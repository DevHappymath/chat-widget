<script setup lang="ts">
import { computed, ref } from "vue";
import WidgetIcon from "./WidgetIcon.vue";

/**
 * Lịch chọn một ngày, nằm luôn trong khung chứ không bật lên: widget không kéo thư viện lịch
 * theo vì nó nhúng vào nhiều site. Ngày đi vào và ra dạng "YYYY-MM-DD" theo giờ máy.
 */
const props = defineProps<{ min: string; max: string }>();
const model = defineModel<string>({ required: true });

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const pad2 = (n: number) => String(n).padStart(2, "0");
const keyOf = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const parseKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
};

const todayKey = keyOf(new Date());

// Tháng đang xem, luôn là ngày 1 của tháng.
const start = parseKey(model.value || props.min);
const viewMonth = ref(new Date(start.getFullYear(), start.getMonth(), 1));

const monthLabel = computed(
  () => `Tháng ${viewMonth.value.getMonth() + 1}, ${viewMonth.value.getFullYear()}`,
);

// Lưới 6 tuần bắt đầu từ thứ Hai, ô ngoài tháng để trống cho gọn.
const cells = computed(() => {
  const first = viewMonth.value;
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();

  return Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, i) => {
    const day = i - offset + 1;
    if (day < 1 || day > daysInMonth) return null;
    const key = keyOf(new Date(first.getFullYear(), first.getMonth(), day));
    return { key, day, disabled: key < props.min || key > props.max };
  });
});

const canGoPrev = computed(() => keyOf(viewMonth.value) > props.min.slice(0, 8) + "01");
const canGoNext = computed(() => {
  const next = new Date(viewMonth.value.getFullYear(), viewMonth.value.getMonth() + 1, 1);
  return keyOf(next) <= props.max;
});

const shiftMonth = (delta: number) => {
  viewMonth.value = new Date(viewMonth.value.getFullYear(), viewMonth.value.getMonth() + delta, 1);
};
</script>

<template>
  <div class="select-none">
    <div class="mb-1 flex items-center justify-between">
      <button
        type="button"
        class="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:pointer-events-none disabled:opacity-30"
        aria-label="Tháng trước"
        :disabled="!canGoPrev"
        @click="shiftMonth(-1)"
      >
        <WidgetIcon name="ChevronLeft" :size="15" />
      </button>
      <p class="text-xs font-semibold text-gray-800">{{ monthLabel }}</p>
      <button
        type="button"
        class="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:pointer-events-none disabled:opacity-30"
        aria-label="Tháng sau"
        :disabled="!canGoNext"
        @click="shiftMonth(1)"
      >
        <WidgetIcon name="ChevronRight" :size="15" />
      </button>
    </div>

    <div class="grid grid-cols-7 gap-0.5 text-center">
      <span v-for="weekday in WEEKDAYS" :key="weekday" class="py-1 text-[10px] font-medium text-gray-400">
        {{ weekday }}
      </span>

      <template v-for="(cell, index) in cells" :key="cell?.key ?? `blank-${index}`">
        <span v-if="!cell" />
        <button
          v-else
          type="button"
          class="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-xs transition-colors disabled:pointer-events-none disabled:text-gray-300"
          :class="
            cell.key === model
              ? 'bg-chat-accent-strong font-semibold text-white'
              : cell.key === todayKey
                ? 'font-semibold text-chat-accent-strong hover:bg-chat-accent/10'
                : 'text-gray-700 hover:bg-gray-100'
          "
          :disabled="cell.disabled"
          :aria-pressed="cell.key === model"
          :aria-label="`Ngày ${cell.day} ${monthLabel.toLowerCase()}`"
          @click="model = cell.key"
        >
          {{ cell.day }}
        </button>
      </template>
    </div>
  </div>
</template>
