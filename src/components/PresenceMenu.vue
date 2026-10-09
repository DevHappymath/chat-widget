<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import {
  formatUntil,
  MESSAGE_DURATIONS,
  ownPresenceLabel,
  PRESENCE_OPTIONS,
  resolveExpiry,
  STATUS_DURATIONS,
  type PresenceDuration,
} from "../constants/presence";
import { useChatStore } from "../core/store/useChatStore";
import { useWidgetToast } from "../core/store/useWidgetToast";
import { PresenceStatus } from "../types/chat";
import { extractErrorMessage } from "../utils/error";
import PresenceDot from "./PresenceDot.vue";
import WidgetAvatar from "./WidgetAvatar.vue";
import WidgetIcon from "./WidgetIcon.vue";

/** Bảng đặt trạng thái và lời nhắn của chính mình. Nơi gọi lo vị trí và lúc đóng. */
const emit = defineEmits<{ close: [] }>();

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

// Người đặt "Bận" rồi quên là chuyện thường, nên mặc định tự trở về trong ngày.
const statusDuration = ref<PresenceDuration>("today");

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

const pickStatus = async (status: PresenceStatus) => {
  const ok = await run(() =>
    setPresenceStatus({
      status,
      expiresAtUtc: status === PresenceStatus.Available ? null : resolveExpiry(statusDuration.value),
    }),
  );
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
    class="w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-200 bg-white text-gray-900 shadow-xl"
    role="dialog"
    aria-label="Trạng thái của bạn"
  >
    <div class="flex items-center gap-2.5 border-b border-gray-100 px-3 py-3">
      <WidgetAvatar :name="currentUserName" :status="current" show-presence size="sm" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold">{{ currentUserName }}</p>
        <p class="truncate text-[11px] text-gray-600">
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
          class="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-gray-50 disabled:opacity-60"
          :disabled="isSaving"
          @click="pickStatus(option.status)"
        >
          <PresenceDot :status="option.status" class="h-3 w-3 shrink-0" />
          <span class="min-w-0 flex-1">
            <span class="block text-xs font-medium text-gray-800">{{ option.label }}</span>
            <span v-if="option.hint" class="block truncate text-[11px] text-gray-500">
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

    <label class="flex items-center gap-2 border-t border-gray-100 px-3 py-2 text-[11px] text-gray-600">
      <span class="flex-1">Tự trở về Sẵn sàng</span>
      <select
        v-model="statusDuration"
        class="rounded-md border border-gray-200 bg-white py-1 pl-2 pr-7 text-[11px] text-gray-800 focus:border-chat-accent focus:ring-0"
      >
        <option v-for="d in STATUS_DURATIONS" :key="d.key" :value="d.key">{{ d.label }}</option>
      </select>
    </label>

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

        <label class="mt-2 flex items-center gap-2 text-[11px] text-gray-600">
          <span class="flex-1">Tự xoá sau</span>
          <select
            v-model="messageDuration"
            class="rounded-md border border-gray-200 bg-white py-1 pl-2 pr-7 text-[11px] text-gray-800 focus:border-chat-accent focus:ring-0"
          >
            <option v-for="d in MESSAGE_DURATIONS" :key="d.key" :value="d.key">{{ d.label }}</option>
          </select>
        </label>

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
          <span class="block break-words text-xs text-gray-800">{{ myPresence.message }}</span>
          <span v-if="messageUntil" class="mt-0.5 block text-[10px] text-gray-500">
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
        class="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-xs font-medium text-chat-accent-strong transition-colors hover:bg-chat-accent/10"
        @click="startEditMessage"
      >
        <WidgetIcon name="MessageSquarePlus" :size="15" />
        Đặt lời nhắn trạng thái
      </button>
    </div>
  </div>
</template>
