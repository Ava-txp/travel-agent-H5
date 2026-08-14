import { computed, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import { fetchPlanDetail, streamTravelRecommend } from "@/api/travel";
import type { TravelPlan } from "@/api/travel";
import { isApiError } from "@/api/errors";
import { kindFromCatch, toApiError, type AbortCause } from "./classifyError";
import { buildHint } from "./hints";
import { applyRecommendEvent } from "./mergePlanEvent";
import {
  CONNECT_TIMEOUT_MS,
  CHUNK_IDLE_MS,
  ELAPSED_TICK_MS,
  SLOW_TTFT_MS,
  totalTimeoutMs,
} from "./timeouts";
import {
  isPendingState,
  type PlanErrorKind,
  type PlanLoadState,
} from "./types";

export function usePlanLoad() {
  const route = useRoute();

  const planId = computed(() => String(route.query.id || ""));
  const city = computed(() => String(route.query.city || ""));
  const budget = computed(() => Number(route.query.budget || 0));
  const days = computed(() => Number(route.query.days || 0));
  const isHistoryView = computed(() => Boolean(planId.value));

  const loadState = ref<PlanLoadState>("connecting");
  const planData = ref<TravelPlan | null>(null);
  const elapsedMs = ref(0);
  const retryAfterSec = ref(0);
  const errorKind = ref<PlanErrorKind | null>(null);

  let abortController: AbortController | null = null;
  let abortCause: AbortCause = null;
  let lastEventAt = 0;
  let elapsedTimer: ReturnType<typeof setInterval> | null = null;
  let retryTimer: ReturnType<typeof setInterval> | null = null;
  let connectTimer: ReturnType<typeof setTimeout> | null = null;
  let totalTimer: ReturnType<typeof setTimeout> | null = null;

  const hint = computed(() =>
    buildHint({
      state: loadState.value,
      city: planData.value?.city || city.value,
      days: planData.value?.days || days.value,
      budget: planData.value?.totalBudget || budget.value,
      elapsedMs: elapsedMs.value,
      retryAfterSec: retryAfterSec.value,
      isHistoryView: isHistoryView.value,
      errorKind: errorKind.value,
    }),
  );

  const isPending = computed(() => isPendingState(loadState.value));
  const isFailed = computed(
    () => loadState.value === "failed" || loadState.value === "rate_limited",
  );
  const isStreaming = computed(
    () => loadState.value === "streaming" || loadState.value === "idle_gap",
  );
  const pageTitle = computed(() => {
    const displayCity = planData.value?.city || city.value;
    return displayCity ? `${displayCity}行程规划` : "行程规划";
  });

  const clearLoadTimers = () => {
    if (elapsedTimer) clearInterval(elapsedTimer);
    if (connectTimer) clearTimeout(connectTimer);
    if (totalTimer) clearTimeout(totalTimer);
    elapsedTimer = connectTimer = totalTimer = null;
  };

  const clearRetryTimer = () => {
    if (retryTimer) clearInterval(retryTimer);
    retryTimer = null;
  };

  const clearTimers = () => {
    clearLoadTimers();
    clearRetryTimer();
  };

  const abortPending = () => {
    abortController?.abort();
    abortController = null;
  };

  const startRetryCountdown = (sec: number) => {
    retryAfterSec.value = sec;
    retryTimer = setInterval(() => {
      retryAfterSec.value = Math.max(0, retryAfterSec.value - 1);
      if (retryAfterSec.value === 0 && retryTimer) {
        clearInterval(retryTimer);
        retryTimer = null;
      }
    }, 1000);
  };

  const startClocks = (limitMs: number) => {
    elapsedMs.value = 0;
    lastEventAt = Date.now();
    const started = Date.now();

    elapsedTimer = setInterval(() => {
      elapsedMs.value = Date.now() - started;
      if (loadState.value === "waiting_ttft" && elapsedMs.value >= SLOW_TTFT_MS) {
        loadState.value = "slow_ttft";
      }
      if (
        (loadState.value === "streaming" || loadState.value === "idle_gap") &&
        Date.now() - lastEventAt >= CHUNK_IDLE_MS
      ) {
        loadState.value = "idle_gap";
      }
    }, ELAPSED_TICK_MS);

    connectTimer = setTimeout(() => {
      if (loadState.value === "connecting") {
        abortCause = "timeout";
        abortPending();
      }
    }, CONNECT_TIMEOUT_MS);

    totalTimer = setTimeout(() => {
      abortCause = "timeout";
      abortPending();
    }, limitMs);
  };

  const fail = (kind: PlanErrorKind, retryAfter?: number) => {
    errorKind.value = kind;
    if (kind === "rate_limited") {
      loadState.value = "rate_limited";
      startRetryCountdown(retryAfter ?? 12);
      return;
    }
    loadState.value = "failed";
  };

  const loadHistory = async (signal: AbortSignal) => {
    const detail = await fetchPlanDetail(planId.value, signal);
    const data = detail.plan;
    if (!data || data.success === false) {
      throw new Error(data?.message || "规划记录无效");
    }
    planData.value = {
      ...data,
      id: detail.id,
      city: data.city || detail.city,
      days: data.days ?? detail.days,
      totalBudget: data.totalBudget ?? detail.totalBudget,
    };
    loadState.value = "success";
  };

  const loadGenerate = async (signal: AbortSignal) => {
    const plan = await streamTravelRecommend({
      city: city.value,
      budget: budget.value,
      days: days.value,
      signal,
      onEvent: (event) => {
        lastEventAt = Date.now();
        if (event.type === "stage" && loadState.value === "connecting") {
          loadState.value = "waiting_ttft";
          return;
        }
        const next = applyRecommendEvent(planData.value, event, {
          city: city.value,
          budget: budget.value,
          days: days.value,
        });
        if (!next || next === planData.value) return;
        planData.value = next;
        loadState.value = event.type === "done" ? "success" : "streaming";
      },
    });
    planData.value = plan;
    loadState.value = "success";
  };

  const loadPlan = async () => {
    if (!planId.value && (!city.value || !budget.value || !days.value)) {
      fail("invalid_params");
      return;
    }

    abortCause = null;
    abortPending();
    clearTimers();
    abortController = new AbortController();
    const { signal } = abortController;

    loadState.value = "connecting";
    errorKind.value = null;
    planData.value = null;
    retryAfterSec.value = 0;
    startClocks(
      isHistoryView.value ? 30_000 : totalTimeoutMs(days.value),
    );

    try {
      if (planId.value) await loadHistory(signal);
      else await loadGenerate(signal);
    } catch (error) {
      if (abortCause === "user") return;
      if (signal.aborted && abortCause === null) return;
      const kind = kindFromCatch(error, abortCause);
      if (!kind) return;
      fail(
        kind,
        isApiError(error) ? error.retryAfterSec : toApiError(error).retryAfterSec,
      );
    } finally {
      clearLoadTimers();
      if (abortController?.signal === signal) abortController = null;
    }
  };

  const cancelLoad = () => {
    if (!isPending.value) return;
    abortCause = "user";
    abortPending();
    clearTimers();
    fail("canceled");
  };

  onUnmounted(() => {
    abortCause = "user";
    abortPending();
    clearTimers();
  });

  return {
    city,
    budget,
    days,
    isHistoryView,
    pageTitle,
    loadState,
    planData,
    hint,
    isPending,
    isFailed,
    isStreaming,
    loadPlan,
    cancelLoad,
  };
}
