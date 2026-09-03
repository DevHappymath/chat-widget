const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * Đưa chuỗi/số/Date về Date theo GIỜ ĐỊA PHƯƠNG.
 * Chuỗi "YYYY-MM-DD" phải tự tách tay vì new Date("2026-05-20") được JS hiểu là mốc UTC,
 * quy về giờ VN (UTC+7) sẽ lùi thành ngày hôm trước.
 */
export const toDate = (date: Date | string | number): Date => {
  if (date instanceof Date) return date;
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y!, m! - 1, d!);
  }
  return new Date(date);
};

/**
 * Format ngày dd/MM/yyyy - nhất quán mọi môi trường.
 * @example formatDate(new Date()) // "20/05/2026"
 */
export const formatDate = (
  date: Date | string | number,
  options: { includeTime?: boolean } = {},
): string => {
  const d = toDate(date);
  if (isNaN(d.getTime())) return "Ngày không hợp lệ";

  const dateStr = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  if (!options.includeTime) return dateStr;

  return `${dateStr}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

export const formatDateTime = (date: Date | string | number): string =>
  formatDate(date, { includeTime: true });

/** @example formatTime(new Date()) // "14:30" */
export const formatTime = (date: Date | string | number): string => {
  const d = toDate(date);
  if (isNaN(d.getTime())) return "Giờ không hợp lệ";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/** Khoá nhóm theo ngày, cũng dùng để so hai mốc có cùng ngày hay không. */
export const formatDateISO = (date: Date | string | number): string => {
  const d = toDate(date);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const RELATIVE_TIME_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
  ["second", 1000],
];

/** @example formatRelativeTime(Date.now() - 60000) // "1 phút trước" */
export const formatRelativeTime = (date: Date | string | number): string => {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "Không xác định";

  const diffMs = d.getTime() - Date.now();
  const absDiff = Math.abs(diffMs);
  if (absDiff < 10_000) return "Vừa xong";

  const rtf = new Intl.RelativeTimeFormat("vi-VN", { numeric: "auto" });
  for (const [unit, ms] of RELATIVE_TIME_UNITS) {
    if (absDiff >= ms) return rtf.format(Math.round(diffMs / ms), unit);
  }
  return rtf.format(Math.round(diffMs / 1000), "second");
};

/** @example formatBytes(1048576) // "1 MB" */
export const formatBytes = (bytes: number, decimals = 2): string => {
  if (!bytes) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(decimals));

  return `${value} ${sizes[i]}`;
};
