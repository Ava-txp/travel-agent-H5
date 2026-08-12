import type { ChatAttachment, ChatSceneHint } from "@/api/travel";

export type { ChatAttachment, ChatSceneHint };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** 用户消息附图（历史回放或本轮乐观展示） */
  attachments?: ChatAttachment[];
  /** 本轮场景软提示（仅用户侧有意义） */
  sceneHint?: ChatSceneHint;
  /** 助手消息的 Markdown 渲染结果 */
  html?: string;
  time: string;
}

/** Composer 中待发送的本地附件（含上传状态） */
export type PendingAttachment = {
  /** 本地临时 id */
  localId: string;
  status: "uploading" | "ready" | "error";
  previewUrl: string;
  mime: string;
  width?: number;
  height?: number;
  /** 上传成功后的服务端附件 */
  uploaded?: ChatAttachment;
  error?: string;
};

export const LAST_CONVERSATION_KEY = "travel-last-conversation-id";

export const CHAT_FAQS = [
  "北京有哪些必去的景点？",
  "上海美食推荐",
  "成都三日游攻略",
  "如何选择旅行保险？",
] as const;

export type ChatSceneShortcut = {
  scene: ChatSceneHint;
  label: string;
  /** 预填到输入框的默认问法 */
  prompt: string;
};

/** 空态三条多模态场景快捷入口 */
export const CHAT_SCENE_SHORTCUTS: readonly ChatSceneShortcut[] = [
  {
    scene: "spot_sign",
    label: "景点/路牌",
    prompt: "帮我看看这是哪里，值不值得去",
  },
  {
    scene: "ticket_itinerary",
    label: "门票/行程",
    prompt: "帮我识别这张票/行程单的关键信息",
  },
  {
    scene: "food_menu",
    label: "美食/价目",
    prompt: "按这份菜单帮我推荐，兼顾预算",
  },
] as const;

/** 景点/路牌、美食场景默认尝试附带定位 */
export const sceneNeedsLocation = (scene?: ChatSceneHint | null): boolean =>
  scene === "spot_sign" || scene === "food_menu";

/** 距底阈值：兼容橡皮筋与小数误差，避免用 === 0 */
export const BOTTOM_THRESHOLD = 80;

export const LONG_PRESS_MS = 480;
export const CTX_MENU_HEIGHT = 156;
export const CTX_GAP = 8;
export const CTX_EDGE = 12;
