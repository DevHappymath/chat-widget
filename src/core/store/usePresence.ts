import { computed, ref } from "vue";
import { HubEvent } from "../../constants/hub-event";
import type { UserPresence } from "../../types/chat";
import { getOnlineUsers, onHubEvent, onHubReconnected } from "../hub";

/** Guid từ backend luôn viết thường, nhưng sub trong token thì không chắc, nên chuẩn hoá hết. */
const normalize = (userId: string) => userId.toLowerCase();

const onlineUserIds = ref<string[]>([]);
let isSubscribed = false;

/**
 * Danh sách người đang online. Nguồn duy nhất là hub: nạp một lần khi kết nối, sau đó nghe
 * PresenceChanged.
 */
export const usePresence = () => {
  const onlineSet = computed(() => new Set(onlineUserIds.value));

  const isOnline = (userId?: string | null) =>
    Boolean(userId) && onlineSet.value.has(normalize(userId!));

  const sync = async () => {
    onlineUserIds.value = (await getOnlineUsers()).map(normalize);
  };

  const apply = (presence: UserPresence) => {
    const id = normalize(presence.userId);
    const has = onlineUserIds.value.includes(id);

    if (presence.isOnline && !has) {
      onlineUserIds.value = [...onlineUserIds.value, id];
    } else if (!presence.isOnline && has) {
      onlineUserIds.value = onlineUserIds.value.filter((x) => x !== id);
    }
  };

  /** Gọi sau khi hub đã kết nối. Lần gọi thứ hai không đăng ký thêm handler. */
  const start = () => {
    if (isSubscribed) return;
    isSubscribed = true;

    onHubEvent(HubEvent.PresenceChanged, (payload: UserPresence) => apply(payload));
    // Mất kết nối là mất luôn các event ở giữa, nên nối lại phải nạp lại từ đầu.
    onHubReconnected(() => sync());

    sync();
  };

  return { onlineUserIds, isOnline, start, sync };
};
