const COOKIE_NAME = "gdtd_chat_minimized";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * Các site nằm chung tên miền mẹ (crm.x, lms.x...) nhưng khác origin nên không dùng chung
 * localStorage được; cookie gắn vào tên miền mẹ thì site nào cũng đọc được.
 */
const sharedDomain = () => {
  const host = window.location.hostname;
  if (host === "localhost" || /^[\d.]+$/.test(host) || host.includes(":")) return null;

  const labels = host.split(".");
  return labels.length >= 2 ? labels.slice(-2).join(".") : null;
};

/**
 * Danh sách hội thoại đang thu nhỏ mà site khác vừa lưu. Trả `null` khi chưa có hoặc cookie là của
 * tài khoản khác đăng nhập trên cùng trình duyệt.
 */
export const readMinimizedIds = (userId: string): string[] | null => {
  if (typeof document === "undefined" || !userId) return null;

  const raw = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!raw) return null;

  const [owner, ids = ""] = decodeURIComponent(raw).split("|");
  if (owner !== userId) return null;

  return ids ? ids.split(",") : [];
};

/** Ghi cả khi danh sách rỗng, để site khác cũng gỡ hết avatar thu nhỏ theo. */
export const writeMinimizedIds = (userId: string, ids: string[]) => {
  if (typeof document === "undefined" || !userId) return;

  const domain = sharedDomain();
  const value = encodeURIComponent(`${userId}|${ids.join(",")}`);
  const attributes = [
    `${COOKIE_NAME}=${value}`,
    "Path=/",
    `Max-Age=${MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    domain && `Domain=${domain}`,
    window.location.protocol === "https:" && "Secure",
  ];

  document.cookie = attributes.filter(Boolean).join("; ");
};
