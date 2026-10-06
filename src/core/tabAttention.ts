// Báo tin mới lên tab: "(n)" trên tiêu đề, số đỏ trên favicon, nhấp nháy khi người dùng vắng.
// Giống hệt `chat.gdtd.vn-fe/utils/tab-attention.ts`; sửa một bên thì sửa cả bên kia.

const BADGE_ATTR = "data-gdtd-chat-badge";
const BLINK_INTERVAL_MS = 1500;
const ICON_SIZE = 64;

let isStarted = false;
let unread = 0;
let baseTitle = "";
/** Tiêu đề do chính module này ghi, để phân biệt với lần trang tự đổi tiêu đề. */
let appliedTitle = "";
let isBlinking = false;
let showsBlinkText = false;
let blinkTimer: ReturnType<typeof setInterval> | null = null;
let observer: MutationObserver | null = null;
let badgeLink: HTMLLinkElement | null = null;
/** Icon gốc mà thẻ số đỏ đang dựa vào, để biết khi nào trang đã đổi favicon. */
let badgeSource = "";
let iconRequest = 0;
/** Ảnh favicon gốc theo href; mỗi lần đổi số chỉ vẽ lại, không tải lại ảnh. */
const iconCache = new Map<string, Promise<HTMLImageElement | null>>();

const isLookingAtPage = () => document.visibilityState === "visible" && document.hasFocus();

const countLabel = (count: number) => (count > 99 ? "99+" : `${count}`);

// Favicon chỉ 16px, quá một chữ số là không đọc nổi nên gộp thành "9+".
const iconLabel = (count: number) => (count > 9 ? "9+" : `${count}`);

const renderTitle = () => {
  let title = baseTitle;
  if (unread > 0) {
    title = isBlinking && showsBlinkText
      ? `${countLabel(unread)} tin nhắn mới`
      : `(${countLabel(unread)}) ${baseTitle}`;
  }

  appliedTitle = title;
  if (document.title !== title) document.title = title;
};

const iconLinks = () =>
  Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));

const originalIconHref = () => {
  const own = iconLinks().filter((link) => !link.hasAttribute(BADGE_ATTR));
  return own.at(-1)?.href || `${location.origin}/favicon.ico`;
};

const loadIcon = (href: string) => {
  let pending = iconCache.get(href);
  if (pending) return pending;

  pending = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    if (new URL(href, location.href).origin !== location.origin) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = href;
  });
  iconCache.set(href, pending);
  return pending;
};

const BADGE_HEIGHT = 40;
const BADGE_RING = 3;
const BADGE_PADDING = 7;
const BADGE_FONT = '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';

const pillPath = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const radius = height / 2;
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.arc(x + width - radius, y + radius, radius, -Math.PI / 2, Math.PI / 2);
  context.lineTo(x + radius, y + height);
  context.arc(x + radius, y + radius, radius, Math.PI / 2, (Math.PI * 3) / 2);
  context.closePath();
};

/** Vẽ số đỏ đè lên góc trên phải icon; không có icon thì chỉ còn số. */
const drawBadge = (image: HTMLImageElement | null, label: string): string | null => {
  const canvas = document.createElement("canvas");
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const context = canvas.getContext("2d");
  if (!context) return null;

  if (image) context.drawImage(image, 0, 0, ICON_SIZE, ICON_SIZE);

  // Nhãn dài hơn bề ngang icon thì thu nhỏ chữ cho lọt.
  const maxWidth = ICON_SIZE - BADGE_RING * 2;
  let fontSize = 34;
  let textWidth = 0;
  do {
    context.font = `700 ${fontSize}px ${BADGE_FONT}`;
    textWidth = context.measureText(label).width;
    fontSize -= 2;
  } while (textWidth + BADGE_PADDING * 2 > maxWidth && fontSize > 14);

  const width = Math.min(maxWidth, Math.max(BADGE_HEIGHT, textWidth + BADGE_PADDING * 2));
  const x = ICON_SIZE - BADGE_RING - width;
  const y = BADGE_RING;

  // Viền trắng tách số đỏ khỏi icon nền đỏ hoặc tối, thu về 16px vẫn đọc được.
  const ring = BADGE_RING * 2;
  pillPath(context, x - BADGE_RING, y - BADGE_RING, width + ring, BADGE_HEIGHT + ring);
  context.fillStyle = "#ffffff";
  context.fill();
  pillPath(context, x, y, width, BADGE_HEIGHT);
  context.fillStyle = "#dc2626";
  context.fill();

  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, x + width / 2, y + BADGE_HEIGHT / 2 + 2);

  try {
    return canvas.toDataURL("image/png");
  } catch {
    // Icon khác origin mà không mở CORS thì canvas bị khoá, vẽ lại số trên nền trống.
    return image ? drawBadge(null, label) : null;
  }
};

// Chrome không tự quay về icon cũ khi gỡ thẻ link, nên giữ thẻ lại và trỏ nó về icon gốc.
const resetBadge = () => {
  if (!badgeLink) return;

  badgeSource = originalIconHref();
  if (badgeLink.href !== badgeSource) badgeLink.href = badgeSource;
};

const syncFavicon = async () => {
  const request = ++iconRequest;
  if (unread <= 0) return resetBadge();

  const href = originalIconHref();
  const image = await loadIcon(href);
  if (request !== iconRequest) return;
  if (unread <= 0) return resetBadge();

  const dataUrl = drawBadge(image, iconLabel(unread));
  if (!dataUrl) return resetBadge();

  if (!badgeLink) {
    badgeLink = document.createElement("link");
    badgeLink.rel = "icon";
    badgeLink.setAttribute(BADGE_ATTR, "");
  }
  badgeSource = href;
  if (badgeLink.href !== dataUrl) badgeLink.href = dataUrl;

  // Trình duyệt lấy icon khai báo sau cùng, nên số đỏ phải luôn đứng cuối.
  if (iconLinks().at(-1) !== badgeLink) document.head.appendChild(badgeLink);
};

/** Trang đổi tiêu đề hoặc favicon khi chuyển route: nhận làm gốc mới rồi gắn lại số lên. */
const onHeadMutated = () => {
  if (document.title !== appliedTitle) {
    baseTitle = document.title;
    renderTitle();
  }

  if (!badgeLink) return;

  const isStale = !badgeLink.isConnected || originalIconHref() !== badgeSource;
  if (isStale || (unread > 0 && iconLinks().at(-1) !== badgeLink)) syncFavicon();
};

const stopBlink = () => {
  if (blinkTimer) clearInterval(blinkTimer);
  blinkTimer = null;
  isBlinking = false;
  showsBlinkText = false;
  renderTitle();
};

const onReturn = () => {
  if (isBlinking && isLookingAtPage()) stopBlink();
};

/** Bắt đầu quản lý tiêu đề và favicon của tab. Gọi lại khi đang chạy thì bỏ qua. */
export const startTabAttention = () => {
  if (isStarted) return;
  isStarted = true;

  baseTitle = document.title;
  appliedTitle = document.title;

  // Lần nạp trước (nạp lại nóng khi dev, widget mount lại) có thể để sót thẻ số đỏ: nhận lại
  // thẻ đang hiển thị để trỏ về icon gốc, các thẻ thừa thì gỡ.
  const leftovers = Array.from(document.querySelectorAll<HTMLLinkElement>(`link[${BADGE_ATTR}]`));
  badgeLink = leftovers.pop() ?? null;
  leftovers.forEach((link) => link.remove());
  syncFavicon();

  observer = new MutationObserver(onHeadMutated);
  observer.observe(document.head, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["href"],
  });

  window.addEventListener("focus", onReturn);
  document.addEventListener("visibilitychange", onReturn);
};

/** Trả tiêu đề và favicon về như cũ, trừ khi trang đã tự đổi tiêu đề sang thứ khác. */
export const stopTabAttention = () => {
  if (!isStarted) return;
  isStarted = false;

  observer?.disconnect();
  observer = null;
  window.removeEventListener("focus", onReturn);
  document.removeEventListener("visibilitychange", onReturn);

  if (blinkTimer) clearInterval(blinkTimer);
  blinkTimer = null;
  isBlinking = false;
  showsBlinkText = false;
  unread = 0;
  iconRequest++;
  resetBadge();
  badgeLink?.remove();
  badgeLink = null;

  if (document.title === appliedTitle) document.title = baseTitle;
};

/** Số tin chưa đọc hiện trên tiêu đề và favicon; về 0 thì trả cả hai về như cũ. */
export const setTabUnread = (count: number) => {
  if (!isStarted) return;

  const next = Math.max(0, count);
  if (next === unread) return;

  unread = next;
  if (unread === 0 && isBlinking) stopBlink();
  else renderTitle();
  syncFavicon();
};

/**
 * Gọi khi có tin mới đáng báo. Người dùng đang nhìn trang thì không làm gì; đang ở chỗ khác
 * thì tiêu đề nhấp nháy tới khi họ quay lại.
 */
export const announceTabMessage = () => {
  if (!isStarted || isBlinking || isLookingAtPage()) return;

  isBlinking = true;
  blinkTimer = setInterval(() => {
    showsBlinkText = !showsBlinkText;
    renderTitle();
  }, BLINK_INTERVAL_MS);
};
