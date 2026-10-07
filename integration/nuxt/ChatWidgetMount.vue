<!--
  Chép file này vào `components/ChatWidgetMount.vue` của site rồi đặt <ChatWidgetMount /> trong
  layout mặc định. Bọc ClientOnly vì widget mở WebSocket và đọc localStorage của trình duyệt.
-->
<script setup lang="ts">
import type { ChatWidgetConfig } from "@gdtd/chat-widget";
import { ChatWidget } from "@gdtd/chat-widget";

const runtime = useRuntimeConfig();
const { user, login } = useAuth();

const config = computed<ChatWidgetConfig>(() => ({
  apiBase: runtime.public.chatApiBase as string,
  proxyBase: "/api/chat-proxy",
  onUnauthorized: login,
}));
</script>

<template>
  <ClientOnly>
    <!-- Chưa đăng nhập thì gọi bootstrap chỉ nhận 401, dựng widget lúc đó là thừa. -->
    <ChatWidget v-if="user" :config="config" />
  </ClientOnly>
</template>
