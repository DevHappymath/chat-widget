const ARCHIVE_CONTENT_TYPES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.rar",
  "application/x-rar-compressed",
]);

/** Biểu tượng của thẻ tệp, đủ để người xem phân biệt ảnh, tệp nén và tài liệu thường. */
export const attachmentIcon = (contentType: string) => {
  if (contentType.startsWith("image/")) return "Image";
  if (ARCHIVE_CONTENT_TYPES.has(contentType)) return "FileArchive";
  return "FileText";
};

/**
 * Chỉ ảnh và PDF là trình duyệt hiển thị tử tế. Tệp chữ (.txt, .csv) mở trên tab thường vỡ dấu
 * tiếng Việt vì trình duyệt tự đoán bảng mã, còn tệp Office/nén thì tải về với tên ngẫu nhiên.
 */
export const isPreviewableInBrowser = (contentType: string) =>
  contentType.startsWith("image/") || contentType === "application/pdf";

/** Kéo chữ hay kéo ảnh ngay trong trang cũng phát sự kiện kéo; chỉ tính khi kéo tệp từ máy vào. */
export const hasDraggedFiles = (event: DragEvent) =>
  Array.from(event.dataTransfer?.types ?? []).includes("Files");
