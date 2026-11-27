const COOKIE_NAME = "gdtd_chat_windows";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Trợ lý đang chiếm khung chính, đang nằm thành bong bóng, hay không hiện. */
export type AssistantPlacement = "main" | "bubble" | null;

/** Các khung chat đang hiện: panel, khung chính, khung thứ hai, dãy avatar thu nhỏ và trợ lý. */
export interface ChatWindows {
  isPanelOpen: boolean;
  mainId: string | null;
  sideId: string | null;
  minimizedIds: string[];
  assistant: AssistantPlacement;
  assistantThreadId: string | null;
}

export interface SharedChatWindows extends ChatWindows {
  /** Đổi sau mỗi lần ghi, để tab biết từ lần nó đọc hay ghi gần nhất đã có nơi khác ghi đè chưa. */
  stamp: string;
}

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

const newStamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const isSameWindows = (a: ChatWindows, b: ChatWindows) =>
  a.isPanelOpen === b.isPanelOpen &&
  a.mainId === b.mainId &&
  a.sideId === b.sideId &&
  a.minimizedIds.join(",") === b.minimizedIds.join(",") &&
  a.assistant === b.assistant &&
  a.assistantThreadId === b.assistantThreadId;

const PLACEMENT_CODES = { main: "m", bubble: "b" } as const;

const placementOf = (code: string | undefined): AssistantPlacement =>
  code === PLACEMENT_CODES.main ? "main" : code === PLACEMENT_CODES.bubble ? "bubble" : null;

/**
 * Khung chat site khác vừa lưu. Trả `null` khi chưa có hoặc cookie là của tài khoản khác đăng
 * nhập trên cùng trình duyệt.
 */
export const readSharedWindows = (userId: string): SharedChatWindows | null => {
  if (typeof document === "undefined" || !userId) return null;

  const raw = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!raw) return null;

  // Cookie do bản widget cũ ghi thì thiếu hai trường trợ lý, coi như trợ lý không hiện.
  const [owner, stamp, open, mainId, sideId, minimizedIds = "", assistant, assistantThreadId] =
    decodeURIComponent(raw).split("|");
  if (owner !== userId || !stamp) return null;

  return {
    stamp,
    isPanelOpen: open === "1",
    mainId: mainId || null,
    sideId: sideId || null,
    minimizedIds: minimizedIds ? minimizedIds.split(",") : [],
    assistant: placementOf(assistant),
    assistantThreadId: assistantThreadId || null,
  };
};

/**
 * Ghi cả khi panel đóng và dãy avatar rỗng, để site khác cũng đóng theo.
 * @returns mốc của lần ghi này.
 */
export const writeSharedWindows = (userId: string, windows: ChatWindows) => {
  const stamp = newStamp();
  if (typeof document === "undefined" || !userId) return stamp;

  const domain = sharedDomain();
  const value = encodeURIComponent(
    [
      userId,
      stamp,
      windows.isPanelOpen ? "1" : "0",
      windows.mainId ?? "",
      windows.sideId ?? "",
      windows.minimizedIds.join(","),
      windows.assistant ? PLACEMENT_CODES[windows.assistant] : "",
      windows.assistantThreadId ?? "",
    ].join("|"),
  );
  const attributes = [
    `${COOKIE_NAME}=${value}`,
    "Path=/",
    `Max-Age=${MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    domain && `Domain=${domain}`,
    window.location.protocol === "https:" && "Secure",
  ];

  document.cookie = attributes.filter(Boolean).join("; ");
  return stamp;
};
