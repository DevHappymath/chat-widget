import { computed, ref } from "vue";
import { useWidgetConfig } from "../config";
import { onHubEvent } from "../hub";
import { useHttp } from "../http";
import { createAssistantGateway, type AssistantGateway } from "../services/assistant.gateway";
import { createAssistantMockGateway } from "../services/assistant.mock";
import type {
  AssistantAccess,
  AssistantEntity,
  AssistantFeedback,
  AssistantMessage,
  AssistantModelChoice,
  AssistantModelList,
  AssistantModelOption,
  AssistantStep,
  AssistantThread,
} from "../../types/assistant";
import { extractErrorMessage } from "../../utils/error";
import { useChatStore } from "./useChatStore";
import { useWidgetToast } from "./useWidgetToast";

// ─── State: một bản duy nhất cho cả tab ───────────────────────────────────────

let gateway: AssistantGateway | null = null;

const mockAccess = ref<AssistantAccess | null>(null);
/** Thứ site đang mở trên trang (lead, lớp...), do site báo qua `setAssistantContext`. */
const entity = ref<AssistantEntity | null>(null);

const threads = ref<AssistantThread[]>([]);
const hasLoadedThreads = ref(false);
const isLoadingThreads = ref(false);
/** Null là cuộc hỏi mới chưa gửi câu nào; hội thoại chỉ được tạo khi gửi câu đầu. */
const activeThreadId = ref<string | null>(null);
const messagesByThread = ref<Record<string, AssistantMessage[]>>({});
const isLoadingMessages = ref(false);
const isAsking = ref(false);

const PICKED_MODEL_KEY = "gdtd-assistant-model";

// Bộ nhớ trình duyệt có thể bị chặn (cửa sổ ẩn danh, chặn dữ liệu trang): mất thì quay về mặc định.
const readPickedModel = (): AssistantModelChoice | null => {
  try {
    const raw = localStorage.getItem(PICKED_MODEL_KEY);
    return raw ? (JSON.parse(raw) as AssistantModelChoice) : null;
  } catch {
    return null;
  }
};

const writePickedModel = (value: AssistantModelChoice | null) => {
  try {
    if (value) localStorage.setItem(PICKED_MODEL_KEY, JSON.stringify(value));
    else localStorage.removeItem(PICKED_MODEL_KEY);
  } catch {
    // Không nhớ được thì lần sau dùng mặc định, không ảnh hưởng câu hỏi hiện tại.
  }
};

const modelList = ref<AssistantModelList>({ models: [], defaultModel: null });
/** Đã nạp xong danh sách mô hình ít nhất một lần; để phân biệt "đang nạp" với "chưa có mô hình nào". */
const isModelListLoaded = ref(false);
/** Lựa chọn riêng của người hỏi, nhớ trong trình duyệt theo từng site; null là theo mặc định. */
const pickedModel = ref<AssistantModelChoice | null>(readPickedModel());

const sameModel = (a: AssistantModelChoice | null | undefined, b: AssistantModelChoice | null | undefined) =>
  Boolean(a && b && a.providerId === b.providerId && a.model === b.model);

/** Site báo thứ đang mở trên trang để trợ lý hiểu "bạn này" là ai; truyền null khi rời trang đó. */
export const setAssistantContext = (value: AssistantEntity | null) => {
  entity.value = value;
};

/** Nguồn dữ liệu trợ lý dùng chung cho màn hỏi đáp và màn cài đặt. */
export const useAssistantGateway = (): AssistantGateway => {
  if (gateway) return gateway;

  const config = useWidgetConfig();
  gateway = config.assistantMock
    ? createAssistantMockGateway(() => true)
    : createAssistantGateway(useHttp(), onHubEvent);
  return gateway;
};

/** Đổi tài khoản trên cùng trang thì lịch sử hỏi đáp của người trước không được lọt sang. */
export const resetAssistant = () => {
  mockAccess.value = null;
  threads.value = [];
  hasLoadedThreads.value = false;
  activeThreadId.value = null;
  messagesByThread.value = {};
  isAsking.value = false;
  modelList.value = { models: [], defaultModel: null };
  isModelListLoaded.value = false;
};

export const useAssistant = () => {
  const store = useChatStore();
  const toast = useWidgetToast();
  const config = useWidgetConfig();
  const api = useAssistantGateway();

  const app = computed(() => config.app ?? "chat");

  const access = computed<AssistantAccess>(
    () =>
      mockAccess.value ??
      store.bootstrap.value?.assistant ?? {
        canUseAssistant: false,
        canManageAssistant: false,
        isEnabled: false,
      },
  );
  const canUse = computed(() => access.value.canUseAssistant);
  const canManage = computed(() => access.value.canManageAssistant);

  const activeThread = computed(
    () => threads.value.find((t) => t.id === activeThreadId.value) ?? null,
  );
  const activeMessages = computed(() =>
    activeThreadId.value ? (messagesByThread.value[activeThreadId.value] ?? []) : [],
  );

  /** Mô hình đã chọn bị admin gỡ hoặc khoá hỏng thì lặng lẽ quay về mặc định. */
  const activeModel = computed<AssistantModelOption | null>(() => {
    const { models, defaultModel } = modelList.value;
    return (
      models.find((m) => sameModel(m, pickedModel.value)) ??
      models.find((m) => sameModel(m, defaultModel)) ??
      models[0] ??
      null
    );
  });

  const isDefaultModel = (option: AssistantModelOption) => sameModel(option, modelList.value.defaultModel);

  const loadModels = async () => {
    try {
      modelList.value = await api.getModels();
      isModelListLoaded.value = true;
    } catch {
      // Không nạp được thì vẫn hỏi được, server tự dùng mô hình mặc định.
    }
  };

  const pickModel = (option: AssistantModelOption) => {
    pickedModel.value = isDefaultModel(option) ? null : { providerId: option.providerId, model: option.model };
    writePickedModel(pickedModel.value);
  };

  /** Bootstrap thật đã mang sẵn quyền; chỉ bản giả lập phải hỏi riêng. */
  const refreshAccess = async () => {
    if (config.assistantMock) mockAccess.value = await api.getAccess();
  };

  const loadThreads = async () => {
    isLoadingThreads.value = true;
    try {
      threads.value = await api.getThreads();
      hasLoadedThreads.value = true;
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      isLoadingThreads.value = false;
    }
  };

  /** Mở trợ lý ở khung chính, hội thoại đang mở nhường chỗ như khi mở một hội thoại khác. */
  const open = async () => {
    if (!canUse.value) return;
    await store.showAssistant();
    if (!hasLoadedThreads.value) void loadThreads();
    // Admin có thể vừa thêm hay gỡ mô hình, nạp lại mỗi lần mở cho danh sách luôn mới.
    void loadModels();
  };

  const newThread = () => {
    activeThreadId.value = null;
    store.view.value = "assistant";
  };

  const selectThread = async (threadId: string) => {
    activeThreadId.value = threadId;
    store.view.value = "assistant";
    if (messagesByThread.value[threadId]) return;

    isLoadingMessages.value = true;
    try {
      const list = await api.getMessages(threadId);
      messagesByThread.value = { ...messagesByThread.value, [threadId]: list };
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      isLoadingMessages.value = false;
    }
  };

  const deleteThread = async (threadId: string) => {
    try {
      await api.deleteThread(threadId);
      threads.value = threads.value.filter((t) => t.id !== threadId);
      const { [threadId]: _, ...rest } = messagesByThread.value;
      messagesByThread.value = rest;
      if (activeThreadId.value === threadId) activeThreadId.value = null;
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const patchMessage = (
    threadId: string,
    messageId: string,
    patch: (m: AssistantMessage) => AssistantMessage,
  ) => {
    const list = messagesByThread.value[threadId] ?? [];
    messagesByThread.value = {
      ...messagesByThread.value,
      [threadId]: list.map((m) => (m.id === messageId ? patch(m) : m)),
    };
  };

  const upsertStep = (steps: AssistantStep[], step: AssistantStep) =>
    steps.some((s) => s.id === step.id)
      ? steps.map((s) => (s.id === step.id ? step : s))
      : [...steps, step];

  /** Câu ngắn cho thẻ báo: bỏ dấu markdown, lấy dòng có chữ đầu tiên. */
  const replyPreview = (message: AssistantMessage) => {
    if (message.state === "error") return "Chưa trả lời được câu vừa hỏi, mở để xem lý do";
    if (message.choices) return message.choices.question;
    const line = message.content
      .split("\n")
      .map((l) => l.replace(/[*#`|>]/g, "").replace(/^\s*(?:[-•]|\d+[.)])\s+/, "").trim())
      .find(Boolean);
    return line || "Đã có kết quả tra cứu";
  };

  const notifyReply = (threadId: string, messageId: string) => {
    const message = (messagesByThread.value[threadId] ?? []).find((m) => m.id === messageId);
    if (message) store.noteAssistantReply(replyPreview(message));
  };

  /** `preferAssistant` bỏ qua tra nhanh, dùng cho nút "Hỏi trợ lý thêm" dưới thẻ tra nhanh. */
  const ask = async (content: string, options: { preferAssistant?: boolean } = {}) => {
    const question = content.trim();
    if (!question || isAsking.value) return false;

    isAsking.value = true;
    let threadId = activeThreadId.value;

    try {
      if (!threadId) {
        const thread = await api.createThread(app.value);
        threads.value = [thread, ...threads.value];
        messagesByThread.value = { ...messagesByThread.value, [thread.id]: [] };
        activeThreadId.value = thread.id;
        threadId = thread.id;
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
      isAsking.value = false;
      return false;
    }

    const id = threadId;
    const isFirstQuestion = !(messagesByThread.value[id] ?? []).length;
    const now = new Date().toISOString();
    const placeholderId = `pending-${Date.now()}`;
    messagesByThread.value = {
      ...messagesByThread.value,
      [id]: [
        ...(messagesByThread.value[id] ?? []),
        {
          id: `local-${Date.now()}`,
          threadId: id,
          role: "user",
          content: question,
          steps: [],
          citations: [],
          feedback: null,
          createdAtUtc: now,
        },
        {
          id: placeholderId,
          threadId: id,
          role: "assistant",
          content: "",
          steps: [],
          citations: [],
          feedback: null,
          createdAtUtc: now,
          state: "streaming",
        },
      ],
    };

    try {
      const answer = await api.ask(
        id,
        {
          content: question,
          context: { app: app.value, entity: entity.value },
          model: activeModel.value
            ? { providerId: activeModel.value.providerId, model: activeModel.value.model }
            : null,
          preferAssistant: options.preferAssistant || undefined,
        },
        {
          onStep: (step) =>
            patchMessage(id, placeholderId, (m) => ({ ...m, steps: upsertStep(m.steps, step) })),
          onDelta: (text) =>
            patchMessage(id, placeholderId, (m) => ({ ...m, content: m.content + text })),
        },
      );
      patchMessage(id, placeholderId, () => answer);
      notifyReply(id, answer.id);

      // Câu đầu tiên đặt tên cho cuộc hỏi ở phía server, nạp lại để danh sách có tên mới.
      const thread = threads.value.find((t) => t.id === id);
      if (isFirstQuestion || !thread) void loadThreads();
      else {
        threads.value = [
          { ...thread, lastMessageAtUtc: answer.createdAtUtc },
          ...threads.value.filter((t) => t.id !== id),
        ];
      }
      return true;
    } catch (err) {
      patchMessage(id, placeholderId, (m) => ({
        ...m,
        state: "error",
        content: m.content || extractErrorMessage(err),
      }));
      notifyReply(id, placeholderId);
      return false;
    } finally {
      isAsking.value = false;
    }
  };

  /** Chỉ câu trả lời mới nhất mới bấm được lựa chọn; đã có câu hỏi sau thì lựa chọn cũ hết hiệu lực. */
  const isLatestMessage = (message: AssistantMessage) => {
    const list = messagesByThread.value[message.threadId] ?? [];
    return list[list.length - 1]?.id === message.id;
  };

  /** Lựa chọn trả lời câu hỏi lại của mô hình: gửi thẳng cho mô hình để nó đọc tiếp ngữ cảnh, không tra nhanh. */
  const answerChoice = (option: string) => ask(option, { preferAssistant: true });

  /** Hỏi tiếp về một dòng trong thẻ danh sách; câu này đã đúng mẫu nên đi qua tra nhanh như câu gõ tay. */
  const askFollowUp = (question: string) => ask(question);

  /** Hỏi lại đúng câu đã tra nhanh, lần này để mô hình trả lời kỹ hơn. */
  const askAssistantAbout = (message: AssistantMessage) => {
    const list = messagesByThread.value[message.threadId] ?? [];
    const index = list.findIndex((m) => m.id === message.id);
    const question = list.slice(0, Math.max(index, 0)).reverse().find((m) => m.role === "user");
    if (question) return ask(question.content, { preferAssistant: true });
    return Promise.resolve(false);
  };

  const hasModels = computed(() => modelList.value.models.length > 0);

  /** Bấm lại đúng nút đang chọn là bỏ đánh giá. */
  const setFeedback = async (message: AssistantMessage, value: AssistantFeedback) => {
    const next = message.feedback === value ? null : value;
    patchMessage(message.threadId, message.id, (m) => ({ ...m, feedback: next }));
    try {
      await api.sendFeedback(message.id, next);
      if (next === "wrong") toast.info("Cảm ơn bạn, câu trả lời này sẽ được xem lại");
    } catch (err) {
      patchMessage(message.threadId, message.id, (m) => ({ ...m, feedback: message.feedback }));
      toast.error(extractErrorMessage(err));
    }
  };

  const openSettings = () => {
    if (canManage.value) store.view.value = "assistant-settings";
  };

  return {
    app,
    entity,
    access,
    canUse,
    canManage,
    threads,
    isLoadingThreads,
    activeThreadId,
    activeThread,
    activeMessages,
    isLoadingMessages,
    isAsking,
    modelList,
    isModelListLoaded,
    hasModels,
    activeModel,
    isDefaultModel,
    loadModels,
    pickModel,
    refreshAccess,
    loadThreads,
    open,
    newThread,
    selectThread,
    deleteThread,
    ask,
    askAssistantAbout,
    isLatestMessage,
    answerChoice,
    askFollowUp,
    setFeedback,
    openSettings,
  };
};
