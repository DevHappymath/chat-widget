<script setup lang="ts">
import { computed, ref } from "vue";
import WidgetIcon from "../../WidgetIcon.vue";
import TipWrap from "./TipWrap.vue";
import { useAssistantSettingsContext } from "../../../core/store/useAssistantSettings";
import { useWidgetConfirm } from "../../../core/store/useWidgetConfirm";
import { formatDateTime } from "../../../utils/format";
import type { AssistantKeyStatus, AssistantModelPurpose, AssistantProviderOption } from "../../../types/assistant";

const props = defineProps<{ provider: AssistantProviderOption }>();

const { form, providerKinds, busyProviderIds, updateProviderKey, testProviderKey, addModel, removeModel, deleteProvider } =
  useAssistantSettingsContext();

const kindInfo = computed(() => providerKinds.value.find((k) => k.kind === props.provider.kind));
const { ask } = useWidgetConfirm();

const isBusy = computed(() => busyProviderIds.value.includes(props.provider.id));
const isInUse = computed(
  () => form.value?.chatProvider === props.provider.id || form.value?.embeddingProvider === props.provider.id,
);

const STATUS: Record<AssistantKeyStatus, { icon: string; label: string; class: string }> = {
  valid: { icon: "CircleCheck", label: "Dùng được", class: "text-emerald-600" },
  invalid: { icon: "CircleX", label: "Không dùng được", class: "text-red-600" },
  untested: { icon: "CircleHelp", label: "Chưa kiểm tra", class: "text-gray-400" },
};

const isEditingKey = ref(false);
const newKey = ref("");

const saveKey = async () => {
  const key = newKey.value.trim();
  if (!key) return;
  if (await updateProviderKey(props.provider.id, key)) cancelKey();
};

const cancelKey = () => {
  isEditingKey.value = false;
  newKey.value = "";
};

// Bên không có mô hình đọc tài liệu thì bỏ hẳn dòng đó, để ô thêm không dẫn người ta gõ tên không dùng được.
const PURPOSES = computed<{ value: AssistantModelPurpose; label: string }[]>(() => [
  { value: "chat", label: "Trả lời" },
  ...(kindInfo.value?.supportsEmbedding === false ? [] : [{ value: "embedding" as const, label: "Đọc tài liệu" }]),
]);

const addingPurpose = ref<AssistantModelPurpose | null>(null);
const newModel = ref("");

const modelsOf = (purpose: AssistantModelPurpose) =>
  purpose === "chat" ? props.provider.chatModels : props.provider.embeddingModels;

const isModelInUse = (purpose: AssistantModelPurpose, model: string) =>
  purpose === "chat"
    ? form.value?.chatProvider === props.provider.id && form.value?.chatModel === model
    : form.value?.embeddingProvider === props.provider.id && form.value?.embeddingModel === model;

/** Khoá bị từ chối thì mô hình của bên này không trả lời được, không cho đặt làm mặc định. */
const isUsable = computed(() => Boolean(props.provider.keyPreview) && props.provider.keyStatus !== "invalid");

/** Vào bản nháp cài đặt, lưu bằng thanh lưu chung như các thay đổi khác. */
const setDefault = (model: string) => {
  if (!form.value || !isUsable.value) return;
  form.value.chatProvider = props.provider.id;
  form.value.chatModel = model;
};

const startAddModel = (purpose: AssistantModelPurpose) => {
  addingPurpose.value = purpose;
  newModel.value = "";
};

const submitModel = async () => {
  const name = newModel.value.trim();
  if (!name || !addingPurpose.value) return;
  if (await addModel(props.provider.id, name, addingPurpose.value)) addingPurpose.value = null;
};

const onDelete = async () => {
  const agreed = await ask({
    title: "Xoá nhà cung cấp",
    message: `Xoá ${props.provider.label} cùng khoá API và danh sách mô hình của nó?`,
    confirmText: "Xoá",
  });
  if (agreed) await deleteProvider(props.provider.id);
};

const ICON_ACTION =
  "inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:pointer-events-none disabled:opacity-40";
const INPUT =
  "min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-900 outline-none transition-colors focus:border-chat-accent/50 focus:ring-4 focus:ring-chat-accent/10";
</script>

<template>
  <li class="p-4">
    <div class="flex items-start gap-3">
      <span
        class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-sm font-semibold text-gray-600"
        aria-hidden="true"
      >
        {{ provider.label.charAt(0).toUpperCase() }}
      </span>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p class="truncate text-sm font-semibold text-gray-900">{{ provider.label }}</p>
          <span v-if="kindInfo && kindInfo.label !== provider.label" class="text-xs text-gray-400">{{ kindInfo.label }}</span>
          <span
            v-if="isInUse"
            class="rounded-full bg-chat-accent/10 px-2 py-0.5 text-[11px] font-medium text-chat-accent-strong"
          >
            Đang dùng
          </span>
        </div>

        <p v-if="provider.baseUrl" class="mt-0.5 truncate font-mono text-[11px] text-gray-500">
          {{ provider.baseUrl }}
        </p>

        <!-- Khoá chỉ có vài ký tự đầu do máy chủ trả về, kèm kết quả lần kiểm tra gần nhất. -->
        <div class="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
          <code v-if="provider.keyPreview" class="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-gray-700">
            {{ provider.keyPreview }}<span class="text-gray-400">••••••</span>
          </code>
          <span v-else class="text-gray-500">Chưa có khoá</span>

          <span
            v-if="provider.keyPreview"
            class="inline-flex items-center gap-1 font-medium"
            :class="isBusy ? 'text-gray-500' : STATUS[provider.keyStatus].class"
          >
            <WidgetIcon v-if="isBusy" name="Loader2" :size="14" class="animate-spin" />
            <WidgetIcon v-else :name="STATUS[provider.keyStatus].icon" :size="14" />
            {{ isBusy ? "Đang kiểm tra" : STATUS[provider.keyStatus].label }}
          </span>

          <span v-if="provider.keyCheckedAtUtc && !isBusy" class="text-gray-400">
            {{ formatDateTime(provider.keyCheckedAtUtc) }}
          </span>
        </div>

        <p v-if="provider.keyStatus === 'invalid' && provider.keyError && !isBusy" class="mt-1 text-xs text-red-600">
          {{ provider.keyError }}
        </p>
      </div>

      <div class="flex shrink-0 items-center">
        <TipWrap v-if="provider.keyPreview" content="Kiểm tra khoá">
          <button
            type="button"
            :class="ICON_ACTION"
            :disabled="isBusy"
            :aria-label="`Kiểm tra khoá của ${provider.label}`"
            @click="testProviderKey(provider.id)"
          >
            <WidgetIcon name="RefreshCw" :size="15" />
          </button>
        </TipWrap>
        <TipWrap :content="provider.keyPreview ? 'Đổi khoá' : 'Thêm khoá'">
          <button
            type="button"
            :class="[ICON_ACTION, isEditingKey && 'bg-chat-accent/10 text-chat-accent-strong']"
            :disabled="isBusy"
            :aria-label="`Đổi khoá của ${provider.label}`"
            @click="isEditingKey ? cancelKey() : (isEditingKey = true)"
          >
            <WidgetIcon name="KeyRound" :size="15" />
          </button>
        </TipWrap>
        <TipWrap :content="isInUse ? 'Đang được dùng, chọn nhà cung cấp khác trước khi xoá' : 'Xoá nhà cung cấp'">
          <button
            type="button"
            :class="[ICON_ACTION, 'hover:bg-red-50 hover:text-red-600']"
            :disabled="isInUse"
            :aria-label="`Xoá ${provider.label}`"
            @click="onDelete"
          >
            <WidgetIcon name="Trash2" :size="15" />
          </button>
        </TipWrap>
      </div>
    </div>

    <form v-if="isEditingKey" class="mt-3 flex items-center gap-2 pl-12" @submit.prevent="saveKey">
      <input
        v-model="newKey"
        type="password"
        autocomplete="off"
        spellcheck="false"
        placeholder="Dán khoá API mới"
        :class="INPUT"
        @keydown.esc="cancelKey"
      />
      <button
        type="submit"
        class="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-chat-accent-strong px-3.5 py-2 text-xs font-medium text-white transition-all hover:bg-chat-accent active:scale-[0.98] disabled:opacity-60"
        :disabled="isBusy || !newKey.trim()"
      >
        <WidgetIcon v-if="isBusy" name="Loader2" :size="13" class="animate-spin" />
        Lưu và kiểm tra
      </button>
    </form>

    <dl class="mt-3 grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-2 pl-12">
      <template v-for="purpose in PURPOSES" :key="purpose.value">
        <dt class="pt-1 text-xs text-gray-500">{{ purpose.label }}</dt>
        <dd class="flex flex-wrap items-center gap-1.5">
          <span
            v-for="model in modelsOf(purpose.value)"
            :key="model"
            class="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white py-0.5 pr-0.5 font-mono text-xs text-gray-700"
            :class="[
              isModelInUse(purpose.value, model) && 'border-chat-accent/40 bg-chat-accent/5 text-chat-accent-strong',
              purpose.value === 'chat' ? 'pl-0.5' : 'pl-2',
            ]"
          >
            <TipWrap
              v-if="purpose.value === 'chat'"
              :content="isModelInUse('chat', model) ? 'Mô hình mặc định' : isUsable ? 'Đặt làm mặc định' : 'Khoá chưa dùng được'"
            >
              <button
                type="button"
                class="inline-flex h-5 w-5 items-center justify-center rounded-md transition-colors disabled:pointer-events-none"
                :class="
                  isModelInUse('chat', model)
                    ? 'text-amber-500'
                    : 'text-gray-300 hover:bg-amber-50 hover:text-amber-500 disabled:opacity-40'
                "
                :disabled="!isUsable && !isModelInUse('chat', model)"
                :aria-pressed="isModelInUse('chat', model)"
                :aria-label="`Đặt ${model} làm mô hình mặc định`"
                @click="setDefault(model)"
              >
                <WidgetIcon name="Star" :size="12" :class="isModelInUse('chat', model) && 'fill-current'" />
              </button>
            </TipWrap>
            {{ model }}
            <button
              type="button"
              class="inline-flex h-5 w-5 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:pointer-events-none disabled:opacity-0"
              :disabled="isBusy || isModelInUse(purpose.value, model)"
              :aria-label="`Gỡ mô hình ${model}`"
              @click="removeModel(provider.id, model, purpose.value)"
            >
              <WidgetIcon name="X" :size="12" />
            </button>
          </span>

          <form
            v-if="addingPurpose === purpose.value"
            class="flex items-center gap-1.5"
            @submit.prevent="submitModel"
          >
            <input
              v-model="newModel"
              type="text"
              spellcheck="false"
              placeholder="Tên mô hình"
              class="w-40 rounded-lg border border-gray-200 bg-white px-2 py-1 font-mono text-xs text-gray-900 outline-none focus:border-chat-accent/50 focus:ring-2 focus:ring-chat-accent/15"
              @keydown.esc="addingPurpose = null"
            />
            <button
              type="submit"
              class="rounded-lg bg-chat-accent-strong px-2 py-1 text-xs font-medium text-white hover:bg-chat-accent disabled:opacity-60"
              :disabled="isBusy || !newModel.trim()"
            >
              Thêm
            </button>
            <button
              type="button"
              class="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Huỷ thêm mô hình"
              @click="addingPurpose = null"
            >
              <WidgetIcon name="X" :size="13" />
            </button>
          </form>
          <button
            v-else
            type="button"
            class="inline-flex items-center gap-1 rounded-lg border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 transition-colors hover:border-chat-accent/50 hover:text-chat-accent-strong"
            @click="startAddModel(purpose.value)"
          >
            <WidgetIcon name="Plus" :size="12" />
            Thêm
          </button>
        </dd>
      </template>
    </dl>
  </li>
</template>
