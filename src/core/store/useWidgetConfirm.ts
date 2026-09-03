import { ref, shallowRef } from "vue";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
}

const isOpen = ref(false);
const options = shallowRef<ConfirmOptions | null>(null);
let resolveAsk: ((agreed: boolean) => void) | null = null;

/** Hộp xác nhận nằm trong panel widget, không dùng `window.confirm` để không chặn tab. */
export const useWidgetConfirm = () => {
  const ask = (opts: ConfirmOptions) => {
    options.value = opts;
    isOpen.value = true;

    return new Promise<boolean>((resolve) => {
      resolveAsk = resolve;
    });
  };

  const settle = (agreed: boolean) => {
    isOpen.value = false;
    resolveAsk?.(agreed);
    resolveAsk = null;
  };

  return {
    isOpen,
    options,
    ask,
    confirm: () => settle(true),
    cancel: () => settle(false),
  };
};
