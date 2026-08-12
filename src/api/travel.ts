import axiosRequest from "@/api/axiosRequest";
import { getClientId } from "@/utils/clientId";
import { getToken } from "@/utils/auth";

export interface TravelRecommendParams {
  city: string;
  budget: number;
  days: number;
}

export interface TravelPeriod {
  spot: string;
  duration: string;
  ticket: string;
  transportation: string;
  description: string;
}

export interface DailyItinerary {
  day: number;
  date: string;
  morning: TravelPeriod;
  afternoon: TravelPeriod;
  evening: TravelPeriod;
}

export interface BudgetBreakdown {
  accommodation: number;
  food: number;
  transportation: number;
  tickets: number;
  other: number;
}

export interface TravelPlan {
  success: boolean;
  id?: string;
  city?: string;
  days?: number;
  totalBudget?: number;
  dailyItinerary?: DailyItinerary[];
  budgetBreakdown?: BudgetBreakdown;
  tips?: string[];
  warnings?: string[];
  message?: string;
}

export interface PlanSummary {
  id: string;
  city: string;
  days: number;
  totalBudget: number;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface PlanDetail extends PlanSummary {
  plan: TravelPlan;
}

export interface TravelRecommendResponse {
  status: "ok" | "error";
  data?: TravelPlan;
  message?: string;
}

export async function fetchTravelRecommend(
  params: TravelRecommendParams,
  signal?: AbortSignal,
): Promise<TravelRecommendResponse> {
  const { data } = await axiosRequest.post<TravelRecommendResponse>(
    "/travel/recommend",
    params,
    { signal },
  );

  return data;
}

export type ChatRole = "user" | "assistant";

/** 多模态场景软提示：后端分类为主，前端 hint 仅加权 */
export type ChatSceneHint = "spot_sign" | "ticket_itinerary" | "food_menu";

export interface ChatAttachment {
  id: string;
  type: "image";
  url: string;
  mime: string;
  width?: number;
  height?: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  pinned: boolean;
  updatedAt: number;
  preview: string;
}

export interface ConversationMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  attachments?: ChatAttachment[];
  sceneHint?: ChatSceneHint;
}

export interface ConversationDetail {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ConversationMessage[];
}

export interface ChatStreamEvent {
  type: "chunk" | "done" | "error";
  content?: unknown;
  message?: string;
}

export interface ChatStreamResult {
  content: string;
  conversationId?: string;
}

export interface ChatLocationPayload {
  lat: number;
  lon: number;
  accuracy?: number;
  city?: string;
  displayName?: string;
}

export interface ReverseGeocodeResult {
  lat: number;
  lon: number;
  city: string;
  displayName: string;
}

export interface UploadTravelImageResult {
  id: string;
  url: string;
  mime: string;
  width?: number;
  height?: number;
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

type ApiOk<T> = {
  status: "ok" | "error";
  data?: T;
  message?: string;
};

export async function fetchPlans(
  signal?: AbortSignal,
): Promise<PlanSummary[]> {
  const { data } = await axiosRequest.get<ApiOk<PlanSummary[]>>(
    "/travel/plans",
    { signal },
  );
  return data.data ?? [];
}

export async function fetchPlanDetail(
  id: string,
  signal?: AbortSignal,
): Promise<PlanDetail> {
  const { data } = await axiosRequest.get<ApiOk<PlanDetail>>(
    `/travel/plans/${id}`,
    { signal },
  );
  if (!data.data) {
    throw new Error(data.message || "规划记录不存在");
  }
  return data.data;
}

export async function deletePlan(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await axiosRequest.delete<ApiOk<unknown>>(`/travel/plans/${id}`, {
    signal,
  });
}

/** 经纬度反查城市与地址 */
export async function reverseGeocodeLocation(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<ReverseGeocodeResult> {
  const { data } = await axiosRequest.get<ApiOk<ReverseGeocodeResult>>(
    "/travel/location/reverse",
    {
      params: { lat, lon },
      signal,
    },
  );
  if (!data.data) {
    throw new Error(data.message || "逆地理编码失败");
  }
  return data.data;
}

export async function fetchConversations(
  signal?: AbortSignal,
): Promise<ConversationSummary[]> {
  const { data } = await axiosRequest.get<ApiOk<ConversationSummary[]>>(
    "/travel/conversations",
    { signal },
  );
  return data.data ?? [];
}

export async function fetchConversationDetail(
  id: string,
  signal?: AbortSignal,
): Promise<ConversationDetail> {
  const { data } = await axiosRequest.get<ApiOk<ConversationDetail>>(
    `/travel/conversations/${id}`,
    { signal },
  );
  if (!data.data) {
    throw new Error(data.message || "会话不存在");
  }
  return data.data;
}

export async function createConversation(
  signal?: AbortSignal,
): Promise<ConversationSummary> {
  const { data } = await axiosRequest.post<
    ApiOk<{
      id: string;
      title: string;
      createdAt: number;
      updatedAt: number;
    }>
  >("/travel/conversations", undefined, { signal });

  if (!data.data) {
    throw new Error(data.message || "创建会话失败");
  }

  return {
    id: data.data.id,
    title: data.data.title,
    pinned: false,
    updatedAt: data.data.updatedAt,
    preview: "",
  };
}

export async function deleteConversation(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await axiosRequest.delete<ApiOk<unknown>>(`/travel/conversations/${id}`, {
    signal,
  });
}

export async function updateConversation(
  id: string,
  payload: { title?: string; pinned?: boolean },
  signal?: AbortSignal,
): Promise<Pick<ConversationSummary, "id" | "title" | "pinned" | "updatedAt">> {
  const { data } = await axiosRequest.patch<
    ApiOk<Pick<ConversationSummary, "id" | "title" | "pinned" | "updatedAt">>
  >(`/travel/conversations/${id}`, payload, { signal });

  if (!data.data) {
    throw new Error(data.message || "更新会话失败");
  }
  return data.data;
}

/**
 * 上传聊天图片：multipart POST /travel/uploads/image
 * 返回 attachment id / url，供后续 chat 引用。
 */
export async function uploadTravelImage(
  file: File,
  signal?: AbortSignal,
): Promise<ChatAttachment> {
  const form = new FormData();
  form.append("file", file);

  const { data } = await axiosRequest.post<ApiOk<UploadTravelImageResult>>(
    "/travel/uploads/image",
    form,
    {
      signal,
      // 交由浏览器/axios 自动带 boundary，避免沿用实例默认 application/json
      headers: { "Content-Type": undefined },
    },
  );

  if (!data.data?.id || !data.data.url) {
    throw new Error(data.message || "图片上传失败");
  }

  return {
    id: data.data.id,
    type: "image",
    url: data.data.url,
    mime: data.data.mime || file.type || "image/jpeg",
    width: data.data.width,
    height: data.data.height,
  };
}

/**
 * 流式对话：POST /travel/chat，按 SSE 逐段回调 content。
 * 传入 conversationId 续聊；省略则后端新建会话，并在 done 中回传 id。
 */
export async function streamTravelChat(
  options: StreamTravelChatOptions,
): Promise<ChatStreamResult> {
  const { message, conversationId, attachments, sceneHint, location, onChunk, signal } =
    options;

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
    if (event.type === "chunk" && typeof event.content === "string") {
      fullText += event.content;
      onChunk(event.content);
      return false;
    }

    if (event.type === "error") {
      throw new Error(event.message || "对话失败");
    }

    if (event.type === "done") {
      const payload = event.content;
      if (payload && typeof payload === "object") {
        const obj = payload as { conversationId?: unknown; content?: unknown };
        if (typeof obj.conversationId === "string") {
          resolvedConversationId = obj.conversationId;
        }
        if (typeof obj.content === "string" && !fullText) {
          fullText = obj.content;
          onChunk(obj.content);
        }
      } else if (typeof payload === "string" && !fullText) {
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
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const raw = line.replace(/^data:\s?/, "").trim();
        if (!raw) continue;

        let event: ChatStreamEvent;
        try {
          event = JSON.parse(raw) as ChatStreamEvent;
        } catch {
          continue;
        }

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
