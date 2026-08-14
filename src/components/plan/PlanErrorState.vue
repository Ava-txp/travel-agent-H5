<script setup lang="ts">
import type { LoadHint } from "@/composables/plan/types";

defineProps<{
  hint: LoadHint;
}>();

defineEmits<{
  retry: [];
}>();
</script>

<template>
  <van-empty image="error">
    <template #description>
      <p class="plan-error__title">{{ hint.title }}</p>
      <p v-if="hint.desc" class="plan-error__desc">{{ hint.desc }}</p>
    </template>
    <van-button
      v-if="!hint.retryDisabled || hint.retryLabel"
      round
      type="primary"
      class="plan-error__retry"
      :disabled="hint.retryDisabled"
      @click="$emit('retry')"
    >
      {{ hint.retryLabel || "重试" }}
    </van-button>
  </van-empty>
</template>

<style scoped>
.plan-error__title {
  margin: 8px 0 0;
  color: #646566;
  font-size: 14px;
  padding: 0 16px;
}

.plan-error__desc {
  margin: 6px 0 0;
  color: #969799;
  font-size: 12px;
  padding: 0 16px;
  line-height: 1.5;
}

.plan-error__retry {
  width: 160px;
  margin-top: 16px;
}
</style>
