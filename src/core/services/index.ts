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
  MarkConversationReadCommand,
  MessageHistory,
  MessageHistoryRequest,
  MessagePinChanged,
  MessageReactionsChanged,
  MessageSearchItem,
  MessageSearchRequest,
  MessageSearchResponse,
  SendMessageCommand,
  SetMessageReactionCommand,
  UpdateConversationSettingsCommand,
  UpdateGroupConversationCommand,
  UpdateMessageCommand,
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

  leave: (id: string) => useHttp().post<ApiEnvelope<null>>(`/conversations/${id}/leave`),

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

  /** Mỗi người chỉ giữ một biểu tượng trên một tin; gửi emoji khác là thay cái cũ. */
  setReaction: (id: string, command: SetMessageReactionCommand) =>
    useHttp().put<ApiEnvelope<MessageReactionsChanged>>(
      `/messages/${id}/reactions`,
      command,
    ),

  removeReaction: (id: string) =>
    useHttp().delete<ApiEnvelope<MessageReactionsChanged>>(`/messages/${id}/reactions`),

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

export const userApi = {
  getPaged: (params: PagedParams) =>
    useHttp().get<PagedResult<AppUser>>("/users", { params: toQuery(params, 30) }),
};
