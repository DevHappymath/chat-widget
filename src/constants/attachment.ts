/**
 * Giá trị dự phòng khi bootstrap chưa về. Nguồn thật là `attachment` trong
 * `GET /api/chat/bootstrap`; backend vẫn kiểm tra lại và mới là nơi quyết định.
 */
export const FALLBACK_MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;

export const FALLBACK_ALLOWED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".csv",
  ".zip",
];

export const MAX_ATTACHMENTS_PER_MESSAGE = 5;
