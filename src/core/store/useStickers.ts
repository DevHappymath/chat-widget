import { ref } from "vue";
import type { StickerPack } from "../../types/chat";
import { extractErrorMessage } from "../../utils/error";
import { stickerApi } from "../services";

const packs = ref<StickerPack[]>([]);
const isLoading = ref(false);
const loadError = ref<string | null>(null);

let inflight: Promise<void> | null = null;

/**
 * Danh mục nhãn dán dùng chung cho cả tab. Chỉ tải lần đầu mở bảng chọn; tải hỏng thì lần mở
 * sau tải lại.
 */
export const useStickers = () => {
  const load = () => {
    if (packs.value.length) return Promise.resolve();

    inflight ??= (async () => {
      isLoading.value = true;
      loadError.value = null;
      try {
        const res = await stickerApi.getPacks();
        packs.value = res.data.data;
      } catch (err) {
        loadError.value = extractErrorMessage(err);
      } finally {
        isLoading.value = false;
        inflight = null;
      }
    })();

    return inflight;
  };

  return { packs, isLoading, loadError, load };
};
