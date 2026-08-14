import axiosRequest from "@/api/axiosRequest";
import type { ApiOk } from "./types";

export interface ChatLocationPayload {
  lat: number;
  lon: number;
  accuracy?: number;
  city?: string;
  displayName?: string;
}

export interface ReverseGeocodeResult {
  lat: number;
  lon: number;
  city: string;
  displayName: string;
}

/** 经纬度反查城市与地址 */
export async function reverseGeocodeLocation(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<ReverseGeocodeResult> {
  const { data } = await axiosRequest.get<ApiOk<ReverseGeocodeResult>>(
    "/travel/location/reverse",
    {
      params: { lat, lon },
      signal,
    },
  );
  if (!data.data) {
    throw new Error(data.message || "逆地理编码失败");
  }
  return data.data;
}
