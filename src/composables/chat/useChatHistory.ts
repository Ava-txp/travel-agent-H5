import { nextTick, ref, watch, type Ref } from "vue";
import {
  deleteConversation,
  fetchConversations,
  updateConversation,
  type ConversationSummary,
} from "@/api/travel";
import {
  CTX_EDGE,
  CTX_GAP,
  CTX_MENU_HEIGHT,
  LONG_PRESS_MS,
} from "./types";
import { sortConversations } from "./utils";
// showToast / showConfirmDialog 由 unplugin-auto-import + VantResolver 自动引入

export function useChatHistory(options: {
  conversationId: Ref<string | null>;
  sending: Ref<boolean>;
  resetToEmptyChat: () => void;
  syncConversationRoute: (id: string | null) => void;
}) {
  const { conversationId, sending, resetToEmptyChat, syncConversationRoute } =
    options;

  const historyVisible = ref(false);
  const historyLoading = ref(false);
  const conversations = ref<ConversationSummary[]>([]);

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

  let longPressTimer: number | null = null;
  let suppressHistoryClick = false;

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

  const setRenameInputRef = (el: unknown) => {
    renameInputRef.value = el instanceof HTMLInputElement ? el : null;
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

  watch(historyVisible, (visible) => {
    if (!visible) closeHistoryMenu();
  });

  const disposeHistory = () => {
    clearLongPressTimer();
  };

  return {
    historyVisible,
    historyLoading,
    conversations,
    historyMenuVisible,
    actionTarget,
    historyMenuAbove,
    historyMenuStyle,
    renamingId,
    renameTitle,
    renameInputRef,
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
  };
}
