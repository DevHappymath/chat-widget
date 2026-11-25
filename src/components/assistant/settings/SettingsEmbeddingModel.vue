<script setup lang="ts">
import { computed, watch } from "vue";
import WidgetIcon from "../../WidgetIcon.vue";
import SettingSelect from "./SettingSelect.vue";
import { useAssistantSettingsContext } from "../../../core/store/useAssistantSettings";

const { form, providers, embeddingChanged } = useAssistantSettingsContext();

// Giữ lại nhà cung cấp đang chọn dù khoá vừa hỏng, để ô chọn không bỗng dưng trống.
const providerOptions = computed(() =>
  providers.value
    .filter(
      (p) =>
        p.embeddingModels.length &&
        ((p.keyPreview && p.keyStatus !== "invalid") || p.id === form.value?.embeddingProvider),
    )
    .map((p) => ({ label: p.label, value: p.id })),
);

const selectedProvider = computed(() => providers.value.find((p) => p.id === form.value?.embeddingProvider));
const modelOptions = computed(() =>
  (selectedProvider.value?.embeddingModels ?? []).map((model) => ({ label: model, value: model })),
);

// Đổi nhà cung cấp thì mô hình cũ không còn trong danh sách, chọn sẵn mô hình đầu tiên của bên mới.
watch(
  () => form.value?.embeddingProvider,
  () => {
    const models = selectedProvider.value?.embeddingModels ?? [];
    if (form.value && models.length && !models.includes(form.value.embeddingModel)) {
      form.value.embeddingModel = models[0]!;
    }
  },
);
</script>

<template>
  <section v-if="form" class="rounded-2xl border border-gray-200 p-4">
    <p class="text-sm font-semibold text-gray-900">Mô hình đọc tài liệu</p>
    <p class="mt-0.5 text-xs text-gray-500">
      Dùng chung cho mọi người: tài liệu được đọc sẵn bằng mô hình này để tìm đoạn liên quan tới câu hỏi.
    </p>

    <div class="mt-3 grid gap-3">
      <div>
        <p class="mb-1.5 text-xs font-medium text-gray-600">Nhà cung cấp</p>
        <SettingSelect
          v-model="form.embeddingProvider"
          :options="providerOptions"
          placeholder="Chưa có nhà cung cấp phù hợp"
        />
      </div>
      <div>
        <p class="mb-1.5 text-xs font-medium text-gray-600">Mô hình</p>
        <SettingSelect v-model="form.embeddingModel" :options="modelOptions" placeholder="Chọn mô hình" />
      </div>
    </div>

    <p v-if="selectedProvider?.keyStatus === 'invalid'" class="mt-2 flex items-center gap-1.5 text-xs text-red-600">
      <WidgetIcon name="CircleX" :size="14" />
      Khoá của {{ selectedProvider.label }} đang không dùng được, trợ lý chưa tra được tài liệu.
    </p>

    <div
      v-if="embeddingChanged"
      class="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800"
    >
      <WidgetIcon name="TriangleAlert" :size="15" class="mt-px shrink-0" />
      <span>
        Đổi mô hình này thì mọi tài liệu phải đọc lại từ đầu. Trong lúc đọc lại, trợ lý chưa tra được
        tài liệu nội bộ.
      </span>
    </div>
  </section>
</template>
