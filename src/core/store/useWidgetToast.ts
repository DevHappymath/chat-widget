import { ref } from "vue";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

const toasts = ref<ToastMessage[]>([]);

const push = (type: ToastType, message: string, duration = 3200) => {
  const id = Math.random().toString(36).slice(2, 9);
  toasts.value = [...toasts.value, { id, type, message }];

  setTimeout(() => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }, duration);
};

/** Toast riêng của widget, không đụng tới hệ thống toast của site chủ. */
export const useWidgetToast = () => ({
  toasts,
  remove: (id: string) => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  },
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
  warning: (message: string) => push("warning", message),
  info: (message: string) => push("info", message),
});
