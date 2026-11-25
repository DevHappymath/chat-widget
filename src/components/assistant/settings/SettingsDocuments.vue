<script setup lang="ts">
import { ref } from "vue";
import WidgetIcon from "../../WidgetIcon.vue";
import TipWrap from "./TipWrap.vue";
import RolePicker from "./RolePicker.vue";
import SettingsEmbeddingModel from "./SettingsEmbeddingModel.vue";
import { useAssistantSettingsContext } from "../../../core/store/useAssistantSettings";
import { useWidgetConfirm } from "../../../core/store/useWidgetConfirm";
import { useWidgetToast } from "../../../core/store/useWidgetToast";
import { formatDate, formatBytes } from "../../../utils/format";
import type { KnowledgeDocument, KnowledgeDocumentStatus } from "../../../types/assistant";

const {
  documents,
  availableRoles,
  isLoadingDocuments,
  isUploading,
  uploadDocument,
  updateDocumentRoles,
  reindexDocument,
  deleteDocument,
} = useAssistantSettingsContext();
const { ask } = useWidgetConfirm();
const toast = useWidgetToast();

const ACCEPT = ".pdf,.docx,.md,.txt";
const MAX_BYTES = 20 * 1024 * 1024;

const fileInput = ref<HTMLInputElement | null>(null);
const pending = ref<{ file: File; title: string; roles: string[] } | null>(null);
const isDragging = ref(false);
const editingId = ref<string | null>(null);
const editingRoles = ref<string[]>([]);

const titleFromFile = (name: string) =>
  name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

const pick = (file: File | undefined) => {
  if (!file) return;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ACCEPT.includes(`.${extension}`)) {
    toast.error("Chỉ nhận tệp PDF, DOCX, MD hoặc TXT");
    return;
  }
  if (file.size > MAX_BYTES) {
    toast.error(`Tệp lớn hơn ${formatBytes(MAX_BYTES, 0)}, hãy tách nhỏ rồi tải lên`);
    return;
  }
  pending.value = { file, title: titleFromFile(file.name), roles: [] };
};

const onPickFile = (event: Event) => {
  const input = event.target as HTMLInputElement;
  pick(input.files?.[0]);
  input.value = "";
};

const onDrop = (event: DragEvent) => {
  isDragging.value = false;
  pick(event.dataTransfer?.files?.[0]);
};

const submit = async () => {
  if (!pending.value?.title.trim()) return;
  const { file, title, roles } = pending.value;
  if (await uploadDocument(file, title.trim(), roles)) pending.value = null;
};

const startEditRoles = (document: KnowledgeDocument) => {
  editingId.value = document.id;
  editingRoles.value = [...document.allowedRoles];
};

const saveRoles = async (document: KnowledgeDocument) => {
  await updateDocumentRoles(document.id, editingRoles.value);
  editingId.value = null;
};

const onDelete = async (document: KnowledgeDocument) => {
  const agreed = await ask({
    title: "Xoá tài liệu",
    message: `Xoá "${document.title}"? Trợ lý sẽ không còn dựa vào tài liệu này để trả lời.`,
    confirmText: "Xoá",
  });
  if (agreed) await deleteDocument(document.id);
};

const STATUS: Record<KnowledgeDocumentStatus, { label: string; icon: string; class: string }> = {
  processing: { label: "Đang xử lý", icon: "Loader2", class: "bg-sky-50 text-sky-700 [&_svg]:animate-spin" },
  ready: { label: "Sẵn sàng", icon: "CircleCheck", class: "bg-emerald-50 text-emerald-700" },
  failed: { label: "Lỗi", icon: "CircleAlert", class: "bg-red-50 text-red-700" },
};

const ICON_ACTION =
  "inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40";
</script>

<template>
  <div class="space-y-4">
    <SettingsEmbeddingModel />

    <input ref="fileInput" type="file" :accept="ACCEPT" class="hidden" @change="onPickFile" />

    <section
      v-if="pending"
      class="rounded-2xl border border-chat-accent/30 bg-chat-accent/5 p-4"
    >
      <div class="flex items-center gap-2.5">
        <WidgetIcon name="FileUp" :size="18" class="shrink-0 text-chat-accent-strong" />
        <p class="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{{ pending.file.name }}</p>
        <span class="shrink-0 text-xs text-gray-500">{{ formatBytes(pending.file.size, 0) }}</span>
      </div>

      <label class="mt-3 block">
        <span class="mb-1 block text-xs font-medium text-gray-600">Tên hiện cho người hỏi</span>
        <input
          v-model="pending.title"
          type="text"
          maxlength="150"
          class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-chat-accent/50 focus:ring-2 focus:ring-chat-accent/15"
        />
      </label>

      <p class="mt-3 mb-1.5 text-xs font-medium text-gray-600">Ai được tra tài liệu này</p>
      <RolePicker
        v-model="pending.roles"
        :options="availableRoles"
        empty-label="Chưa chọn vai trò nào, mọi nhân sự đều tra được."
      />

      <div class="mt-4 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-full px-3.5 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-white"
          :disabled="isUploading"
          @click="pending = null"
        >
          Huỷ
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full bg-chat-accent-strong px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-chat-accent disabled:opacity-60"
          :disabled="isUploading || !pending.title.trim()"
          @click="submit"
        >
          <WidgetIcon v-if="isUploading" name="Loader2" :size="15" class="animate-spin" />
          Tải lên
        </button>
      </div>
    </section>

    <button
      v-else
      type="button"
      class="flex w-full flex-col items-center gap-1.5 rounded-2xl border border-dashed px-4 py-6 text-center transition-colors"
      :class="isDragging ? 'border-chat-accent bg-chat-accent/5' : 'border-gray-300 hover:border-chat-accent/50 hover:bg-gray-50'"
      @click="fileInput?.click()"
      @dragover.prevent="isDragging = true"
      @dragleave="isDragging = false"
      @drop.prevent="onDrop"
    >
      <WidgetIcon name="Upload" :size="20" class="text-chat-accent-strong" />
      <span class="text-sm font-medium text-gray-900">Tải tài liệu lên</span>
      <span class="text-xs text-gray-500">
        Kéo thả hoặc chọn tệp PDF, DOCX, MD, TXT, tối đa {{ formatBytes(MAX_BYTES, 0) }}
      </span>
    </button>

    <div v-if="isLoadingDocuments && !documents.length" class="space-y-2">
      <span v-for="i in 3" :key="i" class="block h-16 animate-pulse rounded-2xl bg-gray-100" />
    </div>

    <p v-else-if="!documents.length" class="py-8 text-center text-sm text-gray-500">
      Chưa có tài liệu nào. Trợ lý chỉ trả lời từ dữ liệu các hệ cho tới khi có tài liệu.
    </p>

    <ul v-else class="divide-y divide-gray-100 rounded-2xl border border-gray-200">
      <li v-for="document in documents" :key="document.id" class="p-3.5">
        <div class="flex items-start gap-3">
          <span class="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
            <WidgetIcon name="FileText" :size="17" />
          </span>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p class="min-w-0 truncate text-sm font-medium text-gray-900">{{ document.title }}</p>
              <span
                class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                :class="STATUS[document.status].class"
              >
                <WidgetIcon :name="STATUS[document.status].icon" :size="11" />
                {{ STATUS[document.status].label }}
              </span>
            </div>
            <p class="mt-0.5 truncate text-xs text-gray-500">
              {{ document.fileName }} · {{ formatBytes(document.sizeBytes, 0) }}
              <template v-if="document.status === 'ready'"> · {{ document.chunkCount }} đoạn</template>
              · {{ formatDate(document.createdAtUtc) }}
            </p>
            <p v-if="document.status === 'failed' && document.error" class="mt-1 text-xs text-red-600">
              {{ document.error }}
            </p>

            <div v-if="editingId === document.id" class="mt-2.5">
              <RolePicker
                v-model="editingRoles"
                :options="availableRoles"
                empty-label="Chưa chọn vai trò nào, mọi nhân sự đều tra được."
              />
              <div class="mt-2 flex gap-2">
                <button
                  type="button"
                  class="rounded-full bg-chat-accent-strong px-3 py-1.5 text-xs font-medium text-white hover:bg-chat-accent"
                  @click="saveRoles(document)"
                >
                  Lưu
                </button>
                <button
                  type="button"
                  class="rounded-full px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                  @click="editingId = null"
                >
                  Huỷ
                </button>
              </div>
            </div>
            <div v-else class="mt-1.5 flex flex-wrap items-center gap-1">
              <WidgetIcon name="Users" :size="12" class="text-gray-400" />
              <span v-if="!document.allowedRoles.length" class="text-xs text-gray-600">Mọi nhân sự</span>
              <span
                v-for="role in document.allowedRoles"
                :key="role"
                class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600"
              >
                {{ role }}
              </span>
            </div>
          </div>

          <div class="flex shrink-0 items-center">
            <TipWrap content="Đổi người được tra">
              <button
                type="button"
                :class="ICON_ACTION"
                :aria-label="`Đổi người được tra ${document.title}`"
                @click="startEditRoles(document)"
              >
                <WidgetIcon name="UserCog" :size="15" />
              </button>
            </TipWrap>
            <TipWrap content="Xử lý lại">
              <button
                type="button"
                :class="ICON_ACTION"
                :disabled="document.status === 'processing'"
                :aria-label="`Xử lý lại ${document.title}`"
                @click="reindexDocument(document.id)"
              >
                <WidgetIcon name="RefreshCw" :size="15" />
              </button>
            </TipWrap>
            <TipWrap content="Xoá">
              <button
                type="button"
                :class="[ICON_ACTION, 'hover:bg-red-50 hover:text-red-600']"
                :aria-label="`Xoá ${document.title}`"
                @click="onDelete(document)"
              >
                <WidgetIcon name="Trash2" :size="15" />
              </button>
            </TipWrap>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
