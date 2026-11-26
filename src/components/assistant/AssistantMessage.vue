<script setup lang="ts">
import { computed } from "vue";
import { useAssistant } from "../../core/store/useAssistant";
import { useWidgetToast } from "../../core/store/useWidgetToast";
import { vTooltip } from "../../core/tooltip";
import type { AssistantMessage, AssistantStepStatus } from "../../types/assistant";
import { renderAssistantMarkdown } from "../../utils/assistant-markdown";
import WidgetIcon from "../WidgetIcon.vue";
import AssistantAvatar from "./AssistantAvatar.vue";
import AssistantQuickCard from "./AssistantQuickCard.vue";

const props = defineProps<{ message: AssistantMessage }>();

const { setFeedback, askAssistantAbout, hasModels, isAsking } = useAssistant();
const toast = useWidgetToast();

const isUser = computed(() => props.message.role === "user");
const isStreaming = computed(() => props.message.state === "streaming");
const isError = computed(() => props.message.state === "error");
const cards = computed(() => props.message.cards ?? []);
const isQuick = computed(() => props.message.source === "quick");
const html = computed(() => renderAssistantMarkdown(props.message.content));
/** Đang tra dữ liệu, chưa có chữ nào để hiện. */
const isThinking = computed(
  () =>
    isStreaming.value &&
    !props.message.content &&
    !props.message.steps.some((s) => s.status === "running"),
);

const STEP_ICON: Record<AssistantStepStatus, { name: string; class: string }> = {
  running: { name: "Loader2", class: "animate-spin text-chat-accent" },
  done: { name: "Check", class: "text-emerald-600" },
  denied: { name: "Lock", class: "text-amber-600" },
  failed: { name: "TriangleAlert", class: "text-red-500" },
};

const copy = async () => {
  try {
    await navigator.clipboard.writeText(props.message.content);
    toast.success("Đã chép câu trả lời");
  } catch {
    toast.error("Trình duyệt không cho chép, hãy bôi đen rồi chép tay");
  }
};

const ACTION =
  "inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700";
</script>

<template>
  <div v-if="isUser" class="flex justify-end">
    <p
      class="max-w-[85%] rounded-2xl rounded-br-md bg-chat-accent-strong px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words text-white"
    >
      {{ message.content }}
    </p>
  </div>

  <div v-else class="flex gap-2">
    <AssistantAvatar size="xs" class="mt-0.5" />

    <div class="min-w-0 flex-1">
      <ul v-if="message.steps.length" class="mb-1.5 space-y-1">
        <li
          v-for="step in message.steps"
          :key="step.id"
          class="flex items-center gap-1.5 text-xs"
          :class="step.status === 'running' ? 'text-gray-700' : 'text-gray-500'"
        >
          <WidgetIcon :name="STEP_ICON[step.status].name" :size="13" :class="STEP_ICON[step.status].class" />
          {{ step.label }}
        </li>
      </ul>

      <div v-if="isThinking" class="flex h-6 items-center gap-1" aria-label="Trợ lý đang trả lời">
        <span class="gdtd-assistant-dot h-1.5 w-1.5 rounded-full bg-gray-400" />
        <span class="gdtd-assistant-dot h-1.5 w-1.5 rounded-full bg-gray-400 [animation-delay:150ms]" />
        <span class="gdtd-assistant-dot h-1.5 w-1.5 rounded-full bg-gray-400 [animation-delay:300ms]" />
      </div>

      <div v-if="!isQuick && cards.length && !isError" class="mb-2 space-y-2">
        <AssistantQuickCard v-for="(card, index) in cards" :key="index" :card="card" />
      </div>

      <div v-if="isError" class="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
        <WidgetIcon name="CircleAlert" :size="16" class="mt-0.5" />
        <span>{{ message.content || "Trợ lý chưa trả lời được câu này, bạn hỏi lại giúp nhé." }}</span>
      </div>

      <div v-else-if="isQuick && cards.length" class="space-y-2">
        <AssistantQuickCard v-for="(card, index) in cards" :key="index" :card="card" />
      </div>

      <div
        v-else-if="message.content"
        class="gdtd-assistant-md text-sm leading-relaxed text-gray-900"
        :class="isStreaming && 'is-streaming'"
        v-html="html"
      />

      <div v-if="message.citations.length" class="mt-2 flex flex-wrap gap-1.5">
        <component
          :is="citation.url ? 'a' : 'span'"
          v-for="(citation, index) in message.citations"
          :key="`${citation.documentId}-${index}`"
          :href="citation.url ?? undefined"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600"
          :class="citation.url && 'transition-colors hover:border-chat-accent/40 hover:text-chat-accent-strong'"
        >
          <WidgetIcon name="FileText" :size="13" class="text-chat-accent-strong" />
          <span class="truncate">{{ citation.title }}</span>
          <span v-if="citation.page" class="shrink-0 text-gray-400">tr. {{ citation.page }}</span>
        </component>
      </div>

      <div v-if="!isStreaming && !isError" class="mt-1 -ml-1.5 flex items-center gap-0.5">
        <button type="button" :class="ACTION" aria-label="Chép câu trả lời" v-tooltip="'Chép câu trả lời'" @click="copy">
          <WidgetIcon name="Copy" :size="14" />
        </button>
        <button
          type="button"
          :class="[ACTION, message.feedback === 'helpful' && 'text-chat-accent-strong']"
          aria-label="Trả lời đúng ý"
          v-tooltip="'Trả lời đúng ý'"
          :aria-pressed="message.feedback === 'helpful'"
          @click="setFeedback(message, 'helpful')"
        >
          <WidgetIcon name="ThumbsUp" :size="14" :class="message.feedback === 'helpful' && 'fill-current'" />
        </button>
        <button
          type="button"
          :class="[ACTION, message.feedback === 'wrong' && 'text-red-500']"
          aria-label="Trả lời chưa đúng"
          v-tooltip="'Trả lời chưa đúng'"
          :aria-pressed="message.feedback === 'wrong'"
          @click="setFeedback(message, 'wrong')"
        >
          <WidgetIcon name="ThumbsDown" :size="14" :class="message.feedback === 'wrong' && 'fill-current'" />
        </button>
        <span v-if="isQuick" class="ml-1 inline-flex items-center gap-1 text-[11px] text-gray-400">
          <WidgetIcon name="Zap" :size="11" />
          Tra nhanh
        </span>
        <span v-else-if="message.model" class="ml-1 truncate text-[11px] text-gray-400">{{ message.model }}</span>
        <button
          v-if="isQuick && hasModels"
          type="button"
          class="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-chat-accent-strong transition-colors hover:bg-chat-accent/10 disabled:opacity-50"
          :disabled="isAsking"
          @click="askAssistantAbout(message)"
        >
          <WidgetIcon name="Sparkles" :size="13" />
          Hỏi trợ lý thêm
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gdtd-assistant-dot {
  animation: gdtd-assistant-bounce 1s ease-in-out infinite;
}

@keyframes gdtd-assistant-bounce {
  0%,
  80%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-3px);
  }
}

.gdtd-assistant-md :deep(p) {
  margin: 0 0 0.6em;
}
.gdtd-assistant-md :deep(p:last-child),
.gdtd-assistant-md :deep(ul:last-child),
.gdtd-assistant-md :deep(ol:last-child) {
  margin-bottom: 0;
}
.gdtd-assistant-md :deep(.md-heading) {
  font-weight: 600;
  margin-top: 0.9em;
}
.gdtd-assistant-md :deep(ul),
.gdtd-assistant-md :deep(ol) {
  margin: 0 0 0.6em;
  padding-left: 1.25em;
}
.gdtd-assistant-md :deep(ul) {
  list-style: disc;
}
.gdtd-assistant-md :deep(ol) {
  list-style: decimal;
}
.gdtd-assistant-md :deep(li) {
  margin: 0.15em 0;
}
.gdtd-assistant-md :deep(li::marker) {
  color: rgb(156 163 175);
}
.gdtd-assistant-md :deep(strong) {
  font-weight: 600;
}
.gdtd-assistant-md :deep(a) {
  color: var(--color-chat-accent-strong);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.gdtd-assistant-md :deep(code) {
  border-radius: 0.375rem;
  background: rgb(243 244 246);
  padding: 0.1em 0.35em;
  font-size: 0.85em;
}
.gdtd-assistant-md :deep(pre) {
  margin: 0 0 0.6em;
  overflow-x: auto;
  border-radius: 0.75rem;
  background: rgb(243 244 246);
  padding: 0.75em 1em;
}
.gdtd-assistant-md :deep(pre code) {
  background: none;
  padding: 0;
}
.gdtd-assistant-md :deep(.md-table) {
  margin: 0 0 0.6em;
  overflow-x: auto;
  border: 1px solid rgb(229 231 235);
  border-radius: 0.75rem;
}
.gdtd-assistant-md :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}
.gdtd-assistant-md :deep(th),
.gdtd-assistant-md :deep(td) {
  padding: 0.4em 0.6em;
  text-align: left;
  border-bottom: 1px solid rgb(243 244 246);
}
.gdtd-assistant-md :deep(th) {
  background: rgb(249 250 251);
  font-weight: 500;
  color: rgb(75 85 99);
  font-size: 0.92em;
}
.gdtd-assistant-md :deep(tr:last-child td) {
  border-bottom: 0;
}
/* Con trỏ nhấp nháy ở cuối đoạn chữ đang về, để người đọc biết câu trả lời chưa xong. */
.gdtd-assistant-md.is-streaming :deep(> :last-child)::after {
  content: "";
  display: inline-block;
  width: 0.45em;
  height: 1em;
  margin-left: 2px;
  vertical-align: -0.15em;
  border-radius: 1px;
  background: var(--color-chat-accent);
  animation: gdtd-assistant-caret 0.9s steps(2) infinite;
}
@keyframes gdtd-assistant-caret {
  to {
    visibility: hidden;
  }
}
</style>
