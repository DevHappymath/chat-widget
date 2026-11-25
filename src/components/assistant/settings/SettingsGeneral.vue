<script setup lang="ts">
import { ref, watch } from "vue";
import WidgetIcon from "../../WidgetIcon.vue";
import SettingToggle from "./SettingToggle.vue";
import RolePicker from "./RolePicker.vue";
import { useAssistantSettingsContext } from "../../../core/store/useAssistantSettings";

const { form, availableRoles } = useAssistantSettingsContext();

const AUDIENCE_OPTIONS: { value: "all" | "roles"; label: string; hint: string; icon: string }[] = [
  { value: "all", label: "Mọi nhân sự", hint: "Ai có tài khoản nhân sự đều dùng được", icon: "Users" },
  { value: "roles", label: "Chỉ một số vai trò", hint: "Mở thử cho một nhóm trước khi mở rộng", icon: "UserCheck" },
];

// Giữ lựa chọn riêng: bỏ hết vai trò không được tự nhảy về "Mọi nhân sự" ngay dưới tay người bấm.
const audience = ref<"all" | "roles">(form.value?.allowedRoles.length ? "roles" : "all");

watch(audience, (value) => {
  if (value === "all" && form.value) form.value.allowedRoles = [];
});

// Huỷ thay đổi thì danh sách vai trò quay về bản đã lưu, lựa chọn phải theo về.
watch(
  () => form.value?.allowedRoles.length,
  (count) => {
    if (count) audience.value = "roles";
  },
);
</script>

<template>
  <div v-if="form" class="space-y-4">
    <section class="flex items-start gap-4 rounded-2xl border border-gray-200 p-4">
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-gray-900">Bật trợ lý</p>
        <p class="mt-0.5 text-xs leading-relaxed text-gray-500">
          Tắt thì nhân sự không còn thấy trợ lý. Quản trị viên vẫn thấy để vào bật lại.
        </p>
      </div>
      <SettingToggle v-model="form.enabled" />
    </section>

    <section class="flex items-start gap-4 rounded-2xl border border-gray-200 p-4">
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-gray-900">Tra nhanh</p>
        <p class="mt-0.5 text-xs leading-relaxed text-gray-500">
          Câu hỏi ngắn như mã lead, học sinh, hoa hồng, lịch dạy được tra ngay và trả kết quả kèm link, không tốn
          lượt mô hình. Tắt thì mọi câu đều để mô hình trả lời.
        </p>
      </div>
      <SettingToggle v-model="form.quickLookupEnabled" />
    </section>

    <section class="rounded-2xl border border-gray-200 p-4">
      <p class="text-sm font-semibold text-gray-900">Ai được dùng</p>
      <p class="mt-0.5 text-xs leading-relaxed text-gray-500">
        Chọn ai thấy trợ lý trong danh sách đoạn chat.
      </p>

      <div class="mt-3 grid gap-2.5" role="radiogroup" aria-label="Ai được dùng trợ lý">
        <button
          v-for="option in AUDIENCE_OPTIONS"
          :key="option.value"
          type="button"
          role="radio"
          :aria-checked="audience === option.value"
          class="group relative flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all"
          :class="
            audience === option.value
              ? 'border-chat-accent-strong bg-chat-accent/4 ring-4 ring-chat-accent/10'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/60'
          "
          @click="audience = option.value"
        >
          <span
            class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors"
            :class="
              audience === option.value
                ? 'bg-chat-accent-strong text-white'
                : 'bg-gray-100 text-gray-500 group-hover:text-gray-700'
            "
          >
            <WidgetIcon :name="option.icon" :size="19" />
          </span>

          <span class="min-w-0 flex-1 pr-6">
            <span class="block text-sm font-semibold text-gray-900">{{ option.label }}</span>
            <span class="mt-0.5 block text-xs leading-relaxed text-gray-500">{{ option.hint }}</span>
          </span>

          <span
            class="absolute top-3.5 right-3.5 inline-flex h-5 w-5 items-center justify-center rounded-full border transition-colors"
            :class="audience === option.value ? 'border-chat-accent-strong bg-chat-accent-strong text-white' : 'border-gray-300 bg-white'"
          >
            <WidgetIcon v-if="audience === option.value" name="Check" :size="12" :stroke="3" />
          </span>
        </button>
      </div>

      <Transition name="roles">
        <div v-if="audience === 'roles'" class="mt-3 rounded-xl bg-gray-50 p-3.5">
          <div class="mb-2.5 flex items-center gap-2">
            <p class="flex-1 text-xs font-medium text-gray-700">Vai trò được dùng</p>
            <span
              v-if="form.allowedRoles.length"
              class="rounded-full bg-chat-accent/10 px-2 py-0.5 text-[11px] font-medium text-chat-accent-strong tabular-nums"
            >
              Đã chọn {{ form.allowedRoles.length }}
            </span>
          </div>
          <RolePicker
            v-model="form.allowedRoles"
            :options="availableRoles"
            empty-label="Chưa chọn vai trò nào, nên đang tính là mọi nhân sự."
          />
        </div>
      </Transition>

      <p class="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
        <WidgetIcon name="ShieldCheck" :size="14" class="shrink-0 text-emerald-600" />
        Học sinh luôn bị chặn, dù chọn vai trò nào ở đây.
      </p>
    </section>
  </div>
</template>

<style scoped>
.roles-enter-active,
.roles-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.roles-enter-from,
.roles-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
