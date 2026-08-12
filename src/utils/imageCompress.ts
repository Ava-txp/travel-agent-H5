/** 单张上传上限（压缩后） */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** 每轮最多附件数 */
export const MAX_ATTACHMENTS_PER_SEND = 3;
/** 压缩长边上限 */
export const IMAGE_MAX_EDGE = 1600;
/** JPEG 压缩质量 */
export const IMAGE_QUALITY = 0.8;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export const isAllowedImageMime = (mime: string): boolean =>
  ALLOWED_MIME.has(mime.toLowerCase());

const loadImage = (file: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片读取失败"));
    };
    img.src = url;
  });

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("图片压缩失败"));
          return;
        }
        resolve(blob);
      },
      mime,
      quality,
    );
  });

export type CompressedImage = {
  file: File;
  mime: string;
  width: number;
  height: number;
  previewUrl: string;
};

/**
 * 校验并压缩图片：长边约 1600、质量 ~0.8，输出 JPEG（PNG/WebP 透明图也转 JPEG）。
 */
export async function compressImageFile(file: File): Promise<CompressedImage> {
  const rawMime = (file.type || "image/jpeg").toLowerCase();
  if (!isAllowedImageMime(rawMime)) {
    throw new Error("仅支持 JPEG / PNG / WebP 图片");
  }

  const img = await loadImage(file);
  const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("图片压缩失败");

  // JPEG 无透明通道，铺白底避免黑底
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const outMime = "image/jpeg";
  let blob = await canvasToBlob(canvas, outMime, IMAGE_QUALITY);

  // 仍超限则继续降质量
  let quality = IMAGE_QUALITY;
  while (blob.size > MAX_IMAGE_BYTES && quality > 0.4) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, outMime, quality);
  }

  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error("图片过大，请换一张更小的图");
  }

  const name = file.name.replace(/\.\w+$/, "") || "image";
  const compressed = new File([blob], `${name}.jpg`, { type: outMime });
  const previewUrl = URL.createObjectURL(compressed);

  return {
    file: compressed,
    mime: outMime,
    width,
    height,
    previewUrl,
  };
}

export const revokePreviewUrl = (url: string | undefined) => {
  if (!url || !url.startsWith("blob:")) return;
  URL.revokeObjectURL(url);
};
