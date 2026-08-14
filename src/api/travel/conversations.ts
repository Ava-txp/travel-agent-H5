import axiosRequest from "@/api/axiosRequest";
import type { ApiOk } from "./types";

export type ChatRole = "user" | "assistant";

/** 多模态场景软提示：后端分类为主，前端 hint 仅加权 */
export type ChatSceneHint = "spot_sign" | "ticket_itinerary" | "food_menu";

export interface ChatAttachment {
  id: string;
  type: "image";
  url: string;
  mime: string;
  width?: number;
  height?: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  pinned: boolean;
  updatedAt: number;
  preview: string;
}

export interface ConversationMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  attachments?: ChatAttachment[];
  sceneHint?: ChatSceneHint;
}

export interface ConversationDetail {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ConversationMessage[];
}

export async function fetchConversations(
  signal?: AbortSignal,
): Promise<ConversationSummary[]> {
  const { data } = await axiosRequest.get<ApiOk<ConversationSummary[]>>(
    "/travel/conversations",
    { signal },
  );
  return data.data ?? [];
}

export async function fetchConversationDetail(
  id: string,
  signal?: AbortSignal,
): Promise<ConversationDetail> {
  const { data } = await axiosRequest.get<ApiOk<ConversationDetail>>(
    `/travel/conversations/${id}`,
    { signal },
  );
  if (!data.data) {
    throw new Error(data.message || "会话不存在");
  }
  return data.data;
}

export async function createConversation(
  signal?: AbortSignal,
): Promise<ConversationSummary> {
  const { data } = await axiosRequest.post<
    ApiOk<{
      id: string;
      title: string;
      createdAt: number;
      updatedAt: number;
    }>
  >("/travel/conversations", undefined, { signal });

  if (!data.data) {
    throw new Error(data.message || "创建会话失败");
  }

  return {
    id: data.data.id,
    title: data.data.title,
    pinned: false,
    updatedAt: data.data.updatedAt,
    preview: "",
  };
}

export async function deleteConversation(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await axiosRequest.delete<ApiOk<unknown>>(`/travel/conversations/${id}`, {
    signal,
  });
}

export async function updateConversation(
  id: string,
  payload: { title?: string; pinned?: boolean },
  signal?: AbortSignal,
): Promise<Pick<ConversationSummary, "id" | "title" | "pinned" | "updatedAt">> {
  const { data } = await axiosRequest.patch<
    ApiOk<Pick<ConversationSummary, "id" | "title" | "pinned" | "updatedAt">>
  >(`/travel/conversations/${id}`, payload, { signal });

  if (!data.data) {
    throw new Error(data.message || "更新会话失败");
  }
  return data.data;
}
