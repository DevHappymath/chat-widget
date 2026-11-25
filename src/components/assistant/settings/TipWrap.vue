<script setup lang="ts">
import { vTooltip } from "../../../core/tooltip";

/** Bọc nút cần tooltip, cùng cách dùng với UiTooltip của web chat để hai bên giữ được một bố cục. */
defineProps<{ content: string }>();
</script>

<template>
  <span v-tooltip="content" class="inline-flex"><slot /></span>
</template>
