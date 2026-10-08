import {
  MessageType,
  type ChatConversation,
  type ChatMessage,
  type MessageReaction,
} from "../types/chat";
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

/** Tắt thông báo có hạn thì tự bật lại khi tới hạn, không cần server phát event. */
export const isMutedNow = (conversation: ChatConversation): boolean =>
  conversation.isMuted &&
  (!conversation.mutedUntilUtc || new Date(conversation.mutedUntilUtc).getTime() > Date.now());

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

const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const FLAG = /^\p{Regional_Indicator}{2}$/u;
const KEYCAP = "\u20E3";

let graphemeSegmenter: Intl.Segmenter | null = null;

// Mỗi lần vẽ lại danh sách tin đều hỏi lại hàm này nhiều lần cho cùng một nội dung.
const emojiOnlyCache = new Map<string, number>();
const EMOJI_ONLY_CACHE_LIMIT = 500;

/**
 * Số emoji nếu nội dung chỉ toàn emoji, có chữ lẫn vào thì 0. Đếm theo cụm ký tự vì một emoji
 * như 👍🏽 hay 👨‍👩‍👧 ghép từ nhiều code point.
 */
export const countEmojiOnly = (content: string | null | undefined): number => {
  const text = content?.trim();
  if (!text) return 0;

  const cached = emojiOnlyCache.get(text);
  if (cached !== undefined) return cached;

  graphemeSegmenter ??= new Intl.Segmenter(undefined, { granularity: "grapheme" });

  let count = 0;
  for (const { segment } of graphemeSegmenter.segment(text)) {
    if (!segment.trim()) continue;
    if (!PICTOGRAPHIC.test(segment) && !FLAG.test(segment) && !segment.includes(KEYCAP)) {
      count = 0;
      break;
    }
    count++;
  }

  if (emojiOnlyCache.size >= EMOJI_ONLY_CACHE_LIMIT) emojiOnlyCache.clear();
  emojiOnlyCache.set(text, count);

  return count;
};

export interface ReactionOp {
  emoji: string;
  /** `true` là thả thêm, `false` là gỡ. */
  add: boolean;
}

const reactedBy = (reaction: MessageReaction, userId: string) =>
  reaction.userIds.some((id) => id.toLowerCase() === userId);

/**
 * Áp một thao tác thả/gỡ lên hàng biểu tượng mà không chờ server. Thả cái đã có hay gỡ cái
 * chưa có thì giữ nguyên, nên phủ lại nhiều lần lên bản server trả về vẫn ra cùng kết quả.
 */
export const applyReactionOp = (
  reactions: MessageReaction[],
  op: ReactionOp,
  userId: string,
): MessageReaction[] => {
  const index = reactions.findIndex((r) => r.emoji === op.emoji);
  const current = index >= 0 ? reactions[index] : undefined;

  if (op.add) {
    if (current && reactedBy(current, userId)) return reactions;
    if (!current) return [...reactions, { emoji: op.emoji, count: 1, userIds: [userId] }];

    return reactions.map((r, i) =>
      i === index ? { ...r, count: r.count + 1, userIds: [...r.userIds, userId] } : r,
    );
  }

  if (!current || !reactedBy(current, userId)) return reactions;
  if (current.count <= 1) return reactions.filter((_, i) => i !== index);

  return reactions.map((r, i) =>
    i === index
      ? {
          ...r,
          count: r.count - 1,
          userIds: r.userIds.filter((id) => id.toLowerCase() !== userId),
        }
      : r,
  );
};

/**
 * Server xếp theo số lượt, nên mỗi lần có người thả là các chip đổi chỗ cho nhau. Giữ thứ tự
 * đang hiện, biểu tượng mới nối vào cuối, để hàng chip không nhảy dưới tay người đang bấm.
 */
export const keepReactionOrder = (
  current: MessageReaction[],
  next: MessageReaction[],
): MessageReaction[] => {
  const order = new Map(current.map((r, i) => [r.emoji, i]));
  const rank = (emoji: string, fallback: number) => order.get(emoji) ?? current.length + fallback;

  return next
    .map((reaction, i) => ({ reaction, rank: rank(reaction.emoji, i) }))
    .sort((a, b) => a.rank - b.rank)
    .map((item) => item.reaction);
};

export interface MessageSegment extends ContentSegment {
  /** Có giá trị khi mẩu này là một đường link. */
  href?: string;
}

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"]+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?'"…]+$/;

/**
 * Dấu câu ngay sau link ("xem tại https://abc.vn.") không thuộc link. Dấu ")" chỉ bỏ khi
 * thừa, vì link Wikipedia hay có ngoặc đóng thật bên trong.
 */
const trimUrl = (raw: string) => {
  let url = raw.replace(TRAILING_PUNCTUATION, "");

  while (url.endsWith(")") && url.split("(").length < url.split(")").length) {
    url = url.slice(0, -1).replace(TRAILING_PUNCTUATION, "");
  }

  return url;
};

/** Tách thêm link khỏi các mẩu chữ thường; mẩu nhắc tên giữ nguyên. Chỉ nhận http/https. */
export const linkifySegments = (segments: ContentSegment[]): MessageSegment[] =>
  segments.flatMap<MessageSegment>((segment) => {
    if (segment.isMention) return [segment];

    const parts: MessageSegment[] = [];
    let lastIndex = 0;

    for (const match of segment.text.matchAll(URL_PATTERN)) {
      const url = trimUrl(match[0]);
      if (!url) continue;

      if (match.index > lastIndex) {
        parts.push({ text: segment.text.slice(lastIndex, match.index), isMention: false });
      }

      parts.push({
        text: url,
        isMention: false,
        href: /^https?:\/\//i.test(url) ? url : `https://${url}`,
      });
      lastIndex = match.index + url.length;
    }

    if (lastIndex < segment.text.length) {
      parts.push({ text: segment.text.slice(lastIndex), isMention: false });
    }

    return parts;
  });

export interface HighlightSegment {
  text: string;
  isMatch: boolean;
}

/**
 * Bỏ dấu từng ký tự một. `normalize("NFD")` trên cả chuỗi làm lệch chỉ số vì mỗi chữ có dấu
 * tách thành hai ký tự, mà tô sáng thì phải cắt đúng vị trí trên chuỗi gốc.
 */
const COMBINING_MARKS = /[\u0300-\u036f]/g;

const stripAccentsPreservingLength = (value: string): string =>
  [...value.toLowerCase().replace(/đ/g, "d")]
    .map((char) => {
      const stripped = char.normalize("NFD").replace(COMBINING_MARKS, "");
      return stripped.length === 1 ? stripped : char;
    })
    .join("");

/**
 * Cắt nội dung thành các mẩu khớp và không khớp từ khoá. Backend tìm trên bản đã bỏ dấu nên
 * ở đây cũng phải so không dấu, nếu không gõ "hop giao ban" ra kết quả mà không chỗ nào sáng.
 */
export const splitKeywordMatches = (
  content: string,
  keyword: string,
): HighlightSegment[] => {
  const needle = stripAccentsPreservingLength(keyword.trim());
  if (!needle || !content) return [{ text: content, isMatch: false }];

  const haystack = stripAccentsPreservingLength(content);
  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (;;) {
    const at = haystack.indexOf(needle, cursor);
    if (at === -1) break;

    if (at > cursor) segments.push({ text: content.slice(cursor, at), isMatch: false });
    segments.push({ text: content.slice(at, at + needle.length), isMatch: true });
    cursor = at + needle.length;
  }

  if (cursor < content.length) {
    segments.push({ text: content.slice(cursor), isMatch: false });
  }

  return segments;
};

const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

const pastedImageStamp = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

/**
 * Ảnh dán từ clipboard, đặt lại tên Image_yyyyMMddHHmmss vì ảnh chụp màn hình luôn mang tên
 * chung "image.png". Clipboard có kèm chữ (copy từ Excel, Word) thì để trình duyệt dán chữ như thường.
 */
export const pastedImageFiles = (clipboard: DataTransfer | null): File[] => {
  if (!clipboard || clipboard.getData("text/plain").trim()) return [];

  const images = Array.from(clipboard.items)
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));

  const stamp = pastedImageStamp(new Date());

  return images.map((file, index) => {
    const extension = IMAGE_EXTENSION_BY_MIME[file.type] ?? `.${file.type.slice("image/".length)}`;
    const suffix = index ? `_${index + 1}` : "";
    return new File([file], `Image_${stamp}${suffix}${extension}`, { type: file.type });
  });
};
