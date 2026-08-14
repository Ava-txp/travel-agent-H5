import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { ApiError } from "@/api/errors";
import { getClientId } from "@/utils/clientId";
import { clearAuthSession, getToken } from "@/utils/auth";

const axiosRequest: AxiosInstance = axios.create({
  baseURL: "/api",
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosRequest.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    config.headers.set("X-Client-Id", getClientId());
    const token = getToken();
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

const readRetryAfter = (headers: unknown): number | undefined => {
  if (!headers || typeof headers !== "object") return undefined;
  const rec = headers as Record<string, unknown> & {
    get?: (name: string) => unknown;
  };
  const raw =
    rec["retry-after"] ?? rec["Retry-After"] ?? rec.get?.("retry-after");
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : undefined;
};

axiosRequest.interceptors.response.use(
  (response: AxiosResponse) => {
    const payload = response.data as { status?: string; message?: string };

    console.log("response", response);

    if (
      response.status !== 200 ||
      (payload?.status && payload.status !== "ok")
    ) {
      return Promise.reject(
        new ApiError(payload.message || "请求失败", "server", response.status),
      );
    }

    return response;
  },
  (error) => {
    if (axios.isCancel(error) || error?.code === "ERR_CANCELED") {
      return Promise.reject(error);
    }

    if (error?.code === "ECONNABORTED" || /timeout/i.test(error?.message || "")) {
      return Promise.reject(
        new ApiError("请求超时，请稍后重试", "timeout"),
      );
    }

    if (!error?.response) {
      return Promise.reject(
        new ApiError("网络异常，请检查连接后重试", "network"),
      );
    }

    const status = error.response.status as number;
    if (status === 401) {
      clearAuthSession();
    }

    const message =
      error.response.data?.message ||
      error.message ||
      "网络异常，请稍后重试";

    return Promise.reject(
      ApiError.fromStatus(
        status,
        message,
        readRetryAfter(error.response.headers),
      ),
    );
  },
);

export default axiosRequest;
