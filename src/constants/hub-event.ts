/**
 * Bản sao của `CHAT_GDTD.Domain.Constants.HubEvent`. Đổi tên event bên backend thì phải sửa
 * cả file này, không có cơ chế nào kiểm tra chéo hai bên.
 */
export const HubEvent = {
  PresenceChanged: "PresenceChanged",

  ConversationCreated: "ConversationCreated",
  ConversationUpdated: "ConversationUpdated",
  ParticipantsChanged: "ParticipantsChanged",
  ConversationRead: "ConversationRead",

  MessageReceived: "MessageReceived",
  MessageUpdated: "MessageUpdated",
  MessageDeleted: "MessageDeleted",

  ReactionChanged: "ReactionChanged",

  UserTyping: "UserTyping",
  NotificationCreated: "NotificationCreated",
} as const;

export type HubEventName = (typeof HubEvent)[keyof typeof HubEvent];

/** Method invoke được trên ChatHub. */
export const HubMethod = {
  GetOnlineUsers: "GetOnlineUsers",
  Typing: "Typing",
} as const;
