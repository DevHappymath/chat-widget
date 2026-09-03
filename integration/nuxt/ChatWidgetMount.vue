<!--
  Chép file này vào `components/ChatWidgetMount.vue` của site rồi đặt <ChatWidgetMount /> trong
  layout mặc định. Bọc ClientOnly vì widget mở WebSocket và đọc localStorage của trình duyệt.
-->
<script setup lang="ts">
import { createBffTokenProvider, type ChatWidgetConfig } from "@gdtd/chat-widget";
import { ChatWidget } from "@gdtd/chat-widget";

const runtime = useRuntimeConfig();
const { user, login } = useAuth();

const config = computed<ChatWidgetConfig>(() => ({
  apiBase: runtime.public.chatApiBase as string,
  getToken: createBffTokenProvider("/api/auth/chat-token"),
  onUnauthorized: login,
}));
</script>

<template>
  <ClientOnly>
    <!-- Chưa đăng nhập thì chưa có token để gọi bootstrap, dựng widget lúc đó chỉ tốn một 401. -->
    <ChatWidget v-if="user" :config="config" />
  </ClientOnly>
</template>
