<script setup lang="ts">
import { computed } from "vue";
import type { Sticker } from "../types/chat";

/** Nhãn dán dạng video (webm, mp4) phát lặp, tắt tiếng như ảnh động; còn lại hiện bằng ảnh. */
const props = withDefaults(
  defineProps<{ sticker: Pick<Sticker, "url" | "name" | "contentType">; alt?: string }>(),
  { alt: undefined },
);

const isVideo = computed(() => props.sticker.contentType?.startsWith("video/") ?? false);
</script>

<template>
  <video
    v-if="isVideo"
    :src="sticker.url"
    :aria-label="alt ?? sticker.name"
    autoplay
    loop
    muted
    playsinline
    disablepictureinpicture
    preload="metadata"
    class="pointer-events-none object-contain"
  />
  <img
    v-else
    :src="sticker.url"
    :alt="alt ?? sticker.name"
    loading="lazy"
    draggable="false"
    class="object-contain"
  />
</template>
