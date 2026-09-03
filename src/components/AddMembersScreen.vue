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
    await addParticipants(selectedIds.value);
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
      <p class="mb-2 px-1 text-[11px] text-gray-600">
        Người được thêm sẽ thấy các tin nhắn từ lúc vào nhóm.
      </p>
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
