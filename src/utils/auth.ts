export type AuthUser = {
  id: string;
  account: string;
  nickname: string;
  createdAt: number;
};

const TOKEN_KEY = "travel-auth-token";
const USER_KEY = "travel-auth-user";

export const getToken = (): string | null => {
  const token = localStorage.getItem(TOKEN_KEY)?.trim();
  return token || null;
};

export const getStoredUser = (): AuthUser | null => {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as AuthUser;
    if (!user?.id || !user?.account) return null;
    return user;
  } catch {
    return null;
  }
};

export const setAuthSession = (token: string, user: AuthUser) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuthSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const isLoggedIn = () => Boolean(getToken());
