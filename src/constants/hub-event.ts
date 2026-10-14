/**
 * Bản sao của `CHAT_GDTD.Domain.Constants.HubEvent`. Đổi tên event bên backend thì phải sửa
 * cả file này, không có cơ chế nào kiểm tra chéo hai bên.
 */
export const HubEvent = {
  PresenceChanged: "PresenceChanged",
  /** Chỉ gửi cho chính mình khi trạng thái tự đặt đổi ở tab hay thiết bị khác. */
  PresenceSettingsChanged: "PresenceSettingsChanged",
  /** Ảnh đại diện của một người có chung hội thoại (hoặc chính mình) vừa đổi. */
  UserAvatarChanged: "UserAvatarChanged",

  ConversationCreated: "ConversationCreated",
  ConversationUpdated: "ConversationUpdated",
  ParticipantsChanged: "ParticipantsChanged",
  ConversationDissolved: "ConversationDissolved",
  ConversationRead: "ConversationRead",
  /** Chỉ gửi cho chính mình khi vừa xoá một đoạn chat 1-1 ở tab hay thiết bị khác. */
  ConversationCleared: "ConversationCleared",

  MessageReceived: "MessageReceived",
  MessageUpdated: "MessageUpdated",
  MessageDeleted: "MessageDeleted",

  ReactionChanged: "ReactionChanged",
  MessagePinChanged: "MessagePinChanged",

  UserTyping: "UserTyping",
  NotificationCreated: "NotificationCreated",
} as const;

export type HubEventName = (typeof HubEvent)[keyof typeof HubEvent];

/** Method invoke được trên ChatHub. */
export const HubMethod = {
  GetOnlineUsers: "GetOnlineUsers",
  GetPresences: "GetPresences",
  SetIdle: "SetIdle",
  Typing: "Typing",
} as const;
