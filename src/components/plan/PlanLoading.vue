<script setup lang="ts">
import type { LoadHint } from "@/composables/plan/types";

defineProps<{
  hint: LoadHint;
  showCancel?: boolean;
}>();

defineEmits<{
  cancel: [];
}>();
</script>

<template>
  <div class="plan-loading">
    <div class="plan-loading__skeleton">
      <van-skeleton title :row="3" />
    </div>
    <div class="plan-loading__skeleton">
      <van-skeleton title :row="4" />
    </div>
    <div class="plan-loading__hint" :class="`is-${hint.kind}`">
      <van-loading size="20px" />
      <div>
        <p class="plan-loading__title">{{ hint.title }}</p>
        <p v-if="hint.desc" class="plan-loading__desc">{{ hint.desc }}</p>
      </div>
    </div>
    <van-button
      v-if="showCancel"
      size="small"
      plain
      round
      class="plan-loading__cancel"
      @click="$emit('cancel')"
    >
      取消生成
    </van-button>
  </div>
</template>

<style scoped>
.plan-loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.plan-loading__skeleton {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
}

.plan-loading__hint {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 4px 4px 0;
  color: #323233;
}

.plan-loading__hint.is-warn {
  color: #ed6a0c;
}

.plan-loading__hint.is-danger {
  color: #ee0a24;
}

.plan-loading__title {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}

.plan-loading__desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: #969799;
  line-height: 1.5;
}

.plan-loading__cancel {
  align-self: center;
  margin-top: 8px;
}
</style>
