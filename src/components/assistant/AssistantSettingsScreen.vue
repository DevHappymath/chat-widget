<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, watch } from "vue";
import { useAssistant } from "../../core/store/useAssistant";
import {
  ASSISTANT_SETTINGS_TABS,
  useAssistantSettings,
  type AssistantSettingsTab,
} from "../../core/store/useAssistantSettings";
import { useWidgetConfirm } from "../../core/store/useWidgetConfirm";
import { formatDateTime } from "../../utils/format";
import WidgetIcon from "../WidgetIcon.vue";
import SettingsDocuments from "./settings/SettingsDocuments.vue";
import SettingsGeneral from "./settings/SettingsGeneral.vue";
import SettingsLimits from "./settings/SettingsLimits.vue";
import SettingsModel from "./settings/SettingsModel.vue";
import SettingsUsage from "./settings/SettingsUsage.vue";

const settings = useAssistantSettings();
const { tab, form, isLoading, isDirty, isSaving, embeddingChanged, save, reset } = settings;
const { refreshAccess, loadModels } = useAssistant();

// Rời cài đặt là quay về khung hỏi: nạp lại danh sách mô hình vì có thể vừa thêm, gỡ hay đổi mặc định.
onBeforeUnmount(loadModels);
const { ask } = useWidgetConfirm();

provide("assistant-settings", settings);

// Tải tài liệu, khoá, thêm mô hình tự lưu từng thao tác; chỉ các lựa chọn trong bản nháp cài đặt
// (mặc định, mô hình đọc tài liệu, giới hạn...) mới cần thanh lưu chung.
const hasSaveBar = computed(() => tab.value !== "usage" && isDirty.value);

const onSave = async () => {
  if (embeddingChanged.value) {
    const agreed = await ask({
      title: "Đổi mô hình đọc tài liệu",
      message: "Mọi tài liệu sẽ được đọc lại từ đầu theo mô hình mới. Trong lúc đó trợ lý chưa tra được tài liệu nội bộ.",
      confirmText: "Lưu và đọc lại",
    });
    if (!agreed) return;
  }
  if (await save()) void refreshAccess();
};

const selectTab = async (value: AssistantSettingsTab) => {
  if (value === tab.value) return;
  if (isDirty.value) {
    const agreed = await ask({
      title: "Bỏ thay đổi chưa lưu",
      message: "Bạn có thay đổi chưa lưu ở mục này. Chuyển mục thì thay đổi sẽ mất.",
      confirmText: "Bỏ thay đổi",
      danger: true,
    });
    if (!agreed) return;
    reset();
  }
  tab.value = value;
};

watch(tab, (value) => {
  if (value === "documents" && !settings.documents.value.length) void settings.loadDocuments();
  if (value === "usage" && !settings.usage.value) void settings.loadUsage();
});

onMounted(settings.load);
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <nav
      class="gdtd-chat-no-scrollbar flex shrink-0 overflow-x-auto border-b border-gray-200 px-1"
      role="tablist"
      aria-label="Mục cài đặt trợ lý"
    >
      <button
        v-for="item in ASSISTANT_SETTINGS_TABS"
        :key="item.value"
        type="button"
        role="tab"
        :aria-selected="tab === item.value"
        class="relative inline-flex flex-1 shrink-0 items-center justify-center px-2 py-2.5 text-xs font-medium whitespace-nowrap transition-colors"
        :class="tab === item.value ? 'text-chat-accent-strong' : 'text-gray-500 hover:text-gray-900'"
        @click="selectTab(item.value)"
      >
        <!-- Panel chỉ rộng 380px: bỏ icon để đủ năm mục trên một hàng, không phải cuộn ngang. -->
        {{ item.label }}
        <span
          class="absolute inset-x-1.5 -bottom-px h-0.5 rounded-full transition-colors"
          :class="tab === item.value ? 'bg-chat-accent-strong' : 'bg-transparent'"
        />
      </button>
    </nav>

    <div class="gdtd-chat-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3">
      <div v-if="isLoading || !form" class="space-y-3">
        <span v-for="i in 4" :key="i" class="block h-20 animate-pulse rounded-2xl bg-gray-100" />
      </div>

      <template v-else>
        <SettingsGeneral v-if="tab === 'general'" />
        <SettingsModel v-else-if="tab === 'model'" />
        <SettingsDocuments v-else-if="tab === 'documents'" />
        <SettingsLimits v-else-if="tab === 'limits'" />
        <SettingsUsage v-else />

        <p
          v-if="settings.saved.value?.updatedAtUtc && tab !== 'documents' && tab !== 'usage'"
          class="mt-4 text-center text-[11px] text-gray-400"
        >
          Sửa lần cuối {{ formatDateTime(settings.saved.value.updatedAtUtc) }}
          <template v-if="settings.saved.value.updatedByName"> bởi {{ settings.saved.value.updatedByName }}</template>
        </p>
      </template>
    </div>

    <div v-if="hasSaveBar" class="flex shrink-0 items-center gap-2 border-t border-gray-200 bg-white px-3 py-2.5">
      <p class="min-w-0 flex-1 truncate text-xs text-gray-600">Có thay đổi chưa lưu</p>
      <button
        type="button"
        class="rounded-full px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
        :disabled="isSaving"
        @click="reset"
      >
        Huỷ
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full bg-chat-accent-strong px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-chat-accent disabled:opacity-60"
        :disabled="isSaving"
        @click="onSave"
      >
        <WidgetIcon v-if="isSaving" name="Loader2" :size="14" class="animate-spin" />
        Lưu
      </button>
    </div>
  </div>
</template>
