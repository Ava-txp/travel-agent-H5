export type ApiErrorKind =
  | "timeout"
  | "rate_limited"
  | "network"
  | "auth"
  | "server"
  | "unknown";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly retryAfterSec?: number;

  constructor(
    message: string,
    kind: ApiErrorKind,
    status?: number,
    retryAfterSec?: number,
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }

  static fromStatus(
    status: number,
    message: string,
    retryAfterSec?: number,
  ): ApiError {
    if (status === 429) {
      return new ApiError(message, "rate_limited", status, retryAfterSec);
    }
    if (status === 401) {
      return new ApiError(message, "auth", status);
    }
    if (status === 408 || status === 504) {
      return new ApiError(message, "timeout", status);
    }
    if (status >= 500) {
      return new ApiError(message, "server", status);
    }
    return new ApiError(message, "unknown", status, retryAfterSec);
  }
}

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError;

export async function apiErrorFromResponse(
  response: Response,
): Promise<ApiError> {
  let message = "请求失败";
  let retryAfter = Number(response.headers.get("Retry-After") || "") || undefined;

  try {
    const body = (await response.json()) as {
      message?: string;
      retryAfter?: number;
    };
    if (body.message) message = body.message;
    if (typeof body.retryAfter === "number") retryAfter = body.retryAfter;
  } catch {
    // ignore parse error
  }

  return ApiError.fromStatus(response.status, message, retryAfter);
}
