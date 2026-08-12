import type { ChatSceneHint } from "@/api/travel";

/**
 * 后端场景管线契约（H5 侧类型对齐用）。
 * 实际抽取与生成在服务端完成；前端通过 sceneHint 加权分流。
 */

/** 景点 / 路牌 Vision 抽取结果 */
export type SpotSignExtract = {
  placeName?: string;
  placeType?: string;
  visibleText?: string;
  confidence: number;
};

/** 门票 / 行程单结构化抽取 */
export type TicketItineraryExtract = {
  kind: "ticket" | "itinerary" | "mixed" | "unknown";
  title?: string;
  spots: string[];
  /** YYYY-MM-DD */
  startDate?: string;
  endDate?: string;
  visitTime?: string;
  ticketType?: string;
  price?: string;
  /** 完整值仅后端持有；对外展示应脱敏 */
  orderNo?: string;
  notes: string[];
  confidence: number;
};

/** 美食 / 价目表抽取 */
export type FoodMenuItem = {
  name: string;
  price?: number;
  category?: string;
};

export type FoodMenuExtract = {
  items: FoodMenuItem[];
  /** 从菜单估算的人均区间 */
  avgPriceMin?: number;
  avgPriceMax?: number;
  confidence: number;
};

export type SceneExtract =
  | { scene: "spot_sign"; data: SpotSignExtract }
  | { scene: "ticket_itinerary"; data: TicketItineraryExtract }
  | { scene: "food_menu"; data: FoodMenuExtract }
  | { scene: "unknown"; data: null };

/** 订单号脱敏：仅保留后 4 位 */
export const maskOrderNo = (orderNo: string): string => {
  const trimmed = orderNo.trim();
  if (trimmed.length <= 4) return "****";
  return `${"*".repeat(Math.min(trimmed.length - 4, 8))}${trimmed.slice(-4)}`;
};

/** 从用户文案粗解析预算（元）；解析失败返回 null */
export const parseBudgetFromText = (
  text: string,
): { total?: number; perPerson?: number } | null => {
  const content = text.trim();
  if (!content) return null;

  const perPerson = content.match(
    /人均\s*(?:大概|大约|约)?\s*(\d+(?:\.\d+)?)\s*(?:元|块)?/,
  );
  if (perPerson) {
    return { perPerson: Number(perPerson[1]) };
  }

  const twoPerson = content.match(
    /(?:两个人|两人|两位)\s*(?:一共|共|预算)?\s*(\d+(?:\.\d+)?)\s*(?:元|块)?/,
  );
  if (twoPerson) {
    return { total: Number(twoPerson[1]) };
  }

  const budget = content.match(
    /预算\s*(?:大概|大约|约)?\s*(\d+(?:\.\d+)?)\s*(?:元|块)?/,
  );
  if (budget) {
    return { total: Number(budget[1]) };
  }

  return null;
};

/** 场景对应的回答结构提示（可随请求一并给后端作 system 加权，也可仅作文档） */
export const SCENE_ANSWER_OUTLINE: Record<ChatSceneHint, string[]> = {
  spot_sign: [
    "这是哪里（名称 + 一句话）",
    "值不值得去（适合人群、耗时、费用量级、注意点）",
    "附近怎么玩（2–3 个邻近点 + 建议路线时长）",
    "置信度低时说明不确定，并请用户补充城市或景点名",
  ],
  ticket_itinerary: [
    "关键信息清单（日期、景点、时段、票种）",
    "注意事项摘要",
    "与用户计划冲突时提醒",
    "订单号等敏感字段脱敏（只留后 4 位）",
  ],
  food_menu: [
    "菜单解读（特色/必点/慎点）",
    "按预算的组合套餐（2–3 套，含估算总价）",
    "无预算时追问，并给高/中/低三档示例",
    "有定位时可补充相对价格判断（无数据则不做硬比价）",
  ],
};
