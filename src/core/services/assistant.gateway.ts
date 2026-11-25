import type { AxiosInstance } from "axios";
import { HubEvent } from "../../constants/hub-event";
import type {
  AddAssistantProviderCommand,
  AssistantModelList,
  AssistantModelPurpose,
  AssistantProviderOption,
  AskAssistantCommand,
  AssistantAccess,
  AssistantDeltaEvent,
  AssistantFeedback,
  AssistantLookupLog,
  AssistantMessage,
  AssistantSettingsResponse,
  AssistantStatusEvent,
  AssistantStep,
  AssistantThread,
  AssistantUsage,
  KnowledgeDocument,
  UpdateAssistantSettingsCommand,
  UploadKnowledgeDocumentCommand,
} from "../../types/assistant";
import type { PagedData } from "../../types/api";
import { assistantService } from "./assistant.service";

export interface AskHandlers {
  onStep: (step: AssistantStep) => void;
  onDelta: (text: string) => void;
}

type HubOn = (event: string, callback: (payload: any) => void) => () => void;

/** Lớp giữa giao diện và nguồn dữ liệu, để thay được bản giả lập khi backend trợ lý chưa có. */
export interface AssistantGateway {
  getAccess: () => Promise<AssistantAccess>;
  getModels: () => Promise<AssistantModelList>;
  getThreads: () => Promise<AssistantThread[]>;
  createThread: (app: string) => Promise<AssistantThread>;
  deleteThread: (threadId: string) => Promise<void>;
  getMessages: (threadId: string) => Promise<AssistantMessage[]>;
  ask: (threadId: string, command: AskAssistantCommand, handlers: AskHandlers) => Promise<AssistantMessage>;
  sendFeedback: (messageId: string, feedback: AssistantFeedback | null) => Promise<void>;

  getSettings: () => Promise<AssistantSettingsResponse>;
  updateSettings: (command: UpdateAssistantSettingsCommand) => Promise<AssistantSettingsResponse>;
  addProvider: (command: AddAssistantProviderCommand) => Promise<AssistantProviderOption>;
  updateProviderKey: (providerId: string, apiKey: string) => Promise<AssistantProviderOption>;
  testProviderKey: (providerId: string) => Promise<AssistantProviderOption>;
  deleteProvider: (providerId: string) => Promise<void>;
  addModel: (providerId: string, name: string, purpose: AssistantModelPurpose) => Promise<AssistantProviderOption>;
  removeModel: (providerId: string, name: string, purpose: AssistantModelPurpose) => Promise<AssistantProviderOption>;
  getDocuments: () => Promise<KnowledgeDocument[]>;
  uploadDocument: (command: UploadKnowledgeDocumentCommand) => Promise<KnowledgeDocument>;
  updateDocumentRoles: (documentId: string, allowedRoles: string[]) => Promise<KnowledgeDocument>;
  reindexDocument: (documentId: string) => Promise<KnowledgeDocument>;
  reindexAll: () => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;
  getUsage: (days: number) => Promise<AssistantUsage>;
  getLookupLogs: (pageNumber: number, pageSize: number) => Promise<PagedData<AssistantLookupLog>>;
}

export const createAssistantGateway = (axios: AxiosInstance, hubOn: HubOn): AssistantGateway => {
  const api = assistantService(axios);

  return {
    getAccess: async () => {
      try {
        return (await api.getAccess()).data.data;
      } catch {
        // Server chưa có trợ lý hoặc tài khoản không được dùng: coi như không có, không báo lỗi.
        return { canUseAssistant: false, canManageAssistant: false, isEnabled: false };
      }
    },
    getModels: async () => (await api.getModels()).data.data,
    getThreads: async () => (await api.getThreads()).data.data,
    createThread: async (app) => (await api.createThread(app)).data.data,
    deleteThread: async (threadId) => {
      await api.deleteThread(threadId);
    },
    getMessages: async (threadId) => (await api.getMessages(threadId)).data.data,

    ask: async (threadId, command, handlers) => {
      // Mỗi hội thoại chỉ hỏi một câu một lúc, nên lọc sự kiện theo hội thoại là đủ.
      const offStatus = hubOn(HubEvent.AssistantStatus, (event: AssistantStatusEvent) => {
        if (event.threadId === threadId) handlers.onStep(event.step);
      });
      const offDelta = hubOn(HubEvent.AssistantDelta, (event: AssistantDeltaEvent) => {
        if (event.threadId === threadId) handlers.onDelta(event.text);
      });

      try {
        return (await api.ask(threadId, command)).data.data;
      } finally {
        offStatus();
        offDelta();
      }
    },

    sendFeedback: async (messageId, feedback) => {
      await api.sendFeedback(messageId, feedback);
    },

    getSettings: async () => (await api.getSettings()).data.data,
    updateSettings: async (command) => (await api.updateSettings(command)).data.data,
    addProvider: async (command) => (await api.addProvider(command)).data.data,
    updateProviderKey: async (providerId, apiKey) =>
      (await api.updateProviderKey(providerId, apiKey)).data.data,
    testProviderKey: async (providerId) => (await api.testProviderKey(providerId)).data.data,
    deleteProvider: async (providerId) => {
      await api.deleteProvider(providerId);
    },
    addModel: async (providerId, name, purpose) =>
      (await api.addModel(providerId, name, purpose)).data.data,
    removeModel: async (providerId, name, purpose) =>
      (await api.removeModel(providerId, name, purpose)).data.data,
    getDocuments: async () => (await api.getDocuments()).data.data,
    uploadDocument: async (command) => (await api.uploadDocument(command)).data.data,
    updateDocumentRoles: async (documentId, roles) =>
      (await api.updateDocumentRoles(documentId, roles)).data.data,
    reindexDocument: async (documentId) => (await api.reindexDocument(documentId)).data.data,
    reindexAll: async () => {
      await api.reindexAll();
    },
    deleteDocument: async (documentId) => {
      await api.deleteDocument(documentId);
    },
    getUsage: async (days) => (await api.getUsage(days)).data.data,
    getLookupLogs: async (pageNumber, pageSize) =>
      (await api.getLookupLogs(pageNumber, pageSize)).data.data,
  };
};
