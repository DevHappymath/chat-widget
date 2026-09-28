<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useChatStore } from "../core/store/useChatStore";
import { useImageViewer } from "../core/store/useImageViewer";
import { useWidgetToast } from "../core/store/useWidgetToast";
import { lockPageScroll, unlockPageScroll } from "../core/viewport";
import { formatDateTime } from "../utils/format";
import WidgetIcon from "./WidgetIcon.vue";

const { images, index, isOpen, current, close, goTo, next, prev } = useImageViewer();
const { activeConversationId, revealMessage } = useChatStore();
const toast = useWidgetToast();

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_CLICK_SCALE = 2.5;
/** Vuốt ngang quá chừng này mới tính là chuyển ảnh, tránh chạm nhẹ cũng nhảy ảnh. */
const SWIPE_THRESHOLD_PX = 60;
/** Nhích quá chừng này coi như đang kéo, nhả tay ra không được tính là bấm nền để đóng. */
const DRAG_TOLERANCE_PX = 6;

const imageRef = ref<HTMLImageElement | null>(null);
const stripRef = ref<HTMLElement | null>(null);

const isLoaded = ref(false);
const isDownloading = ref(false);
const scale = ref(1);
const offset = ref({ x: 0, y: 0 });
const isPanning = ref(false);

const hasPrev = computed(() => (index.value ?? 0) > 0);
const hasNext = computed(() => (index.value ?? 0) < images.value.length - 1);
const isZoomed = computed(() => scale.value > MIN_SCALE);

const imageStyle = computed(() => ({
  transform: `translate(${offset.value.x}px, ${offset.value.y}px) scale(${scale.value})`,
}));

const resetZoom = () => {
  scale.value = 1;
  offset.value = { x: 0, y: 0 };
};

/** Giữ ảnh không bị kéo trôi khỏi khung: lệch tối đa bằng phần ảnh đang tràn ra ngoài. */
const clampOffset = (x: number, y: number) => {
  const el = imageRef.value;
  if (!el) return { x, y };

  const maxX = ((scale.value - 1) * el.offsetWidth) / 2;
  const maxY = ((scale.value - 1) * el.offsetHeight) / 2;

  return {
    x: Math.max(-maxX, Math.min(maxX, x)),
    y: Math.max(-maxY, Math.min(maxY, y)),
  };
};

const setScale = (value: number) => {
  scale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, value));
  offset.value = isZoomed.value ? clampOffset(offset.value.x, offset.value.y) : { x: 0, y: 0 };
};

const zoomIn = () => setScale(scale.value + 0.5);
const zoomOut = () => setScale(scale.value - 0.5);

const onWheel = (event: WheelEvent) => {
  if (!isLoaded.value) return;
  setScale(scale.value * (event.deltaY < 0 ? 1.15 : 1 / 1.15));
};

const onDoubleClick = () => setScale(isZoomed.value ? MIN_SCALE : DOUBLE_CLICK_SCALE);

// ─── Kéo, vuốt và chụm hai ngón ──────────────────────────────────────────────

const pointers = new Map<number, { x: number; y: number }>();
let dragStart: { x: number; y: number; offsetX: number; offsetY: number } | null = null;
let pinchStart: { distance: number; scale: number } | null = null;
let didDrag = false;

const distanceBetweenPointers = () => {
  const [a, b] = [...pointers.values()];
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
};

const onPointerDown = (event: PointerEvent) => {
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (pointers.size === 2) {
    pinchStart = { distance: distanceBetweenPointers(), scale: scale.value };
    dragStart = null;
    return;
  }

  didDrag = false;
  dragStart = {
    x: event.clientX,
    y: event.clientY,
    offsetX: offset.value.x,
    offsetY: offset.value.y,
  };
};

const onPointerMove = (event: PointerEvent) => {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (pinchStart && pointers.size === 2) {
    didDrag = true;
    setScale((pinchStart.scale * distanceBetweenPointers()) / pinchStart.distance);
    return;
  }

  if (!dragStart) return;

  const dx = event.clientX - dragStart.x;
  const dy = event.clientY - dragStart.y;
  if (Math.abs(dx) > DRAG_TOLERANCE_PX || Math.abs(dy) > DRAG_TOLERANCE_PX) didDrag = true;

  if (isZoomed.value) {
    isPanning.value = true;
    offset.value = clampOffset(dragStart.offsetX + dx, dragStart.offsetY + dy);
  }
};

const onPointerUp = (event: PointerEvent) => {
  pointers.delete(event.pointerId);
  if (pointers.size < 2) pinchStart = null;

  const start = dragStart;
  dragStart = null;
  isPanning.value = false;
  if (!start || isZoomed.value || event.pointerType === "mouse") return;

  // Chỉ vuốt bằng tay mới chuyển ảnh; chuột kéo ngang trên desktop dễ là đang bôi chọn.
  const dx = event.clientX - start.x;
  const dy = event.clientY - start.y;
  if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return;

  if (dx < 0) next();
  else prev();
};

const onPointerCancel = (event: PointerEvent) => {
  pointers.delete(event.pointerId);
  pinchStart = null;
  dragStart = null;
  isPanning.value = false;
};

const onStageClick = (event: MouseEvent) => {
  if (didDrag) {
    didDrag = false;
    return;
  }
  if (event.target === event.currentTarget) close();
};

// ─── Hành động trên ảnh ──────────────────────────────────────────────────────

/**
* Tải qua blob để trình duyệt lưu thẳng thành tệp; gắn href trực tiếp thì ảnh sẽ mở ra
* tab mới thay vì tải về.
*/
const download = async () => {
  const image = current.value;
  if (!image || isDownloading.value) return;

  isDownloading.value = true;
  try {
    const res = await fetch(image.url);
    if (!res.ok) throw new Error(res.statusText);

    const href = URL.createObjectURL(await res.blob());
    const link = document.createElement("a");
    link.href = href;
    link.download = image.fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  } catch {
    toast.error("Chưa tải được ảnh về máy, vui lòng thử lại");
  } finally {
    isDownloading.value = false;
  }
};

const goToMessage = async () => {
  const image = current.value;
  const conversationId = activeConversationId.value;
  if (!image || !conversationId) return;

  close();
  await revealMessage(conversationId, image.messageId);
};

const onKeydown = (event: KeyboardEvent) => {
  if (!isOpen.value) return;

  const handlers: Record<string, () => void> = {
    Escape: close,
    ArrowLeft: prev,
    ArrowRight: next,
    "+": zoomIn,
    "=": zoomIn,
    "-": zoomOut,
  };
  const handler = handlers[event.key];
  if (!handler) return;

  // Chặn ngay ở pha capture: Esc lọt xuống widget sẽ đóng luôn cả khung chat phía sau.
  event.preventDefault();
  event.stopPropagation();
  handler();
};

// Tải sẵn ảnh hai bên để bấm mũi tên là thấy ngay, không phải chờ ảnh gốc.
const preloadNeighbours = () => {
  if (index.value === null) return;

  for (const target of [index.value - 1, index.value + 1]) {
    const image = images.value[target];
    if (image) new Image().src = image.url;
  }
};

const scrollActiveThumbIntoView = () => {
  const thumb = stripRef.value?.querySelector<HTMLElement>(`[data-index="${index.value}"]`);
  thumb?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
};

watch(
  () => current.value?.id,
  async (id) => {
    if (!id) return;

    isLoaded.value = false;
    resetZoom();
    preloadNeighbours();

    await nextTick();
    scrollActiveThumbIntoView();
    // Ảnh đã có trong cache thì sự kiện load có thể xảy ra trước khi kịp gắn listener.
    if (imageRef.value?.complete && imageRef.value.naturalWidth) isLoaded.value = true;
  },
);

watch(isOpen, (open) => (open ? lockPageScroll() : unlockPageScroll()));

onMounted(() => window.addEventListener("keydown", onKeydown, true));

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown, true);
  if (isOpen.value) unlockPageScroll();
  close();
});

const ACTION_BUTTON =
  "inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40";
const NAV_BUTTON =
  "absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25 sm:inline-flex";
</script>

<template>
  <Teleport to="body">
    <Transition name="viewer">
      <div
        v-if="isOpen && current"
        class="gdtd-chat-root fixed inset-0 z-[2147483200] flex flex-col bg-gray-950/95 select-none"
        role="dialog"
        aria-modal="true"
        :aria-label="`Xem ảnh ${current.fileName}`"
      >
        <!-- Nền là chính ảnh đang xem làm nhoè, giống Messenger, để khung không bị đen trơn. -->
        <img
          :src="current.thumbnailUrl || current.url"
          alt=""
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-3xl"
        />

        <header class="relative z-10 flex items-center justify-between gap-3 px-3 py-3 sm:px-5">
          <div class="min-w-0 text-white">
            <p class="truncate text-sm font-semibold">{{ current.senderName }}</p>
            <p class="truncate text-xs text-white/60">
              {{ formatDateTime(current.createdAtUtc) }}
              <template v-if="images.length > 1">
                · {{ (index ?? 0) + 1 }}/{{ images.length }}
              </template>
            </p>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            <button
              type="button"
              :class="[ACTION_BUTTON, 'hidden sm:inline-flex']"
              aria-label="Thu nhỏ"
              title="Thu nhỏ"
              :disabled="!isZoomed"
              @click="zoomOut"
            >
              <WidgetIcon name="ZoomOut" :size="18" />
            </button>
            <button
              type="button"
              :class="[ACTION_BUTTON, 'hidden sm:inline-flex']"
              aria-label="Phóng to"
              title="Phóng to"
              :disabled="scale >= MAX_SCALE || !isLoaded"
              @click="zoomIn"
            >
              <WidgetIcon name="ZoomIn" :size="18" />
            </button>
            <button
              type="button"
              :class="ACTION_BUTTON"
              aria-label="Tải ảnh về máy"
              title="Tải ảnh về máy"
              :disabled="isDownloading"
              @click="download"
            >
              <WidgetIcon
                :name="isDownloading ? 'LoaderCircle' : 'Download'"
                :size="18"
                :class="isDownloading ? 'animate-spin' : ''"
              />
            </button>
            <button
              type="button"
              :class="ACTION_BUTTON"
              aria-label="Mở tin nhắn đã gửi ảnh này"
              title="Mở tin nhắn đã gửi ảnh này"
              @click="goToMessage"
            >
              <WidgetIcon name="MessageSquareText" :size="18" />
            </button>
            <button
              type="button"
              :class="ACTION_BUTTON"
              aria-label="Đóng"
              title="Đóng (Esc)"
              @click="close"
            >
              <WidgetIcon name="X" :size="20" />
            </button>
          </div>
        </header>

        <div class="relative z-10 min-h-0 flex-1">
          <button
            v-if="hasPrev"
            type="button"
            :class="[NAV_BUTTON, 'left-4']"
            aria-label="Ảnh mới hơn"
            @click="prev"
          >
            <WidgetIcon name="ChevronLeft" :size="24" />
          </button>

          <div
            class="flex h-full w-full touch-none items-center justify-center overflow-hidden px-2 sm:px-20"
            :class="isZoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'"
            @click="onStageClick"
            @wheel.prevent="onWheel"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerCancel"
            @pointerleave="onPointerCancel"
          >
            <img
              v-if="!isLoaded && current.thumbnailUrl"
              :src="current.thumbnailUrl"
              alt=""
              aria-hidden="true"
              class="pointer-events-none max-h-full max-w-full object-contain blur-sm"
            />

            <img
              v-show="isLoaded"
              :key="current.id"
              ref="imageRef"
              :src="current.url"
              :alt="current.fileName"
              :style="imageStyle"
              draggable="false"
              class="max-h-full max-w-full object-contain shadow-2xl"
              :class="!isPanning && 'transition-transform duration-150 ease-out'"
              @load="isLoaded = true"
              @dblclick="onDoubleClick"
            />

            <span
              v-if="!isLoaded"
              class="pointer-events-none absolute inset-0 flex items-center justify-center text-white/80"
            >
              <WidgetIcon name="LoaderCircle" :size="32" class="animate-spin" />
            </span>
          </div>

          <button
            v-if="hasNext"
            type="button"
            :class="[NAV_BUTTON, 'right-4']"
            aria-label="Ảnh cũ hơn"
            @click="next"
          >
            <WidgetIcon name="ChevronRight" :size="24" />
          </button>
        </div>

        <div
          v-if="images.length > 1"
          ref="stripRef"
          class="viewer-strip relative z-10 flex shrink-0 gap-2 overflow-x-auto px-4 py-3"
        >
          <button
            v-for="(image, position) in images"
            :key="image.id"
            type="button"
            :data-index="position"
            class="h-14 w-14 shrink-0 overflow-hidden rounded-lg transition-all first:ml-auto last:mr-auto"
            :class="
              position === index
                ? 'opacity-100 ring-2 ring-white'
                : 'opacity-50 hover:opacity-90'
            "
            :aria-label="`Xem ảnh ${position + 1}`"
            :aria-current="position === index"
            @click="goTo(position)"
          >
            <img
              :src="image.thumbnailUrl || image.url"
              :alt="image.fileName"
              loading="lazy"
              draggable="false"
              class="h-full w-full object-cover"
            />
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.viewer-enter-active,
.viewer-leave-active {
  transition: opacity 0.2s ease;
}
.viewer-enter-from,
.viewer-leave-to {
  opacity: 0;
}

.viewer-strip {
  scrollbar-width: none;
}
.viewer-strip::-webkit-scrollbar {
  display: none;
}
</style>
