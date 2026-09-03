<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  ALLOWED_IMAGE_EXTENSIONS,
  IMAGE_ACCEPT,
  MAX_GROUP_NAME_LENGTH,
} from "../constants/attachment";
import { fileApi } from "../core/services";
import { useChatStore } from "../core/store/useChatStore";
import { useWidgetConfirm } from "../core/store/useWidgetConfirm";
import { useWidgetToast } from "../core/store/useWidgetToast";
import { ParticipantRole, type ChatParticipant } from "../types/chat";
import { presenceLabel } from "../utils/chat";
import { extractErrorMessage } from "../utils/error";
import { formatBytes } from "../utils/format";
import WidgetAvatar from "./WidgetAvatar.vue";
import WidgetIcon from "./WidgetIcon.vue";

const {
  view,
  currentUserId,
  activeConversation,
  activeMessages,
  attachmentRule,
  isGroup,
  isOnline,
  partnerOf,
  titleOf,
  membersOf,
  isGroupAdmin,
  updateGroupInfo,
  removeParticipant,
  leaveConversation,
  backToList,
} = useChatStore();

const { ask } = useWidgetConfirm();
const toast = useWidgetToast();

const isEditing = ref(false);
const isSaving = ref(false);
const isUploading = ref(false);
const isLeaving = ref(false);
const name = ref("");
const avatarUrl = ref<string | null>(null);
const nameError = ref("");
const fileInput = ref<HTMLInputElement | null>(null);

const group = computed(() =>
  activeConversation.value ? isGroup(activeConversation.value) : false,
);

const partner = computed(() =>
  activeConversation.value ? partnerOf(activeConversation.value) : undefined,
);

const members = computed(() =>
  activeConversation.value ? membersOf(activeConversation.value) : [],
);

const displayNameOf = (member: ChatParticipant) =>
  member.fullName || member.email || "Người dùng";

/** Quản trị xoá được người khác nhưng không tự xoá mình; muốn ra thì dùng nút rời nhóm. */
const canRemove = (member: ChatParticipant) =>
  isGroupAdmin.value && member.userId.toLowerCase() !== currentUserId.value;

const startEdit = () => {
  if (!activeConversation.value) return;

  name.value = activeConversation.value.name ?? "";
  avatarUrl.value = activeConversation.value.avatarUrl ?? null;
  nameError.value = "";
  isEditing.value = true;
};

// Đổi sang hội thoại khác giữa chừng thì form đang sửa không còn đúng đối tượng nữa.
watch(() => activeConversation.value?.id, () => (isEditing.value = false));

const onPickAvatar = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(extension)) {
    toast.error("Ảnh nhóm chỉ nhận jpg, png, gif hoặc webp");
    return;
  }
  if (file.size > attachmentRule.value.maxSizeBytes) {
    toast.error(`Ảnh vượt quá ${formatBytes(attachmentRule.value.maxSizeBytes, 0)}`);
    return;
  }

  isUploading.value = true;
  try {
    const res = await fileApi.upload(file);
    avatarUrl.value = res.data.data.fileUrl;
  } catch (err) {
    toast.error(extractErrorMessage(err));
  } finally {
    isUploading.value = false;
  }
};

const saveGroupInfo = async () => {
  const trimmed = name.value.trim();

  nameError.value = !trimmed
    ? "Tên nhóm không được để trống"
    : trimmed.length > MAX_GROUP_NAME_LENGTH
      ? `Tên nhóm tối đa ${MAX_GROUP_NAME_LENGTH} ký tự`
      : "";

  if (nameError.value) return;

  isSaving.value = true;
  try {
    await updateGroupInfo({ name: trimmed, avatarUrl: avatarUrl.value });
    toast.success("Đã cập nhật thông tin nhóm");
    isEditing.value = false;
  } catch (err) {
    toast.error(extractErrorMessage(err));
  } finally {
    isSaving.value = false;
  }
};

const onRemove = async (member: ChatParticipant) => {
  const agreed = await ask({
    title: "Xoá thành viên",
    message: `Xoá ${displayNameOf(member)} khỏi nhóm? Họ sẽ không đọc được tin nhắn mới nữa.`,
    confirmText: "Xoá",
    danger: true,
  });
  if (!agreed) return;

  try {
    await removeParticipant(member.userId);
    toast.success(`Đã xoá ${displayNameOf(member)} khỏi nhóm`);
  } catch (err) {
    toast.error(extractErrorMessage(err));
  }
};

const onLeave = async () => {
  const conversation = activeConversation.value;
  if (!conversation) return;

  const agreed = await ask({
    title: "Rời nhóm",
    message: `Rời khỏi "${titleOf(conversation)}"? Bạn sẽ không nhận được tin nhắn mới của nhóm.`,
    confirmText: "Rời nhóm",
    danger: true,
  });
  if (!agreed) return;

  isLeaving.value = true;
  try {
    await leaveConversation(conversation.id);
    toast.success("Đã rời nhóm");
    backToList();
  } catch (err) {
    toast.error(extractErrorMessage(err));
  } finally {
    isLeaving.value = false;
  }
};

const sharedFiles = computed(() =>
  activeMessages.value
    .filter((message) => !message.isDeleted)
    .flatMap((message) => message.attachments),
);
</script>

<template>
  <div
    v-if="activeConversation"
    class="gdtd-chat-scroll min-h-0 flex-1 overflow-y-auto"
  >
    <div class="flex flex-col items-center gap-2 px-4 py-5 text-center">
      <WidgetAvatar
        :name="titleOf(activeConversation)"
        :variant="group ? 'group' : 'user'"
        :src="isEditing ? avatarUrl : activeConversation.avatarUrl"
        :is-online="isOnline(partner?.userId)"
        :show-presence="!group"
        size="lg"
      />

      <template v-if="isEditing">
        <input
          ref="fileInput"
          type="file"
          :accept="IMAGE_ACCEPT"
          class="hidden"
          @change="onPickAvatar"
        />
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-chat-accent-strong transition-colors hover:bg-chat-accent/10 disabled:opacity-60"
          :disabled="isUploading"
          @click="fileInput?.click()"
        >
          <WidgetIcon :name="isUploading ? 'Loader2' : 'ImagePlus'" :size="14" :class="isUploading && 'animate-spin'" />
          {{ isUploading ? "Đang tải ảnh..." : "Đổi ảnh nhóm" }}
        </button>

        <div class="w-full px-1">
          <input
            v-model="name"
            type="text"
            placeholder="Tên nhóm"
            :maxlength="MAX_GROUP_NAME_LENGTH"
            class="w-full rounded-xl bg-gray-50 px-3.5 py-2 text-center text-sm font-semibold text-gray-900 outline-none ring-1 ring-gray-200 transition-colors focus:bg-white focus:ring-2 focus:ring-chat-accent"
            :class="nameError && 'ring-red-400 focus:ring-red-500'"
            @input="nameError = ''"
          />
          <p v-if="nameError" class="mt-1 text-[11px] font-medium text-red-600">
            {{ nameError }}
          </p>
          <!-- Backend bỏ qua avatarUrl để trống nên chỉ thay được ảnh, không gỡ hẳn. -->
          <p v-else class="mt-1 text-[11px] text-gray-500">
            Ảnh đã đặt chỉ có thể thay bằng ảnh khác.
          </p>

          <div class="mt-2 flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-full py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100"
              @click="isEditing = false"
            >
              Huỷ
            </button>
            <button
              type="button"
              class="flex-1 rounded-full bg-chat-accent-strong py-2 text-xs font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-60"
              :disabled="isSaving || isUploading"
              @click="saveGroupInfo"
            >
              {{ isSaving ? "Đang lưu..." : "Lưu" }}
            </button>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="flex items-center gap-1">
          <p class="text-sm font-bold text-gray-900">{{ titleOf(activeConversation) }}</p>
          <button
            v-if="isGroupAdmin"
            type="button"
            class="inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-chat-accent-strong"
            aria-label="Sửa thông tin nhóm"
            @click="startEdit"
          >
            <WidgetIcon name="Pencil" :size="13" />
          </button>
        </div>
        <p class="text-xs text-gray-600">
          {{
            group
              ? `${members.length} thành viên`
              : presenceLabel(isOnline(partner?.userId))
          }}
        </p>
      </template>
    </div>

    <div v-if="!group && partner" class="border-t border-gray-100 px-4 py-4">
      <p class="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">
        Thông tin liên hệ
      </p>
      <dl class="space-y-2 text-sm">
        <div class="flex items-start gap-2.5">
          <WidgetIcon name="Mail" :size="15" class="mt-0.5 text-gray-500" />
          <dd class="min-w-0 flex-1 truncate text-gray-700">
            {{ partner.email || "Chưa có email" }}
          </dd>
        </div>
        <div class="flex items-start gap-2.5">
          <WidgetIcon name="IdCard" :size="15" class="mt-0.5 text-gray-500" />
          <dd class="min-w-0 flex-1 text-gray-700">
            {{ partner.employeeCode || "Chưa có mã nhân viên" }}
          </dd>
        </div>
      </dl>
    </div>

    <div v-else-if="group" class="border-t border-gray-100 px-4 py-4">
      <div class="mb-2 flex items-center justify-between gap-2">
        <p class="text-[11px] font-bold uppercase tracking-wide text-gray-500">
          Thành viên
        </p>
        <button
          v-if="isGroupAdmin"
          type="button"
          class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-chat-accent-strong transition-colors hover:bg-chat-accent/10"
          @click="view = 'add-members'"
        >
          <WidgetIcon name="UserPlus" :size="14" />
          Thêm
        </button>
      </div>

      <ul class="space-y-0.5">
        <li
          v-for="member in members"
          :key="member.userId"
          class="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 hover:bg-gray-50"
        >
          <WidgetAvatar
            :name="displayNameOf(member)"
            size="xs"
            :is-online="isOnline(member.userId)"
            show-presence
          />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-xs font-semibold text-gray-800">
              {{ displayNameOf(member) }}
            </span>
            <span class="block truncate text-[11px] text-gray-600">
              {{ member.employeeCode || member.email }}
            </span>
          </span>

          <span
            v-if="member.role === ParticipantRole.Admin"
            class="shrink-0 rounded-full bg-chat-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-chat-accent-strong"
          >
            Quản trị
          </span>

          <button
            v-if="canRemove(member)"
            type="button"
            class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
            :aria-label="`Xoá ${displayNameOf(member)} khỏi nhóm`"
            @click="onRemove(member)"
          >
            <WidgetIcon name="UserMinus" :size="14" />
          </button>
        </li>
      </ul>
    </div>

    <div class="border-t border-gray-100 px-4 py-4">
      <p class="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-500">
        Tệp đã trao đổi
      </p>

      <ul v-if="sharedFiles.length" class="space-y-0.5">
        <li v-for="file in sharedFiles" :key="file.id">
          <a
            :href="file.fileUrl"
            target="_blank"
            rel="noopener"
            class="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-gray-50"
          >
            <span
              class="flex h-8 w-8 items-center justify-center rounded-lg bg-chat-accent/10 text-chat-accent-strong"
            >
              <WidgetIcon
                :name="file.contentType.startsWith('image/') ? 'Image' : 'FileText'"
                :size="15"
              />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-xs font-medium text-gray-800">
                {{ file.fileName }}
              </span>
              <span class="block text-[11px] text-gray-600">
                {{ formatBytes(file.sizeBytes, 0) }}
              </span>
            </span>
          </a>
        </li>
      </ul>

      <p v-else class="text-xs text-gray-600">
        Hội thoại này chưa có tệp nào được gửi.
      </p>
    </div>

    <div v-if="group" class="border-t border-gray-100 px-4 py-4">
      <button
        type="button"
        class="flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold text-red-600 ring-1 ring-red-200 transition-colors hover:bg-red-50 disabled:opacity-60"
        :disabled="isLeaving"
        @click="onLeave"
      >
        <WidgetIcon name="LogOut" :size="16" />
        {{ isLeaving ? "Đang rời nhóm..." : "Rời nhóm" }}
      </button>
    </div>
  </div>
</template>
