import type { TokenProvider } from "./config";

interface CachedToken {
  value: string;
  /** Mốc hết hạn theo `exp` của JWT, đã trừ biên an toàn. */
  expiresAt: number;
}

/** Trừ trước 30 giây để token không hết hạn ngay giữa lúc request đang bay. */
const EXPIRY_SKEW_MS = 30_000;

const readExpiry = (token: string): number => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return 0;

    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: number };

    return json.exp ? json.exp * 1000 - EXPIRY_SKEW_MS : 0;
  } catch {
    return 0;
  }
};

/**
 * Nguồn token cho site dùng BFF: token nằm trong cookie httpOnly nên phải hỏi server route
 * của chính site đó. Kết quả được giữ lại tới sát hạn để mỗi request không thêm một round-trip.
 * @param endpoint route trả `{ accessToken }`, mặc định `/api/auth/chat-token`.
 */
export const createBffTokenProvider = (
  endpoint = "/api/auth/chat-token",
): TokenProvider => {
  let cached: CachedToken | null = null;
  let inflight: Promise<string | null> | null = null;

  const fetchToken = async (): Promise<string | null> => {
    try {
      const res = await fetch(endpoint, { credentials: "include" });
      if (!res.ok) return null;

      const body = (await res.json()) as { accessToken?: string | null };
      const token = body.accessToken ?? null;
      if (!token) return null;

      cached = { value: token, expiresAt: readExpiry(token) };
      return token;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  };

  return () => {
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    // Nhiều request cùng lúc khi vừa mở tab; gộp về một lần gọi để không dội vào server route.
    inflight ??= fetchToken();
    return inflight;
  };
};
