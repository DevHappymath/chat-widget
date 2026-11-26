import { computed, inject, onScopeDispose, ref, watch } from "vue";
import { extractErrorMessage } from "../../utils/error";
import { useAssistantGateway } from "./useAssistant";
import { useWidgetToast } from "./useWidgetToast";
import type {
  AssistantProviderKindOption,
  AssistantSettingsResponse,
  AddAssistantProviderCommand,
  AssistantModelPurpose,
  AssistantLookupLog,
  AssistantProviderOption,
  AssistantSettings,
  AssistantUsage,
  KnowledgeDocument,
  UpdateAssistantSettingsCommand,
} from "../../types/assistant";

export type AssistantSettingsTab = "general" | "model" | "documents" | "limits" | "usage";

export const ASSISTANT_SETTINGS_TABS: { value: AssistantSettingsTab; label: string; icon: string }[] = [
  { value: "general", label: "Chung", icon: "SlidersHorizontal" },
  { value: "model", label: "Mô hình", icon: "Cpu" },
  { value: "documents", label: "Tài liệu", icon: "FileText" },
  { value: "limits", label: "Giới hạn", icon: "Gauge" },
  { value: "usage", label: "Sử dụng", icon: "ChartColumn" },
];

const toCommand = (s: AssistantSettings): UpdateAssistantSettingsCommand => ({
  enabled: s.enabled,
  allowedRoles: [...s.allowedRoles],
  chatProvider: s.chatProvider,
  chatModel: s.chatModel,
  embeddingProvider: s.embeddingProvider,
  embeddingModel: s.embeddingModel,
  maxQuestionsPerMinute: s.maxQuestionsPerMinute,
  dailyTokenQuotaPerUser: s.dailyTokenQuotaPerUser,
  maskPhoneNumbers: s.maskPhoneNumbers,
  quickLookupEnabled: s.quickLookupEnabled,
  retentionDays: s.retentionDays,
});

/** Các tab con lấy chung một trạng thái do `AssistantSettings` tạo và provide. */
export const useAssistantSettingsContext = () =>
  inject<ReturnType<typeof useAssistantSettings>>("assistant-settings")!;

/** Trạng thái màn cài đặt trợ lý; backend mới là nơi chặn người không phải admin. */
export const useAssistantSettings = () => {
  const api = useAssistantGateway();
  const toast = useWidgetToast();

  const tab = ref<AssistantSettingsTab>("general");
  const isLoading = ref(false);
  const isSaving = ref(false);

  const saved = ref<AssistantSettings | null>(null);
  const form = ref<UpdateAssistantSettingsCommand | null>(null);
  const providers = ref<AssistantProviderOption[]>([]);
  const availableRoles = ref<string[]>([]);
  const providerKinds = ref<AssistantProviderKindOption[]>([]);

  const documents = ref<KnowledgeDocument[]>([]);
  const isLoadingDocuments = ref(false);
  const isUploading = ref(false);

  const usageDays = ref(14);
  const usage = ref<AssistantUsage | null>(null);
  const lookupLogs = ref<AssistantLookupLog[]>([]);
  const isLoadingUsage = ref(false);

  const isDirty = computed(
    () =>
      Boolean(saved.value && form.value) &&
      JSON.stringify(toCommand(saved.value!)) !== JSON.stringify(form.value),
  );

  /** Đổi model nhúng thì vector cũ không so được với câu hỏi mới, phải nhúng lại hết tài liệu. */
  const embeddingChanged = computed(
    () =>
      Boolean(saved.value && form.value) &&
      (saved.value!.embeddingProvider !== form.value!.embeddingProvider ||
        saved.value!.embeddingModel !== form.value!.embeddingModel),
  );

  const apply = (response: AssistantSettingsResponse) => {
    saved.value = response.settings;
    form.value = toCommand(response.settings);
    providers.value = response.providers;
    availableRoles.value = response.availableRoles;
    providerKinds.value = response.providerKinds ?? [];
  };

  const load = async () => {
    isLoading.value = true;
    try {
      apply(await api.getSettings());
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      isLoading.value = false;
    }
  };

  const reset = () => {
    if (saved.value) form.value = toCommand(saved.value);
  };

  const save = async () => {
    if (!form.value || isSaving.value) return false;
    // Bỏ mô hình đọc tài liệu thì không đọc lại: không còn mô hình nào để đọc.
    const needsReindex = embeddingChanged.value && Boolean(form.value.embeddingModel);

    isSaving.value = true;
    try {
      apply(await api.updateSettings(form.value));
      toast.success("Đã lưu cài đặt trợ lý");
      if (needsReindex) {
        await api.reindexAll();
        await loadDocuments();
        toast.info("Đang nhúng lại toàn bộ tài liệu theo mô hình mới");
      }
      return true;
    } catch (err) {
      toast.error(extractErrorMessage(err));
      return false;
    } finally {
      isSaving.value = false;
    }
  };

  /** Nhà cung cấp đang gọi server (kiểm tra khoá, đổi khoá, thêm/gỡ model), để hiện vòng quay đúng chỗ. */
  const busyProviderIds = ref<string[]>([]);
  const isAddingProvider = ref(false);

  const replaceProvider = (provider: AssistantProviderOption) => {
    providers.value = providers.value.map((p) => (p.id === provider.id ? provider : p));
  };

  const runOnProvider = async (
    providerId: string,
    request: () => Promise<AssistantProviderOption>,
    success?: (provider: AssistantProviderOption) => string | null,
  ) => {
    busyProviderIds.value = [...busyProviderIds.value, providerId];
    try {
      const provider = await request();
      replaceProvider(provider);
      const message = success?.(provider);
      if (message) toast.success(message);
      return provider;
    } catch (err) {
      toast.error(extractErrorMessage(err));
      return null;
    } finally {
      busyProviderIds.value = busyProviderIds.value.filter((id) => id !== providerId);
    }
  };

  const keyResultMessage = (provider: AssistantProviderOption) =>
    provider.keyStatus === "valid" ? `Khoá của ${provider.label} dùng được` : null;

  const addProvider = async (command: AddAssistantProviderCommand) => {
    isAddingProvider.value = true;
    try {
      const provider = await api.addProvider(command);
      providers.value = [...providers.value, provider];
      if (provider.keyStatus === "valid") toast.success(`Đã thêm ${provider.label}, khoá dùng được`);
      else toast.error(`Đã lưu ${provider.label} nhưng khoá chưa dùng được`);
      return provider;
    } catch (err) {
      toast.error(extractErrorMessage(err));
      return null;
    } finally {
      isAddingProvider.value = false;
    }
  };

  const updateProviderKey = (providerId: string, apiKey: string) =>
    runOnProvider(providerId, () => api.updateProviderKey(providerId, apiKey), keyResultMessage);

  const testProviderKey = (providerId: string) =>
    runOnProvider(providerId, () => api.testProviderKey(providerId), keyResultMessage);

  const addModel = (providerId: string, name: string, purpose: AssistantModelPurpose) =>
    runOnProvider(providerId, () => api.addModel(providerId, name, purpose));

  const removeModel = (providerId: string, name: string, purpose: AssistantModelPurpose) =>
    runOnProvider(providerId, () => api.removeModel(providerId, name, purpose));

  const deleteProvider = async (providerId: string) => {
    try {
      await api.deleteProvider(providerId);
      providers.value = providers.value.filter((p) => p.id !== providerId);
      toast.success("Đã xoá nhà cung cấp và khoá của nó");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const loadDocuments = async () => {
    isLoadingDocuments.value = true;
    try {
      documents.value = await api.getDocuments();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      isLoadingDocuments.value = false;
    }
  };

  const uploadDocument = async (file: File, title: string, allowedRoles: string[]) => {
    isUploading.value = true;
    try {
      const document = await api.uploadDocument({ file, title, allowedRoles });
      documents.value = [document, ...documents.value];
      toast.success("Đã tải tài liệu lên, trợ lý sẽ dùng được sau khi xử lý xong");
      return true;
    } catch (err) {
      toast.error(extractErrorMessage(err));
      return false;
    } finally {
      isUploading.value = false;
    }
  };

  const replaceDocument = (document: KnowledgeDocument) => {
    documents.value = documents.value.map((d) => (d.id === document.id ? document : d));
  };

  const updateDocumentRoles = async (documentId: string, roles: string[]) => {
    try {
      replaceDocument(await api.updateDocumentRoles(documentId, roles));
      toast.success("Đã đổi người được tra tài liệu");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const reindexDocument = async (documentId: string) => {
    try {
      replaceDocument(await api.reindexDocument(documentId));
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const deleteDocument = async (documentId: string) => {
    try {
      await api.deleteDocument(documentId);
      documents.value = documents.value.filter((d) => d.id !== documentId);
      toast.success("Đã xoá tài liệu, trợ lý không còn dùng tài liệu này");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const loadUsage = async () => {
    isLoadingUsage.value = true;
    try {
      const [usageData, logs] = await Promise.all([
        api.getUsage(usageDays.value),
        api.getLookupLogs(1, 20),
      ]);
      usage.value = usageData;
      lookupLogs.value = logs.items;
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      isLoadingUsage.value = false;
    }
  };

  // Tài liệu đang xử lý ở worker nền; hỏi lại định kỳ tới khi xong để trạng thái tự đổi.
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  watch(
    () => documents.value.some((d) => d.status === "processing"),
    (processing) => {
      if (processing && !pollTimer) {
        pollTimer = setInterval(async () => {
          try {
            documents.value = await api.getDocuments();
          } catch {
            // Lần sau hỏi lại, không làm phiền người dùng vì một lần hỏi hỏng.
          }
        }, 3_000);
      } else if (!processing && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    },
  );
  onScopeDispose(() => {
    if (pollTimer) clearInterval(pollTimer);
  });

  watch(usageDays, loadUsage);

  return {
    tab,
    isLoading,
    isSaving,
    saved,
    form,
    providers,
    availableRoles,
    providerKinds,
    isDirty,
    embeddingChanged,
    load,
    reset,
    save,
    busyProviderIds,
    isAddingProvider,
    addProvider,
    updateProviderKey,
    testProviderKey,
    addModel,
    removeModel,
    deleteProvider,
    documents,
    isLoadingDocuments,
    isUploading,
    loadDocuments,
    uploadDocument,
    updateDocumentRoles,
    reindexDocument,
    deleteDocument,
    usageDays,
    usage,
    lookupLogs,
    isLoadingUsage,
    loadUsage,
  };
};
