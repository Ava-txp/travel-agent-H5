import { ref, type Ref } from "vue";
import { streamTravelChat } from "@/api/travel";
import { renderMarkdown } from "@/utils/markdown";
import {
  getUserLocation,
  needsUserLocation,
  type UserLocation,
} from "@/utils/geolocation";
import type { ChatMessage } from "./types";
import { formatTime, nextMessageId } from "./utils";
// showToast 由 unplugin-auto-import + VantResolver 自动引入

export function useChatSend(options: {
  conversationId: Ref<string | null>;
  messages: Ref<ChatMessage[]>;
  loadingHistory: Ref<boolean>;
  stickToBottom: Ref<boolean>;
  scrollToBottom: (opts?: { force?: boolean }) => Promise<void>;
  scheduleScrollToBottom: () => void;
  bindConversationId: (id: string) => void;
}) {
  const {
    conversationId,
    messages,
    loadingHistory,
    stickToBottom,
    scrollToBottom,
    scheduleScrollToBottom,
    bindConversationId,
  } = options;

  const input = ref("");
  /** 请求进行中：禁用输入与常见问题，按钮切换为「停止」 */
  const sending = ref(false);
  /** 已发出请求但尚未收到首个 chunk：展示「AI 正在思考中」 */
  const thinking = ref(false);
  /** 按需定位结果（仅位置相关提问时获取并展示） */
  const userLocation = ref<UserLocation | null>(null);
  const locating = ref(false);

  let abortController: AbortController | null = null;

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
    if (sending.value || loadingHistory.value) return;

    messages.value.push({
      id: nextMessageId(),
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

  return {
    input,
    sending,
    thinking,
    userLocation,
    locating,
    sendMessage,
    stopGeneration,
    abortPendingRequest,
    onFaqClick,
  };
}
