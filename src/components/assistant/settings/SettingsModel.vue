<script setup lang="ts">
import WidgetIcon from "../../WidgetIcon.vue";
import SettingsProviders from "./SettingsProviders.vue";
</script>

<template>
  <div class="space-y-4">
    <p class="flex items-start gap-2 rounded-xl bg-gray-50 px-3.5 py-3 text-xs leading-relaxed text-gray-600">
      <WidgetIcon name="Info" :size="15" class="mt-px shrink-0 text-gray-400" />
      <span>
        Người hỏi tự chọn mô hình ngay trong khung hỏi, trong số mô hình trả lời có ở đây. Bấm
        <WidgetIcon name="Star" :size="12" class="inline align-[-2px]" /> để đặt mô hình mặc định cho người chưa
        chọn. Mô hình đọc tài liệu chọn ở mục Tài liệu.
      </span>
    </p>

    <SettingsProviders />
  </div>
</template>
