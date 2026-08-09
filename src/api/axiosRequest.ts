import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { getClientId } from "@/utils/clientId";

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
    return config;
  },
  (error) => Promise.reject(error),
);

axiosRequest.interceptors.response.use(
  (response: AxiosResponse) => {
    const payload = response.data as { status?: string; message?: string };

    console.log("response", response);

    // 业务层约定：status !== 'ok' 视为失败
    if (
      response.status !== 200 ||
      (payload?.status && payload.status !== "ok")
    ) {
      return Promise.reject(new Error(payload.message || "请求失败"));
    }

    return response;
  },
  (error) => {
    if (axios.isCancel(error) || error?.code === "ERR_CANCELED") {
      return Promise.reject(error);
    }

    const message =
      error?.response?.data?.message ||
      error?.message ||
      "网络异常，请稍后重试";

    return Promise.reject(new Error(message));
  },
);

export default axiosRequest;
