import { ref, type Ref } from "vue";
import {
  streamTravelChat,
  uploadTravelImage,
  type ChatAttachment,
  type ChatSceneHint,
} from "@/api/travel";
import { renderMarkdown } from "@/utils/markdown";
import {
  getUserLocation,
  needsUserLocation,
  type UserLocation,
} from "@/utils/geolocation";
import {
  compressImageFile,
  MAX_ATTACHMENTS_PER_SEND,
  revokePreviewUrl,
} from "@/utils/imageCompress";
import {
  sceneNeedsLocation,
  type ChatMessage,
  type ChatSceneShortcut,
  type PendingAttachment,
} from "./types";
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
  /** 待发送附件（选图后先上传） */
  const pendingAttachments = ref<PendingAttachment[]>([]);
  /** 空态场景快捷入口写入的软提示 */
  const sceneHint = ref<ChatSceneHint | null>(null);

  let abortController: AbortController | null = null;
  let uploadSeq = 0;
  /** 递增后使进行中的 rAF commit 失效（切会话 / 新发送） */
  let sendSeq = 0;
  let chunkRafId: number | null = null;
  let pendingAssistantText: string | null = null;
  let commitAssistant: ((text: string) => void) | null = null;

  const cancelChunkRaf = () => {
    if (chunkRafId !== null) {
      window.cancelAnimationFrame(chunkRafId);
      chunkRafId = null;
    }
  };

  const flushPendingAssistant = () => {
    cancelChunkRaf();
    if (pendingAssistantText === null || !commitAssistant) return;
    const text = pendingAssistantText;
    pendingAssistantText = null;
    commitAssistant(text);
  };

  /** 流式 chunk 密集时合并为一帧最多渲染一次 Markdown / DOM */
  const scheduleAssistantUpdate = (text: string) => {
    if (!commitAssistant) return;
    pendingAssistantText = text;
    if (chunkRafId !== null) return;
    chunkRafId = window.requestAnimationFrame(() => {
      chunkRafId = null;
      if (pendingAssistantText === null || !commitAssistant) {
        pendingAssistantText = null;
        return;
      }
      const text = pendingAssistantText;
      pendingAssistantText = null;
      commitAssistant(text);
    });
  };

  const abortStream = () => {
    abortController?.abort();
    abortController = null;
    cancelChunkRaf();
  };

  const abortPendingRequest = () => {
    abortStream();
    sendSeq += 1;
    pendingAssistantText = null;
    commitAssistant = null;
  };

  /** 中断生成：保留已展示内容，仅停止后续流式输出 */
  const stopGeneration = () => {
    if (!sending.value) return;
    abortStream();
  };

  const clearPendingAttachments = () => {
    for (const item of pendingAttachments.value) {
      revokePreviewUrl(item.previewUrl);
    }
    pendingAttachments.value = [];
  };

  const clearSendDraft = () => {
    input.value = "";
    sceneHint.value = null;
    clearPendingAttachments();
  };

  const removePendingAttachment = (localId: string) => {
    const target = pendingAttachments.value.find((a) => a.localId === localId);
    if (target) revokePreviewUrl(target.previewUrl);
    pendingAttachments.value = pendingAttachments.value.filter(
      (a) => a.localId !== localId,
    );
  };

  const isUploadingAttachments = () =>
    pendingAttachments.value.some((a) => a.status === "uploading");

  const addImageFiles = async (files: FileList | File[]) => {
    if (sending.value || loadingHistory.value) return;

    const list = Array.from(files);
    const room = MAX_ATTACHMENTS_PER_SEND - pendingAttachments.value.length;
    if (room <= 0) {
      showToast(`最多添加 ${MAX_ATTACHMENTS_PER_SEND} 张图片`);
      return;
    }

    const selected = list.slice(0, room);
    if (list.length > room) {
      showToast(`最多添加 ${MAX_ATTACHMENTS_PER_SEND} 张图片`);
    }

    for (const file of selected) {
      const localId = `local-${Date.now()}-${++uploadSeq}`;
      let previewUrl = "";
      try {
        const compressed = await compressImageFile(file);
        previewUrl = compressed.previewUrl;
        const pending: PendingAttachment = {
          localId,
          status: "uploading",
          previewUrl,
          mime: compressed.mime,
          width: compressed.width,
          height: compressed.height,
        };
        pendingAttachments.value = [...pendingAttachments.value, pending];

        const uploaded = await uploadTravelImage(compressed.file);
        pendingAttachments.value = pendingAttachments.value.map((item) =>
          item.localId === localId
            ? { ...item, status: "ready", uploaded }
            : item,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "图片上传失败";
        if (previewUrl) {
          pendingAttachments.value = pendingAttachments.value.map((item) =>
            item.localId === localId
              ? { ...item, status: "error", error: message }
              : item,
          );
        }
        showToast(message);
      }
    }
  };

  const applySceneShortcut = (shortcut: ChatSceneShortcut) => {
    if (sending.value || loadingHistory.value) return;
    sceneHint.value = shortcut.scene;
    if (!input.value.trim()) {
      input.value = shortcut.prompt;
    }
    showToast(`已选择「${shortcut.label}」，请添加图片后发送`);
  };

  const readyAttachments = (): ChatAttachment[] =>
    pendingAttachments.value
      .filter((a) => a.status === "ready" && a.uploaded)
      .map((a) => a.uploaded!);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input.value).trim();
    const attachments = readyAttachments();
    const currentScene = sceneHint.value ?? undefined;

    if (!content && attachments.length === 0) {
      showToast("请输入问题或添加图片");
      return;
    }
    if (sending.value || loadingHistory.value) return;
    if (isUploadingAttachments()) {
      showToast("图片上传中，请稍候");
      return;
    }
    if (pendingAttachments.value.some((a) => a.status === "error")) {
      showToast("请移除上传失败的图片后再发送");
      return;
    }

    // 展示用：优先服务端 url，否则本地预览
    const displayAttachments: ChatAttachment[] = pendingAttachments.value
      .filter((a) => a.status === "ready")
      .map((a) =>
        a.uploaded
          ? a.uploaded
          : {
              id: a.localId,
              type: "image" as const,
              url: a.previewUrl,
              mime: a.mime,
              width: a.width,
              height: a.height,
            },
      );

    messages.value.push({
      id: nextMessageId(),
      role: "user",
      content,
      attachments:
        displayAttachments.length > 0 ? displayAttachments : undefined,
      sceneHint: currentScene,
      time: formatTime(),
    });

    // 气泡已改用远端 url，释放本地预览
    const previewUrls = pendingAttachments.value.map((a) => a.previewUrl);
    input.value = "";
    sceneHint.value = null;
    pendingAttachments.value = [];
    for (const url of previewUrls) revokePreviewUrl(url);
    sending.value = true;
    thinking.value = true;
    stickToBottom.value = true;
    await scrollToBottom({ force: true });

    abortPendingRequest();
    const controller = new AbortController();
    abortController = controller;
    const thisSend = sendSeq;

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
        return;
      }

      const target = messages.value.find((item) => item.id === assistantId);
      if (!target) return;
      target.content = text;
      target.html = renderMarkdown(text);
    };

    commitAssistant = (text: string) => {
      if (thisSend !== sendSeq) return;
      upsertAssistant(text);
      scheduleScrollToBottom();
    };

    let aborted = false;
    let failMessage: string | null = null;

    try {
      let location: UserLocation | null = null;
      const wantLocation =
        needsUserLocation(content) ||
        (attachments.length > 0 && sceneNeedsLocation(currentScene));

      if (wantLocation) {
        locating.value = true;
        try {
          location = await getUserLocation({ withCity: true });
          if (location) {
            userLocation.value = location;
          } else if (attachments.length === 0) {
            showToast("未能获取位置，可直接说明所在城市");
          }
        } finally {
          locating.value = false;
        }
      }

      if (thisSend !== sendSeq || controller.signal.aborted) {
        aborted = true;
        return;
      }

      let fullContent = "";
      const result = await streamTravelChat({
        message: content,
        conversationId: conversationId.value ?? undefined,
        attachments:
          attachments.length > 0
            ? attachments.map((a) => ({ id: a.id, type: "image" as const }))
            : undefined,
        sceneHint: currentScene,
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
          if (thisSend !== sendSeq) return;
          fullContent += chunk;
          if (thinking.value) thinking.value = false;
          scheduleAssistantUpdate(fullContent);
        },
        signal: controller.signal,
      });

      if (result.conversationId) {
        bindConversationId(result.conversationId);
      }
    } catch (error) {
      // 用户主动停止：保留已展示内容，不弹错误；pending 交给 finally 刷出
      if ((error as Error)?.name === "AbortError") {
        aborted = true;
        return;
      }

      failMessage =
        error instanceof Error ? error.message : "对话失败，请稍后重试";
      showToast(failMessage);
    } finally {
      if (thisSend === sendSeq) {
        flushPendingAssistant();
        if (assistantId === null && !aborted) {
          upsertAssistant(
            failMessage
              ? `抱歉，${failMessage}`
              : "暂时没有生成内容，请稍后再试。",
          );
          void scrollToBottom();
        }
        sending.value = false;
        thinking.value = false;
        abortController = null;
        commitAssistant = null;
      }
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
    pendingAttachments,
    sceneHint,
    addImageFiles,
    removePendingAttachment,
    clearSendDraft,
    applySceneShortcut,
    sendMessage,
    stopGeneration,
    abortPendingRequest,
    onFaqClick,
  };
}
