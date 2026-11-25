<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useAssistant } from "../../core/store/useAssistant";
import { vTooltip } from "../../core/tooltip";
import WidgetIcon from "../WidgetIcon.vue";
import AssistantAvatar from "./AssistantAvatar.vue";
import AssistantMessage from "./AssistantMessage.vue";
import AssistantModelPicker from "./AssistantModelPicker.vue";

const { app, entity, activeThreadId, activeMessages, isLoadingMessages, isAsking, ask } = useAssistant();

const body = ref("");
const textarea = ref<HTMLTextAreaElement | null>(null);
const scroller = ref<HTMLElement | null>(null);

/** Gợi ý theo hệ đang nhúng, để câu đầu tiên đúng việc người dùng hay làm ở đó. */
const suggestions = computed(() => {
  const code = entity.value?.type === "lead" ? entity.value.code : "L1042";
  if (app.value === "lms") {
    return [
      { icon: "GraduationCap", text: `Lớp của học sinh ${code} học mấy buổi rồi?` },
      { icon: "CalendarCheck", text: "Tuần này lớp nào có học sinh nghỉ nhiều?" },
      { icon: "FileText", text: "Hướng dẫn báo nghỉ cho học sinh thế nào?" },
    ];
  }
  return [
    { icon: "UserRound", text: `Lead ${code} đang ở bước nào?` },
    { icon: "GraduationCap", text: `Lớp của học sinh ${code} học mấy buổi rồi?` },
    { icon: "Wallet", text: "Hoa hồng tháng này của tôi bao nhiêu?" },
    { icon: "FileText", text: "Quy trình hoàn học phí thế nào?" },
  ];
});

const canSend = computed(() => Boolean(body.value.trim()) && !isAsking.value);

const resize = () => {
  const el = textarea.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

const send = async () => {
  if (!canSend.value) return;
  const question = body.value;
  body.value = "";
  void nextTick(resize);

  // Hỏi hỏng thì trả lại câu hỏi vào ô nhập để người dùng khỏi gõ lại.
  const ok = await ask(question);
  if (!ok && !body.value) {
    body.value = question;
    void nextTick(resize);
  }
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    void send();
  }
};

const fill = (text: string) => {
  body.value = text;
  void nextTick(() => {
    resize();
    textarea.value?.focus();
  });
};

/** Đang đọc gần cuối thì bám theo câu trả lời đang về; đã cuộn lên đọc lại thì để yên. */
const isNearBottom = ref(true);
const onScroll = () => {
  const el = scroller.value;
  if (el) isNearBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
};

const scrollToBottom = () => {
  const el = scroller.value;
  if (el) el.scrollTop = el.scrollHeight;
};

watch(
  // Tính cả trạng thái: trả lời xong mới hiện hàng nút bên dưới, phải cuộn thêm cho khỏi khuất.
  () => activeMessages.value.map((m) => `${m.content.length}.${m.steps.length}.${m.state ?? ""}`).join(),
  () => {
    if (isNearBottom.value) void nextTick(scrollToBottom);
  },
);

watch(activeThreadId, () => {
  isNearBottom.value = true;
  void nextTick(() => {
    scrollToBottom();
    textarea.value?.focus();
  });
});

onMounted(() => {
  scrollToBottom();
  textarea.value?.focus();
});
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div ref="scroller" class="gdtd-chat-scroll min-h-0 flex-1 overflow-y-auto" @scroll="onScroll">
      <div v-if="isLoadingMessages" class="space-y-5 px-3 py-4">
        <div v-for="i in 3" :key="i" class="animate-pulse space-y-2">
          <span class="ml-auto block h-8 w-2/5 rounded-2xl bg-gray-100" />
          <span class="block h-3 w-4/5 rounded-full bg-gray-100" />
          <span class="block h-3 w-3/5 rounded-full bg-gray-50" />
        </div>
      </div>

      <div v-else-if="!activeMessages.length" class="flex min-h-full flex-col items-center justify-center px-4 py-6 text-center">
        <AssistantAvatar size="lg" />
        <p class="mt-3 text-base font-semibold tracking-tight text-gray-900">Bạn cần tra gì hôm nay?</p>
        <p class="mt-1 text-sm text-gray-500">Cứ hỏi như hỏi một đồng nghiệp, mình tra giúp ngay.</p>

        <p
          v-if="entity"
          class="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full bg-chat-accent/10 px-2.5 py-1 text-xs text-chat-accent-strong"
        >
          <WidgetIcon name="Eye" :size="13" />
          <span class="truncate">Đang xem {{ entity.label ?? entity.code }}</span>
        </p>

        <div class="mt-4 grid w-full gap-2">
          <button
            v-for="item in suggestions"
            :key="item.text"
            type="button"
            class="flex items-center gap-2.5 rounded-xl border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:border-chat-accent/40 hover:bg-chat-accent/5 hover:text-gray-900"
            @click="fill(item.text)"
          >
            <WidgetIcon :name="item.icon" :size="15" class="text-chat-accent-strong" />
            <span class="min-w-0">{{ item.text }}</span>
          </button>
        </div>
      </div>

      <div v-else class="space-y-5 px-3 py-4">
        <AssistantMessage v-for="message in activeMessages" :key="message.id" :message="message" />
      </div>
    </div>

    <div class="shrink-0 bg-white px-3 pb-3 pt-1">
      <div class="mb-1 flex justify-end">
        <AssistantModelPicker />
      </div>

      <div
        class="rounded-3xl bg-gray-100 p-1.5 ring-1 ring-transparent transition-colors focus-within:bg-white focus-within:ring-chat-accent/50"
      >
        <div class="flex items-end gap-1">
          <textarea
            ref="textarea"
            v-model="body"
            rows="1"
            placeholder="Hỏi về lead, lớp học, quy trình..."
            class="gdtd-chat-no-scrollbar block max-h-32 min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-6 text-gray-900 outline-none placeholder:text-gray-500 focus:ring-0"
            @input="resize"
            @keydown="onKeydown"
          />

          <button
            type="button"
            class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all"
            :class="canSend ? 'bg-chat-accent-strong text-white hover:bg-chat-accent active:scale-95' : 'bg-gray-200 text-gray-400'"
            :disabled="!canSend"
            aria-label="Gửi câu hỏi"
            v-tooltip="isAsking ? 'Đang trả lời câu trước' : 'Gửi câu hỏi'"
            @click="send"
          >
            <WidgetIcon v-if="isAsking" name="Loader2" :size="16" class="animate-spin" />
            <WidgetIcon v-else name="ArrowUp" :size="17" />
          </button>
        </div>
      </div>
      <p class="mt-1.5 text-center text-[10px] leading-snug text-gray-400">
        Trợ lý chỉ xem dữ liệu bạn có quyền xem và có thể sai sót, hãy đối chiếu số liệu quan trọng.
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Flowbite đặt padding cho mọi textarea; ghi đè lại đúng khoảng của class để chữ thẳng hàng với nút. */
textarea {
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}
</style>
