# @gdtd/chat-widget

Bong bóng chat kiểu Messenger cho CRM, HRM, LMS. Widget gọi thẳng chat service
(`chat.giaoducthanhdat.vn`) bằng access_token SSO của chính site chủ, không dùng iframe và
không proxy REST qua BFF của site.

Phạm vi bản này: bong bóng kèm badge chưa đọc, danh bạ, danh sách hội thoại, khung chat, gửi
tin, đính kèm, trả lời, thả cảm xúc, sửa, thu hồi, nhắc tên trong nhóm, báo đang soạn tin,
trạng thái online. Nhóm: tạo nhóm, đổi tên và ảnh nhóm, thêm và xoá thành viên, rời nhóm.

Panel đi theo kiểu một cột nhiều màn: danh sách hội thoại, danh bạ, tạo nhóm, khung chat,
thông tin hội thoại, thêm thành viên. Mỗi màn có đúng một màn cha nên nút quay lại không cần
giữ ngăn xếp (`PARENT_VIEW` trong `core/store/useChatStore.ts`).

Hợp đồng API và event hub: xem `chat.gdtd.vn-be/docs/chat-widget-plan.md`.

---

## Yêu cầu phía site chủ

| Thứ | Vì sao |
|---|---|
| Nuxt 3, Vue 3.5, Tailwind v4 | Package ship mã nguồn, biên dịch bằng toolchain của site |
| `axios`, `@microsoft/signalr`, `lucide-vue-next` | Khai báo là peer dependency, site đã có sẵn |
| Origin của site nằm trong `Cors:AllowedOrigins` của chat service | Không có thì chết ở preflight, kể cả khi token hợp lệ |
| Một server route trả access_token | Token nằm trong cookie httpOnly, JS không đọc được |

## Cài đặt

### 1. Thêm package

```bash
npm i github:DevHappymath/chat-widget#v1.0.0
```

Lệnh này ghi vào `package.json` và `package-lock.json`; **commit cả hai file**. Trong lock,
`resolved` được chốt về đúng một commit SHA nên mọi lần build sau đó lấy lại đúng mã nguồn đó,
kể cả khi tag bị dời.

Nâng phiên bản: đổi tag trong `package.json` rồi chạy lại `npm i`.

Đang phát triển song song thì trỏ thẳng vào thư mục, đừng commit dòng này:

```bash
npm i file:../../chat.gdtd.vn/chat-widget
```

**Image build phải có `git`.** `node:20-alpine` không kèm sẵn, mà npm cần `git` để đổi tag
thành SHA, nên `npm ci` sẽ chết với `npm error syscall spawn git`. Sửa đúng một dòng trong
`Dockerfile` của site:

```dockerfile
RUN apk add --no-cache libc6-compat git
```

Repo để public nên không cần secret hay khoá SSH: lock ghi `git+ssh://` nhưng npm tự lùi về
HTTPS khi trong container không có khoá.

### 2. Cho Nuxt biên dịch mã nguồn của package

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  build: {
    transpile: ["@gdtd/chat-widget"],
  },
  runtimeConfig: {
    public: {
      chatApiBase:
        process.env.NUXT_PUBLIC_CHAT_API_BASE || "http://localhost:7400/api",
    },
  },
});
```

### 3. Nạp CSS của widget

```css
/* assets/css/main.css, đặt sau @import "tailwindcss" */
@import "@gdtd/chat-widget/styles.css";
```

File này khai báo `@source` để Tailwind quét class trong `node_modules`, và định nghĩa hai
token màu. Nếu class của widget không được sinh ra (Tailwind bỏ qua `node_modules` do cấu hình
riêng của site), thêm dòng chỉ đường tường minh:

```css
@source "../../node_modules/@gdtd/chat-widget/src";
```

Muốn widget mang màu thương hiệu của site thì ghi đè token **sau** dòng import:

```css
@theme {
  --color-chat-accent: #1d4ed8;
  /* Nền đặc cho chữ trắng, phải đạt tối thiểu 4.5:1 với màu trắng. */
  --color-chat-accent-strong: #1e40af;
}
```

### 4. Thêm server route trả token

Chép `integration/nuxt/chat-token.get.ts` vào `server/api/auth/chat-token.get.ts`.

### 5. Đặt widget vào layout

Chép `integration/nuxt/ChatWidgetMount.vue` vào `components/`, rồi đặt vào layout mặc định:

```vue
<template>
  <div>
    <NuxtPage />
    <ChatWidgetMount />
  </div>
</template>
```

## Cấu hình

```ts
interface ChatWidgetConfig {
  /** Gốc REST của chat service, ví dụ https://chat.giaoducthanhdat.vn/api */
  apiBase: string;
  /** Trả access_token còn hạn; được gọi lại ở mỗi request và mỗi lần hub nối lại */
  getToken: () => string | null | Promise<string | null>;
  /** Bỏ trống thì suy ra từ apiBase và hubPath mà bootstrap trả về */
  hubUrl?: string;
  onUnauthorized?: () => void;
  position?: "bottom-right" | "bottom-left";
  offset?: { x: number; y: number };
  zIndex?: number;
}
```

`createBffTokenProvider(endpoint)` là bản dựng sẵn cho site dùng BFF: gọi server route, giữ
token tới sát hạn (`exp` trừ 30 giây) và gộp các lần hỏi đồng thời thành một request.

**Không bắt cứng chuỗi token** khi tự viết `getToken`. SignalR gọi lại hàm này ở mỗi lần nối
lại; giữ cứng token là tab mở cả ngày sẽ mất kết nối vĩnh viễn khi token hết hạn.

## Cách widget hoạt động

1. `GET /api/chat/bootstrap` quyết định hiện hay ẩn. `canUseChat: false` (học viên, cộng tác
   viên) thì không render gì cả, không phải mã lỗi nên không có màn hình lỗi nhấp nháy.
2. Bootstrap trả `hubPath`, số chưa đọc và giới hạn tệp; widget mở **một** kết nối hub cho cả
   tab, mọi component dùng chung một store.
3. Danh sách hội thoại chỉ nạp khi người dùng mở panel lần đầu. Trước đó badge lấy từ bootstrap
   và tự cộng theo `MessageReceived`.
4. Số trên badge được nắn lại bằng bootstrap khi: hub nối lại, tab được focus lại, hoặc sau khi
   có event mà danh sách chưa nạp. Cần vì thu hồi tin không làm giảm badge và event phát trong
   lúc mất mạng thì mất luôn.
5. Đọc tin ở bất kỳ tab nào cũng tắt badge ở mọi tab, nhờ backend gửi `ConversationRead` cho
   cả chính người đọc.

## Điểm cần biết trước khi sửa

- **Enum đi qua JSON dạng số.** Backend không đăng ký `JsonStringEnumConverter`; `types/chat.ts`
  giữ đúng giá trị số, đừng đổi sang chuỗi.
- **Tên event hub được chép tay** trong `constants/hub-event.ts`. Đổi tên bên backend mà quên
  file này thì không có gì báo lỗi, widget chỉ im lặng không nhận tin.
- **URL tệp đính kèm phải tuyệt đối.** Backend đã ghép `App:PublicBaseUrl`; widget dùng nguyên
  văn `fileUrl`, không tự ghép tiền tố.
- **Panel đóng thì tin mới vẫn tính là chưa đọc**, kể cả khi hội thoại đó đang được chọn.
- Widget chỉ chạy phía client. Luôn bọc `<ClientOnly>`.

## Còn thiếu so với kế hoạch

- `GET /api/conversations/unread-count` (giai đoạn 4 của kế hoạch) chưa có ở backend. Widget
  đang dùng `bootstrap` để nắn badge; có endpoint rồi thì đổi trong `refreshBadge` của
  `core/store/useChatStore.ts`, không phải sửa chỗ khác.
- Widget khoá ở giao diện sáng. Muốn có chế độ tối thì bổ sung biến thể cho hai token màu và
  các lớp `bg-white` / `text-gray-*`.
