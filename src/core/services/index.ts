import type { ApiEnvelope, PagedParams, PagedResult } from "../../types/api";
import type {
  AddParticipantsCommand,
  AppUser,
  ChatBootstrap,
  ChatConversation,
  ChatMessage,
  ConversationAttachmentList,
  ConversationAttachmentRequest,
  ConversationRead,
  CreateDirectConversationCommand,
  CreateGroupConversationCommand,
  ForwardMessageCommand,
  GroupInvitePreview,
  HubTicket,
  MarkConversationReadCommand,
  MessageHistory,
  MessageHistoryRequest,
  MessagePinChanged,
  MessageReactionsChanged,
  MessageSearchItem,
  MessageSearchRequest,
  MessageSearchResponse,
  MyPresence,
  SendMessageCommand,
  SetPresenceMessageCommand,
  SetPresenceStatusCommand,
  SetMessageReactionCommand,
  StickerPack,
  UpdateConversationSettingsCommand,
  UpdateGroupConversationCommand,
  UpdateMessageCommand,
  UpdateParticipantRoleCommand,
  UploadedFile,
} from "../../types/chat";
import { useHttp } from "../http";

const toQuery = (params: PagedParams, defaultPageSize: number) => ({
  Keyword: params.keyword ?? "",
  PageNumber: params.pageNumber ?? 1,
  PageSize: params.pageSize ?? defaultPageSize,
});

export const widgetApi = {
  /** Quyết định hiện hay ẩn bong bóng, gọi một lần trước khi mở kết nối hub. */
  bootstrap: () => useHttp().get<ApiEnvelope<ChatBootstrap>>("/chat/bootstrap"),

  /** Vé chỉ dùng được một lần nên phải xin lại trước mỗi lần kết nối hoặc nối lại hub. */
  hubTicket: () => useHttp().post<ApiEnvelope<HubTicket>>("/chat/hub-ticket"),
};

/**
 * `api/conversations` - chỉ trả hội thoại mà người đang đăng nhập là thành viên còn hoạt động.
 * Backend đã sắp sẵn ghim trước rồi tới tin mới nhất, nhưng widget vẫn sắp lại vì tin đến
 * qua hub làm đổi thứ tự mà không gọi lại API.
 */
export const conversationApi = {
  getPaged: (params: PagedParams) =>
    useHttp().get<PagedResult<ChatConversation>>("/conversations", {
      params: toQuery(params, 20),
    }),

  getById: (id: string) =>
    useHttp().get<ApiEnvelope<ChatConversation>>(`/conversations/${id}`),

  createDirect: (command: CreateDirectConversationCommand) =>
    useHttp().post<ApiEnvelope<ChatConversation>>("/conversations/direct", command),

  createGroup: (command: CreateGroupConversationCommand) =>
    useHttp().post<ApiEnvelope<ChatConversation>>("/conversations/group", command),

  updateGroup: (id: string, command: UpdateGroupConversationCommand) =>
    useHttp().patch<ApiEnvelope<ChatConversation>>(`/conversations/${id}`, command),

  addParticipants: (id: string, command: AddParticipantsCommand) =>
    useHttp().post<ApiEnvelope<ChatConversation>>(`/conversations/${id}/members`, command),

  removeParticipant: (id: string, userId: string) =>
    useHttp().delete<ApiEnvelope<ChatConversation>>(
      `/conversations/${id}/members/${userId}`,
    ),

  /** Chỉ trưởng nhóm gọi được. */
  updateParticipantRole: (id: string, userId: string, command: UpdateParticipantRoleCommand) =>
    useHttp().put<ApiEnvelope<ChatConversation>>(
      `/conversations/${id}/members/${userId}/role`,
      command,
    ),

  /** Chỉ trưởng nhóm gọi được; trưởng nhóm cũ thành phó nhóm. */
  transferLeadership: (id: string, userId: string) =>
    useHttp().post<ApiEnvelope<ChatConversation>>(
      `/conversations/${id}/members/${userId}/transfer-leader`,
    ),

  leave: (id: string) => useHttp().post<ApiEnvelope<null>>(`/conversations/${id}/leave`),

  /** Mọi thành viên cùng rời nhóm; chỉ trưởng nhóm gọi được. */
  dissolve: (id: string) => useHttp().post<ApiEnvelope<null>>(`/conversations/${id}/dissolve`),

  /** Đã bật thì tạo mã mới, liên kết cũ hết hiệu lực ngay. Chỉ trưởng hoặc phó nhóm gọi được. */
  createInviteLink: (id: string) =>
    useHttp().post<ApiEnvelope<ChatConversation>>(`/conversations/${id}/invite`),

  revokeInviteLink: (id: string) =>
    useHttp().delete<ApiEnvelope<ChatConversation>>(`/conversations/${id}/invite`),

  getInvitePreview: (token: string) =>
    useHttp().get<ApiEnvelope<GroupInvitePreview>>(
      `/conversations/invites/${encodeURIComponent(token)}`,
    ),

  joinByInvite: (token: string) =>
    useHttp().post<ApiEnvelope<ChatConversation>>(
      `/conversations/invites/${encodeURIComponent(token)}/join`,
    ),

  updateSettings: (id: string, command: UpdateConversationSettingsCommand) =>
    useHttp().patch<ApiEnvelope<ChatConversation>>(
      `/conversations/${id}/settings`,
      command,
    ),

  markRead: (id: string, command: MarkConversationReadCommand) =>
    useHttp().post<ApiEnvelope<ConversationRead>>(`/conversations/${id}/read`, command),
};

/**
 * Lịch sử tin nhắn phân trang theo `sequence` chứ không theo số trang: tin mới đẩy vào liên tục
 * nên đánh số trang sẽ trôi, còn mốc sequence thì đứng yên.
 */
export const messageApi = {
  getHistory: (conversationId: string, request: MessageHistoryRequest = {}) =>
    useHttp().get<ApiEnvelope<MessageHistory>>(
      `/conversations/${conversationId}/messages`,
      {
        params: {
          BeforeSequence: request.beforeSequence ?? undefined,
          Limit: request.limit ?? 30,
        },
      },
    ),

  send: (conversationId: string, command: SendMessageCommand) =>
    useHttp().post<ApiEnvelope<ChatMessage>>(
      `/conversations/${conversationId}/messages`,
      command,
    ),

  update: (id: string, command: UpdateMessageCommand) =>
    useHttp().patch<ApiEnvelope<ChatMessage>>(`/messages/${id}`, command),

  /** Xoá mềm: server trả về tin đã đánh dấu `isDeleted` để client thay tại chỗ. */
  remove: (id: string) => useHttp().delete<ApiEnvelope<ChatMessage>>(`/messages/${id}`),

  /** Thả thêm một biểu tượng; thả lại cái đã có thì server giữ nguyên. */
  setReaction: (id: string, command: SetMessageReactionCommand) =>
    useHttp().put<ApiEnvelope<MessageReactionsChanged>>(
      `/messages/${id}/reactions`,
      command,
    ),

  /** Gỡ đúng một biểu tượng của mình, các biểu tượng khác đã thả vẫn giữ. */
  removeReaction: (id: string, emoji: string) =>
    useHttp().delete<ApiEnvelope<MessageReactionsChanged>>(`/messages/${id}/reactions`, {
      params: { emoji },
    }),

  /** Tìm trong một hội thoại; keyset theo `sequence` để cuộn liền mạch với lịch sử. */
  search: (conversationId: string, request: MessageSearchRequest) =>
    useHttp().get<ApiEnvelope<MessageSearchResponse>>(
      `/conversations/${conversationId}/messages/search`,
      {
        params: {
          Keyword: request.keyword,
          BeforeSequence: request.beforeSequence ?? undefined,
          Limit: request.limit ?? 20,
        },
      },
    ),

  /**
   * Tìm trên mọi hội thoại mình còn là thành viên. Phân trang offset chứ không keyset:
   * kết quả tìm kiếm là một ảnh chụp, không phải danh sách đang chảy như lịch sử.
   */
  searchAll: (params: PagedParams) =>
    useHttp().get<PagedResult<MessageSearchItem>>("/messages/search", {
      params: {
        Keyword: params.keyword ?? "",
        PageNumber: params.pageNumber ?? 1,
        PageSize: params.pageSize ?? 20,
      },
    }),

  getPinned: (conversationId: string) =>
    useHttp().get<ApiEnvelope<ChatMessage[]>>(
      `/conversations/${conversationId}/pinned-messages`,
    ),

  pin: (id: string) =>
    useHttp().post<ApiEnvelope<MessagePinChanged>>(`/messages/${id}/pin`),

  unpin: (id: string) =>
    useHttp().delete<ApiEnvelope<MessagePinChanged>>(`/messages/${id}/pin`),

  /** Trả về đúng một tin cho mỗi đích, theo thứ tự `targets` đã gửi lên. */
  forward: (id: string, command: ForwardMessageCommand) =>
    useHttp().post<ApiEnvelope<ChatMessage[]>>(`/messages/${id}/forward`, command),

  getAttachments: (conversationId: string, request: ConversationAttachmentRequest = {}) =>
    useHttp().get<ApiEnvelope<ConversationAttachmentList>>(
      `/conversations/${conversationId}/attachments`,
      {
        params: {
          Kind: request.kind ?? undefined,
          BeforeSequence: request.beforeSequence ?? undefined,
          Limit: request.limit ?? 30,
        },
      },
    ),
};

/** Tệp được upload trước, rồi mới gắn `fileUrl` vào tin nhắn. */
export const fileApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return useHttp().post<ApiEnvelope<UploadedFile>>("/files", form);
  },
};

export const stickerApi = {
  /** Danh sách ít đổi, widget chỉ tải một lần cho cả phiên. */
  getPacks: () => useHttp().get<ApiEnvelope<StickerPack[]>>("/stickers"),
};

/** `api/presence/me` - trạng thái và lời nhắn của chính người đang đăng nhập. */
export const presenceApi = {
  getMine: () => useHttp().get<ApiEnvelope<MyPresence>>("/presence/me"),

  setStatus: (command: SetPresenceStatusCommand) =>
    useHttp().put<ApiEnvelope<MyPresence>>("/presence/me/status", command),

  setMessage: (command: SetPresenceMessageCommand) =>
    useHttp().put<ApiEnvelope<MyPresence>>("/presence/me/message", command),
};

export const userApi = {
  getPaged: (params: PagedParams) =>
    useHttp().get<PagedResult<AppUser>>("/users", { params: toQuery(params, 30) }),
};
