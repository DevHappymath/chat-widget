import { ref } from "vue";

export interface MessageAlert {
  conversationId: string;
  title: string;
  avatarUrl?: string | null;
  isGroup: boolean;
  preview: string;
  /** Số tin dồn vào thẻ này kể từ lúc nó hiện ra. */
  count: number;
}

const MAX_ALERTS = 3;
const ALERT_DURATION_MS = 6000;

const alerts = ref<MessageAlert[]>([]);
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let isWatchingVisibility = false;

const clearTimer = (conversationId: string) => {
  const timer = timers.get(conversationId);
  if (timer) clearTimeout(timer);
  timers.delete(conversationId);
};

const dismiss = (conversationId: string) => {
  clearTimer(conversationId);
  alerts.value = alerts.value.filter((a) => a.conversationId !== conversationId);
};

// Tab đang ẩn thì chưa đếm giờ, kẻo người dùng quay lại thì thẻ đã tự tắt mà chưa kịp thấy.
const schedule = (conversationId: string) => {
  clearTimer(conversationId);
  if (document.visibilityState !== "visible") return;
  timers.set(conversationId, setTimeout(() => dismiss(conversationId), ALERT_DURATION_MS));
};

const watchVisibility = () => {
  if (isWatchingVisibility) return;
  isWatchingVisibility = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    alerts.value.forEach((a) => {
      if (!timers.has(a.conversationId)) schedule(a.conversationId);
    });
  });
};

/**
 * Thẻ nổi báo tin mới ở hội thoại người dùng không mở. Mỗi hội thoại một thẻ: tin sau dồn vào
 * thẻ cũ và đẩy nó lên đầu thay vì chồng thêm thẻ.
 */
export const useMessageAlerts = () => {
  const push = (alert: Omit<MessageAlert, "count">) => {
    watchVisibility();

    const existing = alerts.value.find((a) => a.conversationId === alert.conversationId);
    const next: MessageAlert = { ...alert, count: (existing?.count ?? 0) + 1 };
    const rest = alerts.value.filter((a) => a.conversationId !== alert.conversationId);

    const kept = [next, ...rest];
    kept.slice(MAX_ALERTS).forEach((a) => clearTimer(a.conversationId));
    alerts.value = kept.slice(0, MAX_ALERTS);

    schedule(alert.conversationId);
  };

  return {
    alerts,
    push,
    dismiss,
    /** Rê chuột vào thẻ thì giữ lại để đọc cho hết. */
    pause: clearTimer,
    resume: schedule,
    clear: () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      alerts.value = [];
    },
  };
};
