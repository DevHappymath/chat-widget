import * as signalR from "@microsoft/signalr";
import { readonly, ref, shallowRef } from "vue";
import { HubEvent, HubMethod } from "../constants/hub-event";
import { resolveHubUrl, useWidgetConfig } from "./config";

type HubHandler = (payload: any) => void;

const connection = shallowRef<signalR.HubConnection | null>(null);
const isConnected = ref(false);

const handlers = new Map<string, Set<HubHandler>>();
const reconnectedCallbacks = new Set<() => void>();

const dispatch = (event: string, payload: unknown) => {
  handlers.get(event)?.forEach((callback) => callback(payload));
};

const build = (hubUrl: string) =>
  new signalR.HubConnectionBuilder()
    .withUrl(hubUrl, {
      // Factory được gọi lại ở mỗi lần nối lại, nên token hết hạn sẽ tự được thay bằng token mới.
      accessTokenFactory: async () => (await useWidgetConfig().getToken()) ?? "",
      // Bỏ negotiate để token đi thẳng qua query string của WebSocket, đúng cách backend
      // đọc token ở JwtBearerEvents.OnMessageReceived.
      skipNegotiation: true,
      transport: signalR.HttpTransportType.WebSockets,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

/**
 * Một kết nối duy nhất cho cả tab. Gọi nhiều lần không mở thêm kết nối, để widget nhúng ở
 * layout không đẻ ra mỗi component một socket.
 */
export const startHub = async (hubPath: string): Promise<void> => {
  const existing = connection.value;
  if (
    existing &&
    (existing.state === signalR.HubConnectionState.Connected ||
      existing.state === signalR.HubConnectionState.Connecting)
  ) {
    return;
  }

  const conn = build(resolveHubUrl(hubPath));
  connection.value = conn;

  for (const event of Object.values(HubEvent)) {
    conn.on(event, (payload) => dispatch(event, payload));
  }

  conn.onreconnected(() => {
    isConnected.value = true;
    // Event phát ra trong lúc mất kết nối là mất luôn, nơi đăng ký phải tự nạp lại dữ liệu.
    reconnectedCallbacks.forEach((callback) => callback());
  });

  conn.onclose(() => {
    isConnected.value = false;
  });

  try {
    await conn.start();
    isConnected.value = true;
  } catch (err) {
    isConnected.value = false;
    console.error("[chat-widget] Không kết nối được hub:", err);
  }
};

export const stopHub = async () => {
  if (!connection.value) return;

  await connection.value.stop();
  connection.value = null;
  isConnected.value = false;
};

/**
 * Đăng ký nhận một event của hub.
 * @returns hàm huỷ đăng ký, phải gọi khi component bị gỡ để không rò callback.
 */
export const onHubEvent = (event: string, callback: HubHandler) => {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event)!.add(callback);

  return () => handlers.get(event)?.delete(callback);
};

export const onHubReconnected = (callback: () => void) => {
  reconnectedCallbacks.add(callback);
  return () => reconnectedCallbacks.delete(callback);
};

const isReady = () =>
  connection.value?.state === signalR.HubConnectionState.Connected;

/** Danh sách userId đang online, dùng dựng trạng thái ban đầu ngay sau khi kết nối. */
export const getOnlineUsers = async (): Promise<string[]> => {
  if (!isReady()) return [];
  return await connection.value!.invoke<string[]>(HubMethod.GetOnlineUsers);
};

export const sendTyping = async (conversationId: string, isTyping: boolean) => {
  if (!isReady()) return;
  try {
    await connection.value!.invoke(HubMethod.Typing, conversationId, isTyping);
  } catch {
    // Báo đang gõ rơi mất không ảnh hưởng gì, không cần làm phiền người dùng.
  }
};

export const useHubState = () => ({ isConnected: readonly(isConnected) });
