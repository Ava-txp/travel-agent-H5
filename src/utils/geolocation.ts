import { reverseGeocodeLocation } from "@/api/travel";

export type UserLocation = {
  lat: number;
  lon: number;
  accuracy?: number;
  city?: string;
  displayName?: string;
  /** 定位时间戳 */
  timestamp: number;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const GEO_TIMEOUT_MS = 8000;

/** 显式位置意图（业内常见：按需申请定位，避免进页即弹权限） */
const EXPLICIT_LOCATION_RE =
  /当前位置|所在位置|我所在|我这里|我这边|这附近|附近|周边|周围|当地|本地|附近的|周边的|周围的|定位一下|我的位置/;

/** 天气/出行类意图：未点名城市时，才需要当前位置 */
const WEATHER_OR_LOCAL_RE =
  /天气|气温|下雨|降雨|穿衣|紫外线|空气质量|冷不冷|热不热|适不适合出门|适合出门吗/;

/** 用户已点名目的地城市时，不必再取定位 */
const NAMED_CITY_RE =
  /北京|上海|广州|深圳|杭州|成都|重庆|西安|南京|武汉|苏州|天津|青岛|大连|厦门|长沙|郑州|济南|福州|合肥|昆明|贵阳|南宁|海口|三亚|拉萨|乌鲁木齐|呼和浩特|银川|西宁|哈尔滨|长春|沈阳|石家庄|太原|南昌|兰州|香港|澳门|台北|东京|大阪|京都|名古屋|福冈|札幌|首尔|曼谷|新加坡|巴黎|伦敦|纽约|洛杉矶|悉尼/;

let cached: UserLocation | null = null;
let inflight: Promise<UserLocation | null> | null = null;

const readPosition = (): Promise<UserLocation> =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("当前环境不支持定位"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy:
            typeof pos.coords.accuracy === "number"
              ? pos.coords.accuracy
              : undefined,
          timestamp: pos.timestamp || Date.now(),
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: false,
        timeout: GEO_TIMEOUT_MS,
        maximumAge: CACHE_TTL_MS,
      },
    );
  });

const enrichWithCity = async (location: UserLocation): Promise<UserLocation> => {
  if (location.city && location.displayName) return location;

  try {
    const geo = await reverseGeocodeLocation(location.lat, location.lon);
    return {
      ...location,
      city: geo.city,
      displayName: geo.displayName,
    };
  } catch (error) {
    console.warn("[geolocation] reverse geocode failed:", error);
    return location;
  }
};

/**
 * 是否需要附带用户定位（按需触发）。
 * - 明确提到「附近 / 当前位置 / 当地」等
 * - 或问天气/出行但未点名城市
 */
export const needsUserLocation = (text: string): boolean => {
  const content = text.trim();
  if (!content) return false;

  if (EXPLICIT_LOCATION_RE.test(content)) return true;

  if (WEATHER_OR_LOCAL_RE.test(content) && !NAMED_CITY_RE.test(content)) {
    return true;
  }

  return false;
};

/** 获取当前位置（含城市名）；失败返回 null，不抛错 */
export const getUserLocation = async (
  options: { force?: boolean; withCity?: boolean } = {},
): Promise<UserLocation | null> => {
  const { force = false, withCity = true } = options;

  if (
    !force &&
    cached &&
    Date.now() - cached.timestamp < CACHE_TTL_MS &&
    (!withCity || cached.city)
  ) {
    return cached;
  }

  if (!force && inflight) return inflight;

  inflight = (async () => {
    try {
      let location = await readPosition();
      if (withCity) {
        location = await enrichWithCity(location);
      }
      cached = location;
      return location;
    } catch (error) {
      console.warn("[geolocation] failed:", error);
      return cached;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
};
