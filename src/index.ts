export { default as ChatWidget } from "./components/ChatWidget.vue";

export { configureChatWidget, type ChatWidgetConfig, type TokenProvider } from "./core/config";
export { createBffTokenProvider } from "./core/token";

export { useChatStore } from "./core/store/useChatStore";
export { usePresence } from "./core/store/usePresence";

export { HubEvent, HubMethod } from "./constants/hub-event";
export { REACTION_EMOJIS } from "./constants/reaction";

export type {
  AppUser,
  ChatAttachmentRule,
  ChatBootstrap,
  ChatBootstrapUser,
  ChatConversation,
  ChatMessage,
  ChatParticipant,
  ConversationAttachment,
  ConversationAttachmentList,
  MessageAttachment,
  MessagePinChanged,
  MessageReaction,
  MessageSearchItem,
  MessageSearchResponse,
  UploadedFile,
} from "./types/chat";
export {
  AttachmentKind,
  ConversationType,
  MessageType,
  ParticipantRole,
} from "./types/chat";
export {
  MAX_FORWARD_TARGETS,
  MAX_PINNED_PER_CONVERSATION,
} from "./constants/chat";
