<script setup lang="ts">
import { computed, ref } from "vue";
import { MAX_GROUP_NAME_LENGTH, MIN_GROUP_MEMBERS } from "../constants/attachment";
import { useChatStore } from "../core/store/useChatStore";
import { useWidgetToast } from "../core/store/useWidgetToast";
import type { AppUser } from "../types/chat";
import { extractErrorMessage } from "../utils/error";
import PeoplePicker from "./PeoplePicker.vue";
import WidgetAvatar from "./WidgetAvatar.vue";
import WidgetIcon from "./WidgetIcon.vue";

const { createGroupConversation } = useChatStore();
const toast = useWidgetToast();

const name = ref("");
const selected = ref<AppUser[]>([]);
const nameError = ref("");
const isSaving = ref(false);

const selectedIds = computed(() => selected.value.map((person) => person.id));

const canSubmit = computed(
  () => Boolean(name.value.trim()) && selected.value.length >= MIN_GROUP_MEMBERS,
);

const displayNameOf = (person: AppUser) =>
  person.fullName || person.email || "Người dùng";

const toggle = (person: AppUser) => {
  selected.value = selected.value.some((u) => u.id === person.id)
    ? selected.value.filter((u) => u.id !== person.id)
    : [...selected.value, person];
};

const submit = async () => {
  const trimmed = name.value.trim();

  nameError.value = !trimmed
    ? "Tên nhóm không được để trống"
    : trimmed.length > MAX_GROUP_NAME_LENGTH
      ? `Tên nhóm tối đa ${MAX_GROUP_NAME_LENGTH} ký tự`
      : "";

  if (nameError.value || !canSubmit.value) return;

  isSaving.value = true;
  try {
    await createGroupConversation(trimmed, selectedIds.value);
    toast.success("Đã tạo nhóm thành công");
  } catch (err) {
    toast.error(extractErrorMessage(err));
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="shrink-0 px-3 pt-3">
      <input
        v-model="name"
        type="text"
        placeholder="Tên nhóm, ví dụ: Phòng Đào tạo"
        :maxlength="MAX_GROUP_NAME_LENGTH"
        class="w-full rounded-xl bg-gray-50 px-3.5 py-2 text-sm text-gray-900 outline-none ring-1 ring-gray-200 transition-colors placeholder:text-gray-500 focus:bg-white focus:ring-2 focus:ring-chat-accent"
        :class="nameError && 'ring-red-400 focus:ring-red-500'"
        @input="nameError = ''"
      />
      <p v-if="nameError" class="mt-1 px-1 text-[11px] font-medium text-red-600">
        {{ nameError }}
      </p>

      <div class="mt-2 flex items-center justify-between px-1">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Thành viên
        </span>
        <span
          class="text-[11px] font-medium"
          :class="
            selected.length >= MIN_GROUP_MEMBERS ? 'text-emerald-600' : 'text-gray-500'
          "
        >
          Đã chọn {{ selected.length }}/{{ MIN_GROUP_MEMBERS }} tối thiểu
        </span>
      </div>

      <ul v-if="selected.length" class="mt-2 flex flex-wrap gap-1.5">
        <li
          v-for="person in selected"
          :key="person.id"
          class="flex items-center gap-1.5 rounded-full bg-chat-accent/10 py-0.5 pl-0.5 pr-1.5"
        >
          <WidgetAvatar :name="displayNameOf(person)" size="xs" />
          <span class="max-w-24 truncate text-[11px] font-semibold text-chat-accent-strong">
            {{ displayNameOf(person) }}
          </span>
          <button
            type="button"
            class="inline-flex h-4 w-4 items-center justify-center rounded-full text-chat-accent-strong/70 transition-colors hover:bg-white hover:text-chat-accent-strong"
            :aria-label="`Bỏ ${displayNameOf(person)}`"
            @click="toggle(person)"
          >
            <WidgetIcon name="X" :size="11" />
          </button>
        </li>
      </ul>
    </div>

    <PeoplePicker :selected-ids="selectedIds" multiple @pick="toggle" />

    <div class="shrink-0 border-t border-gray-100 p-3">
      <button
        type="button"
        class="w-full rounded-full py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed"
        :class="
          canSubmit && !isSaving
            ? 'bg-chat-accent-strong text-white hover:brightness-110'
            : 'bg-gray-100 text-gray-500'
        "
        :disabled="!canSubmit || isSaving"
        @click="submit"
      >
        {{ isSaving ? "Đang tạo nhóm..." : "Tạo nhóm" }}
      </button>
    </div>
  </div>
</template>
