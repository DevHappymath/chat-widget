<script setup lang="ts">
import * as rawIcons from "lucide-vue-next";
import { computed, type Component } from "vue";

const icons = rawIcons as unknown as Record<string, Component>;

const props = withDefaults(
  defineProps<{
    name: string;
    size?: number;
    stroke?: number;
  }>(),
  { size: 20, stroke: 2 },
);

const resolved = computed<Component | undefined>(() => icons[props.name]);
</script>

<template>
  <component
    :is="resolved"
    v-if="resolved"
    :size="size"
    :stroke-width="stroke"
    class="inline-block shrink-0"
  />
</template>
