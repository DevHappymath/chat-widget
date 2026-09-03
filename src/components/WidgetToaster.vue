<script setup lang="ts">
import { useWidgetToast, type ToastType } from "../core/store/useWidgetToast";
import WidgetIcon from "./WidgetIcon.vue";

const { toasts, remove } = useWidgetToast();

const TONE: Record<ToastType, string> = {
  success: "bg-emerald-600",
  error: "bg-red-600",
  warning: "bg-amber-600",
  info: "bg-gray-800",
};

const ICON: Record<ToastType, string> = {
  success: "CircleCheck",
  error: "CircleAlert",
  warning: "TriangleAlert",
  info: "Info",
};
</script>

<template>
  <div class="pointer-events-none absolute inset-x-3 top-3 z-30 flex flex-col gap-2">
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="-translate-y-2 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-center gap-2 rounded-xl px-3 py-2.5 text-white shadow-lg"
        :class="TONE[toast.type]"
        role="status"
      >
        <WidgetIcon :name="ICON[toast.type]" :size="16" />
        <p class="min-w-0 flex-1 text-xs font-medium">{{ toast.message }}</p>
        <button
          type="button"
          class="rounded-full p-1 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          aria-label="Đóng thông báo"
          @click="remove(toast.id)"
        >
          <WidgetIcon name="X" :size="14" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
