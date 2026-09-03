<script setup lang="ts">
import { useChatStore } from "../core/store/useChatStore";
import type { AppUser } from "../types/chat";
import PeoplePicker from "./PeoplePicker.vue";
import WidgetIcon from "./WidgetIcon.vue";

const { view, openConversationWith } = useChatStore();

const pick = (person: AppUser) =>
  openConversationWith({
    userId: person.id,
    fullName: person.fullName || person.email || "Người dùng",
    email: person.email,
  });
</script>

<template>
  <PeoplePicker @pick="pick">
    <template #top>
      <button
        type="button"
        class="flex w-full items-center gap-3 rounded-xl border border-dashed border-gray-200 px-3 py-2.5 text-left transition-colors hover:border-chat-accent hover:bg-chat-accent/5"
        @click="view = 'new-group'"
      >
        <span
          class="flex h-9 w-9 items-center justify-center rounded-full bg-chat-accent/10 text-chat-accent-strong"
        >
          <WidgetIcon name="UsersRound" :size="17" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-gray-800">Tạo nhóm mới</span>
          <span class="block text-xs text-gray-600">Cần ít nhất 2 thành viên ngoài bạn</span>
        </span>
        <WidgetIcon name="ChevronRight" :size="16" class="text-gray-400" />
      </button>
    </template>
  </PeoplePicker>
</template>
