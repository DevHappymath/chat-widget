<script setup lang="ts">
import { computed } from "vue";
import { useChatStore } from "../core/store/useChatStore";
import type { ChatParticipant } from "../types/chat";
import TypingDots from "./TypingDots.vue";
import WidgetAvatar from "./WidgetAvatar.vue";

const props = defineProps<{
  participants: ChatParticipant[];
  /** Nhóm mới cần biết ai đang gõ, hội thoại 1-1 thì chỉ có một người. */
  showName: boolean;
}>();

const { avatarOf } = useChatStore();

const first = computed(() => props.participants[0]);

const nameOf = (participant: ChatParticipant) =>
  participant.fullName || participant.email || "Ai đó";

const label = computed(() =>
  props.participants.length > 1
    ? `${props.participants.length} người đang soạn tin`
    : `${nameOf(first.value!)} đang soạn tin`,
);
</script>

<template>
  <div v-if="first" class="flex gap-2" role="status" :aria-label="label">
    <WidgetAvatar :name="nameOf(first)" :src="avatarOf(first.userId)" size="xs" class="mt-0.5" />

    <div class="flex min-w-0 flex-col items-start gap-1">
      <p v-if="showName" class="px-1 text-[11px] font-semibold text-gray-600">{{ label }}</p>

      <div class="flex h-8 items-center rounded-2xl bg-gray-100 px-3 text-gray-400">
        <TypingDots />
      </div>
    </div>
  </div>
</template>
