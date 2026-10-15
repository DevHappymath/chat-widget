import { ref } from "vue";
import type { CreateStickerCommand, Sticker, StickerPack } from "../../types/chat";
import { extractErrorMessage } from "../../utils/error";
import { stickerApi } from "../services";

const packs = ref<StickerPack[]>([]);
const isLoading = ref(false);
const loadError = ref<string | null>(null);
const loadedAt = ref(0);
const isCreating = ref(false);

let inflight: Promise<void> | null = null;

// Người khác tạo hay quản trị gỡ nhãn dán không có event realtime, nên mở lại bảng chọn sau
// chừng này thì tải lại danh mục.
const STALE_MS = 3 * 60 * 1000;

/**
 * Danh mục nhãn dán dùng chung cho cả tab. Tải khi mở bảng chọn lần đầu hoặc khi danh mục đã cũ;
 * tải hỏng thì lần mở sau tải lại.
 */
export const useStickers = () => {
  const load = (force = false) => {
    if (!force && packs.value.length && Date.now() - loadedAt.value < STALE_MS) {
      return Promise.resolve();
    }

    inflight ??= (async () => {
      isLoading.value = true;
      loadError.value = null;
      try {
        const res = await stickerApi.getPacks();
        packs.value = res.data.data;
        loadedAt.value = Date.now();
      } catch (err) {
        loadError.value = extractErrorMessage(err);
      } finally {
        isLoading.value = false;
        inflight = null;
      }
    })();

    return inflight;
  };

  /** Lần mở bảng chọn sau sẽ tải lại, vd. khi gửi trượt vì nhãn dán vừa bị gỡ. */
  const invalidate = () => {
    loadedAt.value = 0;
  };

  /** Tạo xong thì đưa nhãn dán lên đầu gói tự tạo luôn, không chờ tải lại danh mục. */
  const create = async (command: CreateStickerCommand): Promise<Sticker> => {
    isCreating.value = true;
    try {
      const res = await stickerApi.create(command);
      const sticker = res.data.data;

      packs.value = packs.value.map((pack) =>
        pack.isUserMade ? { ...pack, stickers: [sticker, ...pack.stickers] } : pack,
      );

      return sticker;
    } finally {
      isCreating.value = false;
    }
  };

  return { packs, isLoading, loadError, isCreating, load, invalidate, create };
};
