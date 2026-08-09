import axiosRequest from "@/api/axiosRequest";
import { getClientId } from "@/utils/clientId";
import {
  clearAuthSession,
  setAuthSession,
  type AuthUser,
} from "@/utils/auth";

type ApiOk<T> = {
  status: "ok" | "error";
  data?: T;
  message?: string;
};

export type AuthResult = {
  token: string;
  user: AuthUser;
  mergedConversations: number;
};

const persist = (result: AuthResult) => {
  setAuthSession(result.token, result.user);
  return result;
};

export async function register(payload: {
  account: string;
  password: string;
  nickname?: string;
}): Promise<AuthResult> {
  const { data } = await axiosRequest.post<ApiOk<AuthResult>>(
    "/auth/register",
    {
      ...payload,
      clientId: getClientId(),
    },
  );
  if (!data.data?.token || !data.data.user) {
    throw new Error(data.message || "注册失败");
  }
  return persist(data.data);
}

export async function login(payload: {
  account: string;
  password: string;
}): Promise<AuthResult> {
  const { data } = await axiosRequest.post<ApiOk<AuthResult>>("/auth/login", {
    ...payload,
    clientId: getClientId(),
  });
  if (!data.data?.token || !data.data.user) {
    throw new Error(data.message || "登录失败");
  }
  return persist(data.data);
}

export async function fetchMe(): Promise<AuthUser> {
  const { data } = await axiosRequest.get<ApiOk<AuthUser>>("/auth/me");
  if (!data.data) {
    throw new Error(data.message || "获取用户信息失败");
  }
  return data.data;
}

export async function logout(): Promise<void> {
  try {
    await axiosRequest.post("/auth/logout");
  } catch {
    // 忽略网络错误，本地仍清会话
  } finally {
    clearAuthSession();
  }
}
