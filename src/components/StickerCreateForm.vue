<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useStickers } from "../core/store/useStickers";
import { useWidgetToast } from "../core/store/useWidgetToast";
import type { Sticker } from "../types/chat";
import { extractErrorMessage } from "../utils/error";
import WidgetIcon from "./WidgetIcon.vue";

/** Màn hình tạo nhãn dán nằm ngay trong bảng chọn, để không phải mở hộp thoại chồng lên ô soạn tin. */
const emit = defineEmits<{ done: [sticker: Sticker]; cancel: [] }>();

const { create, isCreating } = useStickers();
const toast = useWidgetToast();

// Phải khớp StickerRule bên server.
const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const NAME_MAX_LENGTH = 50;
const ACCEPT =
  ".png,.jpg,.jpeg,.webp,.gif,.webm,.mp4,image/png,image/jpeg,image/webp,image/gif,video/webm,video/mp4";
const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "webm", "mp4"];

const fileInput = ref<HTMLInputElement | null>(null);
const file = ref<File | null>(null);
const previewUrl = ref<string | null>(null);
const name = ref("");
const error = ref<string | null>(null);
const videoSize = ref<{ width: number; height: number } | null>(null);

const isVideo = computed(
  () => Boolean(file.value?.type.startsWith("video/")) || /\.(webm|mp4)$/i.test(file.value?.name ?? ""),
);

const canSubmit = computed(() => Boolean(file.value && name.value.trim()) && !isCreating.value);

const clearPreview = () => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = null;
};

onBeforeUnmount(clearPreview);

const choose = () => fileInput.value?.click();

const onFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const picked = input.files?.[0];
  input.value = "";
  if (!picked) return;

  const extension = picked.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    error.value = "Chỉ dùng được ảnh PNG, JPG, WEBP, GIF hoặc video WEBM, MP4";
    return;
  }
  if (picked.size > MAX_SIZE_BYTES) {
    error.value = "Tệp lớn hơn 2MB, hãy chọn tệp nhẹ hơn";
    return;
  }

  error.value = null;
  clearPreview();
  videoSize.value = null;
  file.value = picked;
  previewUrl.value = URL.createObjectURL(picked);

  if (!name.value.trim()) {
    name.value = picked.name
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim()
      .slice(0, NAME_MAX_LENGTH);
  }
};

const onVideoMetadata = (event: Event) => {
  const video = event.target as HTMLVideoElement;
  if (video.videoWidth && video.videoHeight) {
    videoSize.value = { width: video.videoWidth, height: video.videoHeight };
  }
};

const submit = async () => {
  if (!file.value || !canSubmit.value) return;

  error.value = null;
  try {
    const sticker = await create({
      file: file.value,
      name: name.value.trim(),
      width: isVideo.value ? videoSize.value?.width : undefined,
      height: isVideo.value ? videoSize.value?.height : undefined,
    });
    toast.success("Đã tạo nhãn dán, mọi người đều dùng được");
    emit("done", sticker);
  } catch (err) {
    error.value = extractErrorMessage(err);
  }
};
</script>

<template>
  <form
    class="gdtd-chat-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pt-1 pb-3"
    @submit.prevent="submit"
  >
    <input ref="fileInput" type="file" :accept="ACCEPT" class="hidden" @change="onFileChange" />

    <button
      type="button"
      class="group relative mx-auto flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-chat-accent/60"
      :aria-label="file ? 'Chọn tệp khác' : 'Chọn tệp nhãn dán'"
      @click="choose"
    >
      <template v-if="previewUrl">
        <video
          v-if="isVideo"
          :src="previewUrl"
          autoplay
          loop
          muted
          playsinline
          class="size-full object-contain"
          @loadedmetadata="onVideoMetadata"
        />
        <img v-else :src="previewUrl" alt="" class="size-full object-contain" />
        <span
          class="absolute inset-x-0 bottom-0 bg-gray-900/60 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
        >
          Đổi tệp
        </span>
      </template>
      <span v-else class="flex flex-col items-center gap-1.5 px-3 text-center text-gray-500">
        <WidgetIcon name="ImagePlus" :size="22" class="text-gray-400" />
        <span class="text-[11px] font-medium">Chọn ảnh, GIF hoặc video</span>
      </span>
    </button>

    <label class="flex flex-col gap-1">
      <span class="text-[11px] font-medium text-gray-600">Tên nhãn dán</span>
      <input
        v-model="name"
        type="text"
        :maxlength="NAME_MAX_LENGTH"
        placeholder="Vd. Cố lên nào"
        class="h-8 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 outline-none placeholder:text-gray-400 focus:border-chat-accent/60 focus:ring-0"
      />
    </label>

    <p v-if="error" class="text-[11px] text-red-600">{{ error }}</p>
    <p v-else class="text-[10px] leading-snug text-gray-500">
      PNG, JPG, WEBP, GIF, WEBM hoặc MP4, tối đa 2MB. Nhãn dán sẽ hiện cho mọi người, kể cả học sinh.
    </p>

    <div class="mt-auto flex items-center justify-end gap-2">
      <button
        type="button"
        class="rounded-full px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
        @click="emit('cancel')"
      >
        Huỷ
      </button>
      <button
        type="submit"
        :disabled="!canSubmit"
        class="inline-flex items-center gap-1.5 rounded-full bg-chat-accent-strong px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <WidgetIcon v-if="isCreating" name="Loader2" :size="12" class="animate-spin" />
        Tạo nhãn dán
      </button>
    </div>
  </form>
</template>
