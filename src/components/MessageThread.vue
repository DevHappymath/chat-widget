<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useChatStore } from "../core/store/useChatStore";
import { groupChatMessages, presenceLabel } from "../utils/chat";
import MessageCluster from "./MessageCluster.vue";
import MessageComposer from "./MessageComposer.vue";
import WidgetAvatar from "./WidgetAvatar.vue";
import WidgetIcon from "./WidgetIcon.vue";

const {
  view,
  currentUserId,
  activeConversation,
  activeConversationId,
  activeMessages,
  activeTypingNames,
  hasMoreMessages,
  isLoadingMessages,
  draft,
  isGroup,
  isOnline,
  partnerOf,
  titleOf,
  membersOf,
  sendMessage,
  loadOlderMessages,
  notifyTyping,
  toggleMute,
} = useChatStore();

const scroller = ref<HTMLElement | null>(null);

const partner = computed(() =>
  activeConversation.value ? partnerOf(activeConversation.value) : undefined,
);

const group = computed(() =>
  activeConversation.value ? isGroup(activeConversation.value) : false,
);

/** Header dùng chung cho hội thoại thật và bản nháp, khác nhau ở nguồn tên và avatar. */
const headerTitle = computed(() =>
  activeConversation.value
    ? titleOf(activeConversation.value)
    : (draft.value?.fullName ?? ""),
);

const headerPartnerId = computed(() => partner.value?.userId ?? draft.value?.userId);

const subtitle = computed(() => {
  const conversation = activeConversation.value;

  if (!conversation) return draft.value ? "Hội thoại mới, chưa gửi tin nào" : "";

  if (group.value) {
    const members = membersOf(conversation);
    const online = members.filter((m) => isOnline(m.userId)).length;
    return `${members.length} thành viên · ${online} đang hoạt động`;
  }

  return presenceLabel(isOnline(partner.value?.userId));
});

const dayGroups = computed(() =>
  groupChatMessages(activeMessages.value, currentUserId.value),
);

const lastOwnClusterKey = computed(() => {
  const clusters = dayGroups.value.flatMap((day) => day.clusters);
  return clusters.filter((c) => c.isOwn && !c.isSystem).at(-1)?.key ?? null;
});

const typingLabel = computed(() => {
  const names = activeTypingNames.value;
  if (!names.length) return "";
  if (names.length === 1) return `${names[0]} đang soạn tin...`;
  return `${names.length} người đang soạn tin...`;
});

const scrollToBottom = () => {
  const el = scroller.value;
  if (el) el.scrollTop = el.scrollHeight;
};

// Chờ render xong bong bóng mới rồi mới cuộn, nếu không scrollHeight vẫn là giá trị cũ.
watch(
  [() => activeConversationId.value, () => activeMessages.value.length],
  () => nextTick(scrollToBottom),
  { immediate: true },
);

/** Giữ nguyên vị trí đang đọc sau khi chèn thêm tin cũ ở phía trên. */
const onLoadOlder = async () => {
  const el = scroller.value;
  const previousHeight = el?.scrollHeight ?? 0;

  await loadOlderMessages();

  await nextTick();
  if (el) el.scrollTop = el.scrollHeight - previousHeight;
};
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <header class="flex shrink-0 items-center gap-2.5 border-b border-gray-100 px-3 py-2.5">
      <WidgetAvatar
        :name="headerTitle"
        :variant="group ? 'group' : 'user'"
        :src="activeConversation?.avatarUrl"
        :is-online="isOnline(headerPartnerId)"
        :show-presence="!group"
        size="sm"
      />

      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-bold text-gray-900">{{ headerTitle }}</p>
        <p
          class="truncate text-[11px]"
          :class="typingLabel ? 'text-chat-accent-strong' : 'text-gray-600'"
        >
          {{ typingLabel || subtitle }}
        </p>
      </div>

      <template v-if="activeConversation">
        <button
          type="button"
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-gray-100"
          :class="activeConversation.isMuted ? 'text-chat-accent-strong' : 'text-gray-500'"
          :aria-label="activeConversation.isMuted ? 'Bật thông báo' : 'Tắt thông báo'"
          :title="activeConversation.isMuted ? 'Bật thông báo' : 'Tắt thông báo'"
          @click="toggleMute(activeConversation.id)"
        >
          <WidgetIcon :name="activeConversation.isMuted ? 'BellOff' : 'Bell'" :size="17" />
        </button>

        <button
          type="button"
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100"
          :aria-label="group ? 'Thông tin nhóm' : 'Thông tin hội thoại'"
          :title="group ? 'Thông tin nhóm' : 'Thông tin hội thoại'"
          @click="view = 'info'"
        >
          <WidgetIcon name="Info" :size="17" />
        </button>
      </template>
    </header>

    <div ref="scroller" class="gdtd-chat-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3">
      <div v-if="hasMoreMessages" class="mb-3 flex justify-center">
        <button
          type="button"
          class="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
          :disabled="isLoadingMessages"
          @click="onLoadOlder"
        >
          {{ isLoadingMessages ? "Đang tải..." : "Tải tin nhắn cũ hơn" }}
        </button>
      </div>

      <div
        v-if="!dayGroups.length && !isLoadingMessages"
        class="flex h-full flex-col items-center justify-center gap-2 px-6 text-center"
      >
        <WidgetAvatar
          :name="headerTitle"
          :variant="group ? 'group' : 'user'"
          :src="activeConversation?.avatarUrl"
          size="lg"
        />
        <p class="mt-1 text-sm font-semibold text-gray-800">{{ headerTitle }}</p>
        <p class="max-w-56 text-xs text-gray-600">
          Chưa có tin nhắn nào. Gửi lời chào để bắt đầu hội thoại.
        </p>
      </div>

      <div v-for="day in dayGroups" :key="day.key" class="space-y-3">
        <div class="py-1.5 text-center">
          <span class="text-[11px] font-medium text-gray-500">{{ day.label }}</span>
        </div>

        <MessageCluster
          v-for="cluster in day.clusters"
          :key="cluster.key"
          :cluster="cluster"
          :show-sender-name="group"
          :show-status="cluster.key === lastOwnClusterKey"
        />
      </div>
    </div>

    <MessageComposer
      :key="activeConversationId ?? draft?.userId"
      :autofocus="Boolean(draft)"
      :placeholder="`Nhắn tin cho ${headerTitle}`"
      @send="sendMessage"
      @typing="notifyTyping"
    />
  </div>
</template>
