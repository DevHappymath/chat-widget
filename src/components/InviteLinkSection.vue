<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useChatStore } from "../core/store/useChatStore";
import { useWidgetConfirm } from "../core/store/useWidgetConfirm";
import { useWidgetToast } from "../core/store/useWidgetToast";
import { extractErrorMessage } from "../utils/error";
import WidgetIcon from "./WidgetIcon.vue";

const { activeConversation, isGroupAdmin, createInviteLink, revokeInviteLink } = useChatStore();

const { ask } = useWidgetConfirm();
const toast = useWidgetToast();

const isWorking = ref(false);
const isCopied = ref(false);
const isMenuOpen = ref(false);
const menuRef = ref<HTMLElement | null>(null);
let copiedTimer: ReturnType<typeof setTimeout> | undefined;

const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

// Widget nằm trên domain của site khác nên không tự ghép được liên kết; thiếu thì chia sẻ mã.
const shareText = computed(
  () => activeConversation.value?.inviteUrl || activeConversation.value?.inviteToken || null,
);

// Bỏ giao thức cho gọn trong khung hẹp, khi sao chép vẫn dùng liên kết đầy đủ.
const displayText = computed(() => shareText.value?.replace(/^https?:\/\//, "") ?? "");

const run = async (action: () => Promise<void>, successMessage: string) => {
  isWorking.value = true;
  try {
    await action();
    toast.success(successMessage);
  } catch (err) {
    toast.error(extractErrorMessage(err));
  } finally {
    isWorking.value = false;
  }
};

const onCreate = () => run(createInviteLink, "Đã bật liên kết tham gia nhóm");

const onRenew = async () => {
  isMenuOpen.value = false;
  const agreed = await ask({
    title: "Tạo liên kết mới",
    message: "Liên kết đang dùng sẽ không vào được nhóm nữa. Ai cần vào thì phải nhận liên kết mới.",
    confirmText: "Tạo liên kết mới",
  });
  if (agreed) await run(createInviteLink, "Đã tạo liên kết mới");
};

const onRevoke = async () => {
  isMenuOpen.value = false;
  const agreed = await ask({
    title: "Tắt liên kết",
    message: "Không ai vào được nhóm bằng liên kết nữa. Thành viên đang có trong nhóm không bị ảnh hưởng.",
    confirmText: "Tắt liên kết",
    danger: true,
  });
  if (agreed) await run(revokeInviteLink, "Đã tắt liên kết tham gia nhóm");
};

const onCopy = async () => {
  if (!shareText.value) return;

  try {
    await navigator.clipboard.writeText(shareText.value);
  } catch {
    toast.error("Trình duyệt chưa cho sao chép, hãy chọn liên kết và sao chép tay");
    return;
  }

  isCopied.value = true;
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => (isCopied.value = false), 1800);
};

const onShare = async () => {
  const conversation = activeConversation.value;
  if (!conversation?.inviteUrl) return;

  try {
    await navigator.share({
      title: conversation.name || "Nhóm trò chuyện",
      text: `Tham gia nhóm "${conversation.name}"`,
      url: conversation.inviteUrl,
    });
  } catch {
    // Người dùng tự đóng bảng chia sẻ thì không cần báo gì.
  }
};

const onOutsidePointer = (event: PointerEvent) => {
  if (!menuRef.value?.contains(event.target as Node)) isMenuOpen.value = false;
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape") isMenuOpen.value = false;
};

// Chỉ nghe sự kiện toàn trang lúc menu đang mở, vì widget nằm chung trang với site chủ.
watch(isMenuOpen, (open) => {
  if (open) {
    document.addEventListener("pointerdown", onOutsidePointer);
    document.addEventListener("keydown", onKeydown);
  } else {
    document.removeEventListener("pointerdown", onOutsidePointer);
    document.removeEventListener("keydown", onKeydown);
  }
});

onBeforeUnmount(() => {
  clearTimeout(copiedTimer);
  isMenuOpen.value = false;
  document.removeEventListener("pointerdown", onOutsidePointer);
  document.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <section
    v-if="shareText || isGroupAdmin"
    class="border-t border-gray-100 px-4 py-4"
    aria-label="Liên kết tham gia nhóm"
  >
    <div class="mb-2.5 flex items-center justify-between gap-2">
      <p class="text-xs font-medium text-gray-500">Liên kết tham gia nhóm</p>

      <div v-if="shareText" class="-my-1.5 -mr-1.5 flex items-center gap-0.5">
        <span
          class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Đang bật
        </span>

        <div v-if="isGroupAdmin" ref="menuRef" class="relative">
          <button
            type="button"
            class="inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors"
            :class="
              isMenuOpen
                ? 'bg-chat-accent/10 text-chat-accent-strong'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
            "
            aria-haspopup="menu"
            :aria-expanded="isMenuOpen"
            aria-label="Tuỳ chọn liên kết"
            @click="isMenuOpen = !isMenuOpen"
          >
            <WidgetIcon name="MoreHorizontal" :size="16" />
          </button>

          <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="scale-95 opacity-0"
            leave-active-class="transition duration-100 ease-in"
            leave-to-class="scale-95 opacity-0"
          >
            <div
              v-if="isMenuOpen"
              role="menu"
              class="absolute right-0 top-full z-10 mt-1 w-max min-w-44 origin-top-right rounded-xl bg-white py-1 shadow-lg ring-1 ring-gray-200"
            >
              <button
                type="button"
                role="menuitem"
                class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-chat-accent/5 disabled:opacity-50"
                :disabled="isWorking"
                @click="onRenew"
              >
                <WidgetIcon name="RefreshCw" :size="14" class="text-gray-500" />
                Tạo liên kết mới
              </button>
              <button
                type="button"
                role="menuitem"
                class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                :disabled="isWorking"
                @click="onRevoke"
              >
                <WidgetIcon name="Link2Off" :size="14" class="text-red-500" />
                Tắt liên kết
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <template v-if="shareText">
      <div class="flex items-center gap-2.5 rounded-2xl bg-white py-2 pl-2.5 pr-2 ring-1 ring-gray-200">
        <span
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-chat-accent/10 text-chat-accent-strong"
        >
          <WidgetIcon name="Link" :size="15" />
        </span>

        <button type="button" class="group min-w-0 flex-1 text-left" :title="shareText" @click="onCopy">
          <span
            class="block truncate font-mono text-xs text-gray-800 transition-colors group-hover:text-chat-accent-strong"
          >
            {{ displayText }}
          </span>
          <span
            class="block text-[11px] transition-colors"
            :class="isCopied ? 'text-emerald-600' : 'text-gray-500'"
            aria-live="polite"
          >
            {{ isCopied ? "Đã sao chép vào bộ nhớ tạm" : "Bấm để sao chép" }}
          </span>
        </button>

        <button
          type="button"
          class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-200 active:scale-90"
          :class="
            isCopied
              ? 'bg-emerald-50 text-emerald-600'
              : 'text-gray-500 hover:bg-chat-accent/10 hover:text-chat-accent-strong'
          "
          :title="isCopied ? 'Đã sao chép' : 'Sao chép liên kết'"
          aria-label="Sao chép liên kết"
          @click="onCopy"
        >
          <WidgetIcon :name="isCopied ? 'Check' : 'Copy'" :size="14" />
        </button>
      </div>

      <button
        v-if="canShare && activeConversation?.inviteUrl"
        type="button"
        class="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-full bg-chat-accent-strong py-2 text-xs font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
        @click="onShare"
      >
        <WidgetIcon name="Share2" :size="14" />
        Chia sẻ liên kết
      </button>

      <p class="mt-2.5 flex gap-1.5 text-[11px] leading-relaxed text-gray-600">
        <WidgetIcon name="Info" :size="13" class="mt-px text-gray-400" />
        Ai có liên kết đều tự vào được nhóm. Học sinh chỉ vào được khi do quản trị nhóm phụ trách.
      </p>
    </template>

    <div
      v-else
      class="flex flex-col items-center rounded-2xl border border-dashed border-gray-200 px-4 py-4 text-center"
    >
      <span
        class="flex h-9 w-9 items-center justify-center rounded-2xl bg-chat-accent/10 text-chat-accent-strong"
      >
        <WidgetIcon name="Link" :size="16" />
      </span>
      <p class="mt-2.5 text-xs font-semibold text-gray-800">Mời bằng một liên kết</p>
      <p class="mt-1 text-[11px] leading-relaxed text-gray-600">
        Gửi liên kết qua Zalo, Messenger hay email, người nhận dán vào là tham gia nhóm.
      </p>
      <button
        type="button"
        class="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-chat-accent-strong py-2 text-xs font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        :disabled="isWorking"
        @click="onCreate"
      >
        <WidgetIcon :name="isWorking ? 'Loader2' : 'Link'" :size="14" :class="isWorking && 'animate-spin'" />
        {{ isWorking ? "Đang bật..." : "Bật liên kết" }}
      </button>
    </div>
  </section>
</template>
