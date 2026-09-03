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

/** Ảnh đại diện nhóm chỉ nhận tệp ảnh, dùng chung endpoint upload với tệp đính kèm. */
export const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

export const IMAGE_ACCEPT = ALLOWED_IMAGE_EXTENSIONS.join(",");

/** Backend giới hạn tên nhóm 200 ký tự; chặn sẵn ở đây để báo lỗi ngay lúc gõ. */
export const MAX_GROUP_NAME_LENGTH = 200;

/** Nhóm dưới 2 thành viên ngoài người tạo thì đó là hội thoại 1-1, backend chặn lại. */
export const MIN_GROUP_MEMBERS = 2;
