import { ref } from "vue";
import { useWidgetToast } from "./useWidgetToast";

/** Tệp đang tải, dùng chung để bong bóng tin và màn tệp cùng hiện vòng xoay. */
const downloading = ref(new Set<string>());

/**
 * Tải tệp đính kèm về máy với đúng tên gốc. Tệp lưu trên máy chủ mang tên ngẫu nhiên, nên phải
 * tải qua blob rồi đặt tên lại; gắn href thẳng thì trình duyệt mở tab mới hoặc lưu sai tên.
 */
export const useFileDownload = () => {
  const toast = useWidgetToast();

  const isDownloading = (url: string) => downloading.value.has(url);

  const download = async (url: string, fileName: string) => {
    if (isDownloading(url)) return;

    downloading.value = new Set(downloading.value).add(url);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.statusText);

      const href = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = href;
      link.download = fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch {
      toast.error(`Chưa tải được "${fileName}" về máy, vui lòng thử lại`);
    } finally {
      const next = new Set(downloading.value);
      next.delete(url);
      downloading.value = next;
    }
  };

  return { download, isDownloading };
};
