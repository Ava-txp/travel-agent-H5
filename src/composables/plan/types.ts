import type { ApiErrorKind } from "@/api/errors";

export type PlanLoadState =
  | "connecting"
  | "waiting_ttft"
  | "slow_ttft"
  | "streaming"
  | "idle_gap"
  | "success"
  | "rate_limited"
  | "failed";

export type PlanErrorKind = ApiErrorKind | "canceled" | "invalid_params";

export type HintKind = "info" | "warn" | "danger";

export interface LoadHint {
  title: string;
  desc?: string;
  kind: HintKind;
  retryDisabled?: boolean;
  retryLabel?: string;
}

export const PENDING_STATES: readonly PlanLoadState[] = [
  "connecting",
  "waiting_ttft",
  "slow_ttft",
  "streaming",
  "idle_gap",
];

export const isPendingState = (state: PlanLoadState): boolean =>
  PENDING_STATES.includes(state);
