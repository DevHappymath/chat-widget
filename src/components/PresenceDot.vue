<script setup lang="ts">
import { PRESENCE_DOT_CLASSES, PRESENCE_LABELS } from "../constants/presence";
import { PresenceStatus } from "../types/chat";

/** Chấm trạng thái; kích thước do nơi gọi truyền qua class. */
defineProps<{ status: PresenceStatus }>();
</script>

<template>
  <span
    class="inline-flex items-center justify-center rounded-full"
    :class="PRESENCE_DOT_CLASSES[status]"
    role="img"
    :aria-label="PRESENCE_LABELS[status]"
    :title="PRESENCE_LABELS[status]"
  >
    <!-- Vạch trắng tách Không làm phiền khỏi Bận, hai trạng thái cùng màu đỏ như Teams. -->
    <span v-if="status === PresenceStatus.DoNotDisturb" class="h-[2px] w-1/2 rounded-full bg-white" />
  </span>
</template>
