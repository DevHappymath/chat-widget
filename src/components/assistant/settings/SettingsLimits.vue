<script setup lang="ts">
import SettingToggle from "./SettingToggle.vue";
import SettingSelect from "./SettingSelect.vue";
import { useAssistantSettingsContext } from "../../../core/store/useAssistantSettings";
import { formatNumber } from "../../../utils/assistant-format";

const { form } = useAssistantSettingsContext();

const RETENTION_OPTIONS = [30, 90, 180, 365].map((days) => ({ label: `${days} ngày`, value: days }));

const INPUT =
  "w-28 rounded-xl border border-gray-200 bg-white px-3 py-2 text-right text-sm text-gray-900 tabular-nums outline-none transition-colors focus:border-chat-accent/50 focus:ring-2 focus:ring-chat-accent/15";
</script>

<template>
  <div v-if="form" class="space-y-4">
    <section class="divide-y divide-gray-100 rounded-2xl border border-gray-200">
      <label class="flex items-center gap-4 p-4">
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-gray-900">Số câu hỏi mỗi phút</span>
          <span class="mt-0.5 block text-xs leading-relaxed text-gray-500">
            Mỗi người. Hỏi dồn quá mức này thì phải chờ một lát mới hỏi tiếp.
          </span>
        </span>
        <input v-model.number="form.maxQuestionsPerMinute" type="number" min="1" max="120" :class="INPUT" />
      </label>

      <label class="flex items-center gap-4 p-4">
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-gray-900">Lượng dùng mỗi ngày (token)</span>
          <span class="mt-0.5 block text-xs leading-relaxed text-gray-500">
            Mỗi người. Một câu tra dữ liệu thường tốn khoảng 2.000 token, mức
            {{ formatNumber(form.dailyTokenQuotaPerUser) }} đủ cho khoảng
            {{ formatNumber(Math.floor(form.dailyTokenQuotaPerUser / 2000)) }} câu.
          </span>
        </span>
        <input
          v-model.number="form.dailyTokenQuotaPerUser"
          type="number"
          min="10000"
          step="10000"
          :class="INPUT"
        />
      </label>
    </section>

    <section class="divide-y divide-gray-100 rounded-2xl border border-gray-200">
      <div class="flex items-start gap-4 p-4">
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-gray-900">Che số điện thoại</span>
          <span class="mt-0.5 block text-xs leading-relaxed text-gray-500">
            Che số điện thoại phụ huynh, học sinh trước khi gửi cho mô hình AI bên ngoài. Người hỏi
            vẫn thấy số đầy đủ ở trang gốc.
          </span>
        </span>
        <SettingToggle v-model="form.maskPhoneNumbers" />
      </div>

      <div class="flex items-center gap-4 p-4">
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-gray-900">Giữ lịch sử hỏi đáp</span>
          <span class="mt-0.5 block text-xs leading-relaxed text-gray-500">
            Quá hạn thì cuộc hỏi cũ tự xoá, cả với người hỏi.
          </span>
        </span>
        <SettingSelect v-model="form.retentionDays" :options="RETENTION_OPTIONS" class="w-32 shrink-0" />
      </div>
    </section>
  </div>
</template>
