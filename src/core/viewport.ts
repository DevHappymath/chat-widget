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
/** Panel và trình xem ảnh cùng khoá được; chỉ mở lại khi bên khoá cuối cùng đã nhả. */
let lockCount = 0;

/**
 * Khoá cuộn trang nền khi panel hoặc trình xem ảnh phủ toàn màn hình. Dùng `position: fixed`
 * chứ không chỉ `overflow: hidden` vì Safari trên iOS bỏ qua `overflow: hidden` ở body.
 */
export const lockPageScroll = () => {
  if (typeof document === "undefined") return;
  lockCount++;
  if (lockCount > 1) return;

  savedScrollY = window.scrollY;
  const { style } = document.body;

  style.position = "fixed";
  style.top = `-${savedScrollY}px`;
  style.left = "0";
  style.right = "0";
  style.width = "100%";
};

export const unlockPageScroll = () => {
  if (lockCount === 0 || typeof document === "undefined") return;
  lockCount--;
  if (lockCount > 0) return;

  const { style } = document.body;

  style.position = "";
  style.top = "";
  style.left = "";
  style.right = "";
  style.width = "";

  // Bỏ position: fixed là trang nhảy về đầu, phải trả lại đúng chỗ người dùng đang đọc.
  window.scrollTo(0, savedScrollY);
};
