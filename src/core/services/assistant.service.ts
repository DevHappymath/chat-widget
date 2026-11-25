import type { AxiosInstance } from "axios";
import type { ApiEnvelope, PagedData } from "../../types/api";
import type {
  AddAssistantProviderCommand,
  AssistantModelList,
  AssistantModelPurpose,
  AssistantProviderOption,
  AskAssistantCommand,
  AssistantAccess,
  AssistantFeedback,
  AssistantLookupLog,
  AssistantMessage,
  AssistantSettingsResponse,
  AssistantThread,
  AssistantUsage,
  KnowledgeDocument,
  UpdateAssistantSettingsCommand,
  UploadKnowledgeDocumentCommand,
} from "../../types/assistant";

/** Hợp đồng `api/assistant/*` theo docs/assistant-rag-plan.md của chat.gdtd.vn-be. */
export const assistantService = (axios: AxiosInstance) => ({
  getAccess: () => axios.get<ApiEnvelope<AssistantAccess>>("/assistant/access"),

  getModels: () => axios.get<ApiEnvelope<AssistantModelList>>("/assistant/models"),

  getThreads: () => axios.get<ApiEnvelope<AssistantThread[]>>("/assistant/threads"),

  createThread: (app: string) =>
    axios.post<ApiEnvelope<AssistantThread>>("/assistant/threads", { app }),

  deleteThread: (threadId: string) =>
    axios.delete<ApiEnvelope<null>>(`/assistant/threads/${threadId}`),

  getMessages: (threadId: string) =>
    axios.get<ApiEnvelope<AssistantMessage[]>>(`/assistant/threads/${threadId}/messages`),

  /**
   * Request chạy tới khi trả lời xong; trong lúc đó các đoạn chữ về qua hub. Timeout dài hơn
   * thời hạn một lượt hỏi phía server để không cắt ngang câu trả lời đang tra dữ liệu.
   */
  ask: (threadId: string, command: AskAssistantCommand) =>
    axios.post<ApiEnvelope<AssistantMessage>>(
      `/assistant/threads/${threadId}/messages`,
      command,
      { timeout: 75_000 },
    ),

  sendFeedback: (messageId: string, feedback: AssistantFeedback | null, note?: string) =>
    axios.post<ApiEnvelope<null>>(`/assistant/messages/${messageId}/feedback`, {
      feedback,
      note,
    }),

  getSettings: () => axios.get<ApiEnvelope<AssistantSettingsResponse>>("/assistant/settings"),

  updateSettings: (command: UpdateAssistantSettingsCommand) =>
    axios.put<ApiEnvelope<AssistantSettingsResponse>>("/assistant/settings", command),

  /** Khoá gửi lên một lần lúc lưu; server mã hoá rồi tự kiểm tra, trả về nhà cung cấp đã có kết quả. */
  addProvider: (command: AddAssistantProviderCommand) =>
    axios.post<ApiEnvelope<AssistantProviderOption>>("/assistant/settings/providers", command),

  updateProviderKey: (providerId: string, apiKey: string) =>
    axios.put<ApiEnvelope<AssistantProviderOption>>(
      `/assistant/settings/providers/${providerId}/key`,
      { apiKey },
    ),

  testProviderKey: (providerId: string) =>
    axios.post<ApiEnvelope<AssistantProviderOption>>(
      `/assistant/settings/providers/${providerId}/test`,
    ),

  deleteProvider: (providerId: string) =>
    axios.delete<ApiEnvelope<null>>(`/assistant/settings/providers/${providerId}`),

  addModel: (providerId: string, name: string, purpose: AssistantModelPurpose) =>
    axios.post<ApiEnvelope<AssistantProviderOption>>(
      `/assistant/settings/providers/${providerId}/models`,
      { name, purpose },
    ),

  removeModel: (providerId: string, name: string, purpose: AssistantModelPurpose) =>
    axios.delete<ApiEnvelope<AssistantProviderOption>>(
      `/assistant/settings/providers/${providerId}/models`,
      { params: { name, purpose } },
    ),

  getDocuments: () =>
    axios.get<ApiEnvelope<KnowledgeDocument[]>>("/assistant/settings/documents"),

  uploadDocument: (command: UploadKnowledgeDocumentCommand) => {
    const form = new FormData();
    form.append("file", command.file);
    form.append("title", command.title);
    command.allowedRoles.forEach((role) => form.append("allowedRoles", role));

    return axios.post<ApiEnvelope<KnowledgeDocument>>("/assistant/settings/documents", form);
  },

  updateDocumentRoles: (documentId: string, allowedRoles: string[]) =>
    axios.put<ApiEnvelope<KnowledgeDocument>>(`/assistant/settings/documents/${documentId}`, {
      allowedRoles,
    }),

  reindexDocument: (documentId: string) =>
    axios.post<ApiEnvelope<KnowledgeDocument>>(
      `/assistant/settings/documents/${documentId}/reindex`,
    ),

  reindexAll: () => axios.post<ApiEnvelope<null>>("/assistant/settings/documents/reindex"),

  deleteDocument: (documentId: string) =>
    axios.delete<ApiEnvelope<null>>(`/assistant/settings/documents/${documentId}`),

  getUsage: (days: number) =>
    axios.get<ApiEnvelope<AssistantUsage>>("/assistant/settings/usage", { params: { days } }),

  getLookupLogs: (pageNumber: number, pageSize: number) =>
    axios.get<ApiEnvelope<PagedData<AssistantLookupLog>>>("/assistant/settings/tool-calls", {
      params: { pageNumber, pageSize },
    }),
});

export type AssistantService = ReturnType<typeof assistantService>;
