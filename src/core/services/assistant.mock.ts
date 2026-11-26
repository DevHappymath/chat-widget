import type {
  AssistantLookupLog,
  AssistantMessage,
  AssistantModelList,
  AssistantProviderOption,
  AssistantSettingsResponse,
  AssistantStep,
  AssistantThread,
  AssistantUsage,
  KnowledgeDocument,
} from "../../types/assistant";
import type { AskHandlers, AssistantGateway } from "./assistant.gateway";

// Bản giả lập chỉ để dựng giao diện khi backend trợ lý chưa có; bật bằng NUXT_PUBLIC_ASSISTANT_MOCK=true.

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const uid = () => Math.random().toString(36).slice(2, 10);
const nowIso = () => new Date().toISOString();
const daysAgo = (days: number, hours = 0) =>
  new Date(Date.now() - days * 86_400_000 - hours * 3_600_000).toISOString();

const ROLES = [
  "Administrator",
  "Manager",
  "Sale",
  "Marketing",
  "Teacher",
  "Quản lý giáo dục",
  "Kế toán",
];

let threads: AssistantThread[] = [
  {
    id: "t-1",
    app: "crm",
    title: "Lead L1042 đang ở bước nào",
    createdAtUtc: daysAgo(0, 2),
    lastMessageAtUtc: daysAgo(0, 2),
  },
  {
    id: "t-2",
    app: "chat",
    title: "Quy trình hoàn học phí",
    createdAtUtc: daysAgo(1, 3),
    lastMessageAtUtc: daysAgo(1, 3),
  },
  {
    id: "t-3",
    app: "lms",
    title: "Lớp của học sinh L0988 học mấy buổi",
    createdAtUtc: daysAgo(4),
    lastMessageAtUtc: daysAgo(4),
  },
];

const messages: Record<string, AssistantMessage[]> = {
  "t-1": [
    {
      id: "m-1",
      threadId: "t-1",
      role: "user",
      content: "Lead L1042 đang ở bước nào?",
      steps: [],
      citations: [],
      feedback: null,
      createdAtUtc: daysAgo(0, 2),
    },
    {
      id: "m-2",
      threadId: "t-1",
      role: "assistant",
      content:
        "Lead **L1042** (Nguyễn Minh Anh, lớp 7) đang ở bước **Đã hẹn học thử**.\n\n- Sale phụ trách: Trần Thu Hà\n- Buổi học thử: 19:30 thứ Năm, 27/11\n- Lần liên hệ gần nhất: hôm qua, phụ huynh xác nhận cho con học thử",
      steps: [{ id: "s-1", label: "Đã xem thông tin lead L1042", status: "done" }],
      citations: [],
      feedback: "helpful",
      createdAtUtc: daysAgo(0, 2),
    },
  ],
};

let documents: KnowledgeDocument[] = [
  {
    id: "d-1",
    title: "Quy trình hoàn học phí",
    fileName: "quy-trinh-hoan-hoc-phi.pdf",
    sizeBytes: 412_000,
    status: "ready",
    allowedRoles: [],
    chunkCount: 18,
    uploadedByName: "Quản trị hệ thống",
    createdAtUtc: daysAgo(12),
  },
  {
    id: "d-2",
    title: "Chính sách hoa hồng sale 2026",
    fileName: "chinh-sach-hoa-hong-2026.docx",
    sizeBytes: 96_000,
    status: "ready",
    allowedRoles: ["Sale", "Manager"],
    chunkCount: 9,
    uploadedByName: "Quản trị hệ thống",
    createdAtUtc: daysAgo(6),
  },
  {
    id: "d-3",
    title: "Hướng dẫn điểm danh và báo nghỉ",
    fileName: "huong-dan-diem-danh.pdf",
    sizeBytes: 2_300_000,
    status: "failed",
    allowedRoles: ["Teacher", "Quản lý giáo dục"],
    chunkCount: 0,
    error: "Tệp là ảnh chụp, không đọc được chữ. Hãy tải bản có chữ chọn được.",
    uploadedByName: "Quản trị hệ thống",
    createdAtUtc: daysAgo(2),
  },
];

let settings: AssistantSettingsResponse = {
  settings: {
    enabled: true,
    allowedRoles: [],
    chatProvider: "p-anthropic",
    chatModel: "claude-sonnet-5-5",
    embeddingProvider: "p-openai",
    embeddingModel: "text-embedding-3-small",
    maxQuestionsPerMinute: 20,
    dailyTokenQuotaPerUser: 200_000,
    maskPhoneNumbers: true,
    quickLookupEnabled: true,
    retentionDays: 90,
    updatedAtUtc: daysAgo(3),
    updatedByName: "Quản trị hệ thống",
  },
  providers: [
    {
      id: "p-anthropic",
      kind: "anthropic",
      label: "Claude (Anthropic)",
      keyPreview: "sk-ant-a3",
      keyStatus: "valid",
      keyCheckedAtUtc: daysAgo(0, 1),
      chatModels: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"],
      embeddingModels: [],
    },
    {
      id: "p-openai",
      kind: "openai",
      label: "OpenAI",
      keyPreview: "sk-proj-",
      keyStatus: "valid",
      keyCheckedAtUtc: daysAgo(0, 1),
      chatModels: ["gpt-4.1", "gpt-4.1-mini"],
      embeddingModels: ["text-embedding-3-small", "text-embedding-3-large"],
    },
    {
      id: "p-local",
      kind: "openai-compatible",
      label: "Máy chủ nội bộ",
      baseUrl: "http://10.0.0.15:8000/v1",
      keyPreview: "gdtd-loc",
      keyStatus: "invalid",
      keyError: "Máy chủ từ chối khoá này (401). Khoá có thể đã bị thu hồi.",
      keyCheckedAtUtc: daysAgo(1),
      chatModels: ["qwen3-32b"],
      embeddingModels: ["bge-m3"],
    },
  ],
  availableRoles: ROLES,
  providerKinds: [
    { kind: "anthropic", label: "Claude (Anthropic)", requiresBaseUrl: false, supportsEmbedding: false, modelExamples: "claude-sonnet-5-5, claude-opus-5-5" },
    { kind: "openai", label: "OpenAI", requiresBaseUrl: false, supportsEmbedding: true, modelExamples: "gpt-4.1, text-embedding-3-small" },
    { kind: "gemini", label: "Gemini (Google)", requiresBaseUrl: false, supportsEmbedding: true, modelExamples: "gemini-3.8-flash, gemini-embedding-001" },
    { kind: "deepseek", label: "DeepSeek", requiresBaseUrl: false, supportsEmbedding: false, modelExamples: "deepseek-flash, deepseek-v4-pro" },
    { kind: "mistral", label: "Mistral", requiresBaseUrl: false, supportsEmbedding: true, modelExamples: "mistral-large-latest, mistral-embed" },
    { kind: "groq", label: "Groq", requiresBaseUrl: false, supportsEmbedding: false, modelExamples: "llama-3.3-70b-versatile" },
    { kind: "xai", label: "Grok (xAI)", requiresBaseUrl: false, supportsEmbedding: false, modelExamples: "grok-4" },
    { kind: "openrouter", label: "OpenRouter", requiresBaseUrl: false, supportsEmbedding: false, modelExamples: "anthropic/claude-sonnet-5.5" },
    { kind: "openai-compatible", label: "Máy chủ tương thích OpenAI", requiresBaseUrl: true, supportsEmbedding: true, modelExamples: "tên mô hình trên máy chủ của bạn" },
  ],
};

const usage: AssistantUsage = {
  days: Array.from({ length: 14 }, (_, i) => {
    const questions = [12, 18, 9, 22, 31, 6, 4, 27, 35, 29, 41, 38, 15, 24][i] ?? 10;
    return {
      date: daysAgo(13 - i).slice(0, 10),
      questions,
      tokens: questions * 2_150,
      wrongAnswers: Math.round(questions * 0.06),
    };
  }),
  topUsers: [
    { userId: "u-1", fullName: "Trần Thu Hà", questions: 64, tokens: 141_000 },
    { userId: "u-2", fullName: "Lê Quốc Bảo", questions: 41, tokens: 88_300 },
    { userId: "u-3", fullName: "Phạm Ngọc Lan", questions: 33, tokens: 70_900 },
    { userId: "u-4", fullName: "Đỗ Thành Nam", questions: 19, tokens: 39_200 },
  ],
};

const lookupLogs: AssistantLookupLog[] = [
  ["Trần Thu Hà", "crm", "Xem thông tin lead L1042", "ok"],
  ["Trần Thu Hà", "lms", "Xem lớp của học sinh L1042", "denied"],
  ["Lê Quốc Bảo", "crm", "Xem hoa hồng tháng này", "ok"],
  ["Phạm Ngọc Lan", "lms", "Xem điểm danh lớp TA-7B", "ok"],
  ["Đỗ Thành Nam", "chat", "Tra tài liệu: hoàn học phí", "ok"],
  ["Lê Quốc Bảo", "crm", "Tìm lead theo số điện thoại", "not-found"],
  ["Phạm Ngọc Lan", "lms", "Xem buổi học thử tuần này", "ok"],
  ["Trần Thu Hà", "crm", "Xem học viên của lead L0977", "failed"],
].map(([userName, app, label, outcome], index) => ({
  id: `l-${index}`,
  userName: userName!,
  app: app as AssistantLookupLog["app"],
  label: label!,
  outcome: outcome as AssistantLookupLog["outcome"],
  createdAtUtc: daysAgo(0, index * 2 + 1),
}));

interface Scenario {
  steps: { label: string; doneLabel: string; status: AssistantStep["status"] }[];
  answer: string;
  citations?: AssistantMessage["citations"];
}

const pickScenario = (question: string, app: string, entityCode?: string): Scenario => {
  const text = question.toLowerCase();
  const leadCode = (question.match(/\bL\d{2,6}\b/i)?.[0] ?? entityCode)?.toUpperCase();
  const asksClass = /lớp|buổi|điểm danh|học thử|lịch học|giáo viên/.test(text);

  if (/quy trình|chính sách|quy định|hướng dẫn|hoàn học phí|hoàn phí/.test(text)) {
    return {
      steps: [{ label: "Đang tra tài liệu nội bộ", doneLabel: "Đã tra tài liệu nội bộ", status: "done" }],
      answer:
        "Theo **Quy trình hoàn học phí**, phụ huynh được hoàn khi:\n\n1. Học sinh chưa học quá 2 buổi của gói, hoặc\n2. Trung tâm không xếp được lớp trong 14 ngày kể từ ngày đóng tiền.\n\nCác bước:\n- Sale phụ trách lập đề nghị hoàn trong ngày nhận yêu cầu\n- Kế toán đối soát và chuyển khoản trong **7 ngày làm việc**\n- Số tiền hoàn trừ phần buổi đã học theo đơn giá của gói",
      citations: [
        { documentId: "d-1", title: "Quy trình hoàn học phí", page: 3 },
        { documentId: "d-1", title: "Quy trình hoàn học phí", page: 5 },
      ],
    };
  }

  if (/hoa hồng|thưởng|phụ cấp/.test(text)) {
    return {
      steps: [{ label: "Đang xem hoa hồng của bạn", doneLabel: "Đã xem hoa hồng của bạn", status: "done" }],
      answer:
        "Hoa hồng kỳ **tháng 11/2026** của bạn tạm tính:\n\n| Khoản | Số tiền |\n|---|---|\n| Hoa hồng chốt mới (6 học viên) | 7.200.000đ |\n| Hoa hồng gia hạn (3 học viên) | 1.950.000đ |\n| **Tổng tạm tính** | **9.150.000đ** |\n\nKỳ này chưa chốt, số liệu còn đổi nếu có học viên gia hạn thêm trước 30/11.",
    };
  }

  if (leadCode && asksClass) {
    const denied = leadCode === "L999";
    return {
      steps: [
        ...(app === "crm"
          ? [{ label: `Đang xem thông tin lead ${leadCode}`, doneLabel: `Đã xem thông tin lead ${leadCode}`, status: "done" as const }]
          : []),
        {
          label: "Đang kiểm tra lớp học của học sinh",
          doneLabel: denied ? "Bạn chưa được xem lớp học của học sinh này" : "Đã xem lớp học của học sinh",
          status: denied ? "denied" : "done",
        },
      ],
      answer: denied
        ? `Bạn chưa được xem thông tin lớp học của học sinh lead **${leadCode}**. Nếu cần, hãy nhờ quản lý giáo dục hoặc giáo viên phụ trách lớp kiểm tra giúp.`
        : `Học sinh lead **${leadCode}** đang học lớp **TA-7B** (Toán Úc lớp 7):\n\n- Đã học **14/24 buổi**, nghỉ có phép 1 buổi\n- Buổi gần nhất: thứ Hai 24/11, có mặt\n- Buổi kế tiếp: 19:30 thứ Tư 26/11 với cô Phạm Ngọc Lan`,
    };
  }

  if (leadCode) {
    return {
      steps: [
        app === "lms"
          ? { label: `Đang tìm học sinh có mã lead ${leadCode}`, doneLabel: `Đã tìm học sinh có mã lead ${leadCode}`, status: "done" }
          : { label: `Đang xem thông tin lead ${leadCode}`, doneLabel: `Đã xem thông tin lead ${leadCode}`, status: "done" },
      ],
      answer: `Lead **${leadCode}** — Nguyễn Minh Anh, lớp 7, phụ huynh chị Hoa.\n\n- Bước hiện tại: **Đã hẹn học thử**\n- Sale phụ trách: Trần Thu Hà\n- Nguồn: fanpage Kan Math\n- Ghi chú gần nhất: phụ huynh muốn học buổi tối, 2 buổi/tuần\n\nBạn có muốn xem lớp học thử của bạn này không?`,
    };
  }

  return {
    steps: [],
    answer:
      "Mình có thể giúp bạn:\n\n- Tra nhanh một lead theo mã (ví dụ **L1042**), số điện thoại hoặc tên\n- Xem lớp, số buổi đã học, điểm danh của học sinh\n- Xem hoa hồng của chính bạn\n- Tra quy trình, chính sách trong tài liệu nội bộ\n\nMình chỉ xem được đúng những dữ liệu bạn đang có quyền xem.",
  };
};

/** Chỉ mô hình trả lời của nhà cung cấp có khoá dùng được mới cho người hỏi chọn. */
const listModels = (): AssistantModelList => {
  const models = settings.providers
    .filter((p) => p.keyPreview && p.keyStatus !== "invalid")
    .flatMap((p) => p.chatModels.map((model) => ({ providerId: p.id, providerLabel: p.label, model })));
  const { chatProvider, chatModel } = settings.settings;
  const isDefaultUsable = models.some((m) => m.providerId === chatProvider && m.model === chatModel);
  return {
    models,
    defaultModel: isDefaultUsable
      ? { providerId: chatProvider, model: chatModel }
      : models[0]
        ? { providerId: models[0].providerId, model: models[0].model }
        : null,
  };
};

const previewKey = (apiKey: string) => apiKey.trim().slice(0, 8);

/** Giả lập server gọi thử nhà cung cấp: khoá quá ngắn hoặc có chữ "sai" thì coi như bị từ chối. */
const withKeyCheck = (provider: AssistantProviderOption, apiKey: string): AssistantProviderOption => {
  const valid = apiKey.trim().length >= 20 && !/sai/i.test(apiKey);
  return {
    ...provider,
    keyStatus: valid ? "valid" : "invalid",
    keyError: valid ? null : "Nhà cung cấp từ chối khoá này (401). Kiểm tra lại khoá vừa dán.",
    keyCheckedAtUtc: nowIso(),
  };
};

const patchProvider = (
  providerId: string,
  patch: (provider: AssistantProviderOption) => AssistantProviderOption,
) => {
  let updated: AssistantProviderOption | undefined;
  settings.providers = settings.providers.map((p) => {
    if (p.id !== providerId) return p;
    updated = patch(p);
    return updated;
  });
  if (!updated) throw new Error("Không tìm thấy nhà cung cấp");
  return updated;
};

const streamText = async (text: string, onDelta: (chunk: string) => void) => {
  for (let index = 0; index < text.length; ) {
    const size = 2 + Math.floor(Math.random() * 5);
    onDelta(text.slice(index, index + size));
    index += size;
    await sleep(18);
  }
};

const titleFrom = (question: string) => {
  const clean = question.trim().replace(/\s+/g, " ");
  return clean.length > 48 ? `${clean.slice(0, 47)}…` : clean;
};

export const createAssistantMockGateway = (canManage: () => boolean): AssistantGateway => ({
  getAccess: async () => ({
    canUseAssistant: settings.settings.enabled || canManage(),
    canManageAssistant: canManage(),
    isEnabled: settings.settings.enabled,
  }),

  getModels: async () => {
    await sleep(150);
    return listModels();
  },

  getThreads: async () => {
    await sleep(200);
    return [...threads].sort((a, b) => b.lastMessageAtUtc.localeCompare(a.lastMessageAtUtc));
  },

  createThread: async (app) => {
    const thread: AssistantThread = {
      id: `t-${uid()}`,
      app: app as AssistantThread["app"],
      title: "Trao đổi mới",
      createdAtUtc: nowIso(),
      lastMessageAtUtc: nowIso(),
    };
    threads = [thread, ...threads];
    messages[thread.id] = [];
    return thread;
  },

  deleteThread: async (threadId) => {
    threads = threads.filter((t) => t.id !== threadId);
    delete messages[threadId];
  },

  getMessages: async (threadId) => {
    await sleep(250);
    return [...(messages[threadId] ?? [])];
  },

  ask: async (threadId, command, handlers: AskHandlers) => {
    const list = (messages[threadId] ??= []);
    const thread = threads.find((t) => t.id === threadId);
    if (thread && !list.length) thread.title = titleFrom(command.content);

    list.push({
      id: `m-${uid()}`,
      threadId,
      role: "user",
      content: command.content,
      steps: [],
      citations: [],
      feedback: null,
      createdAtUtc: nowIso(),
    });

    const scenario = pickScenario(
      command.content,
      command.context.app,
      command.context.entity?.type === "lead" ? command.context.entity.code : undefined,
    );

    await sleep(400);
    const steps: AssistantStep[] = [];
    for (const item of scenario.steps) {
      const step: AssistantStep = { id: uid(), label: item.label, status: "running" };
      steps.push(step);
      handlers.onStep(step);
      await sleep(900);
      const done = { ...step, label: item.doneLabel, status: item.status };
      steps[steps.length - 1] = done;
      handlers.onStep(done);
    }

    await streamText(scenario.answer, handlers.onDelta);

    const answer: AssistantMessage = {
      id: `m-${uid()}`,
      threadId,
      role: "assistant",
      content: scenario.answer,
      steps,
      citations: scenario.citations ?? [],
      feedback: null,
      createdAtUtc: nowIso(),
      model: command.model?.model ?? listModels().defaultModel?.model ?? null,
    };
    list.push(answer);
    if (thread) thread.lastMessageAtUtc = answer.createdAtUtc;
    return answer;
  },

  sendFeedback: async (messageId, feedback) => {
    for (const list of Object.values(messages)) {
      const found = list.find((m) => m.id === messageId);
      if (found) found.feedback = feedback;
    }
  },

  getSettings: async () => {
    await sleep(300);
    return structuredClone(settings);
  },

  updateSettings: async (command) => {
    await sleep(500);
    settings = {
      ...settings,
      settings: { ...command, updatedAtUtc: nowIso(), updatedByName: "Bạn" },
    };
    return structuredClone(settings);
  },

  addProvider: async (command) => {
    await sleep(400);
    const provider = withKeyCheck({
      id: `p-${uid()}`,
      kind: command.kind,
      label: command.label,
      baseUrl: command.baseUrl ?? null,
      keyPreview: previewKey(command.apiKey),
      keyStatus: "untested",
      chatModels: [],
      embeddingModels: [],
    }, command.apiKey);
    settings.providers = [...settings.providers, provider];
    await sleep(800);
    return structuredClone(provider);
  },

  updateProviderKey: async (providerId, apiKey) => {
    await sleep(1_000);
    return structuredClone(
      patchProvider(providerId, (p) => withKeyCheck({ ...p, keyPreview: previewKey(apiKey) }, apiKey)),
    );
  },

  testProviderKey: async (providerId) => {
    await sleep(1_200);
    // Bản giả lập không giữ khoá thật: khoá đang báo lỗi thì vẫn lỗi, còn lại coi như dùng được.
    return structuredClone(
      patchProvider(providerId, (p) => ({
        ...p,
        keyStatus: p.keyStatus === "invalid" ? "invalid" : "valid",
        keyCheckedAtUtc: nowIso(),
      })),
    );
  },

  deleteProvider: async (providerId) => {
    await sleep(300);
    const { chatProvider, embeddingProvider } = settings.settings;
    if (providerId === chatProvider || providerId === embeddingProvider) {
      throw new Error("Nhà cung cấp đang được dùng, hãy chọn nhà cung cấp khác trước khi xoá");
    }
    settings.providers = settings.providers.filter((p) => p.id !== providerId);
  },

  addModel: async (providerId, name, purpose) => {
    await sleep(300);
    const key = purpose === "chat" ? "chatModels" : "embeddingModels";
    return structuredClone(
      patchProvider(providerId, (p) =>
        p[key].includes(name) ? p : { ...p, [key]: [...p[key], name] },
      ),
    );
  },

  removeModel: async (providerId, name, purpose) => {
    await sleep(300);
    const inUse =
      purpose === "chat"
        ? settings.settings.chatProvider === providerId && settings.settings.chatModel === name
        : settings.settings.embeddingProvider === providerId && settings.settings.embeddingModel === name;
    if (inUse) throw new Error("Mô hình đang được dùng, hãy chọn mô hình khác trước khi gỡ");

    const key = purpose === "chat" ? "chatModels" : "embeddingModels";
    return structuredClone(
      patchProvider(providerId, (p) => ({ ...p, [key]: p[key].filter((m) => m !== name) })),
    );
  },

  getDocuments: async () => {
    await sleep(300);
    return structuredClone(documents);
  },

  uploadDocument: async (command) => {
    await sleep(700);
    const document: KnowledgeDocument = {
      id: `d-${uid()}`,
      title: command.title,
      fileName: command.file.name,
      sizeBytes: command.file.size,
      status: "processing",
      allowedRoles: command.allowedRoles,
      chunkCount: 0,
      uploadedByName: "Bạn",
      createdAtUtc: nowIso(),
    };
    documents = [document, ...documents];
    // Giả lập worker nạp tài liệu chạy nền rồi xong sau vài giây.
    setTimeout(() => {
      documents = documents.map((d) =>
        d.id === document.id ? { ...d, status: "ready", chunkCount: 12 } : d,
      );
    }, 5_000);
    return structuredClone(document);
  },

  updateDocumentRoles: async (documentId, allowedRoles) => {
    await sleep(300);
    documents = documents.map((d) => (d.id === documentId ? { ...d, allowedRoles } : d));
    return structuredClone(documents.find((d) => d.id === documentId)!);
  },

  reindexDocument: async (documentId) => {
    await sleep(300);
    documents = documents.map((d) =>
      d.id === documentId ? { ...d, status: "processing", error: null } : d,
    );
    setTimeout(() => {
      documents = documents.map((d) =>
        d.id === documentId ? { ...d, status: "ready", chunkCount: d.chunkCount || 10 } : d,
      );
    }, 4_000);
    return structuredClone(documents.find((d) => d.id === documentId)!);
  },

  reindexAll: async () => {
    await sleep(300);
    documents = documents.map((d) => ({ ...d, status: "processing", error: null }));
    setTimeout(() => {
      documents = documents.map((d) => ({ ...d, status: "ready", chunkCount: d.chunkCount || 10 }));
    }, 5_000);
  },

  deleteDocument: async (documentId) => {
    await sleep(300);
    documents = documents.filter((d) => d.id !== documentId);
  },

  getUsage: async (days) => {
    await sleep(300);
    return { ...usage, days: usage.days.slice(-days) };
  },

  getLookupLogs: async (pageNumber, pageSize) => {
    await sleep(300);
    const start = (pageNumber - 1) * pageSize;
    return {
      items: lookupLogs.slice(start, start + pageSize),
      totalCount: lookupLogs.length,
      pageNumber,
      pageSize,
      totalPages: Math.max(1, Math.ceil(lookupLogs.length / pageSize)),
    };
  },
});
