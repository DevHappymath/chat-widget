<script setup lang="ts">
import { computed, ref } from "vue";
import WidgetIcon from "../../WidgetIcon.vue";
import WidgetAvatar from "../../WidgetAvatar.vue";
import { useAssistantSettingsContext } from "../../../core/store/useAssistantSettings";
import { formatDateTime } from "../../../utils/format";
import { formatNumber, formatCompactNumber, formatPercent } from "../../../utils/assistant-format";
import type { AssistantLookupOutcome, AssistantUsageDay } from "../../../types/assistant";

const { usage, usageDays, lookupLogs, isLoadingUsage } = useAssistantSettingsContext();

const RANGES = [7, 14, 30];
const showTable = ref(false);
const hovered = ref<AssistantUsageDay | null>(null);
const hoveredIndex = ref(-1);

const days = computed(() => usage.value?.days ?? []);
const totals = computed(() =>
  days.value.reduce(
    (sum, d) => ({
      questions: sum.questions + d.questions,
      tokens: sum.tokens + d.tokens,
      wrong: sum.wrong + d.wrongAnswers,
    }),
    { questions: 0, tokens: 0, wrong: 0 },
  ),
);
const wrongRate = computed(() =>
  totals.value.questions ? totals.value.wrong / totals.value.questions : 0,
);

/** Trục làm tròn lên số đẹp để vạch lưới rơi vào số chẵn dễ đọc. */
const axisMax = computed(() => {
  const max = Math.max(1, ...days.value.map((d) => d.questions));
  const step = max <= 10 ? 5 : max <= 50 ? 10 : max <= 200 ? 50 : 100;
  return Math.ceil(max / step) * step;
});
const gridLines = computed(() => [1, 0.5].map((ratio) => Math.round(axisMax.value * ratio)));

const dayLabel = (iso: string) => {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
};

/** Nhãn trục ngang chỉ hiện thưa, đủ để định vị mà không chồng chữ. */
const showTick = (index: number) => {
  const every = days.value.length > 14 ? 5 : days.value.length > 7 ? 2 : 1;
  return index % every === 0 || index === days.value.length - 1;
};

const onHover = (day: AssistantUsageDay | null, index = -1) => {
  hovered.value = day;
  hoveredIndex.value = index;
};

const OUTCOME: Record<AssistantLookupOutcome, { label: string; icon: string; class: string }> = {
  ok: { label: "Xem được", icon: "Check", class: "text-emerald-700" },
  denied: { label: "Không có quyền", icon: "Lock", class: "text-amber-700" },
  "not-found": { label: "Không tìm thấy", icon: "SearchX", class: "text-gray-600" },
  failed: { label: "Hệ không phản hồi", icon: "TriangleAlert", class: "text-red-700" },
};

const APP_LABEL: Record<string, string> = {
  chat: "Chat",
  crm: "Tuyển sinh",
  lms: "Lớp học",
  hr: "Nhân sự",
  hub: "Tài liệu",
  task: "Công việc",
};

const CHIP = "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors";
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-1">
      <button
        v-for="range in RANGES"
        :key="range"
        type="button"
        :class="[CHIP, usageDays === range ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100']"
        @click="usageDays = range"
      >
        {{ range }} ngày
      </button>
      <WidgetIcon v-if="isLoadingUsage" name="Loader2" :size="14" class="ml-2 animate-spin text-gray-400" />
    </div>

    <div v-if="!usage" class="grid gap-2">
      <span v-for="i in 3" :key="i" class="block h-20 animate-pulse rounded-2xl bg-gray-100" />
    </div>

    <template v-else>
      <div class="grid grid-cols-3 gap-2">
        <div class="rounded-2xl border border-gray-200 p-3.5">
          <p class="text-xs text-gray-500">Câu hỏi</p>
          <p class="mt-1 text-xl font-semibold tracking-tight text-gray-900 tabular-nums">
            {{ formatNumber(totals.questions) }}
          </p>
        </div>
        <div class="rounded-2xl border border-gray-200 p-3.5">
          <p class="text-xs text-gray-500">Token đã dùng</p>
          <p class="mt-1 text-xl font-semibold tracking-tight text-gray-900 tabular-nums">
            {{ formatCompactNumber(totals.tokens) }}
          </p>
        </div>
        <div class="rounded-2xl border border-gray-200 p-3.5">
          <p class="text-xs text-gray-500">Bị chê chưa đúng</p>
          <p class="mt-1 text-xl font-semibold tracking-tight text-gray-900 tabular-nums">
            {{ formatNumber(totals.wrong) }}
            <span class="text-xs font-normal text-gray-500">
              {{ formatPercent(wrongRate, { maximumFractionDigits: 0 }) }}
            </span>
          </p>
        </div>
      </div>

      <section class="rounded-2xl border border-gray-200 p-4">
        <div class="flex items-center gap-2">
          <p class="flex-1 text-sm font-semibold text-gray-900">Số câu hỏi mỗi ngày</p>
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
            @click="showTable = !showTable"
          >
            <WidgetIcon :name="showTable ? 'ChartColumn' : 'Table2'" :size="13" />
            {{ showTable ? "Xem biểu đồ" : "Xem dạng bảng" }}
          </button>
        </div>

        <table v-if="showTable" class="mt-3 w-full text-sm tabular-nums">
          <thead>
            <tr class="text-left text-xs text-gray-500">
              <th class="py-1.5 font-medium">Ngày</th>
              <th class="py-1.5 text-right font-medium">Câu hỏi</th>
              <th class="py-1.5 text-right font-medium">Token</th>
              <th class="py-1.5 text-right font-medium">Bị chê</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="day in [...days].reverse()" :key="day.date" class="text-gray-900">
              <td class="py-1.5">{{ dayLabel(day.date) }}</td>
              <td class="py-1.5 text-right">{{ formatNumber(day.questions) }}</td>
              <td class="py-1.5 text-right">{{ formatNumber(day.tokens) }}</td>
              <td class="py-1.5 text-right">{{ formatNumber(day.wrongAnswers) }}</td>
            </tr>
          </tbody>
        </table>

        <div v-else class="relative mt-4" @mouseleave="onHover(null)">
          <div class="relative h-40 pl-8">
            <div
              v-for="value in gridLines"
              :key="value"
              class="pointer-events-none absolute right-0 left-8 border-t border-dashed border-gray-100"
              :style="{ bottom: `${(value / axisMax) * 100}%` }"
            >
              <span class="absolute -top-2 -left-8 w-6 text-right text-[10px] text-gray-400 tabular-nums">
                {{ value }}
              </span>
            </div>

            <div class="absolute inset-0 left-8 flex items-end gap-0.5 border-b border-gray-200">
              <button
                v-for="(day, index) in days"
                :key="day.date"
                type="button"
                class="group relative flex h-full min-w-0 flex-1 items-end justify-center focus:outline-none"
                :aria-label="`${dayLabel(day.date)}: ${day.questions} câu hỏi`"
                @mouseenter="onHover(day, index)"
                @focus="onHover(day, index)"
                @blur="onHover(null)"
              >
                <span
                  class="block w-full max-w-6 rounded-t transition-opacity"
                  :class="[
                    hoveredIndex >= 0 && hoveredIndex !== index ? 'opacity-40' : 'opacity-100',
                  ]"
                  :style="{
                    height: `${Math.max(day.questions ? 2 : 0, (day.questions / axisMax) * 100)}%`,
                    background: 'var(--color-chat-accent)',
                  }"
                />
              </button>
            </div>

            <div
              v-if="hovered"
              class="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 rounded-lg bg-gray-900 px-2.5 py-1.5 text-[11px] whitespace-nowrap text-white shadow-lg"
              :style="{
                left: `calc(2rem + (100% - 2rem) * ${(hoveredIndex + 0.5) / days.length})`,
              }"
            >
              <p class="font-medium">{{ dayLabel(hovered.date) }}</p>
              <p class="tabular-nums text-gray-300">
                {{ formatNumber(hovered.questions) }} câu hỏi · {{ formatCompactNumber(hovered.tokens) }} token
              </p>
              <p v-if="hovered.wrongAnswers" class="tabular-nums text-gray-300">
                {{ hovered.wrongAnswers }} câu bị chê
              </p>
            </div>
          </div>

          <div class="mt-1.5 flex gap-0.5 pl-8">
            <span
              v-for="(day, index) in days"
              :key="day.date"
              class="min-w-0 flex-1 text-center text-[10px] text-gray-400 tabular-nums"
            >
              {{ showTick(index) ? dayLabel(day.date) : "" }}
            </span>
          </div>
        </div>
      </section>

      <section class="rounded-2xl border border-gray-200 p-4">
        <p class="text-sm font-semibold text-gray-900">Dùng nhiều nhất</p>
        <ul class="mt-2 divide-y divide-gray-100">
          <li v-for="user in usage.topUsers" :key="user.userId" class="flex items-center gap-3 py-2">
            <WidgetAvatar :name="user.fullName" size="xs" />
            <span class="min-w-0 flex-1 truncate text-sm text-gray-900">{{ user.fullName }}</span>
            <span class="text-xs text-gray-500 tabular-nums">{{ formatNumber(user.questions) }} câu</span>
            <span class="w-16 text-right text-xs text-gray-500 tabular-nums">
              {{ formatCompactNumber(user.tokens) }}
            </span>
          </li>
        </ul>
      </section>

      <section class="rounded-2xl border border-gray-200 p-4">
        <p class="text-sm font-semibold text-gray-900">Nhật ký tra cứu</p>
        <p class="mt-0.5 text-xs text-gray-500">
          Ai đã xem dữ liệu gì qua trợ lý. Không lưu nội dung câu hỏi.
        </p>
        <ul class="mt-2 divide-y divide-gray-100">
          <li v-for="log in lookupLogs" :key="log.id" class="flex items-start gap-3 py-2.5">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm text-gray-900">{{ log.label }}</p>
              <p class="mt-0.5 text-xs text-gray-500">
                {{ log.userName }} · {{ APP_LABEL[log.app] ?? log.app }} ·
                {{ formatDateTime(log.createdAtUtc) }}
              </p>
            </div>
            <span
              class="inline-flex shrink-0 items-center gap-1 text-xs font-medium"
              :class="OUTCOME[log.outcome].class"
            >
              <WidgetIcon :name="OUTCOME[log.outcome].icon" :size="13" />
              {{ OUTCOME[log.outcome].label }}
            </span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
