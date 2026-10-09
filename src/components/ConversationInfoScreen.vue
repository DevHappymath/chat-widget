<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
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
import InviteLinkSection from "./InviteLinkSection.vue";
import WidgetIcon from "./WidgetIcon.vue";

const {
  view,
  activeConversation,
  attachmentRule,
  isGroup,
  statusOf,
  statusMessageOf,
  partnerOf,
  titleOf,
  membersOf,
  isGroupLeader,
  canManageGroup,
  canRemoveMember,
  canChangeRoleOf,
  updateGroupInfo,
  removeParticipant,
  updateParticipantRole,
  transferLeadership,
  leaveConversation,
  dissolveConversation,
  backToList,
} = useChatStore();

const { ask } = useWidgetConfirm();
const toast = useWidgetToast();

const isEditing = ref(false);
const isSaving = ref(false);
const isUploading = ref(false);
const isLeaving = ref(false);
const isDissolving = ref(false);
const openMenuUserId = ref<string | null>(null);
const busyMemberId = ref<string | null>(null);
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

const partnerStatusMessage = computed(() => statusMessageOf(partner.value?.userId));

const members = computed(() =>
  activeConversation.value ? membersOf(activeConversation.value) : [],
);

const displayNameOf = (member: ChatParticipant) =>
  member.fullName || member.email || "Người dùng";

const roleLabelOf = (member: ChatParticipant) =>
  member.role === ParticipantRole.Admin
    ? "Trưởng nhóm"
    : member.role === ParticipantRole.Deputy
      ? "Phó nhóm"
      : "";

const isDeputy = (member: ChatParticipant) => member.role === ParticipantRole.Deputy;

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

const onToggleDeputy = async (member: ChatParticipant) => {
  openMenuUserId.value = null;
  const demote = isDeputy(member);

  busyMemberId.value = member.userId;
  try {
    await updateParticipantRole(
      member.userId,
      demote ? ParticipantRole.Member : ParticipantRole.Deputy,
    );
    toast.success(
      demote
        ? `${displayNameOf(member)} không còn là phó nhóm`
        : `Đã bổ nhiệm ${displayNameOf(member)} làm phó nhóm`,
    );
  } catch (err) {
    toast.error(extractErrorMessage(err));
  } finally {
    busyMemberId.value = null;
  }
};

const onTransferLeadership = async (member: ChatParticipant) => {
  openMenuUserId.value = null;

  // Chuyển xong thì mình chỉ còn là phó nhóm, không tự lấy lại chức được nên phải hỏi trước.
  const agreed = await ask({
    title: "Chuyển chức trưởng nhóm",
    message: `Chuyển chức trưởng nhóm cho ${displayNameOf(member)}? Bạn sẽ thành phó nhóm và không còn bổ nhiệm phó nhóm hay giải tán nhóm được nữa.`,
    confirmText: "Chuyển chức",
    danger: true,
  });
  if (!agreed) return;

  busyMemberId.value = member.userId;
  try {
    await transferLeadership(member.userId);
    toast.success(`Đã chuyển chức trưởng nhóm cho ${displayNameOf(member)}`);
  } catch (err) {
    toast.error(extractErrorMessage(err));
  } finally {
    busyMemberId.value = null;
  }
};

const onRemove = async (member: ChatParticipant) => {
  openMenuUserId.value = null;
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

  // Bám đúng thứ tự backend chọn người thay khi trưởng nhóm rời đi.
  const handover =
    isGroupLeader.value && members.value.length > 1
      ? " Phó nhóm vào nhóm sớm nhất sẽ lên làm trưởng nhóm, chưa có phó nhóm thì là thành viên vào sớm nhất."
      : "";

  const agreed = await ask({
    title: "Rời nhóm",
    message: `Rời khỏi "${titleOf(conversation)}"? Bạn sẽ không nhận được tin nhắn mới của nhóm.${handover}`,
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

const onDissolve = async () => {
  const conversation = activeConversation.value;
  if (!conversation) return;

  const agreed = await ask({
    title: "Giải tán nhóm",
    message: `Giải tán "${titleOf(conversation)}"? Mọi thành viên sẽ rời nhóm và nhóm biến mất khỏi danh sách của tất cả. Không khôi phục lại được.`,
    confirmText: "Giải tán",
    danger: true,
  });
  if (!agreed) return;

  isDissolving.value = true;
  try {
    await dissolveConversation(conversation.id);
    toast.success("Đã giải tán nhóm");
    backToList();
  } catch (err) {
    toast.error(extractErrorMessage(err));
  } finally {
    isDissolving.value = false;
  }
};

const onOutsidePointer = (event: PointerEvent) => {
  const menu = (event.target as Element | null)?.closest?.("[data-member-menu]");
  if (menu?.getAttribute("data-member-menu") !== openMenuUserId.value) openMenuUserId.value = null;
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape") openMenuUserId.value = null;
};

// Chỉ nghe sự kiện toàn trang lúc menu đang mở, vì widget nằm chung trang với site chủ.
watch(
  () => openMenuUserId.value !== null,
  (open) => {
    if (open) {
      document.addEventListener("pointerdown", onOutsidePointer);
      document.addEventListener("keydown", onKeydown);
    } else {
      document.removeEventListener("pointerdown", onOutsidePointer);
      document.removeEventListener("keydown", onKeydown);
    }
  },
);

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onOutsidePointer);
  document.removeEventListener("keydown", onKeydown);
});

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
        :status="statusOf(partner?.userId)"
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
            v-if="canManageGroup"
            type="button"
            class="inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-chat-accent/10 hover:text-chat-accent-strong"
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
              : presenceLabel(statusOf(partner?.userId))
          }}
        </p>
        <p
          v-if="!group && partnerStatusMessage"
          class="mt-1 max-w-full break-words rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-700"
        >
          {{ partnerStatusMessage }}
        </p>
      </template>
    </div>

    <div v-if="!group && partner" class="border-t border-gray-100 px-4 py-4">
      <p class="mb-2.5 text-xs font-medium text-gray-500">Thông tin liên hệ</p>
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
        <p class="text-xs font-medium text-gray-500">Thành viên</p>
        <button
          v-if="canManageGroup"
          type="button"
          class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-chat-accent-strong transition-colors hover:bg-chat-accent/10"
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
            :status="statusOf(member.userId)"
            show-presence
          />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-xs font-semibold text-gray-800">
              {{ displayNameOf(member) }}
            </span>
            <span class="block truncate text-[11px] text-gray-600">
              {{ member.employeeCode || member.email }}
              <template v-if="roleLabelOf(member)">
                · {{ roleLabelOf(member) }}
              </template>
            </span>
          </span>

          <div
            v-if="canChangeRoleOf(member)"
            :data-member-menu="member.userId"
            class="relative shrink-0"
          >
            <button
              type="button"
              class="inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors disabled:opacity-60"
              :class="
                openMenuUserId === member.userId
                  ? 'bg-chat-accent/10 text-chat-accent-strong'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
              "
              aria-haspopup="menu"
              :aria-expanded="openMenuUserId === member.userId"
              :aria-label="`Tuỳ chọn cho ${displayNameOf(member)}`"
              :disabled="busyMemberId === member.userId"
              @click="openMenuUserId = openMenuUserId === member.userId ? null : member.userId"
            >
              <WidgetIcon
                :name="busyMemberId === member.userId ? 'Loader2' : 'MoreHorizontal'"
                :size="14"
                :class="busyMemberId === member.userId && 'animate-spin'"
              />
            </button>

            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="scale-95 opacity-0"
              leave-active-class="transition duration-100 ease-in"
              leave-to-class="scale-95 opacity-0"
            >
              <div
                v-if="openMenuUserId === member.userId"
                role="menu"
                class="absolute right-0 top-full z-10 mt-1 w-max min-w-44 origin-top-right rounded-xl bg-white py-1 shadow-lg ring-1 ring-gray-200"
              >
                <button
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-chat-accent/5"
                  @click="onToggleDeputy(member)"
                >
                  <WidgetIcon
                    :name="isDeputy(member) ? 'ShieldOff' : 'ShieldCheck'"
                    :size="14"
                    class="text-gray-500"
                  />
                  {{ isDeputy(member) ? "Bỏ chức phó nhóm" : "Bổ nhiệm phó nhóm" }}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-chat-accent/5"
                  @click="onTransferLeadership(member)"
                >
                  <WidgetIcon name="Crown" :size="14" class="text-gray-500" />
                  Chuyển chức trưởng nhóm
                </button>
                <button
                  v-if="canRemoveMember(member)"
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                  @click="onRemove(member)"
                >
                  <WidgetIcon name="UserMinus" :size="14" class="text-red-500" />
                  Xoá khỏi nhóm
                </button>
              </div>
            </Transition>
          </div>

          <button
            v-else-if="canRemoveMember(member)"
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

    <InviteLinkSection v-if="group" />

    <div class="border-t border-gray-100 px-4 py-4">
      <button
        type="button"
        class="flex w-full items-center gap-2.5 rounded-xl px-1.5 py-2 text-left transition-colors hover:bg-gray-50"
        @click="view = 'media'"
      >
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-chat-accent/10 text-chat-accent-strong"
        >
          <WidgetIcon name="Images" :size="16" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-xs font-semibold text-gray-800">Ảnh và tệp</span>
          <span class="block text-[11px] text-gray-600">
            Toàn bộ tệp đã gửi trong hội thoại
          </span>
        </span>
        <WidgetIcon name="ChevronRight" :size="16" class="shrink-0 text-gray-400" />
      </button>
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

      <button
        v-if="isGroupLeader"
        type="button"
        class="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-red-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
        :disabled="isDissolving"
        @click="onDissolve"
      >
        <WidgetIcon :name="isDissolving ? 'Loader2' : 'Trash2'" :size="16" :class="isDissolving && 'animate-spin'" />
        {{ isDissolving ? "Đang giải tán..." : "Giải tán nhóm" }}
      </button>
    </div>
  </div>
</template>
