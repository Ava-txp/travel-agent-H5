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

export interface TravelRecommendResponse {
  status: "ok" | "error";
  data?: TravelPlan;
  message?: string;
}
