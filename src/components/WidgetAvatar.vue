<script setup lang="ts">
import { computed } from "vue";
import { avatarTone, nameInitials } from "../utils/chat";
import WidgetIcon from "./WidgetIcon.vue";

type AvatarSize = "xs" | "sm" | "md" | "lg";

const props = withDefaults(
  defineProps<{
    name: string;
    size?: AvatarSize;
    /** Nhóm dùng icon thay vì chữ viết tắt để phân biệt ngay với hội thoại 1-1. */
    variant?: "user" | "group";
    src?: string | null;
    isOnline?: boolean;
    showPresence?: boolean;
  }>(),
  { size: "md", variant: "user", isOnline: false, showPresence: false },
);

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: "h-7 w-7 text-[11px]",
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-lg",
};

const DOT_CLASSES: Record<AvatarSize, string> = {
  xs: "h-2 w-2",
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
  lg: "h-3.5 w-3.5",
};

const ICON_SIZES: Record<AvatarSize, number> = { xs: 14, sm: 16, md: 20, lg: 28 };

const tone = computed(() =>
  props.variant === "group"
    ? "bg-chat-accent/10 text-chat-accent-strong"
    : avatarTone(props.name),
);
</script>

<template>
  <span class="relative inline-flex shrink-0">
    <img
      v-if="src"
      :src="src"
      :alt="name"
      class="rounded-full object-cover"
      :class="SIZE_CLASSES[size]"
    />
    <span
      v-else
      class="flex select-none items-center justify-center rounded-full font-semibold"
      :class="[SIZE_CLASSES[size], tone]"
      :title="name"
    >
      <WidgetIcon v-if="variant === 'group'" name="Users" :size="ICON_SIZES[size]" />
      <template v-else>{{ nameInitials(name) }}</template>
    </span>

    <span
      v-if="showPresence"
      class="absolute bottom-0 right-0 rounded-full border-2 border-white"
      :class="[DOT_CLASSES[size], isOnline ? 'bg-emerald-500' : 'bg-gray-300']"
      :aria-label="isOnline ? 'Đang hoạt động' : 'Ngoại tuyến'"
    />
  </span>
</template>
