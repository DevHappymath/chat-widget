<script setup lang="ts">
import { computed, ref } from "vue";
import { useAssistant } from "../../core/store/useAssistant";
import type { AssistantModelOption } from "../../types/assistant";
import WidgetIcon from "../WidgetIcon.vue";

const { modelList, isModelListLoaded, activeModel, isDefaultModel, pickModel } = useAssistant();

const isOpen = ref(false);

/** Gom theo nhà cung cấp, giữ thứ tự admin đã khai. */
const groups = computed(() => {
  const map = new Map<string, { label: string; items: AssistantModelOption[] }>();
  for (const option of modelList.value.models) {
    const group = map.get(option.providerId) ?? { label: option.providerLabel, items: [] };
    group.items.push(option);
    map.set(option.providerId, group);
  }
  return [...map.values()];
});

const isActive = (option: AssistantModelOption) =>
  activeModel.value?.providerId === option.providerId && activeModel.value?.model === option.model;

const choose = (option: AssistantModelOption) => {
  pickModel(option);
  isOpen.value = false;
};
</script>

<template>
  <div v-if="activeModel" class="relative min-w-0">
    <button
      type="button"
      class="inline-flex max-w-full items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200/70 hover:text-gray-900"
      :class="isOpen && 'bg-gray-200/70 text-gray-900'"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      @click="isOpen = !isOpen"
      @keydown.esc="isOpen = false"
    >
      <WidgetIcon name="Sparkles" :size="13" class="text-chat-accent-strong" />
      <span class="truncate">{{ activeModel.model }}</span>
      <WidgetIcon name="ChevronDown" :size="13" class="transition-transform" :class="isOpen && 'rotate-180'" />
    </button>

    <template v-if="isOpen">
      <div class="fixed inset-0 z-30" @click="isOpen = false" />
      <div
        class="absolute bottom-full right-0 z-40 mb-2 w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white py-1.5 shadow-xl shadow-gray-900/10"
        role="listbox"
        aria-label="Chọn mô hình trả lời"
        @keydown.esc="isOpen = false"
      >
        <p class="px-3 pt-1 pb-1.5 text-[11px] text-gray-500">Mô hình trả lời cho các câu hỏi tiếp theo</p>
        <div v-for="group in groups" :key="group.label" class="border-t border-gray-100 py-1 first-of-type:border-t-0">
          <p class="px-3 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-gray-400 uppercase">{{ group.label }}</p>
          <button
            v-for="option in group.items"
            :key="option.model"
            type="button"
            role="option"
            :aria-selected="isActive(option)"
            class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-gray-50"
            :class="isActive(option) ? 'text-chat-accent-strong' : 'text-gray-800'"
            @click="choose(option)"
          >
            <span class="min-w-0 flex-1 truncate">{{ option.model }}</span>
            <span
              v-if="isDefaultModel(option)"
              class="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500"
            >
              Mặc định
            </span>
            <WidgetIcon name="Check" :size="15" :class="isActive(option) ? 'opacity-100' : 'opacity-0'" />
          </button>
        </div>
      </div>
    </template>
  </div>
  <span
    v-else-if="isModelListLoaded"
    class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-400"
    title="Quản trị viên chưa thêm mô hình trả lời nào"
  >
    <WidgetIcon name="Sparkles" :size="13" />
    Chưa có mô hình
  </span>
</template>
