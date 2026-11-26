<script setup lang="ts">
import { computed, ref } from "vue";
import WidgetIcon from "../../WidgetIcon.vue";
import { useAssistantSettingsContext } from "../../../core/store/useAssistantSettings";
import type { AssistantProviderOption } from "../../../types/assistant";

const { form, saved, providers, embeddingChanged } = useAssistantSettingsContext();

const isPicking = ref(false);

// Giữ cả nhà cung cấp đang chọn dù khoá vừa hỏng, để người quản trị thấy và đổi sang bên khác.
const groups = computed(() =>
  providers.value.filter(
    (p) =>
      p.embeddingModels.length &&
      ((p.keyPreview && p.keyStatus !== "invalid") || p.id === form.value?.embeddingProvider),
  ),
);

const current = computed(() => {
  const provider = providers.value.find((p) => p.id === form.value?.embeddingProvider);
  return provider && form.value?.embeddingModel ? { provider, model: form.value.embeddingModel } : null;
});

const showPicker = computed(() => isPicking.value || !current.value);
/** Đang có mô hình đã lưu mà người quản trị vừa bỏ đi, chưa bấm lưu. */
const isRemoving = computed(() => !current.value && Boolean(saved.value?.embeddingModel));

const isSelected = (provider: AssistantProviderOption, model: string) =>
  form.value?.embeddingProvider === provider.id && form.value?.embeddingModel === model;

const choose = (provider: AssistantProviderOption, model: string) => {
  if (!form.value) return;
  form.value.embeddingProvider = provider.id;
  form.value.embeddingModel = model;
  isPicking.value = false;
};

const remove = () => {
  if (!form.value) return;
  form.value.embeddingProvider = "";
  form.value.embeddingModel = "";
  isPicking.value = false;
};

const ACTION =
  "inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98]";
</script>

<template>
  <section v-if="form" class="rounded-2xl border border-gray-200 p-3.5">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="text-sm font-semibold text-gray-900">Mô hình đọc tài liệu</p>
        <p class="mt-0.5 text-xs leading-relaxed text-gray-500">
          Dùng chung cho mọi người: tài liệu được đọc sẵn bằng mô hình này để tìm đúng đoạn liên quan tới câu hỏi.
        </p>
      </div>
      <div v-if="current && !isPicking" class="flex shrink-0 items-center gap-1">
        <button type="button" :class="ACTION" @click="isPicking = true">
          <WidgetIcon name="ArrowLeftRight" :size="12" />
          Đổi
        </button>
        <button
          type="button"
          :class="[ACTION, 'hover:border-red-200 hover:bg-red-50 hover:text-red-600']"
          @click="remove"
        >
          <WidgetIcon name="X" :size="12" />
          Bỏ
        </button>
      </div>
      <button v-else-if="current && isPicking" type="button" :class="ACTION" @click="isPicking = false">Huỷ</button>
    </div>

    <div
      v-if="current && !isPicking"
      class="mt-3 flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5"
    >
      <span
        class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-chat-accent/10 text-chat-accent-strong"
      >
        <WidgetIcon name="ScanText" :size="16" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="truncate font-mono text-[13px] font-medium text-gray-900">{{ current.model }}</p>
        <p class="truncate text-xs text-gray-500">{{ current.provider.label }}</p>
      </div>
      <span
        v-if="current.provider.keyStatus === 'invalid'"
        class="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600"
      >
        <WidgetIcon name="CircleX" :size="12" />
        Khoá hỏng
      </span>
      <span
        v-else-if="current.provider.keyStatus === 'valid'"
        class="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
      >
        <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Dùng được
      </span>
    </div>

    <div
      v-if="!current"
      class="mt-3 flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50 px-3 py-2.5 text-amber-900"
    >
      <WidgetIcon name="TriangleAlert" :size="15" class="mt-px text-amber-600" />
      <div class="text-xs leading-relaxed">
        <p class="font-semibold">Chưa có mô hình đọc tài liệu</p>
        <p v-if="groups.length" class="mt-0.5 text-amber-800">
          Trợ lý đang tra tài liệu theo từ khoá, có thể bỏ sót đoạn dùng từ khác nghĩa với câu hỏi. Chọn một mô hình bên dưới rồi lưu để tra theo nghĩa.
        </p>
        <p v-else class="mt-0.5 text-amber-800">
          Trợ lý đang tra tài liệu theo từ khoá. Muốn tra theo nghĩa thì thêm mô hình đọc tài liệu cho một nhà cung cấp ở tab Mô hình.
        </p>
      </div>
    </div>

    <Transition name="gdtd-picker">
      <div v-if="showPicker && groups.length" class="mt-3 space-y-2.5">
        <div v-for="provider in groups" :key="provider.id">
          <p class="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-gray-400 uppercase">
            {{ provider.label }}
            <span
              v-if="provider.keyStatus === 'invalid'"
              class="rounded-full bg-red-50 px-1.5 py-px text-[10px] tracking-normal text-red-600 normal-case"
            >
              khoá hỏng
            </span>
          </p>
          <div class="grid gap-1.5" role="radiogroup" :aria-label="`Mô hình của ${provider.label}`">
            <button
              v-for="model in provider.embeddingModels"
              :key="model"
              type="button"
              role="radio"
              :aria-checked="isSelected(provider, model)"
              class="flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all active:scale-[0.99]"
              :class="
                isSelected(provider, model)
                  ? 'border-chat-accent-strong bg-chat-accent/5 ring-2 ring-chat-accent/15'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/70'
              "
              @click="choose(provider, model)"
            >
              <span class="min-w-0 flex-1 truncate font-mono text-[13px] text-gray-800">{{ model }}</span>
              <span
                class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors"
                :class="
                  isSelected(provider, model)
                    ? 'border-chat-accent-strong bg-chat-accent-strong text-white'
                    : 'border-gray-300 bg-white'
                "
              >
                <WidgetIcon v-if="isSelected(provider, model)" name="Check" :size="10" :stroke="3" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <div
      v-if="isRemoving"
      class="mt-3 flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2.5 text-xs leading-relaxed text-gray-600"
    >
      <WidgetIcon name="Info" :size="14" class="mt-px text-gray-400" />
      <span>
        Lưu xong, trợ lý chuyển sang tra tài liệu theo từ khoá. Tài liệu đã tải vẫn dùng được, chọn lại mô hình là tài liệu được đọc lại để tra theo nghĩa.
      </span>
    </div>

    <div
      v-else-if="embeddingChanged && current"
      class="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800"
    >
      <WidgetIcon name="TriangleAlert" :size="14" class="mt-px" />
      <span>
        Đổi mô hình này thì mọi tài liệu phải đọc lại từ đầu. Trong lúc đọc lại, tài liệu chưa đọc xong tạm chưa tra được.
      </span>
    </div>
  </section>
</template>

<style scoped>
.gdtd-picker-enter-active,
.gdtd-picker-leave-active {
  transition:
    opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.gdtd-picker-enter-from,
.gdtd-picker-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
