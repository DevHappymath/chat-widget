// Chép nguyên file này vào `server/api/chat-proxy/[...].ts` của từng site nhúng widget.
import { getCookie, getRequestHeader, readRawBody, sendProxy } from "h3";

/** Chỉ chuyển những header chat service cần; cookie của site không được đi theo sang. */
const FORWARDED_HEADERS = ["accept", "accept-language", "content-type"];

/**
 * Chuyển lời gọi của widget sang chat service và gắn token từ cookie httpOnly ngay tại server,
 * để access token không bao giờ tới tay mã chạy trên trình duyệt.
 */
export default defineEventHandler(async (event) => {
  // Trang khác không tự đặt được header này khi gọi sang (Nitro không trả CORS), nên không mượn
  // được cookie phiên để gọi chat thay người dùng.
  if (getRequestHeader(event, "x-chat-widget") !== "1") {
    throw createError({ statusCode: 403 });
  }

  const accessToken = getCookie(event, "access_token");
  if (!accessToken) {
    throw createError({ statusCode: 401 });
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  for (const name of FORWARDED_HEADERS) {
    const value = getRequestHeader(event, name);
    if (value) headers[name] = value;
  }

  const chatApiBase = String(useRuntimeConfig(event).public.chatApiBase).replace(/\/+$/, "");
  const path = event.path.replace(/^\/api\/chat-proxy/, "");
  const body = ["GET", "HEAD"].includes(event.method) ? undefined : await readRawBody(event, false);

  return sendProxy(event, `${chatApiBase}${path}`, {
    fetchOptions: {
      method: event.method,
      headers,
      body: body ? new Uint8Array(body) : undefined,
    },
  });
});
