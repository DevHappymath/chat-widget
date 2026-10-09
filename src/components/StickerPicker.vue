<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useStickers } from "../core/store/useStickers";
import type { Sticker } from "../types/chat";
import { matchesAllWords, normalizeName } from "../utils/chat";
import WidgetIcon from "./WidgetIcon.vue";

/** Bảng chọn nhãn dán của ô soạn tin. Chọn là gửi luôn, nơi gọi tự đóng bảng. */
const emit = defineEmits<{ pick: [sticker: Sticker] }>();

const { packs, isLoading, loadError, load } = useStickers();

onMounted(load);

const RECENT_KEY = "gdtd-chat.recentStickers";
const RECENT_LIMIT = 8;

const readRecent = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
};

const recentIds = ref<string[]>(readRecent());

const allStickers = computed(() => packs.value.flatMap((pack) => pack.stickers));

// Nhãn dán đã bị tắt thì tự rơi khỏi "gần đây" vì không còn trong danh mục.
const recent = computed(() =>
  recentIds.value
    .map((id) => allStickers.value.find((sticker) => sticker.id === id))
    .filter((sticker): sticker is Sticker => Boolean(sticker)),
);

const query = ref("");
const isSearching = computed(() => Boolean(query.value.trim()));

const results = computed(() =>
  isSearching.value
    ? allStickers.value.filter((sticker) =>
        matchesAllWords(normalizeName(sticker.name), query.value),
      )
    : [],
);

const pick = (sticker: Sticker) => {
  const next = [sticker.id, ...readRecent().filter((id) => id !== sticker.id)].slice(
    0,
    RECENT_LIMIT,
  );
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Trình duyệt chặn lưu trữ thì chỉ mất phần "gần đây", vẫn gửi được bình thường.
  }

  emit("pick", sticker);
};

const CELL_CLASS =
  "inline-flex aspect-square items-center justify-center rounded-xl p-1 transition-transform hover:scale-105 hover:bg-gray-100 active:scale-95";
</script>

<template>
  <div class="flex h-80 w-full flex-col overflow-hidden bg-white">
    <div class="shrink-0 px-2 pt-2 pb-1">
      <label
        class="flex h-8 items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 text-gray-500 ring-1 ring-transparent transition-colors focus-within:bg-white focus-within:ring-chat-accent/50"
      >
        <WidgetIcon name="Search" :size="14" />
        <input
          v-model="query"
          type="text"
          placeholder="Tìm nhãn dán"
          aria-label="Tìm nhãn dán"
          class="min-w-0 flex-1 border-0 bg-transparent p-0 text-xs text-gray-900 outline-none placeholder:text-gray-500 focus:ring-0"
          @keydown.esc.stop="query = ''"
        />
        <button
          v-if="isSearching"
          type="button"
          class="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800"
          aria-label="Xoá từ khoá"
          @click="query = ''"
        >
          <WidgetIcon name="X" :size="12" />
        </button>
      </label>
    </div>

    <div
      v-if="!packs.length && isLoading"
      class="flex flex-1 items-center justify-center text-chat-accent-strong"
    >
      <WidgetIcon name="Loader2" :size="20" class="animate-spin" />
    </div>

    <div
      v-else-if="!packs.length && loadError"
      class="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center"
    >
      <p class="text-xs text-gray-600">Chưa tải được nhãn dán. {{ loadError }}</p>
      <button
        type="button"
        class="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
        @click="load"
      >
        Thử lại
      </button>
    </div>

    <div v-else class="gdtd-chat-scroll min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
      <template v-if="isSearching">
        <div v-if="results.length" class="grid grid-cols-4 gap-1 pt-1">
          <button
            v-for="sticker in results"
            :key="sticker.id"
            type="button"
            :class="CELL_CLASS"
            :title="sticker.name"
            :aria-label="`Gửi nhãn dán ${sticker.name}`"
            @click="pick(sticker)"
          >
            <img :src="sticker.url" :alt="sticker.name" loading="lazy" class="h-full w-full" />
          </button>
        </div>
        <p v-else class="px-2 py-10 text-center text-xs text-gray-500">
          Không tìm thấy nhãn dán nào
        </p>
      </template>

      <template v-else>
        <section v-if="recent.length">
          <h3 class="px-1 pb-1 pt-1 text-[11px] font-semibold text-gray-500">Dùng gần đây</h3>
          <div class="grid grid-cols-4 gap-1">
            <button
              v-for="sticker in recent"
              :key="sticker.id"
              type="button"
              :class="CELL_CLASS"
              :title="sticker.name"
              :aria-label="`Gửi nhãn dán ${sticker.name}`"
              @click="pick(sticker)"
            >
              <img :src="sticker.url" :alt="sticker.name" loading="lazy" class="h-full w-full" />
            </button>
          </div>
        </section>

        <section v-for="pack in packs" :key="pack.id">
          <h3 class="px-1 pb-1 pt-2 text-[11px] font-semibold text-gray-500">{{ pack.name }}</h3>
          <div class="grid grid-cols-4 gap-1">
            <button
              v-for="sticker in pack.stickers"
              :key="sticker.id"
              type="button"
              :class="CELL_CLASS"
              :title="sticker.name"
              :aria-label="`Gửi nhãn dán ${sticker.name}`"
              @click="pick(sticker)"
            >
              <img :src="sticker.url" :alt="sticker.name" loading="lazy" class="h-full w-full" />
            </button>
          </div>

          <!-- Giấy phép của gói bắt buộc ghi nguồn ở nơi người dùng nhìn thấy. -->
          <p v-if="pack.attribution" class="px-1 pt-2 text-[10px] text-gray-500">
            <a
              v-if="pack.attributionUrl"
              :href="pack.attributionUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="underline decoration-gray-300 underline-offset-2 hover:text-gray-700"
              >{{ pack.attribution }}</a
            >
            <template v-else>{{ pack.attribution }}</template>
          </p>
        </section>
      </template>
    </div>
  </div>
</template>
