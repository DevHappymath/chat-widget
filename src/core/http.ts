import axios, { type AxiosInstance } from "axios";
import { useWidgetConfig } from "./config";

let instance: AxiosInstance | null = null;

/**
 * Axios riêng của widget: gọi thẳng chat service qua CORS với Bearer token của site chủ,
 * không đi qua BFF nên không gửi cookie.
 */
export const useHttp = (): AxiosInstance => {
  if (instance) return instance;

  const config = useWidgetConfig();
  const http = axios.create({ baseURL: config.apiBase });

  http.interceptors.request.use(async (request) => {
    const token = await config.getToken();
    if (token) request.headers.Authorization = `Bearer ${token}`;
    return request;
  });

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
