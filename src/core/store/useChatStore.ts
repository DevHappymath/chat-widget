import { computed, nextTick, ref, watch } from "vue";
import {
  FALLBACK_ALLOWED_EXTENSIONS,
  FALLBACK_MAX_ATTACHMENT_SIZE_BYTES,
} from "../../constants/attachment";
import {
  MAX_FORWARD_TARGETS,
  MAX_MINIMIZED_CONVERSATIONS,
  MAX_REACTIONS_PER_USER,
  MIN_SEARCH_KEYWORD_LENGTH,
} from "../../constants/chat";
import { HubEvent } from "../../constants/hub-event";
import {
  AttachmentKind,
  ConversationType,
  MessageType,
  ChatAudience,
  ParticipantRole,
  type ChatBootstrap,
  type ChatConversation,
  type ChatMessage,
  type ChatParticipant,
  type ConversationAttachment,
  type ConversationCleared,
  type ConversationDissolved,
  type ConversationRead,
  type MessagePinChanged,
  type MessageReaction,
  type MessageReactionsChanged,
  type MessageSearchItem,
  type MessageSummary,
  type Sticker,
  type TypingSignal,
  type UserAvatarChanged,
  type UpdateGroupConversationCommand,
  type UploadedFile,
} from "../../types/chat";
import {
  applyReactionOp,
  isMutedNow,
  keepReactionOrder,
  messagePreview,
  type ReactionOp,
} from "../../utils/chat";
import { extractErrorMessage } from "../../utils/error";
import { onHubEvent, onHubReconnected, sendTyping, startHub } from "../hub";
import { readMinimizedIds, writeMinimizedIds } from "../minimizedSync";
import { conversationApi, messageApi, userApi, widgetApi } from "../services";
import { announceTabMessage } from "../tabAttention";
import { useFitsTwoWindows } from "../viewport";
import { useMessageAlerts } from "./useMessageAlerts";
import { usePresence } from "./usePresence";
import { useStickers } from "./useStickers";
import { useWidgetToast } from "./useWidgetToast";

export type ConversationFilter = "all" | "unread" | "group";

/**
 * Thao tác thả/gỡ đã hiện trên màn hình nhưng server chưa xác nhận, theo từng tin. Bản server
 * trả về (kể cả qua realtime) được phủ lại các thao tác này để chip không nháy về trạng thái cũ.
 */
const pendingReactionOps = new Map<string, ReactionOp[]>();
/** Gửi tuần tự theo từng tin, server mới nhận đúng thứ tự người dùng bấm. */
const reactionQueues = new Map<string, Promise<void>>();

/** Tín hiệu đang gõ không có sự kiện dừng đáng tin, nên tự tắt sau ngần này. */
const TYPING_TTL_MS = 4000;

const PAGE_SIZE = 30;

/** Trần số tin mỗi lần tải lịch sử phía server. */
const MAX_HISTORY_LIMIT = 100;

const SEARCH_PAGE_SIZE = 20;

const MEDIA_PAGE_SIZE = 30;

/**
 * Backend không có endpoint lấy lịch sử quanh một tin, nên nhảy tới kết quả tìm kiếm phải
 * kéo lùi từng trang. Chặn số trang để một tin rất cũ không kéo cả hội thoại về máy.
 */
const MAX_REVEAL_PAGES = 5;

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
  avatarUrl?: string | null;
}

export type WidgetView =
  | "list"
  | "contacts"
  | "new-group"
  | "thread"
  | "info"
  | "add-members"
  | "search"
  | "forward"
  | "media"
  | "join";

/** Mỗi màn chỉ có đúng một màn cha, đủ để nút quay lại không cần giữ ngăn xếp. */
const PARENT_VIEW: Record<WidgetView, WidgetView> = {
  list: "list",
  contacts: "list",
  "new-group": "contacts",
  thread: "list",
  info: "thread",
  "add-members": "info",
  search: "thread",
  forward: "thread",
  media: "info",
  join: "contacts",
};

// ─── State: một bản duy nhất cho cả tab ───────────────────────────────────────

const bootstrap = ref<ChatBootstrap | null>(null);
const isBooting = ref(false);
const bootError = ref<string | null>(null);

const conversations = ref<ChatConversation[]>([]);
const conversationsLoaded = ref(false);
/** Hội thoại đang được tải về vì có tin đến mà chưa có trong danh sách, tránh tải trùng khi tin dồn dập. */
const fetchingConversationIds = new Set<string>();
const messagesByConversation = ref<Record<string, ChatMessage[]>>({});
/** Hội thoại nào còn tin cũ hơn ở phía trên, để ẩn hay hiện nút tải thêm. */
const hasMoreByConversation = ref<Record<string, boolean>>({});

const pendingClientIds = ref<string[]>([]);
const failedClientIds = ref<string[]>([]);
const typingEntries = ref<TypingEntry[]>([]);

/** Hội thoại ở khung chính, khung nằm sát bong bóng và chứa cả danh sách lẫn các màn phụ. */
const activeConversationId = ref<string | null>(null);
/**
 * Hội thoại ở khung thứ hai, đứng bên trái khung chính; chỉ có khi màn hình đủ rộng. Khung này
 * chỉ để đọc và nhắn, muốn xem thông tin hay tìm tin thì hội thoại đổi chỗ sang khung chính.
 */
const sideConversationId = ref<string | null>(null);
const draft = ref<DraftConversation | null>(null);
const isSavingAvatar = ref(false);
/** Tin đang được trả lời, theo hội thoại: hai khung mở cùng lúc thì mỗi ô nhập có tin riêng. */
const replyingByConversation = ref<Record<string, ChatMessage>>({});
const editingMessageId = ref<string | null>(null);
const editingConversationId = ref<string | null>(null);
const editingContent = ref("");
const actionSheetMessage = ref<ChatMessage | null>(null);
const actionSheetAnchor = ref<MessageActionAnchor | null>(null);
/** Bảng thao tác đang hiện bảng biểu tượng đầy đủ thay cho danh sách thao tác. */
const actionSheetShowsEmojiPicker = ref(false);
const highlightedMessageId = ref<string | null>(null);
/**
 * Vạch "Tin chưa đọc" theo hội thoại: đặt ngay trước tin đầu tiên của người khác có sequence lớn
 * hơn mốc lưu ở đây.
 */
const unreadMarkers = ref<Record<string, number>>({});
/** Khung chat của hội thoại đang cuộn sát đáy, tức người dùng đang thấy tin mới nhất. */
const atBottomByConversation = ref<Record<string, boolean>>({});
/**
 * Lần dựng khung chat kế tiếp phải dừng ở vạch tin chưa đọc thay vì xuống đáy. Chỉ bật khi mở
 * hội thoại từ ngoài vào, quay lại từ màn thông tin hay tìm kiếm thì vẫn xuống đáy như cũ.
 */
const revealUnreadByConversation = ref<Record<string, boolean>>({});

const filter = ref<ConversationFilter>("all");
const keyword = ref("");

const pinnedByConversation = ref<Record<string, ChatMessage[]>>({});

const messageSearchKeyword = ref("");
const messageSearchResults = ref<ChatMessage[]>([]);
const messageSearchHasMore = ref(false);
const isSearchingMessages = ref(false);

const globalSearchResults = ref<MessageSearchItem[]>([]);
const globalSearchTotal = ref(0);
const globalSearchPage = ref(1);
const isSearchingGlobal = ref(false);

const forwardingMessage = ref<ChatMessage | null>(null);

const mediaItems = ref<ConversationAttachment[]>([]);
const mediaKind = ref<AttachmentKind | null>(null);
const mediaHasMore = ref(false);
const isLoadingMedia = ref(false);

const isPanelOpen = ref(false);
const view = ref<WidgetView>("list");
/** Bản chụp lúc thu nhỏ, giữ được avatar kể cả khi danh sách đang lọc theo từ khoá. */
const minimizedSnapshots = ref<ChatConversation[]>([]);

const isLoadingConversations = ref(false);
const loadingMessagesByConversation = ref<Record<string, boolean>>({});

/** Số hội thoại chưa đọc theo bootstrap, dùng khi người dùng chưa mở panel lần nào. */
const unreadFallback = ref(0);
/** Số tin chưa đọc theo bootstrap, cũng chỉ dùng khi chưa nạp danh sách. */
const unreadMessagesFallback = ref(0);
/** Hội thoại đã cộng vào badge trong phiên này, để một hội thoại không bị cộng hai lần. */
const countedUnreadIds = new Set<string>();
/** Hội thoại đã hỏi riêng để dựng thẻ báo tin khi chưa nạp danh sách; xoá mỗi lần nắn badge. */
const fetchedConversations = new Map<string, Promise<ChatConversation | null>>();
/** Nhóm chính tab này đang giải tán: tự báo sau khi gọi xong, event quay về không báo lặp. */
const dissolvingIds = new Set<string>();

let isSubscribed = false;
/** Lấy lại tab vừa bắn cả focus lẫn visibilitychange, chỉ cần đồng bộ một lượt. */
let minimizedSyncing: Promise<void> | null = null;
let badgeTimer: ReturnType<typeof setTimeout> | null = null;
/** Lần cuối báo đang soạn, theo hội thoại: gõ ở khung này không được chặn tín hiệu của khung kia. */
const typingSentAt = new Map<string, number>();

/**
 * State chat của widget: bootstrap, danh sách hội thoại, lịch sử tin nhắn và các event
 * realtime. Mọi component trong widget dùng chung đúng một bản này.
 */
export const useChatStore = () => {
  const toast = useWidgetToast();
  const presence = usePresence();
  const messageAlerts = useMessageAlerts();
  const fitsTwoWindows = useFitsTwoWindows();

  const currentUserId = computed(() =>
    (bootstrap.value?.user?.id ?? "").toLowerCase(),
  );

  const currentUserName = computed(
    () => bootstrap.value?.user?.fullName || bootstrap.value?.user?.email || "Bạn",
  );

  const canUseChat = computed(() => bootstrap.value?.canUseChat === true);

  /** Học sinh chỉ nhắn với giáo viên của mình và không tạo nhóm; server cũng chặn, đây chỉ để ẩn nút. */
  const isStudent = computed(() => bootstrap.value?.audience === ChatAudience.Student);

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

  /** Ảnh đại diện theo userId, gom từ thành viên mọi hội thoại đã nạp. */
  const avatarByUserId = computed(() => {
    const map: Record<string, string> = {};
    for (const conversation of conversations.value) {
      for (const participant of conversation.participants) {
        if (participant.avatarUrl) map[participant.userId.toLowerCase()] = participant.avatarUrl;
      }
    }
    return map;
  });

  const avatarOf = (userId?: string | null) =>
    (userId && avatarByUserId.value[userId.toLowerCase()]) || null;

  const myAvatarUrl = computed(() => bootstrap.value?.user?.avatarUrl ?? null);
  const canChangeAvatar = computed(() => bootstrap.value?.user?.canChangeAvatar === true);
  const canCreateSticker = computed(() => bootstrap.value?.user?.canCreateSticker === true);

  const applyAvatarChanged = (payload: UserAvatarChanged) => {
    const userId = payload.userId.toLowerCase();

    for (const conversation of conversations.value) {
      const participant = conversation.participants.find((p) => p.userId.toLowerCase() === userId);
      if (!participant) continue;

      participant.avatarUrl = payload.avatarUrl;
      // Hội thoại 1-1 lấy ảnh của người còn lại làm ảnh hội thoại.
      if (!isGroup(conversation) && userId !== currentUserId.value) {
        conversation.avatarUrl = payload.avatarUrl;
      }
    }

    if (draft.value?.userId.toLowerCase() === userId) {
      draft.value = { ...draft.value, avatarUrl: payload.avatarUrl };
    }

    const me = bootstrap.value?.user;
    if (me && userId === currentUserId.value) {
      bootstrap.value = { ...bootstrap.value!, user: { ...me, avatarUrl: payload.avatarUrl } };
    }
  };

  /** Đổi hoặc gỡ ảnh của chính mình; hub cũng báo lại nhưng tab đang thao tác không phải chờ. */
  const saveMyAvatar = async (file: File | null) => {
    if (isSavingAvatar.value) return false;

    isSavingAvatar.value = true;
    try {
      const res = file ? await userApi.updateMyAvatar(file) : await userApi.removeMyAvatar();
      applyAvatarChanged({ userId: currentUserId.value, avatarUrl: res.data.data.avatarUrl ?? null });
      toast.success(file ? "Đã đổi ảnh đại diện" : "Đã gỡ ảnh đại diện");
      return true;
    } catch (err) {
      toast.error(extractErrorMessage(err));
      return false;
    } finally {
      isSavingAvatar.value = false;
    }
  };

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

  const sideConversation = computed(() =>
    sideConversationId.value ? (findConversation(sideConversationId.value) ?? null) : null,
  );

  const messagesOf = (conversationId: string | null) =>
    conversationId ? (messagesByConversation.value[conversationId] ?? []) : [];

  const myGroupRoleIn = (conversation: ChatConversation | null | undefined) =>
    conversation && isGroup(conversation)
      ? (conversation.participants.find((p) => p.userId.toLowerCase() === currentUserId.value)
          ?.role ?? null)
      : null;

  /** Trưởng hoặc phó nhóm; hội thoại 1-1 không có vai trò này. */
  const canManage = (conversation: ChatConversation | null | undefined) => {
    const role = myGroupRoleIn(conversation);
    return role === ParticipantRole.Admin || role === ParticipantRole.Deputy;
  };

  /** Chỉ trưởng nhóm bổ nhiệm phó nhóm, chuyển chức và giải tán được nhóm. */
  const isGroupLeader = computed(
    () => myGroupRoleIn(activeConversation.value) === ParticipantRole.Admin,
  );

  const canManageGroup = computed(() => canManage(activeConversation.value));

  /** Phó nhóm chỉ xoá được thành viên thường; không ai tự xoá mình, muốn ra thì rời nhóm. */
  const canRemoveMember = (member: ChatParticipant) =>
    canManageGroup.value &&
    member.userId.toLowerCase() !== currentUserId.value &&
    (isGroupLeader.value || member.role === ParticipantRole.Member);

  const canChangeRoleOf = (member: ChatParticipant) =>
    isGroupLeader.value &&
    member.userId.toLowerCase() !== currentUserId.value &&
    member.role !== ParticipantRole.Admin;

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
    (isOwnMessage(message) || canManage(findConversation(message.conversationId)));

  const hasMoreOf = (conversationId: string | null) =>
    conversationId ? (hasMoreByConversation.value[conversationId] ?? false) : false;

  const isLoadingMessagesOf = (conversationId: string | null) =>
    conversationId ? (loadingMessagesByConversation.value[conversationId] ?? false) : false;

  /** Mọi thành viên còn hoạt động đều ghim và gỡ được, kể cả tin của người khác. */
  const canPinMessage = (message: ChatMessage) =>
    !message.isDeleted &&
    message.type !== MessageType.System &&
    !isLocalMessage(message);

  const canForwardMessage = canPinMessage;

  const pinnedOf = (conversationId: string | null) =>
    conversationId ? (pinnedByConversation.value[conversationId] ?? []) : [];

  const isPinned = (message: ChatMessage) => Boolean(message.pinnedAtUtc);

  /** Hội thoại đang chiếm một trong hai khung, kể cả khi khung chính đang ở màn thông tin. */
  const isOpenInWindow = (conversationId: string) =>
    activeConversationId.value === conversationId || sideConversationId.value === conversationId;

  /** Panel đóng thì tin mới vẫn phải tính là chưa đọc, dù hội thoại đó đang được chọn. */
  const isThreadVisible = (conversationId: string) =>
    isPanelOpen.value &&
    ((view.value === "thread" && activeConversationId.value === conversationId) ||
      sideConversationId.value === conversationId);

  const isAtBottom = (conversationId: string | null) =>
    conversationId ? (atBottomByConversation.value[conversationId] ?? true) : true;

  const setThreadAtBottom = (conversationId: string, atBottom: boolean) => {
    atBottomByConversation.value[conversationId] = atBottom;
  };

  const unreadMarkerOf = (conversationId: string | null) =>
    conversationId ? (unreadMarkers.value[conversationId] ?? null) : null;

  /** Đọc rồi xoá cờ, để chỉ lần dựng đầu tiên dừng ở vạch tin chưa đọc. */
  const takeRevealUnread = (conversationId: string) => {
    const reveal = revealUnreadByConversation.value[conversationId] ?? false;
    delete revealUnreadByConversation.value[conversationId];
    return reveal;
  };

  const replyingToOf = (conversationId: string | null) =>
    conversationId ? (replyingByConversation.value[conversationId] ?? null) : null;

  const badgeCount = computed(() =>
    conversationsLoaded.value
      ? conversations.value.filter((c) => c.unreadCount > 0).length
      : unreadFallback.value,
  );

  /** Số hiện trên tiêu đề tab; bong bóng đếm hội thoại còn tab đếm tin như các app chat khác. */
  const unreadMessageCount = computed(() =>
    conversationsLoaded.value
      ? conversations.value.reduce((sum, c) => sum + c.unreadCount, 0)
      : unreadMessagesFallback.value,
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

  const typingNamesOf = (conversation: ChatConversation | null) => {
    if (!conversation) return [];

    const typingIds = new Set(typingUserIdsOf(conversation.id));
    return conversation.participants
      .filter((p) => typingIds.has(p.userId.toLowerCase()))
      .map((p) => p.fullName || p.email || "Ai đó");
  };

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
      unreadMessagesFallback.value = res.data.data.unreadMessages ?? 0;
      countedUnreadIds.clear();
      fetchedConversations.clear();
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
    if (conversationsLoaded.value) return;

    unreadMessagesFallback.value += 1;
    if (countedUnreadIds.has(conversationId)) return;

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
    minimizedSnapshots.value = minimizedSnapshots.value.filter((c) => c.id !== conversationId);
    delete messagesByConversation.value[conversationId];
    delete replyingByConversation.value[conversationId];
    delete unreadMarkers.value[conversationId];

    if (sideConversationId.value === conversationId) sideConversationId.value = null;

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

  /**
   * Thay tin trong thanh ghim, hoặc gỡ hẳn khi tin bị thu hồi: backend gỡ ghim ngay trong
   * DeleteAsync nhưng chỉ phát MessageDeleted, không phát thêm MessagePinChanged.
   */
  const syncPinnedList = (message: ChatMessage) => {
    const list = pinnedByConversation.value[message.conversationId];
    if (!list) return;

    const index = list.findIndex((m) => m.id === message.id);

    if (!message.pinnedAtUtc || message.isDeleted) {
      if (index >= 0) list.splice(index, 1);
      return;
    }

    if (index >= 0) list.splice(index, 1, message);
    else list.unshift(message);
  };

  /** Sửa hoặc thu hồi tin cuối phải kéo theo dòng preview trong danh sách hội thoại. */
  const applyMessageChange = (message: ChatMessage) => {
    upsertMessage(message);
    syncPinnedList(message);

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
        alertIncoming(message);
      }
      // Đoạn chat đã xoá ở phía mình nay có tin mới: danh sách đã nạp thì đưa nó trở lại.
      if (conversationsLoaded.value) fetchMissingConversation(message.conversationId);
      return;
    }

    if (message.sequence > conversation.lastSequence) {
      conversation.lastSequence = message.sequence;
      conversation.lastMessage = message;
      conversation.lastMessageAtUtc = message.createdAtUtc;
    }

    // Tab của site ẩn hoặc đang cuộn lên đọc tin cũ thì chưa thấy tin mới, kể cả khi panel mở
    // đúng hội thoại.
    const isWatching =
      isThreadVisible(conversation.id) && document.visibilityState === "visible";
    const isReading = isWatching && isAtBottom(conversation.id);

    if (isOpenInWindow(conversation.id) && !isReading && !isOwnMessage(message)) {
      markUnreadFrom(conversation);
    }

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

    // Đang cuộn lên trong chính hội thoại này thì đã có nút "tin mới" báo, không bật thêm thẻ nổi.
    if (!isWatching) alertIncoming(message);
  };

  /**
   * Đặt vạch ngay trên loạt tin người dùng chưa thấy. Vạch cũ mà phần dưới nó đã đọc hết rồi
   * thì dời xuống loạt mới, còn đang dở thì giữ để không mất chỗ bắt đầu đọc.
   */
  const markUnreadFrom = (conversation: ChatConversation) => {
    const marker = unreadMarkers.value[conversation.id];
    if (marker !== undefined && marker >= conversation.lastReadSequence) return;

    unreadMarkers.value[conversation.id] = conversation.lastReadSequence;
  };

  /**
   * Chưa mở panel lần nào thì chưa có danh sách hội thoại, phải hỏi riêng hội thoại này để biết
   * tên, ảnh và có đang tắt thông báo không.
   */
  const resolveConversation = async (conversationId: string) => {
    const known = findConversation(conversationId);
    if (known) return known;

    // Nhóm đông tin dồn dập thì mỗi tin một request là thừa, dùng lại lần hỏi trước.
    let pending = fetchedConversations.get(conversationId);
    if (!pending) {
      pending = conversationApi
        .getById(conversationId)
        .then((res) => res.data.data)
        .catch(() => null);
      fetchedConversations.set(conversationId, pending);
    }
    return pending;
  };

  /** Bỏ qua tin hệ thống và hội thoại đang tắt thông báo. Panel đang mở thì không hiện thẻ. */
  const alertIncoming = async (message: ChatMessage) => {
    if (isOwnMessage(message) || message.type === MessageType.System) return;

    const conversation = await resolveConversation(message.conversationId);
    if (conversation && isMutedNow(conversation)) return;
    // Không làm phiền chỉ bỏ phần làm người dùng giật mình; tin và số chưa đọc vẫn về như thường.
    if (presence.isDoNotDisturb.value) return;

    announceTabMessage();
    if (isPanelOpen.value) return;

    const group = conversation ? isGroup(conversation) : false;
    const body = messagePreview(message);
    const shortName = message.senderName?.split(" ").at(-1) ?? "Ai đó";

    messageAlerts.push({
      conversationId: message.conversationId,
      title: conversation ? titleOf(conversation) : (message.senderName ?? "Tin nhắn mới"),
      avatarUrl: conversation?.avatarUrl,
      isGroup: group,
      preview: group ? `${shortName}: ${body}` : body,
    });
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

  const loadMessages = async (
    conversationId: string,
    beforeSequence?: number,
    limit = PAGE_SIZE,
  ) => {
    loadingMessagesByConversation.value[conversationId] = true;
    try {
      const res = await messageApi.getHistory(conversationId, {
        beforeSequence,
        limit,
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
      delete loadingMessagesByConversation.value[conversationId];
    }
  };

  const loadOlderMessages = async (conversationId: string) => {
    if (!hasMoreOf(conversationId) || isLoadingMessagesOf(conversationId)) return;

    const oldest = messagesByConversation.value[conversationId]?.[0]?.sequence;
    if (oldest) await loadMessages(conversationId, oldest);
  };

  const loadPinnedMessages = async (conversationId: string) => {
    try {
      const res = await messageApi.getPinned(conversationId);
      pinnedByConversation.value[conversationId] = res.data.data ?? [];
    } catch (err) {
      console.error("[chat-widget] loadPinnedMessages:", err);
    }
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

  /**
   * Hội thoại đang ở khung chính nhường chỗ cho hội thoại sắp mở: lùi sang khung thứ hai nếu đủ
   * chỗ, khung thứ hai có sẵn hội thoại khác thì cái đó thu thành avatar.
   */
  const makeRoomInMain = (incomingId: string) => {
    const current = activeConversation.value;
    if (!isPanelOpen.value || !current || current.id === incomingId) return;

    if (!fitsTwoWindows.value) {
      keepMinimized(current);
      return;
    }

    const side = sideConversation.value;
    if (side && side.id !== incomingId) leaveSide(side.id, { minimize: true });
    sideConversationId.value = current.id;
  };

  /** Mở hội thoại ở khung chính; đang nằm ở khung thứ hai thì hai khung đổi chỗ cho nhau. */
  const selectConversation = async (id: string) => {
    const wasOpen = isOpenInWindow(id);

    makeRoomInMain(id);
    if (sideConversationId.value === id) sideConversationId.value = null;
    // Đang hiện thành khung thì không còn là avatar thu nhỏ nữa.
    dismissMinimized(id);

    draft.value = null;
    resetMessageSearch();
    resetMedia();
    activeConversationId.value = id;
    view.value = "thread";
    messageAlerts.dismiss(id);

    // Dời từ khung thứ hai sang thì lịch sử, vạch chưa đọc và tin đang trả lời vẫn còn nguyên.
    if (wasOpen) {
      await markRead(id);
      return;
    }

    await prepareThread(id);
  };

  /**
   * Mở hội thoại ở khung thứ hai, bên trái khung chính. Khung đang chat đứng yên chỗ cũ để người
   * dùng không gõ nhầm sang hội thoại vừa mở; khung thứ hai có hội thoại khác thì cái đó thu lại.
   */
  const openBesideMain = async (id: string) => {
    if (sideConversationId.value === id) return;

    if (sideConversationId.value) leaveSide(sideConversationId.value, { minimize: true });
    dismissMinimized(id);
    messageAlerts.dismiss(id);
    sideConversationId.value = id;

    await prepareThread(id);
  };

  /** Hội thoại vừa mở từ ngoài vào: đặt vạch tin chưa đọc, tải lịch sử, tin ghim và đánh dấu đã đọc. */
  const prepareThread = async (id: string) => {
    cancelEditMessage(id);
    cancelReply(id);

    // Chốt mốc trước markRead, vì markRead đẩy lastReadSequence lên ngay.
    const conversation = findConversation(id);
    const unread = conversation
      ? conversation.lastSequence - conversation.lastReadSequence
      : 0;
    if (conversation && unread > 0) unreadMarkers.value[id] = conversation.lastReadSequence;
    else delete unreadMarkers.value[id];
    atBottomByConversation.value[id] = true;
    revealUnreadByConversation.value[id] = true;

    if (!messagesByConversation.value[id]) {
      // Tải dư thêm một trang để vạch tin chưa đọc có tin cũ phía trên làm ngữ cảnh.
      await loadMessages(id, undefined, Math.min(MAX_HISTORY_LIMIT, PAGE_SIZE + unread));
    }

    await Promise.all([markRead(id), loadPinnedMessages(id)]);
  };

  const backToList = () => {
    const conversationId = activeConversationId.value;

    view.value = "list";
    activeConversationId.value = null;
    draft.value = null;
    if (conversationId) {
      cancelReply(conversationId);
      cancelEditMessage(conversationId);
    }
  };

  const goBack = () => {
    if (view.value === "thread") {
      backToList();
      return;
    }

    // Rời màn chuyển tiếp là bỏ luôn tin đang chọn, mở lại từ tin khác không dính tin cũ.
    if (view.value === "forward") forwardingMessage.value = null;
    if (view.value === "search") resetMessageSearch();

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
    if (sideConversationId.value === created.id) sideConversationId.value = null;

    return findConversation(created.id) ?? null;
  };

  // ─── Hành động ──────────────────────────────────────────────────────────────

  /** `conversationId` null là gửi từ bản nháp ở khung chính. */
  const sendMessage = (
    conversationId: string | null,
    content: string,
    attachments: UploadedFile[] = [],
    mentionedUserIds: string[] = [],
    mentionEveryone = false,
  ) => {
    const body = content.trim();
    if (!body && !attachments.length) return Promise.resolve();

    return postMessage(conversationId, {
      body,
      attachments,
      mentionedUserIds,
      mentionEveryone,
      sticker: null,
    });
  };

  const sendSticker = (conversationId: string | null, sticker: Sticker) =>
    postMessage(conversationId, {
      body: "",
      attachments: [],
      mentionedUserIds: [],
      mentionEveryone: false,
      sticker,
    });

  const postMessage = async (
    targetId: string | null,
    {
      body,
      attachments,
      mentionedUserIds,
      mentionEveryone,
      sticker,
    }: {
      body: string;
      attachments: UploadedFile[];
      mentionedUserIds: string[];
      mentionEveryone: boolean;
      sticker: Sticker | null;
    },
  ) => {
    let conversation = targetId ? (findConversation(targetId) ?? null) : null;

    // Đang ở bản nháp: tạo hội thoại rồi mới gửi, người dùng chỉ thấy một hành động.
    if (!conversation && !targetId && draft.value) {
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
    const replyingTo = replyingToOf(conversationId);

    const optimistic: ChatMessage = {
      id: clientMessageId,
      conversationId,
      // Chỉ để xếp cuối danh sách; server trả sequence thật thì bản này bị thay.
      sequence: conversation.lastSequence + 1 + pendingClientIds.value.length,
      senderId: currentUserId.value,
      senderName: currentUserName.value,
      type: sticker ? MessageType.Sticker : messageTypeOf(attachments),
      content: body,
      clientMessageId,
      sticker,
      replyTo: replyingTo ? toMessageSummary(replyingTo) : null,
      // Giữ nguyên kích thước và thumbnail của lượt upload, nếu không bong bóng lạc quan
      // không có khung ảnh rồi giật một nhịp khi tin thật về.
      attachments: attachments.map((file, index) => ({
        id: `${clientMessageId}-${index}`,
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
        width: file.width,
        height: file.height,
        thumbnailUrl: file.thumbnailUrl,
      })),
      reactions: [],
      mentionedUserIds,
      mentionsEveryone: mentionEveryone,
      isDeleted: false,
      createdAtUtc: new Date().toISOString(),
    };

    const replyToMessageId = replyingTo?.id ?? null;
    cancelReply(conversationId);

    upsertMessage(optimistic);
    pendingClientIds.value = [...pendingClientIds.value, clientMessageId];

    // Đã trả lời thì coi như đọc xong phần chưa đọc, vạch chỉ còn làm rối.
    delete unreadMarkers.value[conversationId];

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
        stickerId: sticker?.id ?? null,
        attachments: attachments.map((file) => ({
          fileUrl: file.fileUrl,
          fileName: file.fileName,
        })),
        mentionedUserIds,
        mentionEveryone,
      });
      applyIncomingMessage(res.data.data);
    } catch (err) {
      pendingClientIds.value = pendingClientIds.value.filter(
        (id) => id !== clientMessageId,
      );
      failedClientIds.value = [...failedClientIds.value, clientMessageId];
      // Hay gặp nhất là nhãn dán vừa bị gỡ: lần mở bảng chọn sau phải thấy danh mục mới.
      if (sticker) useStickers().invalidate();
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
   * Chỉ trưởng hoặc phó nhóm gọi được. Backend bỏ qua field để trống nên không xoá được ảnh nhóm
   * bằng đường này, chỉ thay bằng ảnh khác.
   */
  const updateGroupInfo = async (patch: UpdateGroupConversationCommand) => {
    const conversationId = activeConversationId.value;
    if (!conversationId) return;

    const res = await conversationApi.updateGroup(conversationId, patch);
    upsertConversation(res.data.data);
  };

  /** Chỉ trưởng hoặc phó nhóm gọi được; backend chặn lại bằng LoadGroupForManagerAsync. */
  const addParticipants = async (userIds: string[]) => {
    const conversationId = activeConversationId.value;
    if (!conversationId || !userIds.length) return;

    const res = await conversationApi.addParticipants(conversationId, { userIds });
    upsertConversation(res.data.data);
  };

  /** Chỉ trưởng hoặc phó nhóm gọi được; người bị xoá vẫn nhận event để tự gỡ hội thoại. */
  const removeParticipant = async (userId: string) => {
    const conversationId = activeConversationId.value;
    if (!conversationId) return;

    const res = await conversationApi.removeParticipant(conversationId, userId);
    upsertConversation(res.data.data);
  };

  const updateParticipantRole = async (
    userId: string,
    role: typeof ParticipantRole.Deputy | typeof ParticipantRole.Member,
  ) => {
    const conversationId = activeConversationId.value;
    if (!conversationId) return;

    const res = await conversationApi.updateParticipantRole(conversationId, userId, { role });
    upsertConversation(res.data.data);
  };

  const transferLeadership = async (userId: string) => {
    const conversationId = activeConversationId.value;
    if (!conversationId) return;

    const res = await conversationApi.transferLeadership(conversationId, userId);
    upsertConversation(res.data.data);
  };

  /** Gỡ khỏi danh sách ngay, không chờ event ParticipantsChanged quay về. */
  const fetchMissingConversation = async (conversationId: string) => {
    if (fetchingConversationIds.has(conversationId)) return;

    fetchingConversationIds.add(conversationId);
    try {
      const res = await conversationApi.getById(conversationId);
      upsertConversation(res.data.data);
    } catch {
      // Không tải được thì lần nạp lại danh sách kế tiếp sẽ có.
    } finally {
      fetchingConversationIds.delete(conversationId);
    }
  };

  /** Xoá đoạn chat 1-1 ở phía mình và gỡ khỏi danh sách ngay, không chờ event quay về. */
  const clearConversation = async (conversationId: string) => {
    await conversationApi.clear(conversationId);
    removeConversation(conversationId);
  };

  const leaveConversation = async (conversationId: string) => {
    await conversationApi.leave(conversationId);
    removeConversation(conversationId);
  };

  const dissolveConversation = async (conversationId: string) => {
    dissolvingIds.add(conversationId);
    try {
      await conversationApi.dissolve(conversationId);
      removeConversation(conversationId);
    } finally {
      dissolvingIds.delete(conversationId);
    }
  };

  const applyConversationDissolved = (payload: ConversationDissolved) => {
    const conversation = findConversation(payload.conversationId);
    const name = payload.name || (conversation ? titleOf(conversation) : "");

    if (conversation) removeConversation(payload.conversationId);
    else scheduleBadgeRefresh();

    if (payload.dissolvedByUserId.toLowerCase() !== currentUserId.value) {
      toast.info(name ? `Nhóm "${name}" đã bị giải tán` : "Một nhóm của bạn đã bị giải tán");
      return;
    }

    // Tự giải tán ở tab khác thì vẫn báo; còn ở tab này thì màn giải tán đã tự báo rồi.
    if (conversation && !dissolvingIds.has(payload.conversationId)) {
      toast.success(name ? `Đã giải tán nhóm "${name}"` : "Đã giải tán nhóm");
    }
  };

  const createInviteLink = async () => {
    const conversationId = activeConversationId.value;
    if (!conversationId) return;

    const res = await conversationApi.createInviteLink(conversationId);
    upsertConversation(res.data.data);
  };

  const revokeInviteLink = async () => {
    const conversationId = activeConversationId.value;
    if (!conversationId) return;

    const res = await conversationApi.revokeInviteLink(conversationId);
    upsertConversation(res.data.data);
  };

  /** Đã ở trong nhóm thì backend trả luôn hội thoại, nên dán lại liên kết cũ vẫn mở được nhóm. */
  const joinByInvite = async (token: string) => {
    const res = await conversationApi.joinByInvite(token);
    upsertConversation(res.data.data);
    await selectConversation(res.data.data.id);
    return res.data.data;
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

  // ─── Ghim tin nhắn ──────────────────────────────────────────────────────────

  /** Áp payload của event MessagePinChanged: cập nhật cả lịch sử lẫn thanh ghim. */
  const applyPinChanged = (payload: MessagePinChanged) => {
    upsertMessage(payload.message);
    syncPinnedList(payload.message);
  };

  const togglePinMessage = async (message: ChatMessage) => {
    try {
      const res = isPinned(message)
        ? await messageApi.unpin(message.id)
        : await messageApi.pin(message.id);

      applyPinChanged(res.data.data);
      toast.success(res.data.data.isPinned ? "Đã ghim tin nhắn" : "Đã bỏ ghim tin nhắn");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  // ─── Chuyển tiếp tin nhắn ───────────────────────────────────────────────────

  /** Màn chuyển tiếp chỉ có ở khung chính, tin ở khung thứ hai thì hội thoại đổi chỗ sang trước. */
  const openForward = async (message: ChatMessage) => {
    if (activeConversationId.value !== message.conversationId) {
      await selectConversation(message.conversationId);
    }

    forwardingMessage.value = message;
    view.value = "forward";
  };

  /**
   * Mỗi đích một `clientMessageId` riêng: để server tự sinh thì bấm chuyển tiếp hai lần vì
   * mạng chậm sẽ ra hai tin ở mỗi nhóm. Lỗi ném ra ngoài để màn hình giữ nguyên lựa chọn.
   */
  const forwardMessage = async (conversationIds: string[]) => {
    const message = forwardingMessage.value;
    if (!message || !conversationIds.length) return 0;

    const targets = conversationIds
      .slice(0, MAX_FORWARD_TARGETS)
      .map((conversationId) => ({
        conversationId,
        clientMessageId: crypto.randomUUID(),
      }));

    const res = await messageApi.forward(message.id, { targets });

    // Hội thoại đang mở nhận tin qua hub, các hội thoại khác chỉ cần dòng preview mới.
    for (const forwarded of res.data.data ?? []) {
      applyIncomingMessage(forwarded);
    }

    forwardingMessage.value = null;
    return targets.length;
  };

  // ─── Tìm kiếm tin nhắn ──────────────────────────────────────────────────────

  function resetMessageSearch() {
    messageSearchKeyword.value = "";
    messageSearchResults.value = [];
    messageSearchHasMore.value = false;
  }

  const searchMessages = async (beforeSequence?: number) => {
    const conversationId = activeConversationId.value;
    const trimmed = messageSearchKeyword.value.trim();

    if (!conversationId || trimmed.length < MIN_SEARCH_KEYWORD_LENGTH) {
      messageSearchResults.value = [];
      messageSearchHasMore.value = false;
      return;
    }

    isSearchingMessages.value = true;
    try {
      const res = await messageApi.search(conversationId, {
        keyword: trimmed,
        beforeSequence,
        limit: SEARCH_PAGE_SIZE,
      });

      const batch = res.data.data.items ?? [];
      messageSearchResults.value = beforeSequence
        ? [...messageSearchResults.value, ...batch]
        : batch;
      messageSearchHasMore.value = res.data.data.hasMore;
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      isSearchingMessages.value = false;
    }
  };

  const loadMoreSearchResults = () => {
    if (!messageSearchHasMore.value || isSearchingMessages.value) return;

    const oldest = messageSearchResults.value.at(-1)?.sequence;
    if (oldest) searchMessages(oldest);
  };

  const searchAllMessages = async (pageNumber = 1) => {
    const trimmed = keyword.value.trim();

    if (trimmed.length < MIN_SEARCH_KEYWORD_LENGTH) {
      globalSearchResults.value = [];
      globalSearchTotal.value = 0;
      return;
    }

    isSearchingGlobal.value = true;
    try {
      const res = await messageApi.searchAll({
        keyword: trimmed,
        pageNumber,
        pageSize: SEARCH_PAGE_SIZE,
      });

      globalSearchResults.value = res.data.data.items ?? [];
      globalSearchTotal.value = res.data.data.totalCount;
      globalSearchPage.value = pageNumber;
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      isSearchingGlobal.value = false;
    }
  };

  // ─── Kho media ──────────────────────────────────────────────────────────────

  function resetMedia() {
    mediaItems.value = [];
    mediaHasMore.value = false;
  }

  const loadMedia = async (beforeSequence?: number) => {
    const conversationId = activeConversationId.value;
    if (!conversationId || isLoadingMedia.value) return;

    isLoadingMedia.value = true;
    try {
      const res = await messageApi.getAttachments(conversationId, {
        kind: mediaKind.value,
        beforeSequence,
        limit: MEDIA_PAGE_SIZE,
      });

      const batch = res.data.data.items ?? [];
      mediaItems.value = beforeSequence ? [...mediaItems.value, ...batch] : batch;
      mediaHasMore.value = res.data.data.hasMore;
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      isLoadingMedia.value = false;
    }
  };

  const loadMoreMedia = () => {
    if (!mediaHasMore.value) return;

    const oldest = mediaItems.value.at(-1)?.sequence;
    if (oldest) loadMedia(oldest);
  };

  const setMediaKind = async (kind: AttachmentKind | null) => {
    mediaKind.value = kind;
    resetMedia();
    await loadMedia();
  };

  /**
   * Mở đúng tin nhắn từ thanh ghim, kho media hoặc kết quả tìm kiếm. Tin nằm ngoài phần đã
   * tải thì kéo lùi lịch sử tối đa `MAX_REVEAL_PAGES` trang rồi mới cuộn tới.
   */
  const revealMessage = async (conversationId: string, messageId: string) => {
    // Đang mở ở khung thứ hai thì cuộn ngay tại đó, không kéo hội thoại sang khung chính.
    if (activeConversationId.value === conversationId) {
      view.value = "thread";
    } else if (sideConversationId.value !== conversationId) {
      await selectConversation(conversationId);
    }

    const isLoaded = () =>
      messagesByConversation.value[conversationId]?.some((m) => m.id === messageId);

    for (let page = 0; page < MAX_REVEAL_PAGES && !isLoaded(); page++) {
      if (!hasMoreByConversation.value[conversationId]) break;

      const oldest = messagesByConversation.value[conversationId]?.[0]?.sequence;
      if (!oldest) break;

      await loadMessages(conversationId, oldest);
    }

    await nextTick();
    jumpToMessage(messageId);
  };

  /** `emojiPicker`: mở thẳng bảng biểu tượng đầy đủ, dùng cho nút thả thêm dưới tin. */
  const openMessageActions = (
    message: ChatMessage,
    anchor: MessageActionAnchor,
    options?: { emojiPicker?: boolean },
  ) => {
    actionSheetMessage.value = message;
    actionSheetAnchor.value = anchor;
    actionSheetShowsEmojiPicker.value = Boolean(options?.emojiPicker);
  };

  const showActionSheetEmojiPicker = () => {
    actionSheetShowsEmojiPicker.value = true;
  };

  const closeMessageActions = () => {
    actionSheetMessage.value = null;
    actionSheetAnchor.value = null;
    actionSheetShowsEmojiPicker.value = false;
  };

  const startReply = (message: ChatMessage) => {
    replyingByConversation.value[message.conversationId] = message;
    cancelEditMessage(message.conversationId);
  };

  function cancelReply(conversationId: string) {
    delete replyingByConversation.value[conversationId];
  }

  const findMessage = (conversationId: string, messageId: string) =>
    messagesByConversation.value[conversationId]?.find((m) => m.id === messageId);

  const applyReactions = (payload: MessageReactionsChanged) => {
    const message = findMessage(payload.conversationId, payload.messageId);
    if (!message) return;

    const pending = pendingReactionOps.get(payload.messageId) ?? [];
    const merged = pending.reduce(
      (list, op) => applyReactionOp(list, op, currentUserId.value),
      payload.reactions,
    );

    message.reactions = keepReactionOrder(message.reactions, merged);
  };

  const settleReactionOp = (messageId: string, op: ReactionOp) => {
    const rest = (pendingReactionOps.get(messageId) ?? []).filter((o) => o !== op);

    if (rest.length) pendingReactionOps.set(messageId, rest);
    else pendingReactionOps.delete(messageId);
  };

  const reactedByMe = (reaction: MessageReaction) =>
    reaction.userIds.some((id) => id.toLowerCase() === currentUserId.value);

  /** Các biểu tượng mình đang thả trên tin; một người thả được nhiều cái khác nhau. */
  const myReactionsOf = (message: ChatMessage) =>
    message.reactions.filter(reactedByMe).map((r) => r.emoji);

  /**
   * Bấm biểu tượng đã thả là gỡ riêng cái đó; bấm cái chưa có là thả thêm. Chip đổi ngay khi
   * bấm, server từ chối thì trả lại đúng thao tác đó.
   */
  const toggleReaction = (message: ChatMessage, emoji: string) => {
    const mine = myReactionsOf(message);
    const op: ReactionOp = { emoji, add: !mine.includes(emoji) };

    if (op.add && mine.length >= MAX_REACTIONS_PER_USER) {
      toast.warning(`Mỗi tin chỉ thả được tối đa ${MAX_REACTIONS_PER_USER} biểu tượng`);
      return;
    }

    const { id: messageId, conversationId } = message;
    const me = currentUserId.value;

    pendingReactionOps.set(messageId, [...(pendingReactionOps.get(messageId) ?? []), op]);
    message.reactions = applyReactionOp(message.reactions, op, me);

    const send = async () => {
      try {
        const res = op.add
          ? await messageApi.setReaction(messageId, { emoji })
          : await messageApi.removeReaction(messageId, emoji);

        settleReactionOp(messageId, op);
        applyReactions(res.data.data);
      } catch (err) {
        settleReactionOp(messageId, op);

        const target = findMessage(conversationId, messageId);
        if (target) {
          target.reactions = applyReactionOp(target.reactions, { emoji, add: !op.add }, me);
        }

        toast.error(extractErrorMessage(err));
      }
    };

    const queued = (reactionQueues.get(messageId) ?? Promise.resolve()).then(send);
    reactionQueues.set(messageId, queued);
    queued.finally(() => {
      if (reactionQueues.get(messageId) === queued) reactionQueues.delete(messageId);
    });
  };

  const startEditMessage = (message: ChatMessage) => {
    editingMessageId.value = message.id;
    editingConversationId.value = message.conversationId;
    editingContent.value = message.content ?? "";
  };

  /** Truyền `conversationId` thì chỉ huỷ khi tin đang sửa thuộc hội thoại đó, khung kia giữ nguyên. */
  function cancelEditMessage(conversationId?: string) {
    if (conversationId && editingConversationId.value !== conversationId) return;

    editingMessageId.value = null;
    editingConversationId.value = null;
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
  const notifyTyping = (conversationId: string | null) => {
    if (!conversationId) return;

    const now = Date.now();
    if (now - (typingSentAt.get(conversationId) ?? 0) < TYPING_TTL_MS / 2) return;

    typingSentAt.set(conversationId, now);
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
    onHubEvent(HubEvent.MessagePinChanged, (payload: MessagePinChanged) =>
      applyPinChanged(payload),
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

    onHubEvent(HubEvent.ConversationDissolved, (payload: ConversationDissolved) =>
      applyConversationDissolved(payload),
    );

    onHubEvent(HubEvent.ConversationCleared, (payload: ConversationCleared) =>
      removeConversation(payload.conversationId),
    );

    onHubEvent(HubEvent.ConversationRead, (payload: ConversationRead) => {
      const conversation = findConversation(payload.conversationId);

      // Đọc ở tab khác cũng phải tắt badge ở đây, kể cả khi chưa nạp danh sách.
      if (!conversation) {
        if (payload.userId.toLowerCase() === currentUserId.value) {
          scheduleBadgeRefresh();
          messageAlerts.dismiss(payload.conversationId);
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
        // Đã đọc ở tab/thiết bị khác thì thẻ nổi ở đây cũng hết tác dụng.
        if (payload.lastReadSequence >= conversation.lastSequence) {
          messageAlerts.dismiss(conversation.id);
        }
      }
    });

    onHubEvent(HubEvent.UserAvatarChanged, (payload: UserAvatarChanged) =>
      applyAvatarChanged(payload),
    );

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
      for (const conversationId of [activeConversationId.value, sideConversationId.value]) {
        if (!conversationId) continue;
        await loadMessages(conversationId);
        await loadPinnedMessages(conversationId);
      }
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
      unreadMessagesFallback.value = res.data.data.unreadMessages ?? 0;

      if (!res.data.data.canUseChat) return;

      watch(
        () => minimizedSnapshots.value.map((c) => c.id),
        (ids) => writeMinimizedIds(currentUserId.value, ids),
      );
      void syncMinimized();

      // Thu hẹp cửa sổ trình duyệt thì khung thứ hai không còn chỗ, gập nó thành avatar.
      watch(fitsTwoWindows, (fits) => {
        if (!fits && sideConversationId.value) minimizeSide();
      });

      subscribe();
      await startHub(res.data.data.hubPath);
      presence.start(currentUserId.value);
    } catch (err) {
      bootError.value = extractErrorMessage(err);
    } finally {
      isBooting.value = false;
    }
  };

  const openPanel = async () => {
    isPanelOpen.value = true;
    messageAlerts.clear();

    if (!conversationsLoaded.value) await loadConversations();

    // Đóng panel rồi mở lại vẫn ở đúng hội thoại cũ, tin đến trong lúc đóng phải được đánh dấu.
    if (view.value === "thread" && activeConversationId.value) {
      const conversation = findConversation(activeConversationId.value);
      if (conversation && conversation.lastSequence > conversation.lastReadSequence) {
        revealUnreadByConversation.value[conversation.id] = true;
      }
      await markRead(activeConversationId.value);
    }
  };

  const closePanel = () => {
    isPanelOpen.value = false;
    closeMessageActions();
  };

  const togglePanel = () => {
    if (isPanelOpen.value) collapseAll();
    else openPanel();
  };

  // ─── Thu nhỏ hội thoại ──────────────────────────────────────────────────────

  /** Lấy bản mới nhất trong danh sách để số chưa đọc trên avatar chạy theo tin đến. */
  const minimizedConversations = computed(() =>
    minimizedSnapshots.value.map((snapshot) => findConversation(snapshot.id) ?? snapshot),
  );

  // Đã có thì giữ nguyên chỗ, để dãy avatar không nhảy thứ tự mỗi lần chuyển qua lại.
  const keepMinimized = (conversation: ChatConversation) => {
    if (minimizedSnapshots.value.some((c) => c.id === conversation.id)) return;
    minimizedSnapshots.value = [conversation, ...minimizedSnapshots.value].slice(
      0,
      MAX_MINIMIZED_CONVERSATIONS,
    );
  };

  const dismissMinimized = (conversationId: string) => {
    minimizedSnapshots.value = minimizedSnapshots.value.filter((c) => c.id !== conversationId);
  };

  /** Hội thoại rời khung thứ hai; `minimize` thì để lại avatar, không thì đóng hẳn. */
  function leaveSide(conversationId: string, { minimize }: { minimize: boolean }) {
    const conversation = findConversation(conversationId);
    if (minimize && conversation) keepMinimized(conversation);

    if (sideConversationId.value === conversationId) sideConversationId.value = null;
    cancelReply(conversationId);
    cancelEditMessage(conversationId);
  }

  const minimizeSide = () => {
    if (sideConversationId.value) leaveSide(sideConversationId.value, { minimize: true });
  };

  const closeSide = () => {
    if (sideConversationId.value) leaveSide(sideConversationId.value, { minimize: false });
  };

  /** Khung chính vừa trống: hội thoại ở khung thứ hai dời sang thế chỗ, không có thì gập panel. */
  const vacateMain = () => {
    const sideId = sideConversationId.value;
    const hadConversation = Boolean(activeConversationId.value);

    if (hadConversation || sideId) backToList();
    if (sideId) {
      void selectConversation(sideId);
      return;
    }

    closePanel();
  };

  /** Thu hội thoại ở khung chính thành avatar; khung thứ hai còn hội thoại thì nó dời sang. */
  const minimizeConversation = () => {
    if (activeConversation.value) keepMinimized(activeConversation.value);
    vacateMain();
  };

  /** Đóng hẳn khung chính: hội thoại đang mở không để lại avatar. */
  const closeConversation = () => {
    if (activeConversationId.value) dismissMinimized(activeConversationId.value);
    vacateMain();
  };

  /**
   * Gập cả panel về bong bóng, mọi hội thoại đang mở thành avatar. Khung chính thu sau cùng để
   * avatar của nó nằm sát bong bóng nhất.
   */
  const collapseAll = () => {
    minimizeSide();

    const conversation = activeConversation.value;
    closePanel();
    if (!conversation) return;

    keepMinimized(conversation);
    backToList();
  };

  const pullMinimizedFromOtherSites = async () => {
    // Hội thoại site khác thu nhỏ mà ở đây đang mở thành khung thì không thêm avatar trùng.
    const ids = readMinimizedIds(currentUserId.value)?.filter((id) => !isOpenInWindow(id));
    if (!ids) return;
    if (ids.join(",") === minimizedSnapshots.value.map((c) => c.id).join(",")) return;

    // Có nạp danh sách thì avatar mới có số chưa đọc chạy theo tin đến như lúc tự thu nhỏ.
    if (ids.length && !conversationsLoaded.value) await loadConversations();

    const snapshots = await Promise.all(
      ids.map(
        async (id) =>
          findConversation(id) ??
          minimizedSnapshots.value.find((c) => c.id === id) ??
          // Ngoài 50 hội thoại gần nhất thì hỏi riêng; đã rời nhóm thì bỏ khỏi dãy.
          (await conversationApi
            .getById(id)
            .then((res) => res.data.data)
            .catch(() => null)),
      ),
    );

    minimizedSnapshots.value = snapshots.filter((c): c is ChatConversation => Boolean(c));
  };

  /**
   * Lấy dãy hội thoại thu nhỏ mà site khác cùng tên miền vừa lưu, gọi khi widget khởi động và
   * mỗi lần người dùng quay lại tab.
   */
  const syncMinimized = () => {
    if (!canUseChat.value) return Promise.resolve();
    minimizedSyncing ??= pullMinimizedFromOtherSites().finally(() => {
      minimizedSyncing = null;
    });
    return minimizedSyncing;
  };

  /** Khung chính đang chat dở thì mở bên trái nó; khung chính trống thì mở ngay ở đó. */
  const restoreMinimized = async (conversationId: string) => {
    if (!isPanelOpen.value) await openPanel();

    const mainId = activeConversationId.value;
    if (mainId && mainId !== conversationId && fitsTwoWindows.value) {
      await openBesideMain(conversationId);
      return;
    }

    await selectConversation(conversationId);
  };

  return {
    // bootstrap
    bootstrap,
    isBooting,
    bootError,
    canUseChat,
    isStudent,
    currentUserId,
    currentUserName,
    attachmentRule,
    // ảnh đại diện
    avatarOf,
    myAvatarUrl,
    canChangeAvatar,
    canCreateSticker,
    isSavingAvatar,
    saveMyAvatar,
    // panel
    isPanelOpen,
    unreadMarkerOf,
    isAtBottom,
    setThreadAtBottom,
    takeRevealUnread,
    view,
    badgeCount,
    unreadMessageCount,
    openPanel,
    closePanel,
    togglePanel,
    backToList,
    minimizedConversations,
    minimizeConversation,
    closeConversation,
    collapseAll,
    minimizeSide,
    closeSide,
    restoreMinimized,
    dismissMinimized,
    syncMinimized,
    goBack,
    // dữ liệu
    conversations,
    filteredConversations,
    activeConversation,
    activeConversationId,
    sideConversation,
    sideConversationId,
    messagesOf,
    typingNamesOf,
    hasMoreOf,
    draft,
    filter,
    keyword,
    isLoadingConversations,
    isLoadingMessagesOf,
    pendingClientIds,
    failedClientIds,
    editingMessageId,
    editingContent,
    replyingToOf,
    actionSheetMessage,
    actionSheetAnchor,
    actionSheetShowsEmojiPicker,
    highlightedMessageId,
    isGroupLeader,
    canManageGroup,
    pinnedOf,
    messageSearchKeyword,
    messageSearchResults,
    messageSearchHasMore,
    isSearchingMessages,
    globalSearchResults,
    globalSearchTotal,
    globalSearchPage,
    isSearchingGlobal,
    forwardingMessage,
    mediaItems,
    mediaKind,
    mediaHasMore,
    isLoadingMedia,
    // helpers
    isGroup,
    titleOf,
    partnerOf,
    membersOf,
    isOwnMessage,
    canEditMessage,
    canDeleteMessage,
    canRemoveMember,
    canChangeRoleOf,
    canPinMessage,
    canForwardMessage,
    isPinned,
    typingUserIdsOf,
    myReactionsOf,
    reactedByMe,
    isOnline: presence.isOnline,
    statusOf: presence.statusOf,
    statusMessageOf: presence.messageOf,
    myPresence: presence.mine,
    setPresenceStatus: presence.setStatus,
    setPresenceMessage: presence.setMessage,
    // hành động
    init,
    refreshBadge,
    loadConversations,
    loadOlderMessages,
    selectConversation,
    openConversationWith,
    markRead,
    sendMessage,
    sendSticker,
    deleteMessage,
    startReply,
    cancelReply,
    jumpToMessage,
    revealMessage,
    loadPinnedMessages,
    togglePinMessage,
    openForward,
    forwardMessage,
    resetMessageSearch,
    searchMessages,
    loadMoreSearchResults,
    searchAllMessages,
    loadMedia,
    loadMoreMedia,
    setMediaKind,
    openMessageActions,
    showActionSheetEmojiPicker,
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
    updateParticipantRole,
    transferLeadership,
    leaveConversation,
    clearConversation,
    dissolveConversation,
    createInviteLink,
    revokeInviteLink,
    joinByInvite,
  };
};
