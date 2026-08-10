<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import type { UserLocation } from "@/utils/geolocation";

const props = defineProps<{
  modelValue: string;
  sending: boolean;
  loadingHistory: boolean;
  locating: boolean;
  userLocation: UserLocation | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  send: [];
  stop: [];
}>();

const inputRef = ref<HTMLTextAreaElement | null>(null);

/** 按内容自动增高输入框，最高约 3.5 行后内部滚动 */
const resizeInput = () => {
  const el = inputRef.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

watch(
  () => props.modelValue,
  async () => {
    await nextTick();
    resizeInput();
  },
);

const onInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement;
  emit("update:modelValue", target.value);
  resizeInput();
};
</script>

<template>
  <div class="chat__footer">
    <div v-if="locating || userLocation?.city" class="chat__location">
      <van-loading v-if="locating" size="12" />
      <van-icon v-else name="location-o" size="14" />
      <span
        class="chat__location-text"
        :title="userLocation?.displayName || undefined"
      >
        {{
          locating
            ? "正在获取位置..."
            : `当前位置：${userLocation?.city ?? ""}`
        }}
      </span>
    </div>
    <div class="chat__composer">
      <textarea
        ref="inputRef"
        class="chat__input"
        rows="1"
        placeholder="输入您的问题..."
        :value="modelValue"
        :disabled="sending || loadingHistory"
        @input="onInput"
        @keydown.enter.exact.prevent="emit('send')"
      />
      <van-button
        :type="sending ? 'danger' : 'primary'"
        size="small"
        class="chat__send"
        :disabled="loadingHistory"
        @click="sending ? emit('stop') : emit('send')"
      >
        {{ sending ? "停止" : "发送" }}
      </van-button>
    </div>
  </div>
</template>

<style scoped>
.chat__footer {
  /* 参与 flex 布局，避免 fixed 遮挡消息；滚动区高度即「可视窗口」 */
  flex-shrink: 0;
  z-index: 10;
  background: #fff;
  border-top: 1px solid #ebedf0;
  padding: 8px 12px;
}

.chat__location {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
  padding: 0 2px;
  color: #969799;
  font-size: 12px;
  line-height: 1.3;
}

.chat__location-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat__composer {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  min-height: 40px;
  padding: 4px 4px 4px 12px;
  border: 1px solid #ebedf0;
  border-radius: 22px;
  background: #fff;
}

.chat__input {
  flex: 1;
  min-width: 0;
  min-height: calc(14px * 1.4);
  max-height: calc(14px * 1.4 * 3.5);
  margin: 6px 0;
  padding: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  line-height: 1.4;
  color: #323233;
  resize: none;
  overflow-y: auto;
}

.chat__input:disabled {
  color: #c8c9cc;
}

.chat__input::placeholder {
  color: #c8c9cc;
}

.chat__send {
  flex-shrink: 0;
  border-radius: 18px;
  padding: 0 14px;
  height: 32px;
  min-width: 56px;
}
</style>
