<script setup lang="ts">
import { useWidgetConfirm } from "../core/store/useWidgetConfirm";

const { isOpen, options, confirm, cancel } = useWidgetConfirm();
</script>

<template>
  <Transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="opacity-0"
    leave-active-class="transition duration-100 ease-in"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isOpen && options"
      class="absolute inset-0 z-40 flex items-center justify-center bg-gray-900/40 p-5"
      role="dialog"
      aria-modal="true"
      @click.self="cancel"
    >
      <div class="w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl">
        <p class="text-sm font-bold text-gray-900">{{ options.title }}</p>
        <p class="mt-1.5 text-xs leading-relaxed text-gray-600">{{ options.message }}</p>

        <div class="mt-4 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-full px-4 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100"
            @click="cancel"
          >
            Huỷ
          </button>
          <button
            type="button"
            class="rounded-full px-4 py-2 text-xs font-semibold text-white transition-colors"
            :class="
              options.danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-chat-accent-strong hover:brightness-110'
            "
            @click="confirm"
          >
            {{ options.confirmText ?? "Đồng ý" }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
