import { computed, ref } from "vue";
import {
  FALLBACK_ALLOWED_EXTENSIONS,
  FALLBACK_MAX_ATTACHMENT_SIZE_BYTES,
} from "../../constants/attachment";
import { HubEvent } from "../../constants/hub-event";
import {
  ConversationType,
  MessageType,
  ParticipantRole,
  type ChatBootstrap,
  type ChatConversation,
  type ChatMessage,
  type ChatParticipant,
  type ConversationRead,
  type MessageReactionsChanged,
  type MessageSummary,
  type TypingSignal,
  type UpdateGroupConversationCommand,
  type UploadedFile,
} from "../../types/chat";
import { extractErrorMessage } from "../../utils/error";
import { onHubEvent, onHubReconnected, sendTyping, startHub } from "../hub";
import { conversationApi, messageApi, widgetApi } from "../services";
import { usePresence } from "./usePresence";
import { useWidgetToast } from "./useWidgetToast";

export type ConversationFilter = "all" | "unread" | "group";

/** Tín hiệu đang gõ không có sự kiện dừng đáng tin, nên tự tắt sau ngần này. */
const TYPING_TTL_MS = 4000;

const PAGE_SIZE = 30;

/** Gộp các event dồn dập vào một lần gọi bootstrap để nắn lại số trên bong bóng. */
const BADGE_REFRESH_DELAY_MS = 4000;

interface TypingEntry {
  conversationId: string;
  userId: string;
  expiresAt: number;
}

/** Toạ độ ngón tay lúc ấn giữ, để thanh biểu tượng hiện ngay tại chỗ vừa ấn. */
export interface MessageActionAnchor {
  x: number;
  y: number;
}

/**
 * Người vừa được chọn ở danh bạ nhưng chưa có hội thoại. Giữ ở FE cho tới khi gửi tin đầu
 * tiên, tránh đẻ ra hội thoại rỗng mỗi lần người dùng bấm nhầm vào một cái tên.
 */
export interface DraftConversation {
  userId: string;
  fullName: string;
  email?: string | null;
}

export type WidgetView =
  | "list"
  | "contacts"
  | "new-group"
  | "thread"
  | "info"
  | "add-members";

/** Mỗi màn chỉ có đúng một màn cha, đủ để nút quay lại không cần giữ ngăn xếp. */
const PARENT_VIEW: Record<WidgetView, WidgetView> = {
  list: "list",
  contacts: "list",
  "new-group": "contacts",
  thread: "list",
  info: "thread",
  "add-members": "info",
};

// ─── State: một bản duy nhất cho cả tab ───────────────────────────────────────

const bootstrap = ref<ChatBootstrap | null>(null);
const isBooting = ref(false);
const bootError = ref<string | null>(null);

const conversations = ref<ChatConversation[]>([]);
const conversationsLoaded = ref(false);
const messagesByConversation = ref<Record<string, ChatMessage[]>>({});
/** Hội thoại nào còn tin cũ hơn ở phía trên, để ẩn hay hiện nút tải thêm. */
const hasMoreByConversation = ref<Record<string, boolean>>({});

const pendingClientIds = ref<string[]>([]);
const failedClientIds = ref<string[]>([]);
const typingEntries = ref<TypingEntry[]>([]);

const activeConversationId = ref<string | null>(null);
const draft = ref<DraftConversation | null>(null);
const replyingTo = ref<ChatMessage | null>(null);
const editingMessageId = ref<string | null>(null);
const editingContent = ref("");
const actionSheetMessage = ref<ChatMessage | null>(null);
const actionSheetAnchor = ref<MessageActionAnchor | null>(null);
const highlightedMessageId = ref<string | null>(null);

const filter = ref<ConversationFilter>("all");
const keyword = ref("");

const isPanelOpen = ref(false);
const view = ref<WidgetView>("list");

const isLoadingConversations = ref(false);
const isLoadingMessages = ref(false);

/** Số hội thoại chưa đọc theo bootstrap, dùng khi người dùng chưa mở panel lần nào. */
const unreadFallback = ref(0);
/** Hội thoại đã cộng vào badge trong phiên này, để một hội thoại không bị cộng hai lần. */
const countedUnreadIds = new Set<string>();

let isSubscribed = false;
let badgeTimer: ReturnType<typeof setTimeout> | null = null;
let typingSentAt = 0;

/**
 * State chat của widget: bootstrap, danh sách hội thoại, lịch sử tin nhắn và các event
 * realtime. Mọi component trong widget dùng chung đúng một bản này.
 */
export const useChatStore = () => {
  const toast = useWidgetToast();
  const presence = usePresence();

  const currentUserId = computed(() =>
    (bootstrap.value?.user?.id ?? "").toLowerCase(),
  );

  const currentUserName = computed(
    () => bootstrap.value?.user?.fullName || bootstrap.value?.user?.email || "Bạn",
  );

  const canUseChat = computed(() => bootstrap.value?.canUseChat === true);

  const attachmentRule = computed(
    () =>
      bootstrap.value?.attachment ?? {
        maxSizeBytes: FALLBACK_MAX_ATTACHMENT_SIZE_BYTES,
        allowedExtensions: FALLBACK_ALLOWED_EXTENSIONS,
      },
  );

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const findConversation = (id: string) =>
    conversations.value.find((c) => c.id === id);

  const isGroup = (conversation: ChatConversation) =>
    conversation.type === ConversationType.Group;

  const titleOf = (conversation: ChatConversation) =>
    conversation.name?.trim() || "Hội thoại";

  const membersOf = (conversation: ChatConversation) => conversation.participants;

  /** Người còn lại trong hội thoại 1-1; nhóm thì không có khái niệm này. */
  const partnerOf = (conversation: ChatConversation): ChatParticipant | undefined =>
    isGroup(conversation)
      ? undefined
      : conversation.participants.find(
          (p) => p.userId.toLowerCase() !== currentUserId.value,
        );

  const isOwnMessage = (message: ChatMessage) =>
    message.senderId.toLowerCase() === currentUserId.value;

  const lastActivityAt = (conversation: ChatConversation) =>
    new Date(conversation.lastMessageAtUtc ?? conversation.createdAtUtc).getTime();

  /**
   * Lặp lại đúng thứ tự backend dùng: ghim trước, rồi tới tin mới nhất. Tin đến qua hub và
   * thao tác ghim đều đổi vị trí mà không gọi lại API danh sách.
   */
  const sortedConversations = computed(() =>
    [...conversations.value].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return lastActivityAt(b) - lastActivityAt(a);
    }),
  );

  const filteredConversations = computed(() =>
    sortedConversations.value.filter((conversation) => {
      if (filter.value === "unread" && conversation.unreadCount === 0) return false;
      if (filter.value === "group" && !isGroup(conversation)) return false;
      return true;
    }),
  );

  const activeConversation = computed(
    () => conversations.value.find((c) => c.id === activeConversationId.value) ?? null,
  );

  const activeMessages = computed(() =>
    activeConversationId.value
      ? (messagesByConversation.value[activeConversationId.value] ?? [])
      : [],
  );

  const myParticipant = computed(
    () =>
      activeConversation.value?.participants.find(
        (p) => p.userId.toLowerCase() === currentUserId.value,
      ) ?? null,
  );

  /** Quản trị nhóm được xoá tin của thành viên khác; hội thoại 1-1 không có vai trò này. */
  const isGroupAdmin = computed(() =>
    Boolean(
      activeConversation.value &&
        isGroup(activeConversation.value) &&
        myParticipant.value?.role === ParticipantRole.Admin,
    ),
  );

  /** Tin gửi lạc quan chưa có id thật trên server nên chưa sửa hay xoá được. */
  const isLocalMessage = (message: ChatMessage) =>
    pendingClientIds.value.includes(message.clientMessageId) ||
    failedClientIds.value.includes(message.clientMessageId);

  const canEditMessage = (message: ChatMessage) =>
    isOwnMessage(message) &&
    !message.isDeleted &&
    message.type === MessageType.Text &&
    !isLocalMessage(message);

  const canDeleteMessage = (message: ChatMessage) =>
    !message.isDeleted &&
    message.type !== MessageType.System &&
    !isLocalMessage(message) &&
    (isOwnMessage(message) || isGroupAdmin.value);

  const hasMoreMessages = computed(() =>
    activeConversationId.value
      ? (hasMoreByConversation.value[activeConversationId.value] ?? false)
      : false,
  );

  /** Panel đóng thì tin mới vẫn phải tính là chưa đọc, dù hội thoại đó đang được chọn. */
  const isThreadVisible = computed(() => isPanelOpen.value && view.value === "thread");

  const badgeCount = computed(() =>
    conversationsLoaded.value
      ? conversations.value.filter((c) => c.unreadCount > 0).length
      : unreadFallback.value,
  );

  const purgeExpiredTyping = () => {
    const now = Date.now();
    typingEntries.value = typingEntries.value.filter((e) => e.expiresAt > now);
  };

  const typingUserIdsOf = (conversationId: string) => {
    const now = Date.now();
    return typingEntries.value
      .filter((e) => e.conversationId === conversationId && e.expiresAt > now)
      .map((e) => e.userId);
  };

  const activeTypingNames = computed(() => {
    const conversation = activeConversation.value;
    if (!conversation) return [];

    const typingIds = new Set(typingUserIdsOf(conversation.id));
    return conversation.participants
      .filter((p) => typingIds.has(p.userId.toLowerCase()))
      .map((p) => p.fullName || p.email || "Ai đó");
  });

  // ─── Badge ──────────────────────────────────────────────────────────────────

  /**
   * Nắn lại số chưa đọc bằng bootstrap. Cần vì thu hồi tin không làm giảm badge và vì event
   * phát ra trong lúc mất mạng thì mất luôn.
   */
  const refreshBadge = async () => {
    try {
      const res = await widgetApi.bootstrap();
      bootstrap.value = res.data.data;
      unreadFallback.value = res.data.data.unreadConversations;
      countedUnreadIds.clear();
    } catch {
      // Badge lệch một nhịp không đáng để làm phiền người dùng.
    }
  };

  const scheduleBadgeRefresh = () => {
    if (badgeTimer) clearTimeout(badgeTimer);
    badgeTimer = setTimeout(refreshBadge, BADGE_REFRESH_DELAY_MS);
  };

  /** Cộng tạm khi chưa nạp danh sách; con số đúng đến ở lần nắn lại kế tiếp. */
  const bumpBadge = (conversationId: string) => {
    if (conversationsLoaded.value || countedUnreadIds.has(conversationId)) return;

    countedUnreadIds.add(conversationId);
    unreadFallback.value += 1;
  };

  // ─── Cập nhật store ─────────────────────────────────────────────────────────

  const upsertConversation = (conversation: ChatConversation) => {
    const index = conversations.value.findIndex((c) => c.id === conversation.id);

    // Vị trí do sortedConversations quyết định nên chỉ cần thay hoặc thêm vào cuối.
    if (index >= 0) conversations.value.splice(index, 1, conversation);
    else conversations.value.push(conversation);
  };

  const removeConversation = (conversationId: string) => {
    conversations.value = conversations.value.filter((c) => c.id !== conversationId);
    delete messagesByConversation.value[conversationId];

    if (activeConversationId.value === conversationId) {
      activeConversationId.value = null;
      view.value = "list";
    }
  };

  /** Tin có ảnh hiển thị khác tin có tài liệu, nên kiểu tin bám theo tệp đầu tiên. */
  const messageTypeOf = (attachments: UploadedFile[]) => {
    if (!attachments.length) return MessageType.Text;
    return attachments.some((file) => file.isImage)
      ? MessageType.Image
      : MessageType.File;
  };

  const toMessageSummary = (message: ChatMessage): MessageSummary => ({
    id: message.id,
    sequence: message.sequence,
    senderId: message.senderId,
    senderName: message.senderName,
    type: message.type,
    content: message.content,
    isDeleted: message.isDeleted,
  });

  const upsertMessage = (message: ChatMessage) => {
    const list = messagesByConversation.value[message.conversationId];

    // Chưa mở hội thoại này lần nào thì bỏ qua: lịch sử sẽ được tải đủ khi người dùng mở.
    if (!list) return;

    const index = list.findIndex(
      (m) => m.id === message.id || m.clientMessageId === message.clientMessageId,
    );

    if (index >= 0) {
      list.splice(index, 1, message);
    } else {
      const insertAt = list.findIndex((m) => m.sequence > message.sequence);
      list.splice(insertAt === -1 ? list.length : insertAt, 0, message);
    }

    pendingClientIds.value = pendingClientIds.value.filter(
      (id) => id !== message.clientMessageId,
    );
  };

  /** Sửa hoặc thu hồi tin cuối phải kéo theo dòng preview trong danh sách hội thoại. */
  const applyMessageChange = (message: ChatMessage) => {
    upsertMessage(message);

    const conversation = findConversation(message.conversationId);
    if (conversation?.lastMessage?.id === message.id) {
      conversation.lastMessage = message;
    }
  };

  /**
   * Tin mới chỉ được đẩy qua hub dưới dạng MessageResponse, hội thoại không kèm theo, nên
   * phải tự cập nhật dòng preview và số chưa đọc.
   */
  const applyIncomingMessage = (message: ChatMessage) => {
    upsertMessage(message);

    const conversation = findConversation(message.conversationId);

    if (!conversation) {
      if (!isOwnMessage(message)) {
        bumpBadge(message.conversationId);
        scheduleBadgeRefresh();
      }
      return;
    }

    if (message.sequence > conversation.lastSequence) {
      conversation.lastSequence = message.sequence;
      conversation.lastMessage = message;
      conversation.lastMessageAtUtc = message.createdAtUtc;
    }

    const isReading =
      isThreadVisible.value && activeConversationId.value === conversation.id;

    if (isReading || isOwnMessage(message)) {
      // Đang mở đúng hội thoại thì báo server luôn, nếu không badge ở tab khác cứ sáng mãi.
      if (isReading && !isOwnMessage(message)) {
        conversationApi
          .markRead(conversation.id, { upToSequence: message.sequence })
          .catch(() => undefined);
      }

      conversation.lastReadSequence = Math.max(
        conversation.lastReadSequence,
        message.sequence,
      );
      conversation.unreadCount = 0;
    } else {
      conversation.unreadCount = Math.max(
        0,
        conversation.lastSequence - conversation.lastReadSequence,
      );
    }

    // Người gửi vừa gõ xong thì không còn "đang gõ" nữa.
    typingEntries.value = typingEntries.value.filter(
      (e) =>
        e.conversationId !== message.conversationId ||
        e.userId !== message.senderId.toLowerCase(),
    );
  };

  // ─── Nạp dữ liệu ────────────────────────────────────────────────────────────

  const loadConversations = async () => {
    isLoadingConversations.value = true;
    try {
      const res = await conversationApi.getPaged({
        keyword: keyword.value,
        pageNumber: 1,
        pageSize: 50,
      });
      conversations.value = res.data.data.items ?? [];
      conversationsLoaded.value = true;
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      isLoadingConversations.value = false;
    }
  };

  const loadMessages = async (conversationId: string, beforeSequence?: number) => {
    isLoadingMessages.value = true;
    try {
      const res = await messageApi.getHistory(conversationId, {
        beforeSequence,
        limit: PAGE_SIZE,
      });

      // Server trả sequence giảm dần; UI dựng từ cũ đến mới nên phải đảo lại.
      const batch = [...(res.data.data.items ?? [])].reverse();
      const existing = messagesByConversation.value[conversationId] ?? [];

      messagesByConversation.value[conversationId] = beforeSequence
        ? [...batch, ...existing]
        : batch;

      hasMoreByConversation.value[conversationId] = res.data.data.hasMore;
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      isLoadingMessages.value = false;
    }
  };

  const loadOlderMessages = async () => {
    const conversationId = activeConversationId.value;
    if (!conversationId || !hasMoreMessages.value || isLoadingMessages.value) return;

    const oldest = messagesByConversation.value[conversationId]?.[0]?.sequence;
    if (oldest) await loadMessages(conversationId, oldest);
  };

  const markRead = async (conversationId: string) => {
    const conversation = findConversation(conversationId);
    if (!conversation || conversation.lastSequence <= conversation.lastReadSequence) {
      return;
    }

    const upToSequence = conversation.lastSequence;

    // Xoá badge ngay để bấm vào là thấy phản hồi, event ConversationRead sẽ chốt lại sau.
    conversation.lastReadSequence = upToSequence;
    conversation.unreadCount = 0;

    try {
      await conversationApi.markRead(conversationId, { upToSequence });
    } catch (err) {
      console.error("[chat-widget] markRead:", err);
    }
  };

  // ─── Điều hướng trong panel ─────────────────────────────────────────────────

  const selectConversation = async (id: string) => {
    draft.value = null;
    cancelEditMessage();
    cancelReply();
    activeConversationId.value = id;
    view.value = "thread";

    if (!messagesByConversation.value[id]) {
      await loadMessages(id);
    }

    await markRead(id);
  };

  const backToList = () => {
    view.value = "list";
    activeConversationId.value = null;
    draft.value = null;
    cancelReply();
    cancelEditMessage();
  };

  const goBack = () => {
    if (view.value === "thread") {
      backToList();
      return;
    }

    view.value = PARENT_VIEW[view.value];
  };

  const findDirectWith = (userId: string) =>
    conversations.value.find(
      (c) =>
        c.type === ConversationType.Direct &&
        c.participants.some((p) => p.userId.toLowerCase() === userId.toLowerCase()),
    );

  /**
   * Mở khung chat với một người: đã có hội thoại thì mở luôn, chưa có thì chỉ mở bản nháp.
   * @returns id hội thoại nếu mở được cái có sẵn, null nếu đang ở trạng thái nháp.
   */
  const openConversationWith = async (
    person: DraftConversation,
  ): Promise<string | null> => {
    const existing = findDirectWith(person.userId);

    if (existing) {
      await selectConversation(existing.id);
      return existing.id;
    }

    activeConversationId.value = null;
    draft.value = person;
    view.value = "thread";
    return null;
  };

  /** Đổi bản nháp thành hội thoại thật. Backend tự dùng lại hội thoại cũ nếu đã tồn tại. */
  const materializeDraft = async () => {
    if (!draft.value) return null;

    const res = await conversationApi.createDirect({
      targetUserId: draft.value.userId,
    });
    const created = res.data.data;
    upsertConversation(created);

    // Hội thoại cũ vẫn còn nguyên lịch sử, phải nạp về chứ không khởi tạo rỗng.
    if (created.lastSequence > 0) {
      await loadMessages(created.id);
    } else if (!messagesByConversation.value[created.id]) {
      messagesByConversation.value[created.id] = [];
    }

    draft.value = null;
    activeConversationId.value = created.id;

    return findConversation(created.id) ?? null;
  };

  // ─── Hành động ──────────────────────────────────────────────────────────────

  const sendMessage = async (
    content: string,
    attachments: UploadedFile[] = [],
    mentionedUserIds: string[] = [],
  ) => {
    const body = content.trim();
    if (!body && !attachments.length) return;

    let conversation = activeConversation.value;

    // Đang ở bản nháp: tạo hội thoại rồi mới gửi, người dùng chỉ thấy một hành động.
    if (!conversation && draft.value) {
      try {
        conversation = await materializeDraft();
      } catch (err) {
        toast.error(extractErrorMessage(err));
        return;
      }
    }

    if (!conversation) return;

    const clientMessageId = crypto.randomUUID();
    const conversationId = conversation.id;

    const optimistic: ChatMessage = {
      id: clientMessageId,
      conversationId,
      // Chỉ để xếp cuối danh sách; server trả sequence thật thì bản này bị thay.
      sequence: conversation.lastSequence + 1 + pendingClientIds.value.length,
      senderId: currentUserId.value,
      senderName: currentUserName.value,
      type: messageTypeOf(attachments),
      content: body,
      clientMessageId,
      replyTo: replyingTo.value ? toMessageSummary(replyingTo.value) : null,
      attachments: attachments.map((file, index) => ({
        id: `${clientMessageId}-${index}`,
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
      })),
      reactions: [],
      mentionedUserIds,
      isDeleted: false,
      createdAtUtc: new Date().toISOString(),
    };

    const replyToMessageId = replyingTo.value?.id ?? null;
    replyingTo.value = null;

    upsertMessage(optimistic);
    pendingClientIds.value = [...pendingClientIds.value, clientMessageId];

    // Đẩy hội thoại lên đầu ngay, không chờ server. Cố tình không đụng lastSequence: sequence
    // của bản lạc quan là số bịa, ghi vào sẽ chặn mất tin thật khi nó về.
    conversation.lastMessage = optimistic;
    conversation.lastMessageAtUtc = optimistic.createdAtUtc;

    try {
      const res = await messageApi.send(conversationId, {
        clientMessageId,
        type: optimistic.type,
        content: body || null,
        replyToMessageId,
        attachments: attachments.map((file) => ({
          fileUrl: file.fileUrl,
          fileName: file.fileName,
        })),
        mentionedUserIds,
      });
      applyIncomingMessage(res.data.data);
    } catch (err) {
      pendingClientIds.value = pendingClientIds.value.filter(
        (id) => id !== clientMessageId,
      );
      failedClientIds.value = [...failedClientIds.value, clientMessageId];
      toast.error(extractErrorMessage(err));
    }
  };

  const updateSettings = async (
    conversationId: string,
    patch: { isPinned?: boolean; isMuted?: boolean },
  ) => {
    try {
      const res = await conversationApi.updateSettings(conversationId, patch);
      upsertConversation(res.data.data);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const togglePin = (conversationId: string) => {
    const conversation = findConversation(conversationId);
    if (conversation) {
      updateSettings(conversationId, { isPinned: !conversation.isPinned });
    }
  };

  const toggleMute = (conversationId: string) => {
    const conversation = findConversation(conversationId);
    if (conversation) {
      updateSettings(conversationId, { isMuted: !conversation.isMuted });
    }
  };

  // ─── Nhóm ───────────────────────────────────────────────────────────────────
  // Các hàm dưới đây để lỗi ném ra ngoài: màn hình gọi tới cần biết thất bại để giữ nguyên
  // form và báo đúng thông điệp của backend.

  const createGroupConversation = async (name: string, memberIds: string[]) => {
    const res = await conversationApi.createGroup({ name, memberIds });
    upsertConversation(res.data.data);
    await selectConversation(res.data.data.id);

    return res.data.data.id;
  };

  /**
   * Chỉ quản trị nhóm gọi được. Backend bỏ qua field để trống nên không xoá được ảnh nhóm
   * bằng đường này, chỉ thay bằng ảnh khác.
   */
  const updateGroupInfo = async (patch: UpdateGroupConversationCommand) => {
    const conversationId = activeConversationId.value;
    if (!conversationId) return;

    const res = await conversationApi.updateGroup(conversationId, patch);
    upsertConversation(res.data.data);
  };

  /** Chỉ quản trị nhóm gọi được; backend chặn lại bằng LoadGroupForAdminAsync. */
  const addParticipants = async (userIds: string[]) => {
    const conversationId = activeConversationId.value;
    if (!conversationId || !userIds.length) return;

    const res = await conversationApi.addParticipants(conversationId, { userIds });
    upsertConversation(res.data.data);
  };

  /** Chỉ quản trị nhóm gọi được; người bị xoá vẫn nhận event để tự gỡ hội thoại. */
  const removeParticipant = async (userId: string) => {
    const conversationId = activeConversationId.value;
    if (!conversationId) return;

    const res = await conversationApi.removeParticipant(conversationId, userId);
    upsertConversation(res.data.data);
  };

  /** Gỡ khỏi danh sách ngay, không chờ event ParticipantsChanged quay về. */
  const leaveConversation = async (conversationId: string) => {
    await conversationApi.leave(conversationId);
    removeConversation(conversationId);
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const res = await messageApi.remove(messageId);
      applyMessageChange(res.data.data);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  /**
   * Nhảy tới tin gốc khi bấm khối trích dẫn. Tin cũ hơn phần đã tải thì không có trong DOM,
   * lúc đó chỉ báo cho người dùng biết phải tải thêm.
   */
  const jumpToMessage = (messageId: string) => {
    const element = document.querySelector(
      `[data-gdtd-message-id="${messageId}"]`,
    );

    if (!element) {
      toast.info("Tin nhắn này nằm ngoài phần đã tải, hãy tải thêm tin cũ hơn");
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    highlightedMessageId.value = messageId;

    setTimeout(() => {
      if (highlightedMessageId.value === messageId) highlightedMessageId.value = null;
    }, 1600);
  };

  const openMessageActions = (
    message: ChatMessage,
    anchor: MessageActionAnchor,
  ) => {
    actionSheetMessage.value = message;
    actionSheetAnchor.value = anchor;
  };

  const closeMessageActions = () => {
    actionSheetMessage.value = null;
    actionSheetAnchor.value = null;
  };

  const startReply = (message: ChatMessage) => {
    replyingTo.value = message;
    cancelEditMessage();
  };

  function cancelReply() {
    replyingTo.value = null;
  }

  const applyReactions = (payload: MessageReactionsChanged) => {
    const message = messagesByConversation.value[payload.conversationId]?.find(
      (m) => m.id === payload.messageId,
    );

    if (message) message.reactions = payload.reactions;
  };

  /** Biểu tượng mình đang thả trên tin; backend chỉ cho mỗi người giữ một cái. */
  const myReactionOf = (message: ChatMessage) =>
    message.reactions.find((r) =>
      r.userIds.some((id) => id.toLowerCase() === currentUserId.value),
    )?.emoji ?? null;

  /** Bấm lại đúng biểu tượng đang thả là gỡ; bấm cái khác là đổi sang cái đó. */
  const toggleReaction = async (message: ChatMessage, emoji: string) => {
    try {
      const res =
        myReactionOf(message) === emoji
          ? await messageApi.removeReaction(message.id)
          : await messageApi.setReaction(message.id, { emoji });

      applyReactions(res.data.data);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const startEditMessage = (message: ChatMessage) => {
    editingMessageId.value = message.id;
    editingContent.value = message.content ?? "";
  };

  function cancelEditMessage() {
    editingMessageId.value = null;
    editingContent.value = "";
  }

  const saveEditMessage = async () => {
    const messageId = editingMessageId.value;
    const content = editingContent.value.trim();
    if (!messageId || !content) return;

    try {
      const res = await messageApi.update(messageId, { content });
      applyMessageChange(res.data.data);
      cancelEditMessage();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  /** Gửi tối đa 1 tín hiệu mỗi nửa TTL: đủ để bên kia không thấy nhấp nháy, không spam hub. */
  const notifyTyping = () => {
    const conversationId = activeConversationId.value;
    if (!conversationId) return;

    const now = Date.now();
    if (now - typingSentAt < TYPING_TTL_MS / 2) return;

    typingSentAt = now;
    sendTyping(conversationId, true);
  };

  // ─── Realtime ───────────────────────────────────────────────────────────────

  const subscribe = () => {
    if (isSubscribed) return;
    isSubscribed = true;

    onHubEvent(HubEvent.MessageReceived, (payload: ChatMessage) =>
      applyIncomingMessage(payload),
    );
    onHubEvent(HubEvent.MessageUpdated, (payload: ChatMessage) =>
      applyMessageChange(payload),
    );
    onHubEvent(HubEvent.MessageDeleted, (payload: ChatMessage) =>
      applyMessageChange(payload),
    );

    onHubEvent(HubEvent.ReactionChanged, (payload: MessageReactionsChanged) =>
      applyReactions(payload),
    );

    onHubEvent(HubEvent.ConversationCreated, (payload: ChatConversation) =>
      upsertConversation(payload),
    );
    onHubEvent(HubEvent.ConversationUpdated, (payload: ChatConversation) =>
      upsertConversation(payload),
    );

    onHubEvent(HubEvent.ParticipantsChanged, (payload: ChatConversation) => {
      // Bị xoá hoặc tự rời nhóm: server vẫn gửi payload nhưng mình không còn trong danh sách.
      const stillMember = payload.participants.some(
        (p) => p.userId.toLowerCase() === currentUserId.value,
      );
      if (stillMember) upsertConversation(payload);
      else removeConversation(payload.id);
    });

    onHubEvent(HubEvent.ConversationRead, (payload: ConversationRead) => {
      const conversation = findConversation(payload.conversationId);

      // Đọc ở tab khác cũng phải tắt badge ở đây, kể cả khi chưa nạp danh sách.
      if (!conversation) {
        if (payload.userId.toLowerCase() === currentUserId.value) {
          scheduleBadgeRefresh();
        }
        return;
      }

      const participant = conversation.participants.find(
        (p) => p.userId.toLowerCase() === payload.userId.toLowerCase(),
      );
      if (participant) participant.lastReadSequence = payload.lastReadSequence;

      if (payload.userId.toLowerCase() === currentUserId.value) {
        conversation.lastReadSequence = payload.lastReadSequence;
        conversation.unreadCount = Math.max(
          0,
          conversation.lastSequence - payload.lastReadSequence,
        );
      }
    });

    onHubEvent(HubEvent.UserTyping, (payload: TypingSignal) => {
      const userId = payload.userId.toLowerCase();
      const others = typingEntries.value.filter(
        (e) => e.conversationId !== payload.conversationId || e.userId !== userId,
      );

      if (!payload.isTyping) {
        typingEntries.value = others;
        return;
      }

      typingEntries.value = [
        ...others,
        {
          conversationId: payload.conversationId,
          userId,
          expiresAt: Date.now() + TYPING_TTL_MS,
        },
      ];

      // Hết hạn phải tự dọn: computed đọc Date.now() không chạy lại khi thời gian trôi.
      setTimeout(purgeExpiredTyping, TYPING_TTL_MS + 100);
    });

    // Trong lúc rớt mạng event bị mất, nối lại phải nạp lại những gì đang hiển thị.
    onHubReconnected(async () => {
      await refreshBadge();
      if (conversationsLoaded.value) await loadConversations();
      if (activeConversationId.value) await loadMessages(activeConversationId.value);
    });
  };

  // ─── Vòng đời ───────────────────────────────────────────────────────────────

  /**
   * Gọi một lần lúc widget được mount: hỏi bootstrap, nếu được phép dùng chat thì mở hub.
   * Người không phải nhân sự nhận `canUseChat: false` và widget ẩn hẳn.
   */
  const init = async () => {
    if (isBooting.value || bootstrap.value) return;

    isBooting.value = true;
    bootError.value = null;

    try {
      const res = await widgetApi.bootstrap();
      bootstrap.value = res.data.data;
      unreadFallback.value = res.data.data.unreadConversations;

      if (!res.data.data.canUseChat) return;

      subscribe();
      await startHub(res.data.data.hubPath);
      presence.start();
    } catch (err) {
      bootError.value = extractErrorMessage(err);
    } finally {
      isBooting.value = false;
    }
  };

  const openPanel = async () => {
    isPanelOpen.value = true;

    if (!conversationsLoaded.value) await loadConversations();

    // Đóng panel rồi mở lại vẫn ở đúng hội thoại cũ, tin đến trong lúc đóng phải được đánh dấu.
    if (view.value === "thread" && activeConversationId.value) {
      await markRead(activeConversationId.value);
    }
  };

  const closePanel = () => {
    isPanelOpen.value = false;
    closeMessageActions();
  };

  const togglePanel = () => {
    if (isPanelOpen.value) closePanel();
    else openPanel();
  };

  return {
    // bootstrap
    bootstrap,
    isBooting,
    bootError,
    canUseChat,
    currentUserId,
    currentUserName,
    attachmentRule,
    // panel
    isPanelOpen,
    view,
    badgeCount,
    openPanel,
    closePanel,
    togglePanel,
    backToList,
    goBack,
    // dữ liệu
    conversations,
    filteredConversations,
    activeConversation,
    activeConversationId,
    activeMessages,
    activeTypingNames,
    hasMoreMessages,
    draft,
    filter,
    keyword,
    isLoadingConversations,
    isLoadingMessages,
    pendingClientIds,
    failedClientIds,
    editingMessageId,
    editingContent,
    replyingTo,
    actionSheetMessage,
    actionSheetAnchor,
    highlightedMessageId,
    isGroupAdmin,
    // helpers
    isGroup,
    titleOf,
    partnerOf,
    membersOf,
    isOwnMessage,
    canEditMessage,
    canDeleteMessage,
    typingUserIdsOf,
    myReactionOf,
    isOnline: presence.isOnline,
    // hành động
    init,
    refreshBadge,
    loadConversations,
    loadOlderMessages,
    selectConversation,
    openConversationWith,
    markRead,
    sendMessage,
    deleteMessage,
    startReply,
    cancelReply,
    jumpToMessage,
    openMessageActions,
    closeMessageActions,
    toggleReaction,
    startEditMessage,
    cancelEditMessage,
    saveEditMessage,
    togglePin,
    toggleMute,
    notifyTyping,
    createGroupConversation,
    updateGroupInfo,
    addParticipants,
    removeParticipant,
    leaveConversation,
  };
};
