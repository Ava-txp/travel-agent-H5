import axiosRequest from "@/api/axiosRequest";
import type { TravelPlan } from "./recommend";
import type { ApiOk } from "./types";

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

export async function fetchPlans(signal?: AbortSignal): Promise<PlanSummary[]> {
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
