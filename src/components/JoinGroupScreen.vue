<script setup lang="ts">
import { ref } from "vue";
import { conversationApi } from "../core/services";
import { useChatStore } from "../core/store/useChatStore";
import { useWidgetToast } from "../core/store/useWidgetToast";
import type { GroupInvitePreview } from "../types/chat";
import { extractErrorMessage } from "../utils/error";
import WidgetAvatar from "./WidgetAvatar.vue";
import WidgetIcon from "./WidgetIcon.vue";

const { joinByInvite, selectConversation } = useChatStore();
const toast = useWidgetToast();

const input = ref("");
const token = ref("");
const preview = ref<GroupInvitePreview | null>(null);
const error = ref("");
const isChecking = ref(false);
const isJoining = ref(false);

/** Nhận cả liên kết đầy đủ (…/join/<mã>) lẫn mã trần, vì nơi không có trang chat chỉ chia sẻ được mã. */
const extractToken = (value: string) => {
  const trimmed = value.trim();
  const match = trimmed.match(/\/join\/([^/?#\s]+)/);

  return match?.[1] ? decodeURIComponent(match[1]) : trimmed;
};

const check = async () => {
  token.value = extractToken(input.value);
  preview.value = null;
  error.value = "";
  if (!token.value) return;

  isChecking.value = true;
  try {
    const res = await conversationApi.getInvitePreview(token.value);
    preview.value = res.data.data;
  } catch (err) {
    error.value = extractErrorMessage(err);
  } finally {
    isChecking.value = false;
  }
};

const join = async () => {
  isJoining.value = true;
  try {
    const conversation = await joinByInvite(token.value);
    toast.success(`Đã tham gia nhóm "${conversation.name}"`);
  } catch (err) {
    toast.error(extractErrorMessage(err));
  } finally {
    isJoining.value = false;
  }
};
</script>

<template>
  <div class="gdtd-chat-scroll min-h-0 flex-1 overflow-y-auto p-4">
    <form class="flex gap-2" @submit.prevent="check">
      <input
        v-model="input"
        type="text"
        placeholder="Dán liên kết hoặc mã mời"
        class="min-w-0 flex-1 rounded-full bg-gray-50 px-3.5 py-2 text-sm text-gray-900 outline-none ring-1 ring-gray-200 transition-colors focus:bg-white focus:ring-2 focus:ring-chat-accent"
        @input="error = ''"
      />
      <button
        type="submit"
        class="shrink-0 rounded-full bg-chat-accent-strong px-4 text-xs font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-60"
        :disabled="!input.trim() || isChecking"
      >
        {{ isChecking ? "Đang xem..." : "Xem nhóm" }}
      </button>
    </form>

    <p v-if="error" class="mt-3 flex items-start gap-2 text-xs text-red-600">
      <WidgetIcon name="Link2Off" :size="14" class="mt-px" />
      {{ error }}
    </p>

    <div
      v-if="preview"
      class="mt-4 flex flex-col items-center gap-1 rounded-2xl px-4 py-5 text-center ring-1 ring-gray-100"
    >
      <WidgetAvatar
        :name="preview.name || 'Nhóm'"
        :src="preview.avatarUrl"
        variant="group"
        size="lg"
      />
      <p class="mt-2 text-sm font-bold text-gray-900">{{ preview.name || "Nhóm trò chuyện" }}</p>
      <p class="text-xs text-gray-600">{{ preview.memberCount }} thành viên</p>

      <button
        v-if="preview.isMember"
        type="button"
        class="mt-3 w-full rounded-full bg-chat-accent-strong py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110"
        @click="selectConversation(preview.conversationId)"
      >
        Bạn đã ở trong nhóm - mở nhóm
      </button>

      <button
        v-else-if="preview.canJoin"
        type="button"
        class="mt-3 w-full rounded-full bg-chat-accent-strong py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-60"
        :disabled="isJoining"
        @click="join"
      >
        {{ isJoining ? "Đang tham gia..." : "Tham gia nhóm" }}
      </button>

      <p v-else class="mt-3 w-full rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
        {{ preview.reason }}
      </p>
    </div>
  </div>
</template>
