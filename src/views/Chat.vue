<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  deleteConversation,
  fetchConversationDetail,
  fetchConversations,
  updateConversation,
  streamTravelChat,
  type ConversationSummary,
} from "@/api/travel";
import { renderMarkdown } from "@/utils/markdown";
import {
  getUserLocation,
  needsUserLocation,
  type UserLocation,
} from "@/utils/geolocation";
// showToast / showConfirmDialog 由 unplugin-auto-import + VantResolver 自动引入

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** 助手消息的 Markdown 渲染结果 */
  html?: string;
  time: string;
}

const LAST_CONVERSATION_KEY = "travel-last-conversation-id";

const router = useRouter();
const route = useRoute();

const input = ref("");
const inputRef = ref<HTMLTextAreaElement | null>(null);
const messages = ref<ChatMessage[]>([]);
const listRef = ref<HTMLElement | null>(null);
/** 当前会话 id；有则多轮续聊，无则首轮由后端创建 */
const conversationId = ref<string | null>(null);
/** 请求进行中：禁用输入与常见问题，按钮切换为「停止」 */
const sending = ref(false);
/** 已发出请求但尚未收到首个 chunk：展示「AI 正在思考中」 */
const thinking = ref(false);
/** 拉取会话详情中 */
const loadingHistory = ref(false);
/** 未上滑时为 true：内容更新后自动贴底 */
const stickToBottom = ref(true);

const historyVisible = ref(false);
const historyLoading = ref(false);
const conversations = ref<ConversationSummary[]>([]);
/** 按需定位结果（仅位置相关提问时获取并展示） */
const userLocation = ref<UserLocation | null>(null);
const locating = ref(false);

/** 长按上下文菜单 */
const historyMenuVisible = ref(false);
const actionTarget = ref<ConversationSummary | null>(null);
const historyMenuAbove = ref(false);
const historyMenuStyle = ref<Record<string, string>>({});
const historyItemRefs = new Map<string, HTMLElement>();

/** 正在内联重命名的会话 id */
const renamingId = ref<string | null>(null);
const renameTitle = ref("");
const renameInputRef = ref<HTMLInputElement | null>(null);
let renameSaving = false;

const LONG_PRESS_MS = 480;
const CTX_MENU_HEIGHT = 156;
const CTX_GAP = 8;
const CTX_EDGE = 12;
let longPressTimer: number | null = null;
let suppressHistoryClick = false;

const faqs = [
  "北京有哪些必去的景点？",
  "上海美食推荐",
  "成都三日游攻略",
  "如何选择旅行保险？",
];

/** 距底阈值：兼容橡皮筋与小数误差，避免用 === 0 */
const BOTTOM_THRESHOLD = 80;

let abortController: AbortController | null = null;
let loadAbortController: AbortController | null = null;
let scrollRafId: number | null = null;
let messageSeq = 0;

const nextMessageId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${++messageSeq}`;

const formatTime = (date = new Date()) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const persistLastConversationId = (id: string | null) => {
  if (id) {
    localStorage.setItem(LAST_CONVERSATION_KEY, id);
    return;
  }
  localStorage.removeItem(LAST_CONVERSATION_KEY);
};

const syncConversationRoute = (id: string | null) => {
  const current = typeof route.query.id === "string" ? route.query.id : null;
  if (current === id) return;

  void router.replace({
    path: "/chat",
    query: id ? { id } : {},
  });
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
    void scrollToBottom();
  });
};

const abortPendingRequest = () => {
  abortController?.abort();
  abortController = null;
};

const abortLoadRequest = () => {
  loadAbortController?.abort();
  loadAbortController = null;
};

/** 中断生成：保留已展示内容，仅停止后续流式输出 */
const stopGeneration = () => {
  if (!sending.value) return;
  abortPendingRequest();
};

const resetToEmptyChat = () => {
  abortPendingRequest();
  abortLoadRequest();
  conversationId.value = null;
  messages.value = [];
  thinking.value = false;
  sending.value = false;
  persistLastConversationId(null);
  syncConversationRoute(null);
};

const loadConversation = async (id: string) => {
  if (sending.value) {
    abortPendingRequest();
  }

  abortLoadRequest();
  loadAbortController = new AbortController();
  loadingHistory.value = true;
  thinking.value = false;
  // 切换会话时先清空，避免短暂展示上一会话内容
  if (conversationId.value !== id) {
    messages.value = [];
  }

  try {
    const detail = await fetchConversationDetail(id, loadAbortController.signal);
    conversationId.value = detail.id;
    persistLastConversationId(detail.id);
    messages.value = detail.messages.map((item) => ({
      id: item.id,
      role: item.role,
      content: item.content,
      html:
        item.role === "assistant" ? renderMarkdown(item.content) : undefined,
      time: formatTime(new Date(item.createdAt)),
    }));
    stickToBottom.value = true;
    await scrollToBottom({ force: true });
  } catch (error) {
    if ((error as Error)?.name === "CanceledError") return;
    if ((error as Error)?.name === "AbortError") return;

    const message =
      error instanceof Error ? error.message : "加载会话失败，请稍后重试";
    showToast(message);
    resetToEmptyChat();
  } finally {
    loadingHistory.value = false;
    loadAbortController = null;
  }
};

const bindConversationId = (id: string) => {
  if (conversationId.value === id) return;
  conversationId.value = id;
  persistLastConversationId(id);
  syncConversationRoute(id);
};

/** 按内容自动增高输入框，最高约 3.5 行后内部滚动 */
const resizeInput = () => {
  const el = inputRef.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

const sendMessage = async (text?: string) => {
  const content = (text ?? input.value).trim();
  if (!content) {
    showToast("请输入您的问题");
    return;
  }
  if (sending.value || loadingHistory.value) return;

  messages.value.push({
    id: nextMessageId(),
    role: "user",
    content,
    time: formatTime(),
  });
  input.value = "";
  await nextTick();
  resizeInput();
  sending.value = true;
  thinking.value = true;
  stickToBottom.value = true;
  await scrollToBottom({ force: true });

  abortPendingRequest();
  abortController = new AbortController();

  let assistantId: string | null = null;

  const upsertAssistant = (text: string) => {
    if (assistantId === null) {
      thinking.value = false;
      assistantId = nextMessageId();
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
    // 业内常见：仅当用户提及位置/当地天气等意图时再申请定位，避免进页即弹权限
    let location: UserLocation | null = null;
    if (needsUserLocation(content)) {
      locating.value = true;
      try {
        location = await getUserLocation({ withCity: true });
        if (location) {
          userLocation.value = location;
        } else {
          showToast("未能获取位置，可直接说明所在城市");
        }
      } finally {
        locating.value = false;
      }
    }

    let fullContent = "";
    const result = await streamTravelChat({
      message: content,
      conversationId: conversationId.value ?? undefined,
      location: location
        ? {
            lat: location.lat,
            lon: location.lon,
            accuracy: location.accuracy,
            city: location.city,
            displayName: location.displayName,
          }
        : undefined,
      onChunk: (chunk) => {
        fullContent += chunk;
        upsertAssistant(fullContent);
        scheduleScrollToBottom();
      },
      signal: abortController.signal,
    });

    if (result.conversationId) {
      bindConversationId(result.conversationId);
    }

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
  if (sending.value || loadingHistory.value) return;
  void sendMessage(question);
};

const sortConversations = (list: ConversationSummary[]) =>
  [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });

const clearLongPressTimer = () => {
  if (longPressTimer === null) return;
  window.clearTimeout(longPressTimer);
  longPressTimer = null;
};

const setHistoryItemRef = (id: string, el: unknown) => {
  if (el instanceof HTMLElement) {
    historyItemRefs.set(id, el);
    return;
  }
  historyItemRefs.delete(id);
};

const closeHistoryMenu = () => {
  historyMenuVisible.value = false;
  actionTarget.value = null;
};

const openHistoryActions = (item: ConversationSummary) => {
  const el = historyItemRefs.get(item.id);
  if (!el) return;

  const rect = el.getBoundingClientRect();
  const width = Math.min(rect.width - 16, window.innerWidth - CTX_EDGE * 2);
  const left = Math.min(
    Math.max(rect.left + (rect.width - width) / 2, CTX_EDGE),
    window.innerWidth - width - CTX_EDGE,
  );
  const spaceBelow = window.innerHeight - rect.bottom - CTX_EDGE;
  const spaceAbove = rect.top - CTX_EDGE;
  const placeAbove =
    spaceBelow < CTX_MENU_HEIGHT + CTX_GAP && spaceAbove > spaceBelow;

  historyMenuAbove.value = placeAbove;
  historyMenuStyle.value = {
    left: `${left}px`,
    width: `${width}px`,
    top: `${rect.top}px`,
    "--ctx-card-height": `${Math.max(rect.height, 48)}px`,
  };

  actionTarget.value = item;
  historyMenuVisible.value = true;
  // 吞掉长按后的合成 click，短暂窗口后恢复正常点击
  suppressHistoryClick = true;
  window.setTimeout(() => {
    suppressHistoryClick = false;
  }, 350);
};

const onHistoryPressStart = (item: ConversationSummary) => {
  if (renamingId.value || historyMenuVisible.value) return;
  clearLongPressTimer();
  longPressTimer = window.setTimeout(() => {
    longPressTimer = null;
    openHistoryActions(item);
  }, LONG_PRESS_MS);
};

const onHistoryPressEnd = () => {
  clearLongPressTimer();
};

const onHistoryPressMove = () => {
  clearLongPressTimer();
};

const openHistory = async () => {
  historyVisible.value = true;
  historyLoading.value = true;
  try {
    conversations.value = sortConversations(
      (await fetchConversations()).map((item) => ({
        ...item,
        pinned: Boolean(item.pinned),
      })),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "加载历史失败，请稍后重试";
    showToast(message);
  } finally {
    historyLoading.value = false;
  }
};

const selectConversation = async (id: string) => {
  if (suppressHistoryClick) {
    suppressHistoryClick = false;
    return;
  }
  if (renamingId.value) return;
  if (sending.value) {
    showToast("请先停止当前生成");
    return;
  }
  historyVisible.value = false;
  if (conversationId.value === id) return;
  syncConversationRoute(id);
};

const patchConversationLocally = (
  id: string,
  patch: Partial<ConversationSummary>,
) => {
  conversations.value = sortConversations(
    conversations.value.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    ),
  );
};

const togglePinConversation = async (item: ConversationSummary) => {
  try {
    const updated = await updateConversation(item.id, {
      pinned: !item.pinned,
    });
    patchConversationLocally(item.id, {
      pinned: updated.pinned,
      title: updated.title,
      updatedAt: updated.updatedAt,
    });
    showToast(updated.pinned ? "已置顶" : "已取消置顶");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "操作失败，请稍后重试";
    showToast(message);
  }
};

const focusRenameInput = (id: string) => {
  window.setTimeout(() => {
    if (renamingId.value !== id) return;
    const el = renameInputRef.value;
    if (!el) return;
    el.focus();
    el.select();
  }, 80);
};

const startInlineRename = async (item: ConversationSummary) => {
  renamingId.value = item.id;
  renameTitle.value = item.title;
  await nextTick();
  focusRenameInput(item.id);
};

const cancelInlineRename = () => {
  renamingId.value = null;
  renameTitle.value = "";
};

const commitInlineRename = async () => {
  if (renameSaving) return;
  const id = renamingId.value;
  if (!id) return;

  const title = renameTitle.value.trim();
  const current = conversations.value.find((item) => item.id === id);
  if (!current) {
    cancelInlineRename();
    return;
  }

  if (!title) {
    showToast("请输入会话名称");
    await nextTick();
    renameInputRef.value?.focus();
    return;
  }

  if (title === current.title) {
    cancelInlineRename();
    return;
  }

  renameSaving = true;
  try {
    const updated = await updateConversation(id, { title });
    patchConversationLocally(id, {
      title: updated.title,
      updatedAt: updated.updatedAt,
    });
    cancelInlineRename();
    showToast("已重命名");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "重命名失败，请稍后重试";
    showToast(message);
    await nextTick();
    renameInputRef.value?.focus();
  } finally {
    renameSaving = false;
  }
};

const onRenameKeydown = (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void commitInlineRename();
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    cancelInlineRename();
  }
};

const onContextPin = async () => {
  const item = actionTarget.value;
  if (!item) return;
  closeHistoryMenu();
  await togglePinConversation(item);
};

const onContextRename = () => {
  const item = actionTarget.value;
  if (!item) return;
  closeHistoryMenu();
  void startInlineRename(item);
};

const onDeleteConversation = async (item: ConversationSummary) => {
  try {
    await showConfirmDialog({
      title: "删除会话",
      message: `确定删除「${item.title}」吗？`,
    });
  } catch {
    return;
  }

  try {
    await deleteConversation(item.id);
    conversations.value = conversations.value.filter((c) => c.id !== item.id);
    if (conversationId.value === item.id) {
      resetToEmptyChat();
    }
    showToast("已删除");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "删除失败，请稍后重试";
    showToast(message);
  }
};

const onContextDelete = async () => {
  const item = actionTarget.value;
  if (!item) return;
  closeHistoryMenu();
  await onDeleteConversation(item);
};

const startNewConversation = () => {
  if (sending.value) {
    showToast("请先停止当前生成");
    return;
  }
  historyVisible.value = false;
  resetToEmptyChat();
};

const goBack = () => {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.push("/");
};

watch(
  () => (typeof route.query.id === "string" ? route.query.id : ""),
  (id) => {
    if (!id) return;
    // 首轮 done 后已写入 id，且本地已有消息：跳过重复拉取
    if (conversationId.value === id && messages.value.length > 0) return;
    void loadConversation(id);
  },
  { immediate: true },
);

watch(historyVisible, (visible) => {
  if (!visible) closeHistoryMenu();
});

onUnmounted(() => {
  abortPendingRequest();
  abortLoadRequest();
  clearLongPressTimer();
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
    >
      <template #right>
        <button
          type="button"
          class="chat__nav-action"
          :disabled="sending"
          @click="openHistory"
        >
          历史
        </button>
      </template>
    </van-nav-bar>

    <div ref="listRef" class="chat__body" @scroll.passive="onListScroll">
      <div v-if="loadingHistory" class="chat__loading">
        <van-loading size="20" />
        <span>加载会话中...</span>
      </div>

      <div v-else-if="messages.length === 0" class="chat__empty">
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
          v-model="input"
          class="chat__input"
          rows="1"
          placeholder="输入您的问题..."
          :disabled="sending || loadingHistory"
          @input="resizeInput"
          @keydown.enter.exact.prevent="sendMessage()"
        />
        <van-button
          :type="sending ? 'danger' : 'primary'"
          size="small"
          class="chat__send"
          :disabled="loadingHistory"
          @click="sending ? stopGeneration() : sendMessage()"
        >
          {{ sending ? "停止" : "发送" }}
        </van-button>
      </div>
    </div>

    <van-popup
      v-model:show="historyVisible"
      position="right"
      class="chat__history-popup"
      :style="{ width: '82%', height: '100%' }"
    >
      <div class="chat__history">
        <div class="chat__history-header">
          <h2 class="chat__history-title">历史会话</h2>
          <button
            type="button"
            class="chat__history-new"
            :disabled="sending"
            @click="startNewConversation"
          >
            新对话
          </button>
        </div>

        <div v-if="historyLoading" class="chat__history-loading">
          <van-loading size="20" />
        </div>

        <van-empty
          v-else-if="conversations.length === 0"
          description="暂无历史会话"
        />

        <div v-else class="chat__history-list">
          <div
            v-for="item in conversations"
            :key="item.id"
            :ref="(el) => setHistoryItemRef(item.id, el)"
            class="chat__history-item"
            :class="{
              'chat__history-item--active': item.id === conversationId,
              'chat__history-item--pinned': item.pinned,
              'chat__history-item--ghost':
                historyMenuVisible && actionTarget?.id === item.id,
            }"
            @touchstart.passive="onHistoryPressStart(item)"
            @touchend.passive="onHistoryPressEnd"
            @touchcancel.passive="onHistoryPressEnd"
            @touchmove.passive="onHistoryPressMove"
            @mousedown="onHistoryPressStart(item)"
            @mouseup="onHistoryPressEnd"
            @mouseleave="onHistoryPressEnd"
            @contextmenu.prevent
          >
            <div
              v-if="renamingId === item.id"
              class="chat__history-main chat__history-main--editing"
              @touchstart.stop
              @mousedown.stop
            >
              <span v-if="item.pinned" class="chat__history-pin">置顶</span>
              <input
                ref="renameInputRef"
                v-model="renameTitle"
                class="chat__history-rename-input"
                type="text"
                maxlength="40"
                placeholder="请输入会话名称"
                @keydown="onRenameKeydown"
                @blur="commitInlineRename"
              />
            </div>
            <button
              v-else
              type="button"
              class="chat__history-main"
              @click="selectConversation(item.id)"
            >
              <div class="chat__history-item-title">
                <span v-if="item.pinned" class="chat__history-pin">置顶</span>
                <span class="chat__history-item-title-text">{{
                  item.title
                }}</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </van-popup>

    <Teleport to="body">
      <div
        v-if="historyMenuVisible && actionTarget"
        class="chat-ctx"
        @click="closeHistoryMenu"
      >
        <div class="chat-ctx__backdrop" />
        <div
          class="chat-ctx__float"
          :class="{ 'chat-ctx__float--above': historyMenuAbove }"
          :style="historyMenuStyle"
          @click.stop
        >
          <div class="chat-ctx__card">
            <div class="chat-ctx__card-icon" aria-hidden="true">
              <van-icon name="chat-o" size="18" />
            </div>
            <div class="chat-ctx__card-title">{{ actionTarget.title }}</div>
          </div>
          <div class="chat-ctx__menu">
            <button type="button" class="chat-ctx__action" @click="onContextPin">
              <span>{{ actionTarget.pinned ? "取消置顶" : "置顶" }}</span>
              <van-icon
                :name="actionTarget.pinned ? 'down' : 'back-top'"
                size="18"
              />
            </button>
            <button
              type="button"
              class="chat-ctx__action"
              @click="onContextRename"
            >
              <span>编辑对话名称</span>
              <van-icon name="edit" size="18" />
            </button>
            <button
              type="button"
              class="chat-ctx__action chat-ctx__action--danger"
              @click="onContextDelete"
            >
              <span>从对话列表删除</span>
              <van-icon name="delete-o" size="18" />
            </button>
          </div>
        </div>
      </div>
    </Teleport>
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

.chat__nav-action {
  border: none;
  background: transparent;
  color: #1989fa;
  font-size: 14px;
  line-height: 1;
  padding: 0;
  cursor: pointer;
}

.chat__nav-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat__body {
  flex: 1;
  min-height: 0; /* flex 子项可收缩，overflow 才会生效 */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 16px;
}

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

.chat__history {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
}

.chat__history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 16px 12px;
  border-bottom: 1px solid #ebedf0;
}

.chat__history-title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: #323233;
}

.chat__history-new {
  border: none;
  background: transparent;
  color: #1989fa;
  font-size: 14px;
  padding: 0;
  cursor: pointer;
}

.chat__history-new:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat__history-loading {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}

.chat__history-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 0;
}

.chat__history-item {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid #f5f6f7;
  border-left: 3px solid transparent;
  user-select: none;
  -webkit-user-select: none;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.chat__history-item--active {
  background: #e8f3ff;
  border-left-color: #1989fa;
}

.chat__history-item--active .chat__history-item-title-text {
  color: #1989fa;
  font-weight: 600;
}

.chat__history-item--ghost {
  opacity: 0;
}

.chat__history-main {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  text-align: left;
  padding: 14px 16px 14px 13px;
  cursor: pointer;
}

.chat__history-main--editing {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: text;
}

.chat__history-item-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 15px;
  color: #323233;
  line-height: 1.4;
}

.chat__history-item-title-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat__history-rename-input {
  flex: 1;
  min-width: 0;
  height: 28px;
  margin: 0;
  padding: 0 8px;
  border: 1px solid #1989fa;
  border-radius: 6px;
  outline: none;
  background: #fff;
  font-size: 15px;
  line-height: 28px;
  color: #323233;
  box-sizing: border-box;
}

.chat__history-pin {
  flex-shrink: 0;
  padding: 0 4px;
  border-radius: 3px;
  background: #fff7e8;
  color: #ff976a;
  font-size: 11px;
  line-height: 18px;
}
</style>

<style>
/* Teleport 到 body，需非 scoped */
.chat-ctx {
  position: fixed;
  inset: 0;
  z-index: 4000;
}

.chat-ctx__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(40, 40, 40, 0.28);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  animation: chat-ctx-fade-in 0.18s ease;
}

.chat-ctx__float {
  position: fixed;
  z-index: 1;
  animation: chat-ctx-pop-in 0.2s ease;
}

.chat-ctx__card {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: var(--ctx-card-height, 48px);
  padding: 12px 14px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.14);
  box-sizing: border-box;
}

.chat-ctx__card-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #f2f3f5;
  color: #646566;
}

.chat-ctx__card-title {
  min-width: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.35;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-ctx__menu {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 8px);
  overflow: hidden;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.chat-ctx__float--above .chat-ctx__menu {
  top: auto;
  bottom: calc(100% + 8px);
}

.chat-ctx__action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  margin: 0;
  padding: 14px 16px;
  border: none;
  border-bottom: 1px solid rgba(60, 60, 67, 0.12);
  background: transparent;
  color: #323233;
  font-size: 15px;
  line-height: 1.3;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.chat-ctx__action:last-child {
  border-bottom: none;
}

.chat-ctx__action:active {
  background: rgba(0, 0, 0, 0.04);
}

.chat-ctx__action--danger {
  color: #ee0a24;
}

@keyframes chat-ctx-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes chat-ctx-pop-in {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
