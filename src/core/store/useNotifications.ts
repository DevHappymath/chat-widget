import { ref } from "vue";
import { HubEvent } from "../../constants/hub-event";
import type { ChatNotification } from "../../types/notification";
import { extractErrorMessage } from "../../utils/error";
import { onHubEvent, onHubReconnected } from "../hub";
import { notificationApi } from "../services";
import { useWidgetToast } from "./useWidgetToast";

/** Chỉ giữ những thông báo gần nhất; xem lâu hơn thì mở trang chat đầy đủ. */
const PAGE_SIZE = 20;

const notifications = ref<ChatNotification[]>([]);
const unreadCount = ref(0);
const isLoading = ref(false);
let isSubscribed = false;
let unsubscribers: Array<() => void> = [];

/** Thông báo khi có người nhắc tên hoặc trả lời tin của mình, nghe qua hub sau lần nạp đầu. */
export const useNotifications = () => {
  const toast = useWidgetToast();

  const load = async () => {
    isLoading.value = true;
    try {
      const [list, count] = await Promise.all([
        notificationApi.getPaged({ pageNumber: 1, pageSize: PAGE_SIZE }),
        notificationApi.countUnread(),
      ]);

      notifications.value = list.data.data.items ?? [];
      unreadCount.value = count.data.data;
    } catch (err) {
      console.error("[chat-widget] loadNotifications:", err);
    } finally {
      isLoading.value = false;
    }
  };

  const markRead = async (notification: ChatNotification) => {
    if (notification.isRead) return;

    notification.isRead = true;
    unreadCount.value = Math.max(0, unreadCount.value - 1);

    try {
      await notificationApi.markRead(notification.id);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const markAllRead = async () => {
    if (!unreadCount.value) return;

    notifications.value.forEach((n) => (n.isRead = true));
    unreadCount.value = 0;

    try {
      await notificationApi.markAllRead();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  /** Gọi sau khi hub đã kết nối. Lần gọi thứ hai không đăng ký thêm handler. */
  const start = () => {
    if (isSubscribed) return;
    isSubscribed = true;

    unsubscribers.push(
      onHubEvent(HubEvent.NotificationCreated, (payload: ChatNotification) => {
        notifications.value = [payload, ...notifications.value].slice(0, PAGE_SIZE);
        if (!payload.isRead) unreadCount.value += 1;
      }),
      // Thông báo phát ra trong lúc mất kết nối là mất luôn, nối lại phải nạp lại từ server.
      onHubReconnected(() => load()),
    );

    void load();
  };

  /** Huỷ đăng ký và xoá thông báo của người dùng cũ, để phiên đăng nhập sau không thấy lại. */
  const stop = () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    unsubscribers = [];
    isSubscribed = false;
    notifications.value = [];
    unreadCount.value = 0;
    isLoading.value = false;
  };

  return { notifications, unreadCount, isLoading, markRead, markAllRead, start, stop };
};
