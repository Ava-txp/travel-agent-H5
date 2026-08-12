import { ref, watch, type Ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { fetchConversationDetail } from "@/api/travel";
import { renderMarkdown } from "@/utils/markdown";
import { LAST_CONVERSATION_KEY, type ChatMessage } from "./types";
import { formatTime } from "./utils";
// showToast 由 unplugin-auto-import + VantResolver 自动引入

export function useChatConversation(options: {
  stickToBottom: Ref<boolean>;
  scrollToBottom: (opts?: { force?: boolean }) => Promise<void>;
  getSending: () => boolean;
  abortSending: () => void;
}) {
  const { stickToBottom, scrollToBottom, getSending, abortSending } = options;

  const router = useRouter();
  const route = useRoute();

  /** 当前会话 id；有则多轮续聊，无则首轮由后端创建 */
  const conversationId = ref<string | null>(null);
  const messages = ref<ChatMessage[]>([]);
  /** 拉取会话详情中 */
  const loadingHistory = ref(false);

  let loadAbortController: AbortController | null = null;

  const abortLoadRequest = () => {
    loadAbortController?.abort();
    loadAbortController = null;
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

  const resetToEmptyChat = () => {
    abortSending();
    abortLoadRequest();
    conversationId.value = null;
    messages.value = [];
    persistLastConversationId(null);
    syncConversationRoute(null);
  };

  const loadConversation = async (id: string) => {
    if (getSending()) {
      abortSending();
    }

    abortLoadRequest();
    loadAbortController = new AbortController();
    loadingHistory.value = true;
    // 切换会话时先清空，避免短暂展示上一会话内容
    if (conversationId.value !== id) {
      messages.value = [];
    }

    try {
      const detail = await fetchConversationDetail(
        id,
        loadAbortController.signal,
      );
      conversationId.value = detail.id;
      persistLastConversationId(detail.id);
      messages.value = detail.messages.map((item) => ({
        id: item.id,
        role: item.role,
        content: item.content,
        attachments: item.attachments?.length
          ? item.attachments
          : undefined,
        sceneHint: item.sceneHint,
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

  return {
    conversationId,
    messages,
    loadingHistory,
    loadConversation,
    resetToEmptyChat,
    bindConversationId,
    syncConversationRoute,
    abortLoadRequest,
  };
}
