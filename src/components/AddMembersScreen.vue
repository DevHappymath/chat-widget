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
      <div class="mb-3 flex items-center gap-3 px-1">
        <div class="min-w-0 flex-1">
          <p class="text-xs font-semibold text-gray-800">Cho xem tin nhắn cũ</p>
          <p class="text-[11px] text-gray-600">
            {{
              shareHistory
                ? "Đọc được cả tin nhắn trước lúc vào nhóm."
                : "Chỉ thấy tin nhắn từ lúc vào nhóm."
            }}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          :aria-checked="shareHistory"
          aria-label="Cho xem tin nhắn cũ"
          class="relative h-6 w-10 shrink-0 rounded-full transition-colors"
          :class="shareHistory ? 'bg-chat-accent-strong' : 'bg-gray-300'"
          @click="shareHistory = !shareHistory"
        >
          <span
            class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
            :class="shareHistory ? 'translate-x-4' : 'translate-x-0'"
          />
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
