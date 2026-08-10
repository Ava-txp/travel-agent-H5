import type { ConversationSummary } from "@/api/travel";

let messageSeq = 0;

export const nextMessageId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${++messageSeq}`;

export const formatTime = (date = new Date()) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

export const sortConversations = (list: ConversationSummary[]) =>
  [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
