import { computed, ref } from "vue";
import { HubEvent } from "../../constants/hub-event";
import {
  PresenceStatus,
  type MyPresence,
  type SetPresenceMessageCommand,
  type SetPresenceStatusCommand,
  type UserPresence,
} from "../../types/chat";
import { getPresences, onHubEvent, onHubReconnected, sendIdle } from "../hub";
import { isUserIdle, startIdleWatch } from "../idleWatcher";
import { presenceApi } from "../services";

/** Guid từ backend luôn viết thường, nhưng sub trong token thì không chắc, nên chuẩn hoá hết. */
const normalize = (userId: string) => userId.toLowerCase();

interface PresenceEntry {
  status: PresenceStatus;
  statusMessage?: string | null;
}

/** Chỉ giữ người không ngoại tuyến hoặc có lời nhắn; vắng mặt trong map nghĩa là ngoại tuyến. */
const entries = ref<Record<string, PresenceEntry>>({});
const mine = ref<MyPresence | null>(null);
let selfId = "";
let isSubscribed = false;

/**
 * Trạng thái hoạt động của người có chung hội thoại và của chính mình. Nguồn duy nhất là hub:
 * nạp một lần khi kết nối, sau đó nghe PresenceChanged.
 */
export const usePresence = () => {
  const statusOf = (userId?: string | null): PresenceStatus =>
    (userId && entries.value[normalize(userId)]?.status) || PresenceStatus.Offline;

  const isOnline = (userId?: string | null) => statusOf(userId) !== PresenceStatus.Offline;

  const messageOf = (userId?: string | null) =>
    (userId && entries.value[normalize(userId)]?.statusMessage) || null;

  const onlineUserIds = computed(() =>
    Object.keys(entries.value).filter((id) => entries.value[id]!.status !== PresenceStatus.Offline),
  );

  const isDoNotDisturb = computed(() => mine.value?.status === PresenceStatus.DoNotDisturb);

  const apply = (presence: UserPresence) => {
    const id = normalize(presence.userId);
    // Server đời cũ chỉ gửi isOnline.
    const status =
      presence.status ?? (presence.isOnline ? PresenceStatus.Available : PresenceStatus.Offline);
    const next = { ...entries.value };

    if (status === PresenceStatus.Offline && !presence.statusMessage) {
      delete next[id];
    } else {
      next[id] = { status, statusMessage: presence.statusMessage };
    }
    entries.value = next;

    if (id === selfId && mine.value) {
      mine.value = { ...mine.value, status, message: presence.statusMessage };
    }
  };

  const sync = async () => {
    const list = await getPresences();
    entries.value = Object.fromEntries(
      list.map((p) => [normalize(p.userId), { status: p.status, statusMessage: p.statusMessage }]),
    );
  };

  const loadMine = async () => {
    try {
      mine.value = (await presenceApi.getMine()).data.data;
    } catch {
      // Server chưa hỗ trợ thì không có bảng chọn trạng thái, phần còn lại vẫn chạy.
      mine.value = null;
    }
  };

  const setStatus = async (command: SetPresenceStatusCommand) => {
    mine.value = (await presenceApi.setStatus(command)).data.data;
  };

  const setMessage = async (command: SetPresenceMessageCommand) => {
    mine.value = (await presenceApi.setMessage(command)).data.data;
  };

  /** Gọi sau khi hub đã kết nối. Lần gọi thứ hai không đăng ký thêm handler. */
  const start = (currentUserId: string) => {
    selfId = normalize(currentUserId);
    if (isSubscribed) return;
    isSubscribed = true;

    onHubEvent(HubEvent.PresenceChanged, (payload: UserPresence) => apply(payload));
    onHubEvent(HubEvent.PresenceSettingsChanged, (payload: MyPresence) => {
      mine.value = payload;
    });

    // Mất kết nối là mất luôn các event ở giữa, nên nối lại phải nạp lại từ đầu. Kết nối mới ở
    // server mặc định là có người thao tác, nên đang rảnh tay thì báo lại.
    onHubReconnected(() => {
      sync();
      loadMine();
      if (isUserIdle()) sendIdle(true);
    });

    startIdleWatch((idle) => sendIdle(idle));
    sync();
    loadMine();
  };

  return {
    onlineUserIds,
    mine,
    isDoNotDisturb,
    statusOf,
    messageOf,
    isOnline,
    start,
    sync,
    setStatus,
    setMessage,
  };
};
