import axiosRequest from "@/api/axiosRequest";

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
  city?: string;
  days?: number;
  totalBudget?: number;
  dailyItinerary?: DailyItinerary[];
  budgetBreakdown?: BudgetBreakdown;
  tips?: string[];
  warnings?: string[];
  message?: string;
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

export interface ChatStreamEvent {
  type: "chunk" | "done" | "error";
  content?: unknown;
  message?: string;
}

/**
 * 流式对话：POST /travel/chat，按 SSE 逐段回调 content。
 */
export async function streamTravelChat(
  message: string,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch("/api/travel/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ message }),
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

  const handleEvent = (event: ChatStreamEvent) => {
    if (event.type === "chunk" && typeof event.content === "string") {
      fullText += event.content;
      onChunk(event.content);
      return;
    }

    if (event.type === "error") {
      throw new Error(event.message || "对话失败");
    }

    if (event.type === "done") {
      if (typeof event.content === "string" && !fullText) {
        fullText = event.content;
        onChunk(event.content);
      }
    }
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

        handleEvent(event);
        if (event.type === "done") {
          return fullText;
        }
      }
    }
  }

  return fullText;
}
