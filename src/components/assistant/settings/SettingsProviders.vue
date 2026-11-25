<script setup lang="ts">
import { computed, ref, reactive, watch } from "vue";
import WidgetIcon from "../../WidgetIcon.vue";
import SettingSelect from "./SettingSelect.vue";
import SettingsProviderCard from "./SettingsProviderCard.vue";
import { useAssistantSettingsContext } from "../../../core/store/useAssistantSettings";
import type { AssistantProviderKind } from "../../../types/assistant";

const { providers, providerKinds, isAddingProvider, addProvider } = useAssistantSettingsContext();

/** Danh mục do máy chủ trả về; thêm nhà cung cấp mới bên máy chủ là giao diện tự có, không phải sửa ở đây. */
const KIND_OPTIONS = computed(() => providerKinds.value.map((k) => ({ label: k.label, value: k.kind })));

const isFormOpen = ref(false);
const draft = reactive({ kind: "anthropic" as AssistantProviderKind, label: "", apiKey: "", baseUrl: "" });

const selectedKind = computed(() => providerKinds.value.find((k) => k.kind === draft.kind));
const needsBaseUrl = computed(() => Boolean(selectedKind.value?.requiresBaseUrl));
const canSubmit = computed(
  () => Boolean(draft.label.trim() && draft.apiKey.trim() && (!needsBaseUrl.value || draft.baseUrl.trim())),
);

// Gợi sẵn tên theo loại; người dùng đã tự gõ tên thì không ghi đè.
watch(
  () => draft.kind,
  (kind, previous) => {
    const previousLabel = providerKinds.value.find((o) => o.kind === previous)?.label ?? "";
    if (!draft.label || draft.label === previousLabel) {
      const next = providerKinds.value.find((o) => o.kind === kind);
      draft.label = next?.requiresBaseUrl ? "" : (next?.label ?? "");
    }
  },
);

const open = () => {
  const first = providerKinds.value[0];
  Object.assign(draft, { kind: first?.kind ?? "anthropic", label: first?.label ?? "", apiKey: "", baseUrl: "" });
  isFormOpen.value = true;
};

const close = () => {
  isFormOpen.value = false;
  draft.apiKey = "";
};

const submit = async () => {
  if (!canSubmit.value) return;
  const provider = await addProvider({
    kind: draft.kind,
    label: draft.label.trim(),
    apiKey: draft.apiKey.trim(),
    baseUrl: needsBaseUrl.value ? draft.baseUrl.trim() : null,
  });
  // Khoá chỉ nằm trên form tới lúc gửi xong, không giữ lại trong bộ nhớ trang.
  draft.apiKey = "";
  if (provider) isFormOpen.value = false;
};

const INPUT =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-chat-accent/50 focus:ring-4 focus:ring-chat-accent/10";
</script>

<template>
  <section>
    <div class="flex items-end justify-between gap-3">
      <div class="min-w-0">
        <h3 class="text-sm font-semibold text-gray-900">Nhà cung cấp và khoá API</h3>
        <p class="mt-0.5 text-xs text-gray-500">
          Khoá được mã hoá trên máy chủ, sau khi lưu chỉ còn xem được vài ký tự đầu.
        </p>
      </div>
      <button
        v-if="!isFormOpen"
        type="button"
        class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-all hover:border-chat-accent/40 hover:text-chat-accent-strong active:scale-[0.98]"
        @click="open"
      >
        <WidgetIcon name="Plus" :size="14" />
        Thêm nhà cung cấp
      </button>
    </div>

    <form
      v-if="isFormOpen"
      class="mt-3 space-y-4 rounded-2xl border border-gray-200 bg-gray-50/70 p-4"
      @submit.prevent="submit"
    >
      <div class="grid gap-4">
        <div>
          <p class="mb-1.5 text-xs font-medium text-gray-600">Loại</p>
          <SettingSelect v-model="draft.kind" :options="KIND_OPTIONS" />
        </div>
        <label class="block">
          <span class="mb-1.5 block text-xs font-medium text-gray-600">Tên hiển thị</span>
          <input v-model="draft.label" type="text" maxlength="60" :class="INPUT" />
        </label>
      </div>
      <p v-if="selectedKind" class="-mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
        <span>Tên mô hình ví dụ: <code class="font-mono text-gray-700">{{ selectedKind.modelExamples }}</code></span>
        <span>{{ selectedKind.supportsEmbedding ? "Có mô hình đọc tài liệu" : "Không có mô hình đọc tài liệu" }}</span>
      </p>
      <label v-if="needsBaseUrl" class="block">
        <span class="mb-1.5 block text-xs font-medium text-gray-600">Địa chỉ máy chủ</span>
        <input v-model="draft.baseUrl" type="url" spellcheck="false" placeholder="https://.../v1" :class="[INPUT, 'font-mono']" />
      </label>
      <label class="block">
        <span class="mb-1.5 block text-xs font-medium text-gray-600">Khoá API</span>
        <input
          v-model="draft.apiKey"
          type="password"
          autocomplete="off"
          spellcheck="false"
          placeholder="Dán khoá API"
          :class="[INPUT, 'font-mono']"
        />
        <span class="mt-1.5 block text-xs text-gray-500">Lưu xong máy chủ sẽ gọi thử ngay để báo khoá có dùng được không.</span>
      </label>
      <div class="flex items-center justify-end gap-2">
        <button
          type="button"
          class="rounded-full px-3.5 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-white"
          :disabled="isAddingProvider"
          @click="close"
        >
          Huỷ
        </button>
        <button
          type="submit"
          class="inline-flex items-center gap-1.5 rounded-full bg-chat-accent-strong px-4 py-2 text-sm font-medium text-white transition-all hover:bg-chat-accent active:scale-[0.98] disabled:opacity-60"
          :disabled="isAddingProvider || !canSubmit"
        >
          <WidgetIcon v-if="isAddingProvider" name="Loader2" :size="15" class="animate-spin" />
          {{ isAddingProvider ? "Đang kiểm tra khoá" : "Lưu và kiểm tra" }}
        </button>
      </div>
    </form>

    <ul v-if="providers.length" class="mt-3 divide-y divide-gray-100 rounded-2xl border border-gray-200">
      <SettingsProviderCard v-for="provider in providers" :key="provider.id" :provider="provider" />
    </ul>
    <div v-else-if="!isFormOpen" class="mt-3 rounded-2xl border border-dashed border-gray-300 px-4 py-8 text-center">
      <WidgetIcon name="KeyRound" :size="20" class="mx-auto text-gray-400" />
      <p class="mt-2 text-sm font-medium text-gray-800">Chưa có nhà cung cấp nào</p>
      <p class="mt-0.5 text-xs text-gray-500">Thêm một nhà cung cấp kèm khoá API để trợ lý trả lời được.</p>
    </div>
  </section>
</template>
