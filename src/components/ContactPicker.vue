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

const { currentUserId, isOnline, openConversationWith } = useChatStore();
const toast = useWidgetToast();

const users = ref<AppUser[]>([]);
const search = ref("");
const isLoading = ref(false);

// Danh bạ là tài khoản đồng bộ từ AuthService; bỏ chính mình vì không tự chat với mình được.
const contacts = computed(() =>
  users.value.filter((u) => u.id.toLowerCase() !== currentUserId.value),
);

const load = async () => {
  isLoading.value = true;
  try {
    const res = await userApi.getPaged({
      keyword: search.value,
      pageNumber: 1,
      pageSize: 30,
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

const pick = (person: AppUser) =>
  openConversationWith({
    userId: person.id,
    fullName: person.fullName || person.email || "Người dùng",
    email: person.email,
  });
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="shrink-0 px-3 pb-2 pt-3">
      <div class="relative">
        <WidgetIcon
          name="Search"
          :size="16"
          class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"
        />
        <input
          v-model="search"
          type="search"
          placeholder="Tìm theo tên hoặc email"
          autofocus
          class="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-500 focus:border-chat-accent focus:bg-white focus:ring-4 focus:ring-chat-accent/10"
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
            class="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-gray-100"
            @click="pick(person)"
          >
            <WidgetAvatar
              :name="person.fullName || person.email || 'Người dùng'"
              size="sm"
              :is-online="isOnline(person.id)"
              show-presence
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold text-gray-800">
                {{ person.fullName || person.email }}
              </span>
              <span class="block truncate text-xs text-gray-600">
                {{ person.email }}
                <template v-if="person.employeeCode"> · {{ person.employeeCode }}</template>
              </span>
            </span>
            <WidgetIcon name="ChevronRight" :size="16" class="text-gray-400" />
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
