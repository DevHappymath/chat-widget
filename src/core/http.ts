import axios, { type AxiosInstance } from "axios";
import { useWidgetConfig } from "./config";

let instance: AxiosInstance | null = null;

/** Header proxy của site bắt buộc phải có: trang khác không tự đặt được header này nếu không qua CORS. */
export const PROXY_GUARD_HEADER = "X-Chat-Widget";

/**
 * Axios riêng của widget. Có `proxyBase` thì gọi route proxy cùng origin, cookie phiên tự đi
 * kèm và site gắn token ở server; không thì gọi thẳng chat service qua CORS bằng `getToken`.
 */
export const useHttp = (): AxiosInstance => {
  if (instance) return instance;

  const config = useWidgetConfig();
  const { proxyBase, getToken } = config;

  const http = proxyBase
    ? axios.create({ baseURL: proxyBase, headers: { [PROXY_GUARD_HEADER]: "1" } })
    : axios.create({ baseURL: config.apiBase });

  if (!proxyBase && getToken) {
    http.interceptors.request.use(async (request) => {
      const token = await getToken();
      if (token) request.headers.Authorization = `Bearer ${token}`;
      return request;
    });
  }

  http.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error?.response?.status === 401) config.onUnauthorized?.();
      return Promise.reject(error);
    },
  );

  instance = http;
  return http;
};
