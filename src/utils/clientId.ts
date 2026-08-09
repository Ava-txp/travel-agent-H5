const STORAGE_KEY = "travel-client-id";

/** 浏览器端稳定 clientId，供后端按客户端隔离会话 */
export function getClientId(): string {
  const existing = localStorage.getItem(STORAGE_KEY)?.trim();
  if (existing) return existing;

  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  localStorage.setItem(STORAGE_KEY, id);
  return id;
}
