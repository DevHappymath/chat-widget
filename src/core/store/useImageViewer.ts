import { computed, ref } from "vue";
import type { ChatMessage, ConversationAttachment } from "../../types/chat";

export interface ViewerImage {
  id: string;
  url: string;
  thumbnailUrl?: string | null;
  fileName: string;
  messageId: string;
  senderName: string;
  createdAtUtc: string;
}

const isImageType = (contentType: string) => contentType.startsWith("image/");

/** Ảnh trong các tin đã tải của hội thoại, mới nhất đứng đầu để nằm bên trái dải ảnh. */
export const imagesFromMessages = (
  messages: ChatMessage[],
  nameOf: (message: ChatMessage) => string,
): ViewerImage[] =>
  [...messages]
    .filter((m) => !m.isDeleted)
    .sort((a, b) => b.sequence - a.sequence)
    .flatMap((m) =>
      m.attachments
        .filter((file) => isImageType(file.contentType))
        .map((file) => ({
          id: file.id,
          url: file.fileUrl,
          thumbnailUrl: file.thumbnailUrl,
          fileName: file.fileName,
          messageId: m.id,
          senderName: nameOf(m),
          createdAtUtc: m.createdAtUtc,
        })),
    );

/** Kho media đã trả mới nhất trước, giữ nguyên thứ tự đó cho dải ảnh. */
export const imagesFromMedia = (items: ConversationAttachment[]): ViewerImage[] =>
  items
    .filter((item) => isImageType(item.attachment.contentType))
    .map((item) => ({
      id: item.attachment.id,
      url: item.attachment.fileUrl,
      thumbnailUrl: item.attachment.thumbnailUrl,
      fileName: item.attachment.fileName,
      messageId: item.messageId,
      senderName: item.senderName || "Người dùng",
      createdAtUtc: item.createdAtUtc,
    }));

const images = ref<ViewerImage[]>([]);
const index = ref<number | null>(null);

/** Trình xem ảnh toàn màn hình ngay trên trang, thay cho việc mở ảnh sang tab mới. */
export const useImageViewer = () => {
  const isOpen = computed(() => index.value !== null && images.value.length > 0);
  const current = computed(() =>
    index.value === null ? null : (images.value[index.value] ?? null),
  );

  const open = (list: ViewerImage[], imageId: string) => {
    const start = list.findIndex((image) => image.id === imageId);
    if (start < 0) return;

    images.value = list;
    index.value = start;
  };

  const close = () => {
    index.value = null;
    images.value = [];
  };

  const goTo = (target: number) => {
    if (target < 0 || target >= images.value.length) return;
    index.value = target;
  };

  const next = () => index.value !== null && goTo(index.value + 1);
  const prev = () => index.value !== null && goTo(index.value - 1);

  return { images, index, isOpen, current, open, close, goTo, next, prev };
};
