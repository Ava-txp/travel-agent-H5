<script setup lang="ts">
import { onUnmounted } from "vue";
import { useRouter } from "vue-router";
import ChatComposer from "@/components/chat/ChatComposer.vue";
import ChatHistoryDrawer from "@/components/chat/ChatHistoryDrawer.vue";
import ChatMessageList from "@/components/chat/ChatMessageList.vue";
import { useChatConversation } from "@/composables/chat/useChatConversation";
import { useChatHistory } from "@/composables/chat/useChatHistory";
import { useChatScroll } from "@/composables/chat/useChatScroll";
import { useChatSend } from "@/composables/chat/useChatSend";

const router = useRouter();

/** 打破 conversation / send 之间的循环依赖 */
const sendBridge = {
  abortPendingRequest: () => {},
  getSending: () => false,
  clearSendState: () => {},
};

const {
  stickToBottom,
  onListScroll,
  scrollToBottom,
  scheduleScrollToBottom,
  disposeScroll,
} = useChatScroll();

const {
  conversationId,
  messages,
  loadingHistory,
  resetToEmptyChat: resetConversation,
  bindConversationId,
  syncConversationRoute,
  abortLoadRequest,
} = useChatConversation({
  stickToBottom,
  scrollToBottom,
  getSending: () => sendBridge.getSending(),
  abortSending: () => {
    sendBridge.abortPendingRequest();
    sendBridge.clearSendState();
  },
});

const {
  input,
  sending,
  thinking,
  userLocation,
  locating,
  sendMessage,
  stopGeneration,
  abortPendingRequest,
  onFaqClick,
} = useChatSend({
  conversationId,
  messages,
  loadingHistory,
  stickToBottom,
  scrollToBottom,
  scheduleScrollToBottom,
  bindConversationId,
});

sendBridge.abortPendingRequest = abortPendingRequest;
sendBridge.getSending = () => sending.value;
sendBridge.clearSendState = () => {
  sending.value = false;
  thinking.value = false;
};

const resetToEmptyChat = () => {
  sendBridge.clearSendState();
  resetConversation();
};

const {
  historyVisible,
  historyLoading,
  conversations,
  historyMenuVisible,
  actionTarget,
  historyMenuAbove,
  historyMenuStyle,
  renamingId,
  renameTitle,
  setHistoryItemRef,
  setRenameInputRef,
  closeHistoryMenu,
  onHistoryPressStart,
  onHistoryPressEnd,
  onHistoryPressMove,
  openHistory,
  selectConversation,
  commitInlineRename,
  onRenameKeydown,
  onContextPin,
  onContextRename,
  onContextDelete,
  startNewConversation,
  disposeHistory,
} = useChatHistory({
  conversationId,
  sending,
  resetToEmptyChat,
  syncConversationRoute,
});

const goBack = () => {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.push("/");
};

onUnmounted(() => {
  abortPendingRequest();
  abortLoadRequest();
  disposeScroll();
  disposeHistory();
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
      <ChatMessageList
        :messages="messages"
        :loading-history="loadingHistory"
        :thinking="thinking"
        :sending="sending"
        @faq-click="onFaqClick"
      />
    </div>

    <ChatComposer
      v-model="input"
      :sending="sending"
      :loading-history="loadingHistory"
      :locating="locating"
      :user-location="userLocation"
      @send="sendMessage()"
      @stop="stopGeneration"
    />

    <ChatHistoryDrawer
      v-model:show="historyVisible"
      v-model:rename-title="renameTitle"
      :loading="historyLoading"
      :conversations="conversations"
      :conversation-id="conversationId"
      :sending="sending"
      :renaming-id="renamingId"
      :history-menu-visible="historyMenuVisible"
      :action-target="actionTarget"
      :history-menu-above="historyMenuAbove"
      :history-menu-style="historyMenuStyle"
      @new-chat="startNewConversation"
      @select="selectConversation"
      @set-item-ref="setHistoryItemRef"
      @set-rename-input-ref="setRenameInputRef"
      @press-start="onHistoryPressStart"
      @press-end="onHistoryPressEnd"
      @press-move="onHistoryPressMove"
      @rename-keydown="onRenameKeydown"
      @rename-blur="commitInlineRename"
      @close-menu="closeHistoryMenu"
      @context-pin="onContextPin"
      @context-rename="onContextRename"
      @context-delete="onContextDelete"
    />
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
</style>
