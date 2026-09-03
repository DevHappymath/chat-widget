import { shallowRef } from "vue";

export type TokenProvider = () => string | null | Promise<string | null>;

export interface ChatWidgetConfig {
  /** Gốc REST của chat service, ví dụ `https://chat.giaoducthanhdat.vn/api`. */
  apiBase: string;
  /**
   * Trả access_token còn hạn (audience `api`). Được gọi lại ở mỗi request và mỗi lần hub
   * nối lại, nên phải luôn lấy token mới chứ không giữ cứng chuỗi lúc khởi tạo.
   */
  getToken: TokenProvider;
  /** Bỏ trống thì suy ra từ `apiBase` và `hubPath` mà bootstrap trả về. */
  hubUrl?: string;
  /** Gọi khi backend trả 401; site nên đưa người dùng về luồng đăng nhập của mình. */
  onUnauthorized?: () => void;
  position?: "bottom-right" | "bottom-left";
  /** Khoảng cách tới mép màn hình, tính bằng px. */
  offset?: { x: number; y: number };
  zIndex?: number;
}

type ResolvedConfig = Required<Omit<ChatWidgetConfig, "hubUrl" | "onUnauthorized">> &
  Pick<ChatWidgetConfig, "hubUrl" | "onUnauthorized">;

const config = shallowRef<ResolvedConfig | null>(null);

export const configureChatWidget = (input: ChatWidgetConfig) => {
  config.value = {
    position: "bottom-right",
    offset: { x: 24, y: 24 },
    zIndex: 2147483000,
    ...input,
    apiBase: input.apiBase.replace(/\/+$/, ""),
  };
};

/** Ném lỗi thay vì trả null: mọi nơi gọi tới đều nằm sau khi ChatWidget đã cấu hình. */
export const useWidgetConfig = (): ResolvedConfig => {
  if (!config.value) {
    throw new Error("[chat-widget] Chưa cấu hình, hãy mount <ChatWidget> trước.");
  }
  return config.value;
};

/**
 * Ghép URL hub từ gốc REST: `https://host/api` + `/hubs/chat` thành `https://host/hubs/chat`.
 * Bỏ qua khi site đã truyền `hubUrl` tường minh.
 */
export const resolveHubUrl = (hubPath: string): string => {
  const current = useWidgetConfig();
  if (current.hubUrl) return current.hubUrl;

  const origin = current.apiBase.replace(/\/api\/?$/, "");
  return `${origin}${hubPath.startsWith("/") ? hubPath : `/${hubPath}`}`;
};
