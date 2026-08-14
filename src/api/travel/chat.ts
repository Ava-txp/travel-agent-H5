import { getToken } from "@/utils/auth";
import { getClientId } from "@/utils/clientId";
import type { ChatSceneHint } from "./conversations";
import type { ChatLocationPayload } from "./location";

export interface ChatStreamEvent {
  type: "chunk" | "done" | "error";
  content?: unknown;
  message?: string;
}

export interface ChatStreamResult {
  content: string;
  conversationId?: string;
}

export interface StreamTravelChatOptions {
  message: string;
  conversationId?: string;
  /** 已上传的图片附件 id 列表 */
  attachments?: Array<{ id: string; type: "image" }>;
  /** 场景软提示，后端可纠正 */
  sceneHint?: ChatSceneHint;
  /** 浏览器定位坐标，供「当前位置天气」等场景使用 */
  location?: ChatLocationPayload;
  onChunk: (chunk: string) => void;
  signal?: AbortSignal;
}

/**
 * 流式对话：POST /travel/chat，按 SSE 逐段回调 content。
 * 传入 conversationId 续聊；省略则后端新建会话，并在 done 中回传 id。
 */
export async function streamTravelChat(
  options: StreamTravelChatOptions,
): Promise<ChatStreamResult> {
  const {
    message,
    conversationId,
    attachments,
    sceneHint,
    location,
    onChunk,
    signal,
  } = options;

  const token = getToken();
  const response = await fetch("/api/travel/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "X-Client-Id": getClientId(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message,
      ...(conversationId ? { conversationId } : {}),
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
      ...(sceneHint ? { sceneHint } : {}),
      ...(location
        ? {
            location: {
              lat: location.lat,
              lon: location.lon,
              ...(typeof location.accuracy === "number"
                ? { accuracy: location.accuracy }
                : {}),
              ...(location.city ? { city: location.city } : {}),
              ...(location.displayName
                ? { displayName: location.displayName }
                : {}),
            },
          }
        : {}),
    }),
    signal,
  });

  if (!response.ok) {
    let errMsg = "请求失败";
    try {
      const err = (await response.json()) as { message?: string };
      errMsg = err.message || errMsg;
    } catch {
      // ignore parse error
    }
    throw new Error(errMsg);
  }

  if (!response.body) {
    throw new Error("浏览器不支持流式响应");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let fullText = "";
  let resolvedConversationId = conversationId;

  const handleEvent = (event: ChatStreamEvent): boolean => {
    // 处理分段数据
    if (event.type === "chunk" && typeof event.content === "string") {
      fullText += event.content;
      onChunk(event.content);
      return false;
    }

    // 处理错误事件
    if (event.type === "error") {
      throw new Error(event.message || "对话失败");
    }

    // 处理完成事件
    if (event.type === "done") {
      const payload = event.content;
      // 【step1】: payload为对象格式，则按对象格式处理完成事件的 payload
      if (payload && typeof payload === "object") {
        const obj = payload as { conversationId?: unknown; content?: unknown };
        // step1-1: 处理完成事件的 payload 中的 conversationId
        if (typeof obj.conversationId === "string") {
          resolvedConversationId = obj.conversationId;
        }
        // step1-2: 处理完成事件的 payload 中的 content
        if (typeof obj.content === "string" && !fullText) {
          fullText = obj.content;
          onChunk(obj.content);
        }
      }
      // 【step2】: payload为字符串格式，则按字符串格式处理完成事件的 payload
      else if (typeof payload === "string" && !fullText) {
        fullText = payload;
        onChunk(payload);
      }
      return true;
    }

    return false;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    // 按空行拆分返回的数据
    const parts = buffer.split("\n\n");
    // 保留最后一行不完整的数据 => pop+赋值操作，可以同时确保相同的数据只被处理一次
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      for (const line of part.split("\n")) {
        // 非数据列，跳过计算
        if (!line.startsWith("data:")) continue;

        // 去掉数据列前缀
        const raw = line.replace(/^data:\s?/, "").trim();
        if (!raw) continue;

        let event: ChatStreamEvent;
        try {
          event = JSON.parse(raw) as ChatStreamEvent;
        } catch {
          continue;
        }

        // 只有 event.type === "done" 时，才会结束while循环
        if (handleEvent(event)) {
          return {
            content: fullText,
            conversationId: resolvedConversationId,
          };
        }
      }
    }
  }

  return {
    content: fullText,
    conversationId: resolvedConversationId,
  };
}
