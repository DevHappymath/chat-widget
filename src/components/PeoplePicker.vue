<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { userApi } from "../core/services";
import { useChatStore } from "../core/store/useChatStore";
import { useWidgetToast } from "../core/store/useWidgetToast";
import type { AppUser } from "../types/chat";
import { debounce } from "../utils/debounce";
import { extractErrorMessage } from "../utils/error";
import WidgetAvatar from "./WidgetAvatar.vue";
import WidgetIcon from "./WidgetIcon.vue";

const props = withDefaults(
  defineProps<{
    /** Người đã chọn, tô nền và tích dấu. */
    selectedIds?: string[];
    /** Người không chọn được nữa, ví dụ đã ở trong nhóm. */
    disabledIds?: string[];
    disabledLabel?: string;
    /** Nhiều người thì hiện ô tích, một người thì hiện mũi tên. */
    multiple?: boolean;
    placeholder?: string;
  }>(),
  {
    selectedIds: () => [],
    disabledIds: () => [],
    disabledLabel: "Đã ở trong nhóm",
    multiple: false,
    placeholder: "Tìm theo tên hoặc email",
  },
);

const emit = defineEmits<{ pick: [person: AppUser] }>();

const { currentUserId, isOnline } = useChatStore();
const toast = useWidgetToast();

const users = ref<AppUser[]>([]);
const search = ref("");
const isLoading = ref(false);

// Danh bạ là tài khoản đồng bộ từ AuthService; bỏ chính mình vì không tự chat với mình được.
const contacts = computed(() =>
  users.value.filter((u) => u.id.toLowerCase() !== currentUserId.value),
);

const selectedSet = computed(
  () => new Set(props.selectedIds.map((id: string) => id.toLowerCase())),
);
const disabledSet = computed(
  () => new Set(props.disabledIds.map((id: string) => id.toLowerCase())),
);

const isSelected = (person: AppUser) => selectedSet.value.has(person.id.toLowerCase());
const isDisabled = (person: AppUser) => disabledSet.value.has(person.id.toLowerCase());

const displayNameOf = (person: AppUser) =>
  person.fullName || person.email || "Người dùng";

const load = async () => {
  isLoading.value = true;
  try {
    const res = await userApi.getPaged({
      keyword: search.value,
      pageNumber: 1,
      pageSize: 50,
    });
    users.value = res.data.data.items ?? [];
  } catch (err) {
    toast.error(extractErrorMessage(err));
  } finally {
    isLoading.value = false;
  }
};

const reload = debounce(load, 350);
watch(search, () => reload());
onMounted(load);
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="shrink-0 space-y-2 px-3 pb-2 pt-3">
      <slot name="top" />

      <div class="relative">
        <WidgetIcon
          name="Search"
          :size="16"
          class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"
        />
        <input
          v-model="search"
          type="search"
          :placeholder="placeholder"
          class="w-full rounded-full bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-900 outline-none ring-1 ring-gray-200 transition-colors placeholder:text-gray-500 focus:bg-white focus:ring-2 focus:ring-chat-accent"
        />
      </div>
    </div>

    <div class="gdtd-chat-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
      <div v-if="isLoading" class="space-y-1 px-2 py-2">
        <div
          v-for="index in 6"
          :key="index"
          class="flex animate-pulse items-center gap-3 py-2"
        >
          <span class="h-9 w-9 shrink-0 rounded-full bg-gray-100" />
          <span class="h-3 w-1/2 rounded-full bg-gray-100" />
        </div>
      </div>

      <ul v-else class="space-y-0.5">
        <li v-for="person in contacts" :key="person.id">
          <button
            type="button"
            :disabled="isDisabled(person)"
            class="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            :class="isSelected(person) ? 'bg-chat-accent/10' : 'hover:bg-gray-100'"
            @click="emit('pick', person)"
          >
            <WidgetAvatar
              :name="displayNameOf(person)"
              size="sm"
              :is-online="isOnline(person.id)"
              show-presence
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold text-gray-800">
                {{ displayNameOf(person) }}
              </span>
              <span class="block truncate text-xs text-gray-600">
                {{ person.email }}
                <template v-if="person.employeeCode"> · {{ person.employeeCode }}</template>
              </span>
            </span>

            <span
              v-if="isDisabled(person)"
              class="shrink-0 text-[11px] font-medium text-gray-500"
            >
              {{ disabledLabel }}
            </span>
            <span
              v-else-if="multiple"
              class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 transition-colors"
              :class="
                isSelected(person)
                  ? 'bg-chat-accent-strong text-white ring-chat-accent-strong'
                  : 'text-transparent ring-gray-300'
              "
            >
              <WidgetIcon name="Check" :size="12" />
            </span>
            <WidgetIcon v-else name="ChevronRight" :size="16" class="shrink-0 text-gray-400" />
          </button>
        </li>

        <li v-if="!contacts.length" class="px-2 py-12 text-center">
          <p class="text-sm font-semibold text-gray-800">Không tìm thấy ai phù hợp</p>
          <p class="mt-1 text-xs text-gray-600">
            Danh bạ lấy từ tài khoản đã đồng bộ với AuthService.
          </p>
        </li>
      </ul>
    </div>
  </div>
</template>
