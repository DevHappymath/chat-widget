<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import {
  formatUntil,
  MESSAGE_DURATIONS,
  ownPresenceLabel,
  PRESENCE_OPTIONS,
  resolveExpiry,
  type PresenceDuration,
} from "../constants/presence";
import { useChatStore } from "../core/store/useChatStore";
import { useWidgetToast } from "../core/store/useWidgetToast";
import { PresenceStatus } from "../types/chat";
import { extractErrorMessage } from "../utils/error";
import DurationChips from "./DurationChips.vue";
import PresenceDot from "./PresenceDot.vue";
import WidgetAvatar from "./WidgetAvatar.vue";
import WidgetIcon from "./WidgetIcon.vue";

/**
 * Bảng đặt trạng thái và lời nhắn của chính mình. Nơi gọi lo vị trí và lúc đóng; chọn trạng thái
 * tự đặt thì phát `choose` để nơi gọi mở bước hỏi thời hạn.
 */
const emit = defineEmits<{ close: []; choose: [status: PresenceStatus] }>();

const { currentUserName, myPresence, setPresenceStatus, setPresenceMessage } = useChatStore();
const toast = useWidgetToast();

const MESSAGE_MAX_LENGTH = 140;

const isSaving = ref(false);

const current = computed(() => myPresence.value?.status ?? PresenceStatus.Available);
const selected = computed(() => myPresence.value?.manualStatus ?? PresenceStatus.Available);

const statusUntil = computed(() =>
  myPresence.value?.manualStatus != null && myPresence.value.statusExpiresAtUtc
    ? formatUntil(myPresence.value.statusExpiresAtUtc)
    : null,
);

const run = async (action: () => Promise<void>) => {
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    await action();
    return true;
  } catch (err) {
    toast.error(extractErrorMessage(err));
    return false;
  } finally {
    isSaving.value = false;
  }
};

// Sẵn sàng là về tự động nên không có gì để hỏi thêm, đổi ngay.
const pickStatus = async (status: PresenceStatus) => {
  if (status !== PresenceStatus.Available) {
    emit("choose", status);
    return;
  }

  const ok = await run(() => setPresenceStatus({ status }));
  if (ok) emit("close");
};

// ─── Lời nhắn ─────────────────────────────────────────────────────────────────

const isEditingMessage = ref(false);
const messageDraft = ref("");
const messageDuration = ref<PresenceDuration>("never");
const messageInput = ref<HTMLTextAreaElement | null>(null);

const messageUntil = computed(() =>
  myPresence.value?.messageExpiresAtUtc ? formatUntil(myPresence.value.messageExpiresAtUtc) : null,
);

const startEditMessage = async () => {
  messageDraft.value = myPresence.value?.message ?? "";
  messageDuration.value = "never";
  isEditingMessage.value = true;
  await nextTick();
  messageInput.value?.focus();
};

const saveMessage = async () => {
  const message = messageDraft.value.trim();
  const ok = await run(() =>
    setPresenceMessage({
      message: message || null,
      expiresAtUtc: message ? resolveExpiry(messageDuration.value) : null,
    }),
  );
  if (ok) isEditingMessage.value = false;
};

const clearMessage = () => run(() => setPresenceMessage({ message: null }));
</script>

<template>
  <div
    class="w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-200 bg-white text-gray-900 shadow-2xl"
    role="dialog"
    aria-label="Trạng thái của bạn"
  >
    <div class="flex items-center gap-2.5 border-b border-gray-100 px-3 py-3">
      <WidgetAvatar :name="currentUserName" :status="current" show-presence size="sm" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-gray-900">{{ currentUserName }}</p>
        <p class="truncate text-xs text-gray-700">
          <template v-if="myPresence">{{ ownPresenceLabel(myPresence) }}</template><template v-if="statusUntil"> · {{ statusUntil }}</template>
        </p>
      </div>
    </div>

    <ul class="py-1" role="listbox" aria-label="Chọn trạng thái">
      <li v-for="option in PRESENCE_OPTIONS" :key="option.status">
        <button
          type="button"
          role="option"
          :aria-selected="selected === option.status"
          class="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors disabled:opacity-60"
          :class="selected === option.status ? 'bg-chat-accent/5' : 'hover:bg-gray-50'"
          :disabled="isSaving"
          @click="pickStatus(option.status)"
        >
          <PresenceDot :status="option.status" class="h-3.5 w-3.5 shrink-0" />
          <span class="min-w-0 flex-1">
            <span class="block text-[13px] font-medium text-gray-900">{{ option.label }}</span>
            <span v-if="option.hint" class="block truncate text-xs text-gray-600">
              {{ option.hint }}
            </span>
          </span>
          <WidgetIcon
            v-if="selected === option.status"
            name="Check"
            :size="15"
            class="text-chat-accent-strong"
          />
        </button>
      </li>
    </ul>

    <div class="border-t border-gray-100 px-3 py-2.5">
      <template v-if="isEditingMessage">
        <div class="relative">
          <textarea
            ref="messageInput"
            v-model="messageDraft"
            rows="2"
            :maxlength="MESSAGE_MAX_LENGTH"
            placeholder="Ví dụ: Đang họp phụ huynh, chiều trả lời"
            aria-label="Lời nhắn trạng thái"
            class="block w-full resize-none rounded-lg border border-gray-200 px-2.5 py-2 text-xs text-gray-900 placeholder:text-gray-500 focus:border-chat-accent focus:ring-0"
            @keydown.enter.exact.prevent="saveMessage"
            @keydown.esc.stop="isEditingMessage = false"
          />
          <span class="pointer-events-none absolute bottom-1 right-2 text-[10px] text-gray-400">
            {{ messageDraft.length }}/{{ MESSAGE_MAX_LENGTH }}
          </span>
        </div>

        <DurationChips
          v-model="messageDuration"
          label="Tự xoá lời nhắn sau"
          :options="MESSAGE_DURATIONS"
          class="mt-2.5"
        />

        <div class="mt-2.5 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-full px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
            @click="isEditingMessage = false"
          >
            Huỷ
          </button>
          <button
            type="button"
            class="rounded-full bg-chat-accent-strong px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            :disabled="isSaving"
            @click="saveMessage"
          >
            Lưu
          </button>
        </div>
      </template>

      <div v-else-if="myPresence?.message" class="flex items-start gap-2">
        <button
          type="button"
          class="min-w-0 flex-1 rounded-lg bg-gray-50 px-2.5 py-2 text-left transition-colors hover:bg-gray-100"
          aria-label="Sửa lời nhắn trạng thái"
          @click="startEditMessage"
        >
          <span class="block break-words text-[13px] text-gray-900">{{ myPresence.message }}</span>
          <span v-if="messageUntil" class="mt-0.5 block text-[11px] text-gray-600">
            Hiện {{ messageUntil }}
          </span>
        </button>
        <button
          type="button"
          class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:opacity-60"
          aria-label="Xoá lời nhắn trạng thái"
          title="Xoá lời nhắn"
          :disabled="isSaving"
          @click="clearMessage"
        >
          <WidgetIcon name="Trash2" :size="14" />
        </button>
      </div>

      <button
        v-else
        type="button"
        class="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-[13px] font-semibold text-chat-accent-strong transition-colors hover:bg-chat-accent/10"
        @click="startEditMessage"
      >
        <WidgetIcon name="MessageSquarePlus" :size="15" />
        Đặt lời nhắn trạng thái
      </button>
    </div>
  </div>
</template>
