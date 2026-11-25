<script setup lang="ts">
import { computed } from "vue";
import type { AssistantCard, AssistantCardKind } from "../../types/assistant";
import WidgetIcon from "../WidgetIcon.vue";

const props = defineProps<{ card: AssistantCard }>();

const KIND_ICON: Record<AssistantCardKind, string> = {
  lead: "UserRound",
  leads: "Users",
  student: "GraduationCap",
  students: "GraduationCap",
  commission: "Wallet",
  lessons: "CalendarDays",
  classes: "School",
  trials: "CalendarClock",
  docs: "FileText",
};

const icon = computed(() => KIND_ICON[props.card.kind] ?? "Search");
</script>

<template>
  <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white">
    <div class="flex items-start gap-2.5 px-3 pt-2.5 pb-2">
      <span class="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-chat-accent/10 text-chat-accent-strong">
        <WidgetIcon :name="icon" :size="15" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm leading-snug font-semibold text-gray-900">{{ card.title }}</p>
        <p v-if="card.subtitle" class="mt-0.5 text-xs text-gray-500">{{ card.subtitle }}</p>
      </div>
      <span
        v-if="card.badge"
        class="shrink-0 rounded-full bg-chat-accent/10 px-2 py-0.5 text-[11px] font-medium text-chat-accent-strong"
      >
        {{ card.badge }}
      </span>
    </div>

    <dl v-if="card.fields.length" class="space-y-1.5 border-t border-gray-100 px-3 py-2">
      <div v-for="field in card.fields" :key="field.label">
        <dt class="text-[11px] text-gray-500">{{ field.label }}</dt>
        <dd class="text-sm break-words text-gray-900">{{ field.value }}</dd>
      </div>
    </dl>

    <ul v-if="card.rows.length" class="divide-y divide-gray-100 border-t border-gray-100">
      <li v-for="(row, index) in card.rows" :key="`${row.title}-${index}`">
        <component
          :is="row.url ? 'a' : 'div'"
          :href="row.url ?? undefined"
          :target="row.url ? '_blank' : undefined"
          rel="noopener noreferrer"
          class="group flex items-center gap-2.5 px-3 py-2"
          :class="row.url && 'transition-colors hover:bg-gray-50'"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-gray-900">{{ row.title }}</p>
            <p v-if="row.subtitle" class="truncate text-xs text-gray-500">{{ row.subtitle }}</p>
            <p v-if="row.meta" class="truncate text-xs text-gray-500 tabular-nums">{{ row.meta }}</p>
          </div>
          <WidgetIcon
            v-if="row.url"
            name="ChevronRight"
            :size="15"
            class="text-gray-300 transition-colors group-hover:text-chat-accent-strong"
          />
        </component>
      </li>
    </ul>

    <div v-if="card.links.length" class="flex flex-wrap gap-1.5 border-t border-gray-100 px-3 py-2">
      <a
        v-for="link in card.links"
        :key="link.url"
        :href="link.url"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 transition-all hover:border-chat-accent/40 hover:text-chat-accent-strong active:scale-[0.98]"
      >
        {{ link.label }}
        <WidgetIcon name="ArrowUpRight" :size="13" />
      </a>
    </div>
  </div>
</template>
