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

/** Còn cách đáy trong khoảng này thì coi như đã cuộn tới cuối, đỡ lệch do làm tròn pixel. */
const PAGE_END_THRESHOLD = 8;

const isAtPageEnd = ref(false);
let isWatchingPageEnd = false;

const measurePageEnd = () => {
  const { scrollHeight } = document.documentElement;
  const viewportHeight = window.innerHeight;

  // Trang không cuộn được thì bong bóng không che thêm gì, cứ để hiện.
  if (scrollHeight <= viewportHeight + PAGE_END_THRESHOLD) {
    isAtPageEnd.value = false;
    return;
  }

  isAtPageEnd.value = window.scrollY + viewportHeight >= scrollHeight - PAGE_END_THRESHOLD;
};

/**
 * Trang đã cuộn tới đáy hay chưa. Đo lại cả khi nội dung đổi chiều cao (chuyển trang trong SPA,
 * tải thêm dữ liệu) chứ không chỉ lúc cuộn, vì khi đó đáy trang dịch đi mà không có sự kiện cuộn.
 */
export const useIsAtPageEnd = () => {
  if (!isWatchingPageEnd && typeof window !== "undefined") {
    isWatchingPageEnd = true;
    measurePageEnd();
    window.addEventListener("scroll", measurePageEnd, { passive: true });
    window.addEventListener("resize", measurePageEnd);
    new ResizeObserver(measurePageEnd).observe(document.body);
  }

  return readonly(isAtPageEnd);
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
