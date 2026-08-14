import { ApiError, apiErrorFromResponse } from "@/api/errors";
import { consumeSseJson } from "@/api/sse";
import { getToken } from "@/utils/auth";
import { getClientId } from "@/utils/clientId";
import type {
  BudgetBreakdown,
  DailyItinerary,
  TravelPlan,
  TravelRecommendParams,
} from "./recommend";

export type RecommendStreamEvent =
  | { type: "stage"; content?: string }
  | { type: "meta"; content: Pick<TravelPlan, "city" | "days" | "totalBudget"> }
  | { type: "day"; content: DailyItinerary }
  | { type: "budget"; content: BudgetBreakdown }
  | { type: "done"; content: TravelPlan }
  | {
      type: "error";
      message?: string;
      code?: string;
      retryAfter?: number;
    };

export type StreamTravelRecommendOptions = TravelRecommendParams & {
  onEvent: (event: RecommendStreamEvent) => void;
  signal?: AbortSignal;
};

const errorFromStream = (event: Extract<RecommendStreamEvent, { type: "error" }>) => {
  const message = event.message || "生成旅游规划失败";
  if (event.code === "RATE_LIMITED") {
    return new ApiError(message, "rate_limited", 429, event.retryAfter ?? 12);
  }
  if (event.code === "PARSE_FAILED") {
    return new ApiError(message, "server");
  }
  return new ApiError(message, "unknown");
};

export async function streamTravelRecommend(
  options: StreamTravelRecommendOptions,
): Promise<TravelPlan> {
  const { city, budget, days, onEvent, signal } = options;
  const token = getToken();

  const response = await fetch("/api/travel/recommend", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "X-Client-Id": getClientId(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ city, budget, days }),
    signal,
  });

  if (!response.ok) {
    throw await apiErrorFromResponse(response);
  }
  if (!response.body) {
    throw new ApiError("浏览器不支持流式响应", "unknown");
  }

  let plan: TravelPlan | null = null;

  await consumeSseJson<RecommendStreamEvent>(response.body, (event) => {
    if (event.type === "error") {
      throw errorFromStream(event);
    }
    onEvent(event);
    if (event.type === "done") {
      plan = event.content;
      return true;
    }
  });

  if (!plan || (plan as TravelPlan).success === false) {
    throw new ApiError(
      (plan as TravelPlan | null)?.message || "生成旅游规划失败",
      "server",
    );
  }

  return plan;
}
