<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { EMOJI_KEYWORDS } from "../constants/emoji-keywords";
import { EMOJI_CATEGORIES, type EmojiCategory } from "../constants/reaction";
import { matchesAllWords, normalizeName } from "../utils/chat";
import WidgetIcon from "./WidgetIcon.vue";

/**
 * Bảng chọn biểu tượng dùng chung cho thả cảm xúc và chèn vào ô soạn tin. Chỉ là phần thân,
 * nơi gọi tự lo vị trí và lúc đóng.
 */
const props = withDefaults(
  defineProps<{
    /** Biểu tượng đang được chọn sẵn, tô nền để người dùng biết bấm lại là gỡ. */
    selected?: readonly string[];
    /** Bỏ khung và bóng khi nằm trong một khung khác đã có sẵn, như thẻ chọn của ô soạn tin. */
    bare?: boolean;
  }>(),
  { selected: () => [], bare: false },
);

const emit = defineEmits<{ pick: [emoji: string] }>();

// Widget chạy chung origin với site chủ nên khoá phải có tiền tố riêng, tránh đè dữ liệu của site.
const RECENT_KEY = "gdtd-chat.recentEmojis";
const RECENT_LIMIT = 14;

const CELL_CLASS =
  "inline-flex aspect-square items-center justify-center rounded-lg text-2xl leading-none transition-transform hover:scale-110 hover:bg-gray-100 active:scale-95";

const readRecent = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
};

const recent = ref<string[]>(readRecent());

const sections = computed<EmojiCategory[]>(() =>
  recent.value.length
    ? [
        { key: "recent", label: "Dùng gần đây", icon: "Clock", emojis: recent.value },
        ...EMOJI_CATEGORIES,
      ]
    : [...EMOJI_CATEGORIES],
);

// ─── Tìm kiếm ─────────────────────────────────────────────────────────────────

const query = ref("");
const isSearching = computed(() => Boolean(query.value.trim()));

let searchIndex: { emoji: string; text: string }[] | null = null;

// Dựng lúc gõ chữ đầu tiên chứ không dựng sẵn: đa số lần mở bảng chỉ để bấm chọn.
const getSearchIndex = () =>
  (searchIndex ??= [...new Set(EMOJI_CATEGORIES.flatMap((c) => c.emojis))].map((emoji) => ({
    emoji,
    text: normalizeName(EMOJI_KEYWORDS[emoji] ?? ""),
  })));

const results = computed(() =>
  isSearching.value
    ? getSearchIndex()
        .filter((entry) => matchesAllWords(entry.text, query.value))
        .map((entry) => entry.emoji)
    : [],
);

// ─── Nhảy mục ─────────────────────────────────────────────────────────────────

const scroller = ref<HTMLElement | null>(null);
const sectionEls: Record<string, HTMLElement> = {};
const activeKey = ref(sections.value[0]!.key);

const bindSection = (key: string) => (el: unknown) => {
  if (el) sectionEls[key] = el as HTMLElement;
};

const jumpTo = async (key: string) => {
  // Khung danh mục bị ẩn lúc đang tìm nên chưa đo được vị trí, phải chờ nó hiện lại.
  if (isSearching.value) {
    query.value = "";
    await nextTick();
  }

  const el = sectionEls[key];
  if (!el || !scroller.value) return;

  activeKey.value = key;
  scroller.value.scrollTo({ top: el.offsetTop });
};

const syncActive = () => {
  const container = scroller.value;
  if (!container || isSearching.value) return;

  // Khung cuộn là `relative` nên offsetTop của từng mục tính từ đầu khung.
  const top = container.scrollTop + 8;
  let current = sections.value[0]!.key;

  for (const section of sections.value) {
    const el = sectionEls[section.key];
    if (el && el.offsetTop <= top) current = section.key;
  }

  activeKey.value = current;
};

const pick = (emoji: string) => {
  // Danh sách "gần đây" chỉ đổi ở lần mở sau, đổi ngay thì ô vừa bấm nhảy chỗ dưới tay.
  const next = [emoji, ...readRecent().filter((e) => e !== emoji)].slice(0, RECENT_LIMIT);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Trình duyệt chặn lưu trữ thì chỉ mất phần "gần đây", vẫn chọn được bình thường.
  }

  emit("pick", emoji);
};

const isSelected = (emoji: string) => props.selected.includes(emoji);
</script>

<template>
  <div
    class="flex h-80 w-full flex-col overflow-hidden bg-white"
    :class="!bare && 'rounded-xl border border-gray-200 shadow-xl'"
  >
    <div class="shrink-0 px-2 pt-2">
      <label
        class="flex h-8 items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 text-gray-500 ring-1 ring-transparent transition-colors focus-within:bg-white focus-within:ring-chat-accent/50"
      >
        <WidgetIcon name="Search" :size="14" />
        <input
          v-model="query"
          type="text"
          placeholder="Tìm biểu tượng"
          aria-label="Tìm biểu tượng"
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

    <!-- Giữ hàng mục cả lúc đang tìm để khung không nhảy; bấm vào mục là thoát tìm kiếm. -->
    <nav
      class="flex shrink-0 items-center justify-between border-b border-gray-100 px-1.5 py-1"
    >
      <button
        v-for="section in sections"
        :key="section.key"
        type="button"
        class="inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
        :class="
          !isSearching && activeKey === section.key
            ? 'bg-chat-accent/10 text-chat-accent-strong'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
        "
        :title="section.label"
        :aria-label="section.label"
        @click="jumpTo(section.key)"
      >
        <WidgetIcon :name="section.icon" :size="15" />
      </button>
    </nav>

    <div
      v-if="isSearching"
      class="gdtd-chat-scroll min-h-0 flex-1 overflow-y-auto px-1.5 pb-2"
    >
      <div v-if="results.length" class="grid grid-cols-7 gap-0.5 pt-2">
        <button
          v-for="emoji in results"
          :key="emoji"
          type="button"
          :class="[CELL_CLASS, isSelected(emoji) && 'bg-chat-accent/10 ring-1 ring-chat-accent/30']"
          :aria-label="emoji"
          @click="pick(emoji)"
        >
          {{ emoji }}
        </button>
      </div>
      <p v-else class="px-2 py-10 text-center text-xs text-gray-500">
        Không tìm thấy biểu tượng nào
      </p>
    </div>

    <!-- Ẩn bằng v-show để giữ nguyên vị trí cuộn khi xoá từ khoá. -->
    <div
      v-show="!isSearching"
      ref="scroller"
      class="gdtd-chat-scroll relative min-h-0 flex-1 overflow-y-auto px-1.5 pb-2"
      @scroll.passive="syncActive"
    >
      <section v-for="section in sections" :key="section.key" :ref="bindSection(section.key)">
        <h3
          class="sticky top-0 z-10 bg-white/95 px-1 pb-1 pt-2 text-[11px] font-semibold text-gray-500"
        >
          {{ section.label }}
        </h3>
        <div class="grid grid-cols-7 gap-0.5">
          <button
            v-for="emoji in section.emojis"
            :key="emoji"
            type="button"
            :class="[CELL_CLASS, isSelected(emoji) && 'bg-chat-accent/10 ring-1 ring-chat-accent/30']"
            :aria-label="emoji"
            @click="pick(emoji)"
          >
            {{ emoji }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
