/** Gộp các lần gọi liên tiếp trong `delay` ms thành một lần chạy duy nhất. */
export const debounce = <T extends (...args: any[]) => void>(fn: T, delay = 300) => {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};
