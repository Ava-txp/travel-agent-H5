<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { UserLocation } from "@/utils/geolocation";
import type { PendingAttachment } from "@/composables/chat/types";

const props = defineProps<{
  modelValue: string;
  sending: boolean;
  loadingHistory: boolean;
  locating: boolean;
  userLocation: UserLocation | null;
  pendingAttachments: PendingAttachment[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  send: [];
  stop: [];
  pickFiles: [files: FileList];
  removeAttachment: [localId: string];
}>();

const inputRef = ref<HTMLTextAreaElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

const disabled = computed(
  () => props.sending || props.loadingHistory,
);

const uploading = computed(() =>
  props.pendingAttachments.some((a) => a.status === "uploading"),
);

const canSend = computed(
  () => !props.loadingHistory && !uploading.value,
);

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

const openPicker = () => {
  if (disabled.value) return;
  fileInputRef.value?.click();
};

const onFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    emit("pickFiles", input.files);
  }
  input.value = "";
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

    <div
      v-if="pendingAttachments.length > 0"
      class="chat__attachments"
    >
      <div
        v-for="item in pendingAttachments"
        :key="item.localId"
        class="chat__attach"
        :class="{
          'chat__attach--error': item.status === 'error',
          'chat__attach--uploading': item.status === 'uploading',
        }"
      >
        <img
          class="chat__attach-img"
          :src="item.previewUrl"
          alt="待发送图片"
        />
        <div v-if="item.status === 'uploading'" class="chat__attach-mask">
          <van-loading size="16" color="#fff" />
        </div>
        <button
          type="button"
          class="chat__attach-remove"
          :disabled="sending"
          aria-label="移除图片"
          @click="emit('removeAttachment', item.localId)"
        >
          <van-icon name="cross" size="10" />
        </button>
      </div>
    </div>

    <div class="chat__composer">
      <button
        type="button"
        class="chat__attach-btn"
        :disabled="disabled"
        aria-label="添加图片"
        @click="openPicker"
      >
        <van-icon name="photograph" size="22" />
      </button>
      <input
        ref="fileInputRef"
        class="chat__file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        @change="onFileChange"
      />
      <textarea
        ref="inputRef"
        class="chat__input"
        rows="1"
        placeholder="输入问题，或添加图片..."
        :value="modelValue"
        :disabled="disabled"
        @input="onInput"
        @keydown.enter.exact.prevent="canSend && !sending ? emit('send') : undefined"
      />
      <van-button
        :type="sending ? 'danger' : 'primary'"
        size="small"
        class="chat__send"
        :disabled="sending ? false : !canSend"
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

.chat__attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  padding: 0 2px;
}

.chat__attach {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 8px;
  overflow: hidden;
  background: #f2f3f5;
}

.chat__attach-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.chat__attach-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
}

.chat__attach--error {
  outline: 1px solid #ee0a24;
}

.chat__attach-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
}

.chat__attach-remove:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat__composer {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  min-height: 40px;
  padding: 4px 4px 4px 8px;
  border: 1px solid #ebedf0;
  border-radius: 22px;
  background: #fff;
}

.chat__attach-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  margin-bottom: 2px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #646566;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
}

.chat__attach-btn:disabled {
  color: #c8c9cc;
  cursor: not-allowed;
}

.chat__file-input {
  display: none;
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
