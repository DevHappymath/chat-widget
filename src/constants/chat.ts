/**
 * Bản sao của `CHAT_GDTD.Domain.Constants.ChatRule`. Chặn ở widget chỉ để báo lỗi sớm cho
 * người dùng; backend vẫn kiểm tra lại và mới là nơi quyết định.
 */
export const MAX_PINNED_PER_CONVERSATION = 10;

export const MAX_FORWARD_TARGETS = 10;

/** Từ khoá ngắn hơn ngần này thì kết quả tìm kiếm quá rộng, không đáng gọi API. */
export const MIN_SEARCH_KEYWORD_LENGTH = 2;
