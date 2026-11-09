import type { Directive, DirectiveBinding } from "vue";

type Placement = "top" | "bottom" | "left" | "right";
type TooltipValue = string | null | undefined | false;

interface HostState {
  content: string;
  placement: Placement;
  /** Nhãn đọc màn hình do directive tự gắn, để biết cái nào được phép sửa hay gỡ. */
  ownsAriaLabel: boolean;
  cleanup: () => void;
}

const HOST_ATTR = "data-gdtd-tooltip";
const SHOW_DELAY = 200;
// Vừa tắt tooltip này mà rê sang nút cạnh bên thì hiện ngay, đỡ phải chờ lại từ đầu.
const WARM_WINDOW = 300;
const GAP = 8;
const VIEWPORT_PADDING = 8;

// Widget nổi trên trang của site khác, phải cao hơn mọi lớp của widget lẫn của site.
const BUBBLE_Z = "z-[2147483600]";
const BUBBLE_CLASS = `${BUBBLE_Z} pointer-events-none fixed left-0 top-0 max-w-[280px] rounded-md border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs font-medium leading-snug text-slate-100 shadow-xl backdrop-blur-md whitespace-pre-line wrap-break-word select-none transition-opacity duration-100`;
const ARROW_BASE = "absolute h-2 w-2 rotate-45 border-slate-700 bg-slate-900";
const ARROW_BORDER: Record<Placement, string> = {
  top: "border-b border-r",
  bottom: "border-l border-t",
  left: "border-r border-t",
  right: "border-b border-l",
};

const hosts = new WeakMap<HTMLElement, HostState>();
let bubble: HTMLDivElement | null = null;
let label: HTMLSpanElement | null = null;
let arrow: HTMLDivElement | null = null;
let activeHost: HTMLElement | null = null;
let showTimer: ReturnType<typeof setTimeout> | undefined;
let lastHiddenAt = 0;

const ensureBubble = () => {
  if (bubble) return bubble;

  bubble = document.createElement("div");
  bubble.setAttribute("role", "tooltip");
  bubble.className = BUBBLE_CLASS;
  bubble.style.display = "none";
  label = document.createElement("span");
  arrow = document.createElement("div");
  bubble.append(label, arrow);
  document.body.appendChild(bubble);
  return bubble;
};

const fitsAt = (placement: Placement, rect: DOMRect, width: number, height: number) => {
  switch (placement) {
    case "top":
      return rect.top - height - GAP >= VIEWPORT_PADDING;
    case "bottom":
      return rect.bottom + height + GAP <= window.innerHeight - VIEWPORT_PADDING;
    case "left":
      return rect.left - width - GAP >= VIEWPORT_PADDING;
    case "right":
      return rect.right + width + GAP <= window.innerWidth - VIEWPORT_PADDING;
  }
};

const OPPOSITE: Record<Placement, Placement> = { top: "bottom", bottom: "top", left: "right", right: "left" };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const position = (host: HTMLElement, preferred: Placement) => {
  if (!bubble || !arrow) return;

  const rect = host.getBoundingClientRect();
  const { width, height } = bubble.getBoundingClientRect();
  const placement =
    fitsAt(preferred, rect, width, height) || !fitsAt(OPPOSITE[preferred], rect, width, height)
      ? preferred
      : OPPOSITE[preferred];

  const vertical = placement === "top" || placement === "bottom";
  const rawLeft = vertical
    ? rect.left + rect.width / 2 - width / 2
    : placement === "left"
      ? rect.left - width - GAP
      : rect.right + GAP;
  const rawTop = vertical
    ? placement === "top"
      ? rect.top - height - GAP
      : rect.bottom + GAP
    : rect.top + rect.height / 2 - height / 2;

  const left = clamp(rawLeft, VIEWPORT_PADDING, window.innerWidth - width - VIEWPORT_PADDING);
  const top = clamp(rawTop, VIEWPORT_PADDING, window.innerHeight - height - VIEWPORT_PADDING);
  bubble.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;

  // Bóng bị đẩy vào trong khi sát mép màn hình, mũi tên vẫn phải chỉ đúng tâm phần tử.
  arrow.className = `${ARROW_BASE} ${ARROW_BORDER[placement]}`;
  arrow.style.cssText = vertical
    ? `left:${clamp(rect.left + rect.width / 2 - left, 10, width - 10) - 4}px;${placement === "top" ? "bottom" : "top"}:-5px`
    : `top:${clamp(rect.top + rect.height / 2 - top, 10, height - 10) - 4}px;${placement === "left" ? "right" : "left"}:-5px`;
};

const onViewportChange = () => hide();
const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape") hide();
};

const bindWindow = (on: boolean) => {
  const method = on ? "addEventListener" : "removeEventListener";
  // Bắt cả cuộn của khung danh sách bên trong, không chỉ cuộn trang.
  window[method]("scroll", onViewportChange, true);
  window[method]("resize", onViewportChange);
  window[method]("keydown", onKeydown as EventListener, true);
};

const show = (host: HTMLElement) => {
  const state = hosts.get(host);
  if (!state?.content || !host.isConnected) return;

  const el = ensureBubble();
  if (!activeHost) bindWindow(true);
  activeHost = host;
  label!.textContent = state.content;
  el.style.display = "block";
  el.style.opacity = "0";
  position(host, state.placement);
  requestAnimationFrame(() => {
    if (activeHost === host) el.style.opacity = "1";
  });
};

function hide() {
  clearTimeout(showTimer);
  if (!activeHost) return;

  activeHost = null;
  lastHiddenAt = Date.now();
  if (bubble) bubble.style.display = "none";
  bindWindow(false);
}

const schedule = (host: HTMLElement) => {
  clearTimeout(showTimer);
  const warm = activeHost !== null || Date.now() - lastHiddenAt < WARM_WINDOW;
  if (warm) show(host);
  else showTimer = setTimeout(() => show(host), SHOW_DELAY);
};

const readPlacement = (binding: DirectiveBinding<TooltipValue>): Placement => {
  const { modifiers } = binding;
  if (modifiers.bottom) return "bottom";
  if (modifiers.left) return "left";
  if (modifiers.right) return "right";
  return "top";
};

const normalize = (value: TooltipValue) => (typeof value === "string" ? value.trim() : "");

/** Nút chỉ có icon thì tooltip là tên duy nhất của nó, đọc màn hình cũng cần nghe được. */
const syncAriaLabel = (el: HTMLElement, state: HostState) => {
  if (state.ownsAriaLabel) {
    if (state.content) el.setAttribute("aria-label", state.content);
    else {
      el.removeAttribute("aria-label");
      state.ownsAriaLabel = false;
    }
    return;
  }

  const named = el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby");
  if (!named && state.content && !el.textContent?.trim()) {
    el.setAttribute("aria-label", state.content);
    state.ownsAriaLabel = true;
  }
};

const isKeyboardFocus = (el: HTMLElement) => {
  try {
    return el.matches(":focus-visible");
  } catch {
    return false;
  }
};

const isHost = (node: EventTarget | null): node is HTMLElement =>
  node instanceof HTMLElement && hosts.has(node);

/**
 * Tooltip thay cho thuộc tính `title`: `v-tooltip="'Tải về máy'"`, đổi phía bằng `.bottom`,
 * `.left`, `.right`. Gắn thẳng lên phần tử nên không thêm thẻ bọc, không đụng layout.
 */
export const vTooltip: Directive<HTMLElement, TooltipValue> = {
  mounted(el, binding) {
    const onEnter = (event: PointerEvent) => {
      // Cảm ứng không có rê chuột; chạm vào là bấm luôn, hiện tooltip chỉ che mất nội dung.
      if (event.pointerType === "mouse") schedule(el);
    };
    const onLeave = (event: PointerEvent) => {
      // Rời phần tử con có tooltip về lại phần tử cha cũng có tooltip thì hiện lại của cha.
      const parent = (event.relatedTarget as Element | null)?.closest?.(`[${HOST_ATTR}]`) ?? null;
      if (parent !== el && isHost(parent) && parent.contains(el)) {
        clearTimeout(showTimer);
        show(parent);
        return;
      }
      if (activeHost === el || activeHost === null) hide();
    };
    const onFocus = () => {
      if (isKeyboardFocus(el)) schedule(el);
    };
    const onBlur = () => {
      if (activeHost === el || activeHost === null) hide();
    };
    // Bấm là đã biết nút làm gì; để tooltip lại sẽ đè lên menu hay khung vừa mở ra.
    const onDown = () => hide();

    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("focusin", onFocus);
    el.addEventListener("focusout", onBlur);
    el.addEventListener("pointerdown", onDown);
    el.setAttribute(HOST_ATTR, "");

    const state: HostState = {
      content: normalize(binding.value),
      placement: readPlacement(binding),
      ownsAriaLabel: false,
      cleanup: () => {
        el.removeEventListener("pointerenter", onEnter);
        el.removeEventListener("pointerleave", onLeave);
        el.removeEventListener("focusin", onFocus);
        el.removeEventListener("focusout", onBlur);
        el.removeEventListener("pointerdown", onDown);
        el.removeAttribute(HOST_ATTR);
      },
    };
    hosts.set(el, state);
    syncAriaLabel(el, state);
  },

  updated(el, binding) {
    const state = hosts.get(el);
    if (!state) return;

    state.content = normalize(binding.value);
    state.placement = readPlacement(binding);
    syncAriaLabel(el, state);

    if (activeHost !== el) return;
    if (!state.content) hide();
    else {
      label!.textContent = state.content;
      position(el, state.placement);
    }
  },

  beforeUnmount(el) {
    if (activeHost === el) hide();
    hosts.get(el)?.cleanup();
    hosts.delete(el);
  },

  getSSRProps: () => ({}),
};
