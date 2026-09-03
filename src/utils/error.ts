/** Gom message lỗi từ vỏ ApiResponse của backend, kể cả lỗi validation nhiều field. */
export const extractErrorMessage = (err: any): string => {
  const data = err?.response?.data;
  if (!data) return "Đã xảy ra lỗi!";

  if (data.errors && typeof data.errors === "object") {
    const messages = Object.values(data.errors).flat().join("\n");
    return messages || data.message || "Dữ liệu không hợp lệ!";
  }

  return data.message || "Đã xảy ra lỗi!";
};
