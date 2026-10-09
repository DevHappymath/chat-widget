<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  MAX_PRESENCE_DURATION_DAYS,
  PRESENCE_OPTIONS,
  resolveExpiry,
  STATUS_DURATIONS,
  type PresenceDuration,
} from "../constants/presence";
import { useChatStore } from "../core/store/useChatStore";
import { useWidgetToast } from "../core/store/useWidgetToast";
import type { PresenceStatus } from "../types/chat";
import { extractErrorMessage } from "../utils/error";
import DurationChips from "./DurationChips.vue";
import MiniCalendar from "./MiniCalendar.vue";
import PresenceDot from "./PresenceDot.vue";
import WidgetIcon from "./WidgetIcon.vue";

/**
 * Bước xác nhận khi chọn một trạng thái tự đặt: hỏi giữ trong bao lâu và lời nhắn đi kèm.
 * Chỉ đổi trạng thái khi bấm xác nhận.
 */
const props = defineProps<{ status: PresenceStatus }>();
const emit = defineEmits<{ close: [] }>();

const { myPresence, setPresenceStatus, setPresenceMessage } = useChatStore();
const toast = useWidgetToast();

const MESSAGE_MAX_LENGTH = 140;

const label = computed(
  () => PRESENCE_OPTIONS.find((option) => option.status === props.status)?.label ?? "",
);

// Người đặt "Bận" rồi quên là chuyện thường, nên mặc định tự trở về sau một ngày.
const duration = ref<PresenceDuration>("1d");

const pad2 = (n: number) => String(n).padStart(2, "0");
const dayKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const MAX_DURATION_MS = MAX_PRESENCE_DURATION_DAYS * 24 * 60 * 60_000;

// Gợi ý sẵn mốc tròn 15 phút sau một tiếng nữa, người dùng chỉ cần sửa ít.
const suggested = new Date(Date.now() + 60 * 60_000);
suggested.setMinutes(Math.ceil(suggested.getMinutes() / 15) * 15, 0, 0);

const customDate = ref(dayKey(suggested));
const customTime = ref(`${pad2(suggested.getHours())}:${pad2(suggested.getMinutes())}`);
const minDay = dayKey(new Date());
const maxDay = dayKey(new Date(Date.now() + MAX_DURATION_MS));

const TIME_PRESETS = ["08:00", "11:30", "13:30", "17:00", "18:00", "21:00"];

/** Chỉ nhận số và tự chèn dấu hai chấm, gõ "1730" là ra "17:30". */
const onTimeInput = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const digits = input.value.replace(/\D/g, "").slice(0, 4);
  customTime.value = digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
  input.value = customTime.value;
};

const originalMessage = myPresence.value?.message ?? "";
const message = ref(originalMessage);

const isSaving = ref(false);
const error = ref("");

const messageInput = ref<HTMLTextAreaElement | null>(null);
onMounted(() => messageInput.value?.focus());

const resolveExpiresAt = (): string | null | undefined => {
  if (duration.value !== "custom") return resolveExpiry(duration.value);

  const time = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(customTime.value);
  if (!time) {
    error.value = "Nhập giờ theo dạng hh:mm, ví dụ 17:30";
    return undefined;
  }

  const [y, m, d] = customDate.value.split("-").map(Number);
  const at = new Date(y!, m! - 1, d!, Number(time[1]), Number(time[2]));
  if (at.getTime() <= Date.now()) {
    error.value = "Chọn một thời điểm sau bây giờ";
    return undefined;
  }
  if (at.getTime() > Date.now() + MAX_DURATION_MS) {
    error.value = `Chỉ đặt được trong vòng ${MAX_PRESENCE_DURATION_DAYS} ngày tới`;
    return undefined;
  }
  return at.toISOString();
};

const confirm = async () => {
  if (isSaving.value) return;
  error.value = "";

  const expiresAtUtc = resolveExpiresAt();
  if (expiresAtUtc === undefined) return;

  isSaving.value = true;
  try {
    await setPresenceStatus({ status: props.status, expiresAtUtc });

    // Lời nhắn hết hạn cùng trạng thái, kể cả lời nhắn cũ giữ nguyên: "Đang họp" mà còn treo
    // sau khi họp xong thì sai.
    const nextMessage = message.value.trim();
    if (nextMessage || originalMessage) {
      await setPresenceMessage({
        message: nextMessage || null,
        expiresAtUtc: nextMessage ? expiresAtUtc : null,
      });
    }

    emit("close");
  } catch (err) {
    toast.error(extractErrorMessage(err));
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <div
    class="absolute inset-0 z-40 flex items-center justify-center bg-gray-900/30 p-4"
    @click.self="emit('close')"
    @keydown.esc.stop="emit('close')"
  >
    <div
      class="flex max-h-full w-full max-w-xs flex-col overflow-hidden rounded-2xl bg-white text-gray-900 shadow-2xl"
      role="dialog"
      aria-modal="true"
      :aria-label="`Đặt trạng thái ${label}`"
    >
      <div class="flex shrink-0 items-center gap-2.5 border-b border-gray-100 px-4 py-3">
        <PresenceDot :status="status" class="h-3 w-3 shrink-0" />
        <p class="min-w-0 flex-1 truncate text-sm font-semibold">{{ label }}</p>
        <button
          type="button"
          class="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
          aria-label="Đóng"
          @click="emit('close')"
        >
          <WidgetIcon name="X" :size="16" />
        </button>
      </div>

      <div class="gdtd-chat-scroll min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-3.5">
        <div>
          <DurationChips v-model="duration" label="Giữ trạng thái trong" :options="STATUS_DURATIONS" />
          <div v-if="duration === 'custom'" class="mt-2.5 rounded-xl border border-gray-100 p-2.5">
            <MiniCalendar v-model="customDate" :min="minDay" :max="maxDay" />

            <div class="mt-2.5 border-t border-gray-100 pt-2.5">
              <label class="flex items-center gap-2 text-xs text-gray-700">
                <WidgetIcon name="Clock" :size="13" />
                <span>Lúc</span>
                <input
                  :value="customTime"
                  type="text"
                  inputmode="numeric"
                  placeholder="hh:mm"
                  aria-label="Giữ trạng thái đến lúc"
                  class="w-16 rounded-lg border border-gray-200 px-2 py-1 text-center text-xs font-semibold text-gray-900 focus:border-chat-accent focus:ring-0"
                  @input="onTimeInput"
                />
              </label>
              <div class="mt-2 flex flex-wrap gap-1.5">
                <button
                  v-for="preset in TIME_PRESETS"
                  :key="preset"
                  type="button"
                  class="rounded-full border px-2 py-1 text-[11px] leading-none transition-colors"
                  :class="
                    customTime === preset
                      ? 'border-chat-accent/40 bg-chat-accent/10 font-semibold text-chat-accent-strong'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  "
                  @click="customTime = preset"
                >
                  {{ preset }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <p class="mb-1.5 text-xs font-medium text-gray-700">Lời nhắn (không bắt buộc)</p>
          <div class="relative">
            <textarea
              ref="messageInput"
              v-model="message"
              rows="2"
              :maxlength="MESSAGE_MAX_LENGTH"
              placeholder="Ví dụ: Đang họp phụ huynh, chiều trả lời"
              aria-label="Lời nhắn trạng thái"
              class="block w-full resize-none rounded-lg border border-gray-200 px-2.5 pb-4 pt-2 text-xs text-gray-900 placeholder:text-gray-500 focus:border-chat-accent focus:ring-0"
              @keydown.enter.exact.prevent="confirm"
            />
            <span class="pointer-events-none absolute bottom-1 right-2 text-[10px] text-gray-400">
              {{ message.length }}/{{ MESSAGE_MAX_LENGTH }}
            </span>
          </div>
          <p class="mt-1 text-[11px] text-gray-600">Lời nhắn tự xoá cùng lúc trạng thái hết hạn.</p>
        </div>

        <p v-if="error" class="text-[11px] text-red-600" role="alert">{{ error }}</p>
      </div>

      <div class="flex shrink-0 justify-end gap-2 border-t border-gray-100 px-4 py-3">
        <button
          type="button"
          class="rounded-full px-3.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
          @click="emit('close')"
        >
          Huỷ
        </button>
        <button
          type="button"
          class="rounded-full bg-chat-accent-strong px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          :disabled="isSaving"
          @click="confirm"
        >
          Xác nhận
        </button>
      </div>
    </div>
  </div>
</template>
