<script setup lang="ts">
import { nextTick, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { streamTravelChat } from "@/api/travel";
import { renderMarkdown } from "@/utils/markdown";
// showToast 由 unplugin-auto-import + VantResolver 自动引入（含样式）

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  /** 助手消息的 Markdown 渲染结果 */
  html?: string;
  time: string;
}

const router = useRouter();

const input = ref("");
const messages = ref<ChatMessage[]>([]);
const listRef = ref<HTMLElement | null>(null);
/** 请求进行中：禁用输入与常见问题，按钮切换为「停止」 */
const sending = ref(false);
/** 已发出请求但尚未收到首个 chunk：展示「AI 正在思考中」 */
const thinking = ref(false);
/** 未上滑时为 true：内容更新后自动贴底 */
const stickToBottom = ref(true);

const faqs = [
  "北京有哪些必去的景点？",
  "上海美食推荐",
  "成都三日游攻略",
  "如何选择旅行保险？",
];

/** 距底阈值：兼容橡皮筋与小数误差，避免用 === 0 */
const BOTTOM_THRESHOLD = 80;

let messageId = 0;
let abortController: AbortController | null = null;
let scrollRafId: number | null = null;

const formatTime = (date = new Date()) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const isNearBottom = (el: HTMLElement) =>
  el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD;

const onListScroll = () => {
  const el = listRef.value;
  if (!el) return;
  stickToBottom.value = isNearBottom(el);
};

const scrollToBottom = async (options?: { force?: boolean }) => {
  if (!options?.force && !stickToBottom.value) return;
  await nextTick();
  const el = listRef.value;
  if (!el) return;
  // 流式场景用即时赋值，避免 smooth 排队与误判
  el.scrollTop = el.scrollHeight;
  // Markdown 布局结算后再贴一次，避免滚不到真底
  requestAnimationFrame(() => {
    if (!options?.force && !stickToBottom.value) return;
    el.scrollTop = el.scrollHeight;
  });
};

/** 流式 chunk 密集时合并为一帧最多滚一次 */
const scheduleScrollToBottom = () => {
  if (!stickToBottom.value) return;
  if (scrollRafId !== null) return;
  scrollRafId = window.requestAnimationFrame(() => {
    scrollRafId = null;
    /**
     * void: 我知道这是 Promise，但我就是要“发起后不管结果”
     * 1、调用 scrollToBottom()
     * 2、故意丢弃它的返回值（这里是 Promise）
     * 3、整个表达式的结果变成 undefined
     */
    void scrollToBottom();
  });
};

const abortPendingRequest = () => {
  abortController?.abort();
  abortController = null;
};

/** 中断生成：保留已展示内容，仅停止后续流式输出 */
const stopGeneration = () => {
  if (!sending.value) return;
  abortPendingRequest();
};

const sendMessage = async (text?: string) => {
  const content = (text ?? input.value).trim();
  if (!content) {
    showToast("请输入您的问题");
    return;
  }
  if (sending.value) return;

  messages.value.push({
    id: ++messageId,
    role: "user",
    content,
    time: formatTime(),
  });
  input.value = "";
  sending.value = true;
  thinking.value = true;
  stickToBottom.value = true;
  await scrollToBottom({ force: true });

  abortPendingRequest();
  abortController = new AbortController();

  let assistantId: number | null = null;

  const upsertAssistant = (text: string) => {
    if (assistantId === null) {
      thinking.value = false;
      assistantId = ++messageId;
      messages.value.push({
        id: assistantId,
        role: "assistant",
        content: text,
        html: renderMarkdown(text),
        time: formatTime(),
      });
      scheduleScrollToBottom();
      return;
    }

    const target = messages.value.find((item) => item.id === assistantId);
    if (!target) return;
    target.content = text;
    target.html = renderMarkdown(text);
  };

  try {
    let fullContent = "";
    await streamTravelChat(
      content,
      (chunk) => {
        fullContent += chunk;
        upsertAssistant(fullContent);
        scheduleScrollToBottom();
      },
      abortController.signal,
    );

    if (assistantId === null) {
      upsertAssistant("暂时没有生成内容，请稍后再试。");
      await scrollToBottom();
    }
  } catch (error) {
    // 用户主动停止：保留已渲染内容，不弹错误
    if ((error as Error)?.name === "AbortError") return;

    thinking.value = false;
    const message =
      error instanceof Error ? error.message : "对话失败，请稍后重试";
    showToast(message);

    if (assistantId === null) {
      upsertAssistant(`抱歉，${message}`);
      await scrollToBottom();
    }
  } finally {
    sending.value = false;
    thinking.value = false;
    abortController = null;
  }
};

const onFaqClick = (question: string) => {
  if (sending.value) return;
  sendMessage(question);
};

const goBack = () => {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.push("/");
};

onUnmounted(() => {
  abortPendingRequest();
  if (scrollRafId !== null) {
    window.cancelAnimationFrame(scrollRafId);
    scrollRafId = null;
  }
});
</script>

<template>
  <div class="chat">
    <van-nav-bar
      title="AI 旅游助手"
      left-text="返回"
      left-arrow
      fixed
      placeholder
      @click-left="goBack"
    />

    <div ref="listRef" class="chat__body" @scroll.passive="onListScroll">
      <div v-if="messages.length === 0" class="chat__empty">
        <van-empty description="开始和 AI 助手对话吧！" />

        <div class="chat__faq">
          <p class="chat__faq-title">常见问题</p>
          <div class="chat__faq-list">
            <button
              v-for="question in faqs"
              :key="question"
              type="button"
              class="chat__faq-item"
              :disabled="sending"
              @click="onFaqClick(question)"
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
          <div v-else class="chat__bubble">{{ message.content }}</div>
          <div class="chat__time">{{ message.time }}</div>
        </div>

        <div v-if="thinking" class="chat__thinking">
          <van-loading size="16" />
          <span>AI 正在思考中...</span>
        </div>
      </div>
    </div>

    <div class="chat__footer">
      <div class="chat__composer">
        <input
          v-model="input"
          class="chat__input"
          type="text"
          placeholder="输入您的问题..."
          :disabled="sending"
          @keyup.enter="sendMessage()"
        />
        <van-button
          :type="sending ? 'danger' : 'primary'"
          size="small"
          class="chat__send"
          @click="sending ? stopGeneration() : sendMessage()"
        >
          {{ sending ? "停止" : "发送" }}
        </van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  /* 固定视口高度，否则内容增高时 body 跟着长高，内部无法滚动 */
  height: 100svh;
  max-height: 100svh;
  overflow: hidden;
  box-sizing: border-box;
  /* 为底部 TabBar 留白 */
  padding-bottom: 50px;
  background: #f7f8fa;
  text-align: left;
}

.chat__body {
  flex: 1;
  min-height: 0; /* flex 子项可收缩，overflow 才会生效 */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 16px;
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

.chat__footer {
  /* 参与 flex 布局，避免 fixed 遮挡消息；滚动区高度即「可视窗口」 */
  flex-shrink: 0;
  z-index: 10;
  background: #fff;
  border-top: 1px solid #ebedf0;
  padding: 8px 12px;
}

.chat__composer {
  display: flex;
  align-items: center;
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
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: #323233;
  line-height: 1.4;
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
