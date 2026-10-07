import { shallowRef } from "vue";

export type TokenProvider = () => string | null | Promise<string | null>;

export interface ChatWidgetConfig {
  /** Gốc REST của chat service, ví dụ `https://chat.giaoducthanhdat.vn/api`. */
  apiBase: string;
  /**
   * Route proxy cùng origin của site, ví dụ `/api/chat-proxy`. Có thì mọi lời gọi REST đi qua
   * đây và site tự gắn token ở phía server, nên trình duyệt không bao giờ cầm token.
   * Site giữ token trong cookie httpOnly nên dùng cách này thay vì `getToken`.
   */
  proxyBase?: string;
  /**
   * Trả access_token còn hạn (audience `api`), chỉ dùng khi không có `proxyBase`. Được gọi lại ở
   * mỗi request, nên phải luôn lấy token mới chứ không giữ cứng chuỗi lúc khởi tạo.
   */
  getToken?: TokenProvider;
  /** Bỏ trống thì suy ra từ `apiBase` và `hubPath` mà bootstrap trả về. */
  hubUrl?: string;
  /** Gọi khi backend trả 401; site nên đưa người dùng về luồng đăng nhập của mình. */
  onUnauthorized?: () => void;
  position?: "bottom-right" | "bottom-left";
  /** Khoảng cách tới mép màn hình, tính bằng px. */
  offset?: { x: number; y: number };
  zIndex?: number;
  /**
   * Hiện số tin chưa đọc trên tiêu đề tab và thành số đỏ trên favicon. Mặc định bật; tắt khi site
   * đã tự quản lý tiêu đề hoặc favicon để báo việc khác.
   */
  tabIndicator?: boolean;
}

type OptionalKeys = "proxyBase" | "getToken" | "hubUrl" | "onUnauthorized";

type ResolvedConfig = Required<Omit<ChatWidgetConfig, OptionalKeys>> &
  Pick<ChatWidgetConfig, OptionalKeys>;

const config = shallowRef<ResolvedConfig | null>(null);

export const configureChatWidget = (input: ChatWidgetConfig) => {
  if (!input.proxyBase && !input.getToken) {
    throw new Error("[chat-widget] Cần cấu hình proxyBase hoặc getToken.");
  }

  config.value = {
    position: "bottom-right",
    offset: { x: 24, y: 24 },
    zIndex: 2147483000,
    tabIndicator: true,
    ...input,
    apiBase: input.apiBase.replace(/\/+$/, ""),
    proxyBase: input.proxyBase?.replace(/\/+$/, ""),
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
