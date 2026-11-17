// Ánh xạ với CHAT_GDTD.Application.Dtos.Chat.NotificationDtos. Enum đi qua JSON dạng số.

export const NotificationType = {
  /** Có người nhắc tên mình trong một tin nhắn. */
  Mention: 1,
  /** Có người trả lời tin nhắn của mình. */
  Reply: 2,
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export interface ChatNotification {
  id: string;
  type: NotificationType;
  conversationId: string;
  /** Tên nhóm; hội thoại 1-1 thì là tên người gây ra thông báo. */
  conversationName?: string | null;
  messageId?: string | null;
  messagePreview?: string | null;
  actorUserId: string;
  actorName?: string | null;
  isRead: boolean;
  createdAtUtc: string;
}
