import * as signalR from "@microsoft/signalr";
import { readonly, ref, shallowRef } from "vue";
import { HubEvent, HubMethod } from "../constants/hub-event";
import { PresenceStatus, type UserPresence } from "../types/chat";
import { resolveHubUrl, useWidgetConfig } from "./config";
import { widgetApi } from "./services";

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
      // Trả vé dùng một lần chứ không phải token: giá trị này nằm trên URL WebSocket, lọt vào
      // log proxy và DevTools. Factory được gọi lại ở mỗi lần nối lại nên luôn có vé mới.
      accessTokenFactory: async () => {
        // Hết phiên thì đừng xin vé: nhận 401 sẽ kích onUnauthorized, đá người dùng ra đăng nhập.
        // Đi qua proxy thì không biết trước được, để proxy trả 401 như mọi lời gọi khác.
        const { getToken, proxyBase } = useWidgetConfig();
        if (!proxyBase && getToken && !(await getToken())) return "";

        try {
          const res = await widgetApi.hubTicket();
          return res.data.data.ticket;
        } catch {
          return "";
        }
      },
      // Bỏ negotiate để vé đi thẳng qua query string của WebSocket, đúng cách backend
      // đọc ở JwtBearerEvents.OnMessageReceived.
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

/**
 * Trạng thái ban đầu của người có chung hội thoại; ai không có trong danh sách là ngoại tuyến.
 * Server chưa có trạng thái chi tiết thì dựng lại từ danh sách online, coi như ai cũng sẵn sàng.
 */
export const getPresences = async (): Promise<UserPresence[]> => {
  if (!isReady()) return [];

  try {
    return await connection.value!.invoke<UserPresence[]>(HubMethod.GetPresences);
  } catch {
    const ids = await getOnlineUsers();
    const atUtc = new Date().toISOString();
    return ids.map((userId) => ({ userId, isOnline: true, status: PresenceStatus.Available, atUtc }));
  }
};

/** Báo tab này có người đang thao tác hay không; rơi mất thì lần nối lại sẽ gửi lại. */
export const sendIdle = async (isIdle: boolean) => {
  if (!isReady()) return;
  try {
    await connection.value!.invoke(HubMethod.SetIdle, isIdle);
  } catch {
    // Server đời cũ không có method này; trạng thái vắng mặt chỉ đơn giản là không hiện.
  }
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
