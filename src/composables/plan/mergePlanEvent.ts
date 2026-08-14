import type { TravelPlan } from "@/api/travel";
import type { RecommendStreamEvent } from "@/api/travel/recommendStream";

type Fallback = { city: string; budget: number; days: number };

const emptyPlan = (fallback: Fallback, extra?: Partial<TravelPlan>): TravelPlan => ({
  success: true,
  city: fallback.city,
  days: fallback.days,
  totalBudget: fallback.budget,
  dailyItinerary: [],
  ...extra,
});

export function applyRecommendEvent(
  prev: TravelPlan | null,
  event: RecommendStreamEvent,
  fallback: Fallback,
): TravelPlan | null {
  if (event.type === "meta") {
    const base = prev ?? emptyPlan(fallback);
    return {
      ...base,
      city: event.content.city || base.city || fallback.city,
      days: event.content.days ?? base.days ?? fallback.days,
      totalBudget:
        event.content.totalBudget ?? base.totalBudget ?? fallback.budget,
    };
  }

  if (event.type === "day") {
    const base = prev ?? emptyPlan(fallback);
    const list = [...(base.dailyItinerary ?? [])];
    const idx = list.findIndex((item) => item.day === event.content.day);
    if (idx >= 0) list[idx] = event.content;
    else list.push(event.content);
    list.sort((a, b) => a.day - b.day);
    return { ...base, dailyItinerary: list };
  }

  if (event.type === "budget") {
    const base = prev ?? emptyPlan(fallback);
    return { ...base, budgetBreakdown: event.content };
  }

  if (event.type === "done") {
    return event.content;
  }

  return prev;
}
