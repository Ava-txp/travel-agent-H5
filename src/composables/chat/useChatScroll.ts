import { nextTick, ref } from "vue";
import { BOTTOM_THRESHOLD } from "./types";

export function useChatScroll() {
  const listRef = ref<HTMLElement | null>(null);
  /** 未上滑时为 true：内容更新后自动贴底 */
  const stickToBottom = ref(true);
  let scrollRafId: number | null = null;

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

  const disposeScroll = () => {
    if (scrollRafId !== null) {
      window.cancelAnimationFrame(scrollRafId);
      scrollRafId = null;
    }
  };

  return {
    listRef,
    stickToBottom,
    onListScroll,
    scrollToBottom,
    scheduleScrollToBottom,
    disposeScroll,
  };
}
