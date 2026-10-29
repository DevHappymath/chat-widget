import { readonly, ref, type Ref } from "vue";

/** Cùng mốc với breakpoint `sm` của Tailwind: dưới ngưỡng này panel chiếm trọn màn hình. */
const WIDE_QUERY = "(min-width: 640px)";

/**
 * Hai khung 380px đứng cạnh nhau, cộng cột bong bóng và lề hai bên. Hẹp hơn thì khung thứ hai
 * đè lên nội dung trang hoặc tràn ra ngoài.
 */
const TWO_WINDOWS_QUERY = "(min-width: 900px)";

/** Một listener cho mỗi media query, component nào gọi lại cũng dùng chung. */
const mediaFlags = new Map<string, Ref<boolean>>();

const useMediaFlag = (query: string) => {
  let flag = mediaFlags.get(query);
  if (!flag) {
    flag = ref(false);
    mediaFlags.set(query, flag);

    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia(query);
      const target = flag;
      target.value = mediaQuery.matches;
      mediaQuery.addEventListener("change", (event) => (target.value = event.matches));
    }
  }

  return readonly(flag);
};

export const useIsWideViewport = () => useMediaFlag(WIDE_QUERY);

/** Đủ chỗ mở hai hội thoại cạnh nhau; hẹp hơn thì chỉ một khung như cũ. */
export const useFitsTwoWindows = () => useMediaFlag(TWO_WINDOWS_QUERY);

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
