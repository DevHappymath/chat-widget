import { PresenceStatus, type MyPresence } from "../types/chat";
import { formatDate, formatDateISO, formatTime } from "../utils/format";

export const PRESENCE_LABELS: Record<PresenceStatus, string> = {
  [PresenceStatus.Offline]: "Ngoại tuyến",
  [PresenceStatus.Available]: "Sẵn sàng",
  [PresenceStatus.Busy]: "Bận",
  [PresenceStatus.DoNotDisturb]: "Không làm phiền",
  [PresenceStatus.BeRightBack]: "Sẽ quay lại ngay",
  [PresenceStatus.Away]: "Vắng mặt",
};

export const PRESENCE_DOT_CLASSES: Record<PresenceStatus, string> = {
  [PresenceStatus.Offline]: "bg-gray-300",
  [PresenceStatus.Available]: "bg-emerald-500",
  [PresenceStatus.Busy]: "bg-red-500",
  [PresenceStatus.DoNotDisturb]: "bg-red-500",
  [PresenceStatus.BeRightBack]: "bg-amber-400",
  [PresenceStatus.Away]: "bg-amber-400",
};

export interface PresenceOption {
  status: PresenceStatus;
  label: string;
  hint?: string;
}

/** Thứ tự và cách gọi bám theo Teams để người dùng quen tay. */
export const PRESENCE_OPTIONS: readonly PresenceOption[] = [
  { status: PresenceStatus.Available, label: "Sẵn sàng", hint: "Tự chuyển vắng mặt khi bạn rời máy" },
  { status: PresenceStatus.Busy, label: "Bận" },
  {
    status: PresenceStatus.DoNotDisturb,
    label: "Không làm phiền",
    hint: "Tắt thẻ báo tin mới, tin vẫn về bình thường",
  },
  { status: PresenceStatus.BeRightBack, label: "Sẽ quay lại ngay" },
  { status: PresenceStatus.Away, label: "Vắng mặt" },
  { status: PresenceStatus.Offline, label: "Hiện là ngoại tuyến" },
];

export type PresenceDuration = "30m" | "1h" | "2h" | "4h" | "today" | "week" | "never";

export const STATUS_DURATIONS: readonly { key: PresenceDuration; label: string }[] = [
  { key: "30m", label: "30 phút" },
  { key: "1h", label: "1 giờ" },
  { key: "2h", label: "2 giờ" },
  { key: "today", label: "Hết hôm nay" },
  { key: "week", label: "Hết tuần này" },
  { key: "never", label: "Không tự đổi" },
];

export const MESSAGE_DURATIONS: readonly { key: PresenceDuration; label: string }[] = [
  { key: "never", label: "Không tự xoá" },
  { key: "1h", label: "1 giờ" },
  { key: "4h", label: "4 giờ" },
  { key: "today", label: "Hết hôm nay" },
  { key: "week", label: "Hết tuần này" },
];

const MINUTES: Partial<Record<PresenceDuration, number>> = { "30m": 30, "1h": 60, "2h": 120, "4h": 240 };

/** Mốc hết hạn theo giờ máy người dùng; "hết tuần" là hết Chủ nhật. */
export const resolveExpiry = (duration: PresenceDuration, now = new Date()): string | null => {
  if (duration === "never") return null;

  const minutes = MINUTES[duration];
  if (minutes) return new Date(now.getTime() + minutes * 60_000).toISOString();

  const end = new Date(now);
  end.setHours(23, 59, 59, 0);
  if (duration === "week") end.setDate(end.getDate() + ((7 - end.getDay()) % 7));
  return end.toISOString();
};

/** "đến 17:30" nếu trong hôm nay, xa hơn thì kèm ngày. */
export const formatUntil = (iso: string, now = new Date()): string => {
  const time = formatTime(iso);
  if (formatDateISO(iso) === formatDateISO(now)) return `đến ${time}`;

  return `đến ${time} ngày ${formatDate(iso).slice(0, 5)}`;
};

/** Tự đặt ngoại tuyến thì gọi đúng như lựa chọn, để người dùng không tưởng mình đang mất mạng. */
export const ownPresenceLabel = (presence: MyPresence): string =>
  presence.manualStatus === PresenceStatus.Offline
    ? "Hiện là ngoại tuyến"
    : PRESENCE_LABELS[presence.status];
