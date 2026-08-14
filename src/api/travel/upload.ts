import axiosRequest from "@/api/axiosRequest";
import type { ChatAttachment } from "./conversations";
import type { ApiOk } from "./types";

export interface UploadTravelImageResult {
  id: string;
  url: string;
  mime: string;
  width?: number;
  height?: number;
}

/**
 * 上传聊天图片：multipart POST /travel/uploads/image
 * 返回 attachment id / url，供后续 chat 引用。
 */
export async function uploadTravelImage(
  file: File,
  signal?: AbortSignal,
): Promise<ChatAttachment> {
  const form = new FormData();
  form.append("file", file);

  const { data } = await axiosRequest.post<ApiOk<UploadTravelImageResult>>(
    "/travel/uploads/image",
    form,
    {
      signal,
      // 交由浏览器/axios 自动带 boundary，避免沿用实例默认 application/json
      headers: { "Content-Type": undefined },
    },
  );

  if (!data.data?.id || !data.data.url) {
    throw new Error(data.message || "图片上传失败");
  }

  return {
    id: data.data.id,
    type: "image",
    url: data.data.url,
    mime: data.data.mime || file.type || "image/jpeg",
    width: data.data.width,
    height: data.data.height,
  };
}
