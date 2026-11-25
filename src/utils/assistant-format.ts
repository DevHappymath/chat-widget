/** Số có dấu phân cách hàng nghìn kiểu Việt Nam: 1.234.567. */
export const formatNumber = (value: number): string =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);

/** Số rút gọn kiểu Việt Nam: 1,5 N, 2 Tr. */
export const formatCompactNumber = (value: number): string =>
  new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 }).format(value);

/** Nhận tỉ lệ 0-1. */
export const formatPercent = (value: number, options: { maximumFractionDigits?: number } = {}): string =>
  new Intl.NumberFormat("vi-VN", {
    style: "percent",
    maximumFractionDigits: options.maximumFractionDigits ?? 1,
  }).format(value);
