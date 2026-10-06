<script setup lang="ts">
import { computed, ref } from "vue";
import { EMOJI_CATEGORIES, type EmojiCategory } from "../constants/reaction";
import WidgetIcon from "./WidgetIcon.vue";

/**
 * Bảng chọn biểu tượng dùng chung cho thả cảm xúc và chèn vào ô soạn tin. Chỉ là phần thân,
 * nơi gọi tự lo vị trí và lúc đóng.
 */
const props = withDefaults(
  defineProps<{
    /** Biểu tượng đang được chọn sẵn, tô nền để người dùng biết bấm lại là gỡ. */
    selected?: readonly string[];
  }>(),
  { selected: () => [] },
);

const emit = defineEmits<{ pick: [emoji: string] }>();

// Widget chạy chung origin với site chủ nên khoá phải có tiền tố riêng, tránh đè dữ liệu của site.
const RECENT_KEY = "gdtd-chat.recentEmojis";
const RECENT_LIMIT = 16;

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

const scroller = ref<HTMLElement | null>(null);
const sectionEls: Record<string, HTMLElement> = {};
const activeKey = ref(sections.value[0]!.key);

const bindSection = (key: string) => (el: unknown) => {
  if (el) sectionEls[key] = el as HTMLElement;
};

const jumpTo = (key: string) => {
  const el = sectionEls[key];
  if (!el || !scroller.value) return;

  activeKey.value = key;
  scroller.value.scrollTo({ top: el.offsetTop });
};

const syncActive = () => {
  const container = scroller.value;
  if (!container) return;

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
    class="flex h-72 w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
  >
    <nav class="flex shrink-0 items-center justify-between border-b border-gray-100 px-1.5 py-1">
      <button
        v-for="section in sections"
        :key="section.key"
        type="button"
        class="inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
        :class="
          activeKey === section.key
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
        <div class="grid grid-cols-8 gap-0.5">
          <button
            v-for="emoji in section.emojis"
            :key="emoji"
            type="button"
            class="inline-flex aspect-square items-center justify-center rounded-lg text-lg transition-transform hover:scale-110 hover:bg-gray-100 active:scale-95"
            :class="isSelected(emoji) && 'bg-chat-accent/10 ring-1 ring-chat-accent/30'"
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
