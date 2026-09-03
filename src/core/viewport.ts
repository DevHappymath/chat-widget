import { readonly, ref } from "vue";

/** Cùng mốc với breakpoint `sm` của Tailwind: dưới ngưỡng này panel chiếm trọn màn hình. */
const WIDE_QUERY = "(min-width: 640px)";

const isWide = ref(false);
let mediaQuery: MediaQueryList | null = null;

const applyMedia = (event: MediaQueryList | MediaQueryListEvent) => {
  isWide.value = event.matches;
};

/**
 * Một listener duy nhất cho cả widget. Component nào cũng gọi được, lần gọi sau dùng lại
 * listener đã đăng ký.
 */
export const useIsWideViewport = () => {
  if (!mediaQuery && typeof window !== "undefined") {
    mediaQuery = window.matchMedia(WIDE_QUERY);
    applyMedia(mediaQuery);
    mediaQuery.addEventListener("change", applyMedia);
  }

  return readonly(isWide);
};

let savedScrollY = 0;
let isLocked = false;

/**
 * Khoá cuộn trang nền khi panel phủ toàn màn hình. Dùng `position: fixed` chứ không chỉ
 * `overflow: hidden` vì Safari trên iOS bỏ qua `overflow: hidden` ở body.
 */
export const lockPageScroll = () => {
  if (isLocked || typeof document === "undefined") return;
  isLocked = true;

  savedScrollY = window.scrollY;
  const { style } = document.body;

  style.position = "fixed";
  style.top = `-${savedScrollY}px`;
  style.left = "0";
  style.right = "0";
  style.width = "100%";
};

export const unlockPageScroll = () => {
  if (!isLocked || typeof document === "undefined") return;
  isLocked = false;

  const { style } = document.body;

  style.position = "";
  style.top = "";
  style.left = "";
  style.right = "";
  style.width = "";

  // Bỏ position: fixed là trang nhảy về đầu, phải trả lại đúng chỗ người dùng đang đọc.
  window.scrollTo(0, savedScrollY);
};
