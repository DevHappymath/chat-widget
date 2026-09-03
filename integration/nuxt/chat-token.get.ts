// Chép nguyên file này vào `server/api/auth/chat-token.get.ts` của từng site nhúng widget.
import { getCookie } from "h3";

/**
 * Widget chạy trong trình duyệt nên không đọc được cookie httpOnly; route này là chỗ duy nhất
 * trả access_token ra cho JS. Trả 200 kèm token rỗng thay vì 401 để widget tự ẩn, không đá
 * người dùng ra trang đăng nhập chỉ vì phiên đã hết.
 */
export default defineEventHandler((event) => {
  const accessToken = getCookie(event, "access_token") ?? null;
  return { accessToken };
});
