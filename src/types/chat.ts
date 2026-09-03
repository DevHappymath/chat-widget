// Ánh xạ 1-1 với DTO của CHAT_GDTD.Application. Backend không đăng ký JsonStringEnumConverter
// nên mọi enum đi qua JSON dưới dạng số - giữ nguyên giá trị số ở đây để so sánh không lệch.

export const ConversationType = {
  Direct: 1,
  Group: 2,
} as const;
export type ConversationType =
  (typeof ConversationType)[keyof typeof ConversationType];

export const MessageType = {
  Text: 1,
  Image: 2,
  File: 3,
  /** Tin do server sinh khi nhóm đổi tên, thêm hoặc bớt thành viên. */
  System: 4,
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const ParticipantRole = {
  Member: 1,
  Admin: 2,
} as const;
export type ParticipantRole =
  (typeof ParticipantRole)[keyof typeof ParticipantRole];

// ─── Responses ────────────────────────────────────────────────────────────────

export interface ChatParticipant {
  userId: string;
  fullName?: string | null;
  email?: string | null;
  employeeCode?: string | null;
  role: ParticipantRole;
  /** Ảnh chụp tại thời điểm server dựng response; realtime cập nhật qua PresenceChanged. */
  isOnline: boolean;
  lastReadSequence: number;
  joinedAtUtc: string;
}

export interface MessageAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  contentType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  thumbnailUrl?: string | null;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  userIds: string[];
}

/** Payload của event ReactionChanged: chỉ hàng biểu tượng, không kèm cả tin nhắn. */
export interface MessageReactionsChanged {
  conversationId: string;
  messageId: string;
  reactions: MessageReaction[];
}

/** Kết quả `POST /api/files`, dùng làm nguồn cho `MessageAttachmentCommand`. */
export interface UploadedFile {
  fileName: string;
  fileUrl: string;
  contentType: string;
  sizeBytes: number;
  isImage: boolean;
}

/** Bản rút gọn của tin được trả lời, chỉ đủ dựng khối trích dẫn. */
export interface MessageSummary {
  id: string;
  sequence: number;
  senderId: string;
  senderName?: string | null;
  type: MessageType;
  content?: string | null;
  isDeleted: boolean;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  /** Số thứ tự tăng dần trong hội thoại, dùng cho phân trang và mốc đã đọc. */
  sequence: number;
  senderId: string;
  senderName?: string | null;
  type: MessageType;
  content?: string | null;
  clientMessageId: string;
  replyTo?: MessageSummary | null;
  attachments: MessageAttachment[];
  reactions: MessageReaction[];
  mentionedUserIds: string[];
  isDeleted: boolean;
  deletedAtUtc?: string | null;
  editedAtUtc?: string | null;
  createdAtUtc: string;
}

export interface MessageHistory {
  /** Server trả Sequence giảm dần - tin mới nhất đứng đầu. */
  items: ChatMessage[];
  hasMore: boolean;
  oldestSequence?: number | null;
}

export interface ChatConversation {
  id: string;
  type: ConversationType;
  /** Hội thoại 1-1 không có tên riêng: server trả sẵn tên người còn lại. */
  name?: string | null;
  avatarUrl?: string | null;
  lastSequence: number;
  lastMessage?: ChatMessage | null;
  lastMessageAtUtc?: string | null;
  lastReadSequence: number;
  unreadCount: number;
  isMuted: boolean;
  mutedUntilUtc?: string | null;
  isPinned: boolean;
  participants: ChatParticipant[];
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface ConversationRead {
  conversationId: string;
  userId: string;
  lastReadSequence: number;
  readAtUtc: string;
}

export interface UserPresence {
  userId: string;
  isOnline: boolean;
  atUtc: string;
}

export interface TypingSignal {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

/** Tài khoản đồng bộ từ AuthService qua Kafka - chỉ đọc, dùng làm danh bạ. */
export interface AppUser {
  id: string;
  email?: string;
  fullName?: string;
  employeeCode?: string;
  isLocked?: boolean;
}

// ─── Commands ─────────────────────────────────────────────────────────────────

export interface CreateDirectConversationCommand {
  targetUserId: string;
}

/** Cài đặt riêng của từng người; field bỏ trống là giữ nguyên. */
export interface UpdateConversationSettingsCommand {
  isMuted?: boolean;
  /** Chỉ có nghĩa khi `isMuted = true`; bỏ trống là tắt thông báo vô thời hạn. */
  mutedUntilUtc?: string | null;
  isPinned?: boolean;
}

export interface MarkConversationReadCommand {
  upToSequence: number;
}

export interface MessageAttachmentCommand {
  /** Lấy nguyên văn từ kết quả `POST /api/files`. */
  fileUrl: string;
  /** Tên hiển thị; kiểu và dung lượng do server đọc lại từ tệp đã lưu. */
  fileName: string;
}

export interface SendMessageCommand {
  /** Client tự sinh; gửi lại cùng id này khi mất mạng sẽ không tạo tin trùng. */
  clientMessageId: string;
  type: MessageType;
  content?: string | null;
  replyToMessageId?: string | null;
  attachments: MessageAttachmentCommand[];
  /** Người được nhắc tên; phải là thành viên còn hoạt động của hội thoại. */
  mentionedUserIds: string[];
}

export interface SetMessageReactionCommand {
  emoji: string;
}

export interface UpdateMessageCommand {
  content: string;
}

export interface MessageHistoryRequest {
  /** Lấy các tin cũ hơn mốc này; bỏ trống là lấy từ tin mới nhất. */
  beforeSequence?: number | null;
  /** Backend chặn trong khoảng 1 đến 100. */
  limit?: number;
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

export interface ChatBootstrapUser {
  id: string;
  fullName?: string | null;
  email?: string | null;
  employeeCode?: string | null;
}

export interface ChatAttachmentRule {
  maxSizeBytes: number;
  allowedExtensions: string[];
}

/** Kết quả `GET /api/chat/bootstrap`, quyết định widget hiện hay ẩn. */
export interface ChatBootstrap {
  /** False thay vì 403, để ẩn hẳn bong bóng với tài khoản không phải nhân sự. */
  canUseChat: boolean;
  user?: ChatBootstrapUser | null;
  unreadConversations: number;
  unreadMessages: number;
  unreadNotifications: number;
  hubPath: string;
  attachment: ChatAttachmentRule;
  serverTimeUtc: string;
}
