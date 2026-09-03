import { MessageType, type ChatMessage } from "../types/chat";
import { formatDate, formatDateISO, formatRelativeTime, formatTime } from "./format";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Gộp tin nhắn liền nhau của cùng một người trong 5 phút thành một cụm bong bóng. */
const CLUSTER_WINDOW_MS = 5 * 60 * 1000;

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const daysBetweenToday = (iso: string) =>
  Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / DAY_MS);

/** Nhãn thời gian cạnh tên hội thoại: gần thì càng chi tiết, xa thì rút gọn. */
export const chatListTimestamp = (iso: string): string => {
  const diffDays = daysBetweenToday(iso);
  if (diffDays === 0) return formatTime(iso);
  if (diffDays === 1) return "Hôm qua";
  if (diffDays < 7) return `${diffDays} ngày`;
  return formatDate(iso);
};

/** Nhãn ngày ngăn giữa các cụm tin nhắn trong khung chat. */
export const chatDayLabel = (iso: string): string => {
  const diffDays = daysBetweenToday(iso);
  if (diffDays === 0) return "Hôm nay";
  if (diffDays === 1) return "Hôm qua";
  return formatDate(iso);
};

/**
 * Backend không lưu mốc offline cuối cùng, chỉ có online hay không, nên nhãn dừng ở hai
 * trạng thái; truyền `lastSeenAt` khi muốn gợi ý lần xuất hiện gần nhất.
 */
export const presenceLabel = (isOnline: boolean, lastSeenAt?: string | null): string => {
  if (isOnline) return "Đang hoạt động";
  if (lastSeenAt) return `Hoạt động ${formatRelativeTime(lastSeenAt)}`;
  return "Ngoại tuyến";
};

export interface MessageCluster {
  key: string;
  senderId: string;
  senderName: string;
  isSystem: boolean;
  isOwn: boolean;
  messages: ChatMessage[];
}

export interface MessageDayGroup {
  key: string;
  label: string;
  clusters: MessageCluster[];
}

/**
 * Chia tin nhắn thành nhóm theo ngày, trong mỗi ngày lại gom thành cụm cùng người gửi để
 * chỉ vẽ avatar và tên một lần cho cả cụm.
 */
export const groupChatMessages = (
  messages: ChatMessage[],
  currentUserId: string,
): MessageDayGroup[] => {
  const days: MessageDayGroup[] = [];

  for (const message of messages) {
    const dayKey = formatDateISO(message.createdAtUtc);
    let day = days.at(-1);

    if (!day || day.key !== dayKey) {
      day = { key: dayKey, label: chatDayLabel(message.createdAtUtc), clusters: [] };
      days.push(day);
    }

    const isSystem = message.type === MessageType.System;
    const cluster = day.clusters.at(-1);
    const withinWindow =
      cluster &&
      new Date(message.createdAtUtc).getTime() -
        new Date(cluster.messages.at(-1)!.createdAtUtc).getTime() <=
        CLUSTER_WINDOW_MS;

    if (
      cluster &&
      withinWindow &&
      cluster.senderId === message.senderId &&
      cluster.isSystem === isSystem
    ) {
      cluster.messages.push(message);
      continue;
    }

    day.clusters.push({
      key: message.id,
      senderId: message.senderId,
      senderName: message.senderName || "Người dùng",
      isSystem,
      isOwn: message.senderId.toLowerCase() === currentUserId,
      messages: [message],
    });
  }

  return days;
};

/** Chữ cái viết tắt cho avatar, lấy tối đa 2 từ cuối để "Đặng Thu Thảo" ra "TT". */
export const nameInitials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const AVATAR_TONES = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
  "bg-cyan-100 text-cyan-800",
  "bg-orange-100 text-orange-800",
];

/** Màu avatar suy ra từ tên để cùng một người luôn có cùng màu ở mọi màn hình. */
export const avatarTone = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
};

/** Dòng preview cho tin nhắn cuối trong danh sách hội thoại. */
export const messagePreview = (message?: ChatMessage | null): string => {
  if (!message) return "Chưa có tin nhắn";
  if (message.isDeleted) return "Tin nhắn đã bị thu hồi";
  if (message.content?.trim()) return message.content;
  if (message.attachments.length) return `Đã gửi ${message.attachments.length} tệp`;
  return "Tin nhắn";
};

export interface ContentSegment {
  text: string;
  isMention: boolean;
}

/** Bỏ dấu để gõ "thao" vẫn tìm ra "Thảo" khi chọn người trong danh sách nhắc tên. */
export const normalizeName = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, (char) => `\\${char}`);

/**
 * Tách nội dung thành các mẩu để tô sáng phần nhắc tên. Backend chỉ lưu userId nên phải dò
 * lại theo tên hiển thị; tên dài đứng trước để "@Nguyễn An" không bị "@Nguyễn" cắt mất.
 */
export const splitMentions = (
  content: string,
  names: string[],
): ContentSegment[] => {
  const usable = names.filter(Boolean).sort((a, b) => b.length - a.length);
  if (!usable.length) return [{ text: content, isMention: false }];

  const pattern = new RegExp(`@(?:${usable.map(escapeRegExp).join("|")})`, "g");
  const segments: ContentSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(pattern)) {
    if (match.index > lastIndex) {
      segments.push({ text: content.slice(lastIndex, match.index), isMention: false });
    }
    segments.push({ text: match[0], isMention: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({ text: content.slice(lastIndex), isMention: false });
  }

  return segments;
};
