/**
 * Vỏ response chung của backend (`CHAT_GDTD.API.Contracts.ApiResponse<T>`).
 * Lỗi cũng trả về đúng vỏ này, nên `errors` chỉ có giá trị khi `isSuccess = false`.
 */
export interface ApiEnvelope<T> {
  isSuccess: boolean;
  code: number;
  message: string;
  /** Lỗi validation của FluentValidation: khoá là tên field, giá trị là danh sách message. */
  errors?: Record<string, string[]> | null;
  traceId?: string | null;
  data: T;
}

/** Phần thân của `PagedResult<T>` bên backend. */
export interface PagedData<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

export type PagedResult<T> = ApiEnvelope<PagedData<T>>;

export interface PagedParams {
  keyword?: string;
  pageNumber?: number;
  pageSize?: number;
}
