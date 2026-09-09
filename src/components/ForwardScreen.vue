<script setup lang="ts">
import { computed, ref } from "vue";
import { MAX_FORWARD_TARGETS } from "../constants/chat";
import { useChatStore } from "../core/store/useChatStore";
import { useWidgetToast } from "../core/store/useWidgetToast";
import type { ChatConversation } from "../types/chat";
import { messagePreview, normalizeName } from "../utils/chat";
import { extractErrorMessage } from "../utils/error";
import WidgetAvatar from "./WidgetAvatar.vue";
import WidgetIcon from "./WidgetIcon.vue";

const {
  conversations,
  forwardingMessage,
  isGroup,
  isOnline,
  titleOf,
  partnerOf,
  forwardMessage,
  goBack,
} = useChatStore();

const toast = useWidgetToast();

const search = ref("");
const selectedIds = ref<string[]>([]);
const isSending = ref(false);

// Lọc tại chỗ trên danh sách đã nạp: màn này chỉ chọn trong vài chục hội thoại gần đây.
const matches = computed(() => {
  const needle = normalizeName(search.value.trim());
  if (!needle) return conversations.value;

  return conversations.value.filter((c) => normalizeName(titleOf(c)).includes(needle));
});

const isSelected = (id: string) => selectedIds.value.includes(id);

const isFull = computed(() => selectedIds.value.length >= MAX_FORWARD_TARGETS);

const toggle = (conversation: ChatConversation) => {
  if (isSelected(conversation.id)) {
    selectedIds.value = selectedIds.value.filter((id) => id !== conversation.id);
    return;
  }

  if (isFull.value) {
    toast.info(`Mỗi lần chỉ chuyển tiếp tới tối đa ${MAX_FORWARD_TARGETS} hội thoại`);
    return;
  }

  selectedIds.value = [...selectedIds.value, conversation.id];
};

const submit = async () => {
  if (!selectedIds.value.length) return;

  isSending.value = true;
  try {
    const sent = await forwardMessage(selectedIds.value);
    toast.success(`Đã chuyển tiếp tới ${sent} hội thoại`);
    goBack();
  } catch (err) {
    toast.error(extractErrorMessage(err));
  } finally {
    isSending.value = false;
  }
};
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="shrink-0 space-y-2 px-3 pb-2 pt-3">
      <div
        v-if="forwardingMessage"
        class="rounded-xl bg-gray-50 px-3 py-2 ring-1 ring-gray-200"
      >
        <p class="text-[11px] font-semibold text-gray-600">
          {{ forwardingMessage.senderName || "Người dùng" }}
        </p>
        <p class="mt-0.5 line-clamp-2 text-xs text-gray-700">
          {{ messagePreview(forwardingMessage) }}
        </p>
      </div>

      <div class="relative">
        <WidgetIcon
          name="Search"
          :size="16"
          class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"
        />
        <input
          v-model="search"
          type="search"
          placeholder="Tìm hội thoại"
          class="w-full rounded-full bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-900 outline-none ring-1 ring-gray-200 transition-colors placeholder:text-gray-500 focus:bg-white focus:ring-2 focus:ring-chat-accent"
        />
      </div>
    </div>

    <div class="gdtd-chat-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
      <ul class="space-y-0.5">
        <li v-for="conversation in matches" :key="conversation.id">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors"
            :class="
              isSelected(conversation.id)
                ? 'bg-chat-accent/10'
                : isFull
                  ? 'opacity-60 hover:bg-gray-50'
                  : 'hover:bg-gray-100'
            "
            @click="toggle(conversation)"
          >
            <WidgetAvatar
              :name="titleOf(conversation)"
              :variant="isGroup(conversation) ? 'group' : 'user'"
              :src="conversation.avatarUrl"
              :is-online="isOnline(partnerOf(conversation)?.userId)"
              :show-presence="!isGroup(conversation)"
              size="sm"
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold text-gray-800">
                {{ titleOf(conversation) }}
              </span>
              <span class="block truncate text-xs text-gray-600">
                {{ isGroup(conversation) ? "Nhóm" : "Hội thoại riêng" }}
              </span>
            </span>

            <span
              class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 transition-colors"
              :class="
                isSelected(conversation.id)
                  ? 'bg-chat-accent-strong text-white ring-chat-accent-strong'
                  : 'text-transparent ring-gray-300'
              "
            >
              <WidgetIcon name="Check" :size="12" />
            </span>
          </button>
        </li>

        <li v-if="!matches.length" class="px-2 py-12 text-center">
          <p class="text-sm font-semibold text-gray-800">Không có hội thoại nào khớp</p>
          <p class="mt-1 text-xs text-gray-600">
            Chỉ chọn được trong các hội thoại đang có ở danh sách.
          </p>
        </li>
      </ul>
    </div>

    <div class="shrink-0 border-t border-gray-100 p-3">
      <p class="mb-2 px-1 text-[11px] text-gray-600">
        Đã chọn {{ selectedIds.length }}/{{ MAX_FORWARD_TARGETS }}. Tệp đính kèm được giữ
        nguyên.
      </p>
      <button
        type="button"
        class="w-full rounded-full py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed"
        :class="
          selectedIds.length && !isSending
            ? 'bg-chat-accent-strong text-white hover:brightness-110'
            : 'bg-gray-100 text-gray-500'
        "
        :disabled="!selectedIds.length || isSending"
        @click="submit"
      >
        {{ isSending ? "Đang chuyển tiếp..." : "Chuyển tiếp" }}
      </button>
    </div>
  </div>
</template>
