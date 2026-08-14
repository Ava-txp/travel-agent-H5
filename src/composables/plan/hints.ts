import type { LoadHint, PlanErrorKind, PlanLoadState } from "./types";

export type BuildHintInput = {
  state: PlanLoadState;
  city: string;
  days: number;
  budget: number;
  elapsedMs: number;
  retryAfterSec?: number;
  isHistoryView: boolean;
  errorKind?: PlanErrorKind | null;
};

const waitSec = (elapsedMs: number) => Math.ceil(elapsedMs / 1000);

const failedHint = (input: BuildHintInput): LoadHint => {
  const { city, days, budget, errorKind } = input;
  const kept = city
    ? `已保留 ${city}${days ? ` · ${days}天` : ""}${budget ? ` · ¥${budget}` : ""}`
    : "可稍后重试";

  if (errorKind === "invalid_params") {
    return {
      kind: "warn",
      title: "缺少必要参数，请返回重新填写",
      retryDisabled: true,
    };
  }
  if (errorKind === "canceled") {
    return {
      kind: "warn",
      title: "已取消生成",
      desc: kept,
      retryLabel: "重新生成",
    };
  }
  if (errorKind === "timeout") {
    return {
      kind: "danger",
      title: days
        ? `规划超时。${days} 天行程生成较久，建议稍后重试或减少天数`
        : "加载超时，请稍后重试",
      desc: kept,
      retryLabel: "重试",
    };
  }
  if (errorKind === "network") {
    return {
      kind: "danger",
      title: "网络异常，请检查连接后重试",
      retryLabel: "重试",
    };
  }
  if (errorKind === "auth") {
    return {
      kind: "danger",
      title: "登录已过期，请重新登录",
      retryLabel: "重试",
    };
  }
  return {
    kind: "danger",
    title: input.isHistoryView ? "加载规划记录失败" : "规划引擎暂时不可用",
    desc: input.isHistoryView ? undefined : kept,
    retryLabel: "重试",
  };
};

export function buildHint(input: BuildHintInput): LoadHint {
  const { state, city, days, elapsedMs, retryAfterSec, isHistoryView } = input;
  const wait = waitSec(elapsedMs);
  const cityText = city || "目的地";

  if (state === "rate_limited") {
    const n = retryAfterSec ?? 0;
    return {
      kind: "danger",
      title: n > 0 ? `当前规划请求较多，请 ${n} 秒后再试` : "当前规划请求较多，请稍后再试",
      desc: "频繁重试会延长等待，倒计时结束后再点",
      retryDisabled: n > 0,
      retryLabel: n > 0 ? `${n}s 后重试` : "重试",
    };
  }

  if (state === "failed") return failedHint(input);

  if (isHistoryView) {
    return { kind: "info", title: "正在加载规划记录..." };
  }

  if (state === "connecting" || wait < 2) {
    return { kind: "info", title: "正在连接规划引擎…" };
  }
  if (state === "idle_gap") {
    return {
      kind: "warn",
      title: `连接较慢，仍在生成${cityText}行程，请稍候`,
    };
  }
  if (state === "streaming") {
    return { kind: "info", title: `正在安排${cityText}的行程…` };
  }
  if ((state === "waiting_ttft" || state === "slow_ttft") && wait < 8) {
    return { kind: "info", title: `正在为${cityText}检索景点和交通信息…` };
  }
  if (wait < 20) {
    return {
      kind: "info",
      title: days
        ? `${days} 天行程生成中，通常需要 15–30 秒`
        : "行程生成中，请稍候",
    };
  }
  return {
    kind: "warn",
    title: "高峰期生成较慢，你可以继续等待",
    desc: "也可以返回减少天数后再试",
  };
}
