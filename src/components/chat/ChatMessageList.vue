<script setup lang="ts">
import { renderMarkdown } from "@/utils/markdown";
import {
  CHAT_FAQS,
  CHAT_SCENE_SHORTCUTS,
  type ChatMessage,
  type ChatSceneShortcut,
} from "@/composables/chat/types";

defineProps<{
  messages: ChatMessage[];
  loadingHistory: boolean;
  thinking: boolean;
  sending: boolean;
}>();

const emit = defineEmits<{
  faqClick: [question: string];
  sceneClick: [shortcut: ChatSceneShortcut];
}>();
</script>

<template>
  <div v-if="loadingHistory" class="chat__loading">
    <van-loading size="20" />
    <span>加载会话中...</span>
  </div>

  <div v-else-if="messages.length === 0" class="chat__empty">
    <van-empty description="开始和 AI 助手对话吧！" />

    <div class="chat__faq">
      <p class="chat__faq-title">拍照问问</p>
      <div class="chat__faq-list">
        <button
          v-for="item in CHAT_SCENE_SHORTCUTS"
          :key="item.scene"
          type="button"
          class="chat__faq-item chat__faq-item--scene"
          :disabled="sending"
          @click="emit('sceneClick', item)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <div class="chat__faq">
      <p class="chat__faq-title">常见问题</p>
      <div class="chat__faq-list">
        <button
          v-for="question in CHAT_FAQS"
          :key="question"
          type="button"
          class="chat__faq-item"
          :disabled="sending"
          @click="emit('faqClick', question)"
        >
          {{ question }}
        </button>
      </div>
    </div>
  </div>

  <div v-else class="chat__messages">
    <div
      v-for="message in messages"
      :key="message.id"
      class="chat__message"
      :class="`chat__message--${message.role}`"
    >
      <div
        v-if="message.role === 'assistant'"
        class="chat__bubble chat__bubble--md"
        v-html="message.html || renderMarkdown(message.content)"
      ></div>
      <div v-else class="chat__bubble">
        <div
          v-if="message.attachments?.length"
          class="chat__msg-images"
          :class="{ 'chat__msg-images--only': !message.content }"
        >
          <img
            v-for="att in message.attachments"
            :key="att.id"
            class="chat__msg-image"
            :src="att.url"
            alt="用户上传图片"
            loading="lazy"
          />
        </div>
        <div v-if="message.content" class="chat__msg-text">
          {{ message.content }}
        </div>
      </div>
      <div class="chat__time">{{ message.time }}</div>
    </div>

    <div v-if="thinking" class="chat__thinking">
      <van-loading size="16" />
      <span>AI 正在思考中...</span>
    </div>
  </div>
</template>

<style scoped>
.chat__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding-top: 80px;
  color: #969799;
  font-size: 13px;
}

.chat__empty {
  padding-top: 48px;
}

.chat__empty :deep(.van-empty__description) {
  margin-top: 8px;
  color: #969799;
}

.chat__faq {
  margin-top: 8px;
  text-align: center;
}

.chat__faq + .chat__faq {
  margin-top: 20px;
}

.chat__faq-title {
  margin: 0 0 14px;
  font-size: 13px;
  color: #c8c9cc;
}

.chat__faq-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  padding: 0 8px;
}

.chat__faq-item {
  border: none;
  border-radius: 999px;
  padding: 8px 14px;
  background: #646566;
  color: #fff;
  font-size: 13px;
  line-height: 1.4;
  cursor: pointer;
}

.chat__faq-item--scene {
  background: #1989fa;
}

.chat__faq-item:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chat__faq-item:active:not(:disabled) {
  opacity: 0.85;
}

.chat__messages {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat__message {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chat__message--user {
  align-items: flex-end;
}

.chat__message--assistant {
  align-items: flex-start;
}

.chat__bubble {
  max-width: 80%;
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.55;
  word-break: break-word;
}

.chat__message--user .chat__bubble {
  background: #1989fa;
  color: #fff;
  border-bottom-right-radius: 4px;
  white-space: pre-wrap;
}

.chat__message--assistant .chat__bubble {
  max-width: 92%;
  background: #fff;
  color: #323233;
  border-bottom-left-radius: 4px;
}

.chat__msg-images {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.chat__msg-images--only {
  margin-bottom: 0;
}

.chat__msg-image {
  width: 120px;
  max-width: 100%;
  height: 90px;
  object-fit: cover;
  border-radius: 8px;
  display: block;
  background: rgba(255, 255, 255, 0.2);
}

.chat__msg-text {
  white-space: pre-wrap;
}

/* 助手 Markdown 排版 */
.chat__bubble--md :deep(h1),
.chat__bubble--md :deep(h2),
.chat__bubble--md :deep(h3) {
  margin: 14px 0 8px;
  font-weight: 600;
  line-height: 1.35;
  color: #1f2329;
}

.chat__bubble--md :deep(h1) {
  font-size: 17px;
}

.chat__bubble--md :deep(h2) {
  font-size: 16px;
  padding-bottom: 4px;
  border-bottom: 1px solid #f0f0f0;
}

.chat__bubble--md :deep(h3) {
  font-size: 15px;
}

.chat__bubble--md :deep(h1:first-child),
.chat__bubble--md :deep(h2:first-child),
.chat__bubble--md :deep(h3:first-child),
.chat__bubble--md :deep(p:first-child),
.chat__bubble--md :deep(ul:first-child),
.chat__bubble--md :deep(ol:first-child) {
  margin-top: 0;
}

.chat__bubble--md :deep(p) {
  margin: 8px 0;
}

.chat__bubble--md :deep(ul),
.chat__bubble--md :deep(ol) {
  margin: 8px 0;
  padding-left: 1.2em;
}

.chat__bubble--md :deep(p:last-child),
.chat__bubble--md :deep(ul:last-child),
.chat__bubble--md :deep(ol:last-child),
.chat__bubble--md :deep(h1:last-child),
.chat__bubble--md :deep(h2:last-child),
.chat__bubble--md :deep(h3:last-child) {
  margin-bottom: 0;
}

.chat__bubble--md :deep(li) {
  margin: 4px 0;
}

.chat__bubble--md :deep(li + li) {
  margin-top: 6px;
}

.chat__bubble--md :deep(strong) {
  font-weight: 600;
  color: #1f2329;
}

.chat__bubble--md :deep(a) {
  color: #1989fa;
  word-break: break-all;
}

.chat__bubble--md :deep(code) {
  padding: 0.1em 0.35em;
  border-radius: 4px;
  background: #f2f3f5;
  font-size: 0.92em;
}

.chat__bubble--md :deep(pre) {
  margin: 8px 0;
  padding: 10px;
  overflow-x: auto;
  border-radius: 8px;
  background: #f2f3f5;
}

.chat__bubble--md :deep(pre code) {
  padding: 0;
  background: transparent;
}

.chat__bubble--md :deep(hr) {
  margin: 12px 0;
  border: none;
  border-top: 1px solid #ebedf0;
}

.chat__time {
  font-size: 12px;
  color: #c8c9cc;
  line-height: 1;
  padding: 0 2px;
}

.chat__thinking {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #c8c9cc;
  font-size: 13px;
  line-height: 1.4;
}
</style>
