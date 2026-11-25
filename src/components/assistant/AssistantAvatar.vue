<script setup lang="ts">
import WidgetIcon from "../WidgetIcon.vue";

const props = withDefaults(defineProps<{ size?: "xs" | "sm" | "md" | "lg" }>(), { size: "md" });

const SIZE_CLASSES = {
  xs: "h-7 w-7",
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-14 w-14",
} as const;

const ICON_SIZES = { xs: 14, sm: 17, md: 20, lg: 26 } as const;
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-chat-accent to-chat-accent-strong text-white shadow-sm shadow-chat-accent/20"
    :class="SIZE_CLASSES[props.size]"
    aria-hidden="true"
  >
    <WidgetIcon name="Sparkles" :size="ICON_SIZES[props.size]" />
  </span>
</template>
