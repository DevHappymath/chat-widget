<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { MAX_ATTACHMENTS_PER_MESSAGE } from "../constants/attachment";
import { fileApi } from "../core/services";
import { useChatStore } from "../core/store/useChatStore";
import { useWidgetToast } from "../core/store/useWidgetToast";
import type { ChatParticipant, UploadedFile } from "../types/chat";
import { messagePreview, normalizeName, splitMentions } from "../utils/chat";
import { extractErrorMessage } from "../utils/error";
import { formatBytes } from "../utils/format";
import WidgetAvatar from "./WidgetAvatar.vue";
import WidgetIcon from "./WidgetIcon.vue";

const props = withDefaults(
  defineProps<{ placeholder?: string; autofocus?: boolean }>(),
  { placeholder: "Nhập tin nhắn", autofocus: false },
);

const emit = defineEmits<{
  send: [content: string, attachments: UploadedFile[], mentionedUserIds: string[]];
  typing: [];
}>();

const toast = useWidgetToast();

const {
  activeConversation,
  currentUserId,
  attachmentRule,
  isGroup,
  membersOf,
  replyingTo,
  cancelReply,
} = useChatStore();

const body = ref("");
const textarea = ref<HTMLTextAreaElement | null>(null);
const mirror = ref<HTMLElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const attachments = ref<UploadedFile[]>([]);
const uploadingCount = ref(0);

/** Tên đã chèn vào ô nhập, giữ để quy ngược ra userId lúc gửi. */
const mentions = ref<{ userId: string; name: string }[]>([]);
const mentionQuery = ref<string | null>(null);
const mentionIndex = ref(0);

const acceptAttribute = computed(() => attachmentRule.value.allowedExtensions.join(","));

/**
 * Textarea không tô màu được một phần chữ, nên phần @tên hiển thị ở lớp nền phía sau còn chữ
 * trong textarea để trong suốt. Hai lớp phải cùng font, padding và chiều rộng mới trùng khít.
 */
const bodySegments = computed(() =>
  splitMentions(
    body.value,
    mentions.value.map((m) => m.name),
  ),
);

const syncMirrorScroll = () => {
  if (mirror.value && textarea.value) {
    mirror.value.scrollTop = textarea.value.scrollTop;
  }
};

const canSend = computed(
  () => !uploadingCount.value && Boolean(body.value.trim() || attachments.value.length),
);

// ─── Nhắc tên ─────────────────────────────────────────────────────────────────

const mentionCandidates = computed<ChatParticipant[]>(() => {
  const conversation = activeConversation.value;
  if (!conversation || !isGroup(conversation) || mentionQuery.value === null) return [];

  const query = normalizeName(mentionQuery.value);

  return membersOf(conversation)
    .filter((p) => p.userId.toLowerCase() !== currentUserId.value)
    .filter((p) => !query || normalizeName(p.fullName || p.email || "").includes(query))
    .slice(0, 5);
});

const displayNameOf = (participant: ChatParticipant) =>
  participant.fullName || participant.email || "Người dùng";

/** Chỉ nhận token ngay trước con trỏ; gặp khoảng trắng là kết thúc từ khoá. */
const refreshMentionQuery = () => {
  const el = textarea.value;
  const conversation = activeConversation.value;

  if (!el || !conversation || !isGroup(conversation)) {
    mentionQuery.value = null;
    return;
  }

  const match = body.value.slice(0, el.selectionStart).match(/@([^\s@]*)$/);
  mentionQuery.value = match ? match[1]! : null;
  mentionIndex.value = 0;
};

const pickMention = (participant: ChatParticipant) => {
  const el = textarea.value;
  if (!el || mentionQuery.value === null) return;

  const caret = el.selectionStart;
  const tokenStart = caret - mentionQuery.value.length - 1;
  const name = displayNameOf(participant);

  const after = body.value.slice(caret);
  const spacer = after.startsWith(" ") ? "" : " ";

  body.value = `${body.value.slice(0, tokenStart)}@${name}${spacer}${after}`;
  mentions.value = [
    ...mentions.value.filter((m) => m.userId !== participant.userId),
    { userId: participant.userId, name },
  ];
  mentionQuery.value = null;

  nextTick(() => {
    el.focus();
    const position = tokenStart + name.length + 2;
    el.setSelectionRange(position, position);
  });
};

// ─── Tệp đính kèm ─────────────────────────────────────────────────────────────

const isAllowed = (file: File) => {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  return attachmentRule.value.allowedExtensions.includes(extension);
};

const onPickFiles = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const picked = Array.from(input.files ?? []);
  input.value = "";

  for (const file of picked) {
    if (attachments.value.length + uploadingCount.value >= MAX_ATTACHMENTS_PER_MESSAGE) {
      toast.warning(`Mỗi tin nhắn tối đa ${MAX_ATTACHMENTS_PER_MESSAGE} tệp`);
      break;
    }
    if (!isAllowed(file)) {
      toast.error(`Không gửi được "${file.name}": kiểu tệp không được phép`);
      continue;
    }
    if (file.size > attachmentRule.value.maxSizeBytes) {
      toast.error(
        `Không gửi được "${file.name}": vượt quá ${formatBytes(attachmentRule.value.maxSizeBytes, 0)}`,
      );
      continue;
    }

    uploadingCount.value += 1;
    try {
      const res = await fileApi.upload(file);
      attachments.value = [...attachments.value, res.data.data];
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      uploadingCount.value -= 1;
    }
  }
};

const removeAttachment = (fileUrl: string) => {
  attachments.value = attachments.value.filter((f) => f.fileUrl !== fileUrl);
};

// ─── Ô nhập ───────────────────────────────────────────────────────────────────

// Textarea tự cao theo nội dung, chặn ở 5 dòng để khung chat không bị đẩy hết lên.
const MAX_HEIGHT_PX = 110;

const resize = () => {
  const el = textarea.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
};

watch(body, (value) => {
  nextTick(resize);
  if (value.trim()) emit("typing");
});

const focus = () => textarea.value?.focus();

onMounted(() => {
  if (props.autofocus) focus();
});

// Bấm trả lời ở tin nào thì con trỏ nhảy thẳng vào ô nhập.
watch(replyingTo, (value) => {
  if (value) nextTick(focus);
});

const submit = () => {
  if (!canSend.value) return;

  const content = body.value;
  const mentionedUserIds = mentions.value
    .filter((m) => content.includes(`@${m.name}`))
    .map((m) => m.userId);

  emit("send", content, [...attachments.value], mentionedUserIds);

  body.value = "";
  attachments.value = [];
  mentions.value = [];
  mentionQuery.value = null;
  nextTick(resize);
};

const onKeydown = (event: KeyboardEvent) => {
  if (mentionCandidates.value.length) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      mentionIndex.value = (mentionIndex.value + 1) % mentionCandidates.value.length;
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      mentionIndex.value =
        (mentionIndex.value - 1 + mentionCandidates.value.length) %
        mentionCandidates.value.length;
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      pickMention(mentionCandidates.value[mentionIndex.value]!);
      return;
    }
    if (event.key === "Escape") {
      mentionQuery.value = null;
      return;
    }
  }

  if (event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  submit();
};

defineExpose({ focus });
</script>

<template>
  <div class="relative shrink-0 border-t border-gray-100 bg-white px-3 py-2.5">
    <div
      v-if="replyingTo"
      class="mb-2 flex items-start gap-2 rounded-r-lg border-l-2 border-chat-accent bg-chat-accent/5 px-3 py-2"
    >
      <div class="min-w-0 flex-1">
        <p class="text-[11px] font-semibold text-chat-accent-strong">
          Đang trả lời {{ replyingTo.senderName || "tin nhắn" }}
        </p>
        <p class="truncate text-[11px] text-gray-600">{{ messagePreview(replyingTo) }}</p>
      </div>
      <button
        type="button"
        class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-white hover:text-gray-800"
        aria-label="Bỏ trả lời"
        @click="cancelReply"
      >
        <WidgetIcon name="X" :size="14" />
      </button>
    </div>

    <ul v-if="attachments.length || uploadingCount" class="mb-2 flex flex-wrap gap-2">
      <li
        v-for="file in attachments"
        :key="file.fileUrl"
        class="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 py-1.5 pl-2.5 pr-1.5"
      >
        <WidgetIcon
          :name="file.isImage ? 'Image' : 'FileText'"
          :size="15"
          class="text-chat-accent-strong"
        />
        <span class="max-w-32 truncate text-[11px] font-medium text-gray-700">
          {{ file.fileName }}
        </span>
        <button
          type="button"
          class="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800"
          :aria-label="`Bỏ tệp ${file.fileName}`"
          @click="removeAttachment(file.fileUrl)"
        >
          <WidgetIcon name="X" :size="12" />
        </button>
      </li>

      <li
        v-for="index in uploadingCount"
        :key="`uploading-${index}`"
        class="flex items-center gap-2 rounded-xl border border-dashed border-gray-200 px-3 py-1.5 text-[11px] text-gray-600"
      >
        <WidgetIcon
          name="Loader2"
          :size="13"
          class="animate-spin text-chat-accent-strong"
        />
        Đang tải tệp lên
      </li>
    </ul>

    <div class="flex items-end gap-1.5">
      <input
        ref="fileInput"
        type="file"
        multiple
        :accept="acceptAttribute"
        class="hidden"
        @change="onPickFiles"
      />

      <button
        type="button"
        class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-chat-accent-strong"
        aria-label="Đính kèm tệp"
        :title="`Đính kèm tệp, tối đa ${formatBytes(attachmentRule.maxSizeBytes, 0)} mỗi tệp`"
        @click="fileInput?.click()"
      >
        <WidgetIcon name="Paperclip" :size="18" />
      </button>

      <div
        class="flex min-h-9 flex-1 items-center rounded-3xl border border-gray-200 bg-gray-50 px-3.5 transition-all focus-within:border-chat-accent focus-within:bg-white focus-within:ring-4 focus-within:ring-chat-accent/10"
      >
        <div class="relative w-full">
          <div
            ref="mirror"
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap py-2 text-sm leading-6 text-gray-900 wrap-break-word"
          >
            <span
              v-for="(segment, index) in bodySegments"
              :key="index"
              :class="segment.isMention && 'bg-chat-accent/20 text-chat-accent-strong'"
              >{{ segment.text }}</span
            ><span>&#8203;</span>
          </div>

          <textarea
            ref="textarea"
            v-model="body"
            rows="1"
            :placeholder="placeholder"
            class="gdtd-chat-no-scrollbar relative w-full resize-none border-0 bg-transparent px-0 py-2 text-sm leading-6 text-transparent caret-gray-900 outline-none placeholder:text-gray-500"
            @keydown="onKeydown"
            @keyup="refreshMentionQuery"
            @click="refreshMentionQuery"
            @scroll="syncMirrorScroll"
          />
        </div>
      </div>

      <button
        type="button"
        class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed"
        :class="
          canSend
            ? 'bg-chat-accent-strong text-white hover:brightness-110'
            : 'bg-gray-100 text-gray-500'
        "
        :disabled="!canSend"
        aria-label="Gửi tin nhắn"
        title="Gửi tin nhắn (Enter)"
        @click="submit"
      >
        <WidgetIcon name="Send" :size="16" />
      </button>
    </div>

    <ul
      v-if="mentionCandidates.length"
      class="absolute bottom-full left-3 z-20 mb-2 w-64 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-lg"
    >
      <li v-for="(person, index) in mentionCandidates" :key="person.userId">
        <button
          type="button"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors"
          :class="index === mentionIndex ? 'bg-chat-accent/10' : 'hover:bg-gray-50'"
          @mouseenter="mentionIndex = index"
          @click="pickMention(person)"
        >
          <WidgetAvatar :name="displayNameOf(person)" size="xs" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-xs font-medium text-gray-800">
              {{ displayNameOf(person) }}
            </span>
            <span class="block truncate text-[11px] text-gray-600">{{ person.email }}</span>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* Flowbite đặt padding ngang cho mọi textarea, lệch đúng chừng đó là lớp nền không khớp. */
textarea {
  padding-left: 0;
  padding-right: 0;
}
</style>
