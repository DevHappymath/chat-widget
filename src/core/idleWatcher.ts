// Theo dõi người dùng còn ngồi trước trang không, để server cho hiện "Vắng mặt" như Teams.
// Nghe trên window của site chủ: đang làm việc ở CRM mà không đụng tới chat vẫn là có mặt.

const IDLE_AFTER_MS = 5 * 60 * 1000;
const CHECK_INTERVAL_MS = 15 * 1000;

const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;

let isStarted = false;
let isIdle = false;
let lastActivityAt = Date.now();
let onChange: ((isIdle: boolean) => void) | null = null;

const setIdle = (next: boolean) => {
  if (isIdle === next) return;
  isIdle = next;
  onChange?.(next);
};

// Chuột rê liên tục bắn hàng trăm event mỗi giây, nên ở đây chỉ ghi mốc, việc so giờ để cho interval.
const markActive = () => {
  lastActivityAt = Date.now();
  setIdle(false);
};

const onVisibilityChange = () => {
  if (document.visibilityState === "visible") markActive();
};

/** Gọi một lần sau khi hub đã kết nối; lần gọi sau chỉ thay hàm nhận thay đổi. */
export const startIdleWatch = (callback: (isIdle: boolean) => void) => {
  onChange = callback;
  if (isStarted) return;
  isStarted = true;

  for (const event of ACTIVITY_EVENTS) {
    window.addEventListener(event, markActive, { capture: true, passive: true });
  }
  document.addEventListener("visibilitychange", onVisibilityChange);

  setInterval(() => {
    if (Date.now() - lastActivityAt >= IDLE_AFTER_MS) setIdle(true);
  }, CHECK_INTERVAL_MS);
};

export const isUserIdle = () => isIdle;
