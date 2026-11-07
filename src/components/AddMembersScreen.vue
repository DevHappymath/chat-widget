<script setup lang="ts">
import { computed, ref } from "vue";
import { useChatStore } from "../core/store/useChatStore";
import { useWidgetToast } from "../core/store/useWidgetToast";
import type { AppUser } from "../types/chat";
import { extractErrorMessage } from "../utils/error";
import PeoplePicker from "./PeoplePicker.vue";

const { activeConversation, membersOf, addParticipants, goBack } = useChatStore();
const toast = useWidgetToast();

const selected = ref<AppUser[]>([]);
const isSaving = ref(false);
const shareHistory = ref(true);

const historyOptions = [
  { value: true, label: "Được xem", hint: "Đọc được cả tin nhắn trước lúc vào nhóm." },
  { value: false, label: "Không được xem", hint: "Chỉ thấy tin nhắn từ lúc vào nhóm." },
];

// Người đã ở trong nhóm vẫn hiện nhưng khoá lại, để người dùng biết là mình đã thêm rồi.
const existingIds = computed(() =>
  activeConversation.value
    ? membersOf(activeConversation.value).map((p) => p.userId)
    : [],
);

const selectedIds = computed(() => selected.value.map((person) => person.id));

const toggle = (person: AppUser) => {
  selected.value = selected.value.some((u) => u.id === person.id)
    ? selected.value.filter((u) => u.id !== person.id)
    : [...selected.value, person];
};

const submit = async () => {
  if (!selected.value.length) return;

  isSaving.value = true;
  try {
    await addParticipants(selectedIds.value, shareHistory.value);
    toast.success(`Đã thêm ${selected.value.length} thành viên vào nhóm`);
    goBack();
  } catch (err) {
    toast.error(extractErrorMessage(err));
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <PeoplePicker
      :selected-ids="selectedIds"
      :disabled-ids="existingIds"
      multiple
      @pick="toggle"
    />

    <div class="shrink-0 border-t border-gray-100 p-3">
      <p class="mb-1.5 px-1 text-xs font-semibold text-gray-800">Tin nhắn cũ của nhóm</p>
      <div role="radiogroup" aria-label="Tin nhắn cũ của nhóm" class="mb-3 grid grid-cols-2 gap-1.5">
        <button
          v-for="option in historyOptions"
          :key="String(option.value)"
          type="button"
          role="radio"
          :aria-checked="shareHistory === option.value"
          class="flex w-full items-start gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors"
          :class="
            shareHistory === option.value
              ? 'border-chat-accent/40 bg-chat-accent/10'
              : 'border-gray-200 hover:bg-gray-50'
          "
          @click="shareHistory = option.value"
        >
          <span
            class="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2"
            :class="shareHistory === option.value ? 'border-chat-accent-strong' : 'border-gray-300'"
          >
            <span
              v-if="shareHistory === option.value"
              class="h-1.5 w-1.5 rounded-full bg-chat-accent-strong"
            />
          </span>
          <span class="min-w-0">
            <span class="block text-xs font-semibold text-gray-800">{{ option.label }}</span>
            <span class="block text-[11px] text-gray-600">{{ option.hint }}</span>
          </span>
        </button>
      </div>
      <button
        type="button"
        class="w-full rounded-full py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed"
        :class="
          selected.length && !isSaving
            ? 'bg-chat-accent-strong text-white hover:brightness-110'
            : 'bg-gray-100 text-gray-500'
        "
        :disabled="!selected.length || isSaving"
        @click="submit"
      >
        {{ isSaving ? "Đang thêm..." : `Thêm ${selected.length || ""} thành viên` }}
      </button>
    </div>
  </div>
</template>
