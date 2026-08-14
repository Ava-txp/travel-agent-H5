import { ApiError, isApiError, type ApiErrorKind } from "@/api/errors";

export const isCanceled = (error: unknown): boolean => {
  const err = error as { name?: string; code?: string };
  return (
    err?.name === "AbortError" ||
    err?.name === "CanceledError" ||
    err?.code === "ERR_CANCELED"
  );
};

export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) return error;
  if (error instanceof Error) {
    if (/timeout|ECONNABORTED/i.test(error.message)) {
      return new ApiError(error.message, "timeout");
    }
    if (/network|failed to fetch/i.test(error.message)) {
      return new ApiError("网络异常，请检查连接后重试", "network");
    }
    return new ApiError(error.message, "unknown");
  }
  return new ApiError("生成旅游规划失败", "unknown");
}

export type AbortCause = "user" | "timeout" | null;

export function kindFromCatch(
  error: unknown,
  abortCause: AbortCause,
): ApiErrorKind | "canceled" | null {
  if (abortCause === "user") return "canceled";
  if (abortCause === "timeout") return "timeout";
  if (isCanceled(error)) return null;
  return toApiError(error).kind;
}
