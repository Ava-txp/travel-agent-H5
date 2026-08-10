export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** 助手消息的 Markdown 渲染结果 */
  html?: string;
  time: string;
}

export const LAST_CONVERSATION_KEY = "travel-last-conversation-id";

export const CHAT_FAQS = [
  "北京有哪些必去的景点？",
  "上海美食推荐",
  "成都三日游攻略",
  "如何选择旅行保险？",
] as const;

/** 距底阈值：兼容橡皮筋与小数误差，避免用 === 0 */
export const BOTTOM_THRESHOLD = 80;

export const LONG_PRESS_MS = 480;
export const CTX_MENU_HEIGHT = 156;
export const CTX_GAP = 8;
export const CTX_EDGE = 12;
