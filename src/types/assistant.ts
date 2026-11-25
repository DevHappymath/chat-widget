/** Hệ đang mở trợ lý. Chỉ để trợ lý biết tra hệ nào trước, không dùng để cấp quyền. */
export type AssistantApp = "chat" | "crm" | "lms" | "hr" | "hub" | "task";

/** Thứ đang mở trên trang lúc hỏi, ví dụ trang chi tiết lead L123. */
export interface AssistantEntity {
  type: "lead" | "student" | "class-group" | "lesson";
  code: string;
  label?: string;
}

export interface AssistantContext {
  app: AssistantApp;
  entity?: AssistantEntity | null;
}

export interface AssistantAccess {
  canUseAssistant: boolean;
  canManageAssistant: boolean;
  /** Đang tắt thì chỉ admin còn được dùng, để vào cài đặt bật lại. */
  isEnabled: boolean;
}

export interface AssistantThread {
  id: string;
  app: AssistantApp;
  title: string;
  createdAtUtc: string;
  lastMessageAtUtc: string;
}

export type AssistantStepStatus = "running" | "done" | "denied" | "failed";

/** Một lượt trợ lý đi tra dữ liệu, nhãn đã viết sẵn theo lời nghiệp vụ từ backend. */
export interface AssistantStep {
  id: string;
  label: string;
  status: AssistantStepStatus;
}

export interface AssistantCitation {
  documentId: string;
  title: string;
  page?: number | null;
  url?: string | null;
}

export interface AssistantCardField {
  label: string;
  value: string;
}

export interface AssistantCardRow {
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  url?: string | null;
}

export interface AssistantCardLink {
  label: string;
  url: string;
}

export type AssistantCardKind = "lead" | "leads" | "student" | "students" | "commission" | "lessons" | "classes" | "trials" | "docs";

/** Kết quả tra nhanh dựng sẵn ở backend, kèm link mở đúng trang bên hệ tuyển sinh/lớp học. */
export interface AssistantCard {
  kind: AssistantCardKind;
  title: string;
  subtitle?: string | null;
  badge?: string | null;
  fields: AssistantCardField[];
  rows: AssistantCardRow[];
  links: AssistantCardLink[];
}

export type AssistantFeedback = "helpful" | "wrong";

export interface AssistantMessage {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  steps: AssistantStep[];
  citations: AssistantCitation[];
  feedback: AssistantFeedback | null;
  createdAtUtc: string;
  /** Tên mô hình đã trả lời, chỉ có ở câu của trợ lý. */
  model?: string | null;
  /** Chỉ có ở phía giao diện khi câu trả lời đang về dở hoặc hỏng giữa chừng. */
  state?: "streaming" | "error";
  /** "quick" khi trả lời bằng tra nhanh theo mẫu, không qua mô hình. */
  source?: "quick" | null;
  cards?: AssistantCard[];
}

/** Một mô hình trả lời mà người hỏi được chọn; chỉ gồm mô hình admin đã thêm và có khoá dùng được. */
export interface AssistantModelOption {
  providerId: string;
  providerLabel: string;
  model: string;
}

export interface AssistantModelChoice {
  providerId: string;
  model: string;
}

export interface AssistantModelList {
  models: AssistantModelOption[];
  /** Mô hình admin đặt làm mặc định; null khi chưa có mô hình nào dùng được. */
  defaultModel: AssistantModelChoice | null;
}

export interface AskAssistantCommand {
  content: string;
  context: AssistantContext;
  /** Bỏ trống là dùng mô hình mặc định. Server vẫn kiểm lại mô hình có trong danh sách cho phép. */
  model?: AssistantModelChoice | null;
  /** Bỏ qua tra nhanh, hỏi thẳng mô hình (nút "Hỏi trợ lý thêm" dưới thẻ tra nhanh). */
  preferAssistant?: boolean;
}

/** Sự kiện hub `AssistantStatus`. */
export interface AssistantStatusEvent {
  threadId: string;
  messageId: string;
  step: AssistantStep;
}

/** Sự kiện hub `AssistantDelta`: đoạn chữ nối tiếp vào câu trả lời. */
export interface AssistantDeltaEvent {
  threadId: string;
  messageId: string;
  text: string;
}

export interface AssistantErrorEvent {
  threadId: string;
  messageId: string;
  message: string;
}

// ===== Cài đặt (chỉ admin) =====

/** Loại nhà cung cấp; "openai-compatible" là máy chủ tự dựng nói cùng giao thức OpenAI. */
export type AssistantProviderKind =
  | "anthropic"
  | "openai"
  | "gemini"
  | "deepseek"
  | "mistral"
  | "groq"
  | "xai"
  | "openrouter"
  | "openai-compatible";

/** Một loại trong danh mục do máy chủ trả về, để giao diện không tự viết cứng danh sách. */
export interface AssistantProviderKindOption {
  kind: AssistantProviderKind;
  label: string;
  requiresBaseUrl: boolean;
  supportsEmbedding: boolean;
  modelExamples: string;
}

export type AssistantKeyStatus = "valid" | "invalid" | "untested";

export type AssistantModelPurpose = "chat" | "embedding";

export interface AssistantProviderOption {
  id: string;
  kind: AssistantProviderKind;
  label: string;
  baseUrl?: string | null;
  /** Vài ký tự đầu của khoá; server không bao giờ trả khoá đầy đủ. Null là chưa có khoá. */
  keyPreview: string | null;
  keyStatus: AssistantKeyStatus;
  keyError?: string | null;
  keyCheckedAtUtc?: string | null;
  chatModels: string[];
  embeddingModels: string[];
}

export interface AddAssistantProviderCommand {
  kind: AssistantProviderKind;
  label: string;
  apiKey: string;
  baseUrl?: string | null;
}

export interface AssistantSettings {
  enabled: boolean;
  /** Rỗng là mọi nhân sự. */
  allowedRoles: string[];
  /** Id của nhà cung cấp trong `providers`. */
  chatProvider: string;
  chatModel: string;
  embeddingProvider: string;
  embeddingModel: string;
  maxQuestionsPerMinute: number;
  dailyTokenQuotaPerUser: number;
  maskPhoneNumbers: boolean;
  retentionDays: number;
  updatedAtUtc?: string | null;
  updatedByName?: string | null;
}

export interface AssistantSettingsResponse {
  settings: AssistantSettings;
  providers: AssistantProviderOption[];
  /** Vai trò đang có bên tài khoản, để chọn chứ không bắt gõ tay. */
  availableRoles: string[];
  providerKinds: AssistantProviderKindOption[];
}

export type UpdateAssistantSettingsCommand = Omit<
  AssistantSettings,
  "updatedAtUtc" | "updatedByName"
>;

export type KnowledgeDocumentStatus = "processing" | "ready" | "failed";

export interface KnowledgeDocument {
  id: string;
  title: string;
  fileName: string;
  sizeBytes: number;
  status: KnowledgeDocumentStatus;
  /** Rỗng là mọi nhân sự đều được tra. */
  allowedRoles: string[];
  chunkCount: number;
  error?: string | null;
  uploadedByName?: string | null;
  createdAtUtc: string;
  fileUrl?: string | null;
}

export interface UploadKnowledgeDocumentCommand {
  file: File;
  title: string;
  allowedRoles: string[];
}

export interface AssistantUsageDay {
  date: string;
  questions: number;
  tokens: number;
  wrongAnswers: number;
}

export interface AssistantUsageUser {
  userId: string;
  fullName: string;
  questions: number;
  tokens: number;
}

export interface AssistantUsage {
  days: AssistantUsageDay[];
  topUsers: AssistantUsageUser[];
}

export type AssistantLookupOutcome = "ok" | "denied" | "not-found" | "failed";

/** Một lần trợ lý tra dữ liệu thay ai đó, để admin biết ai đã xem gì qua trợ lý. */
export interface AssistantLookupLog {
  id: string;
  userName: string;
  app: AssistantApp;
  label: string;
  outcome: AssistantLookupOutcome;
  createdAtUtc: string;
}
