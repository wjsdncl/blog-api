import sharp from "sharp";
import { logger } from "@/utils/logger.js";

const MAX_WIDTH = 1920;
const WEBP_QUALITY = 80;

interface OptimizedImage {
  buffer: Buffer;
  contentType: string;
  extension: string;
}

async function optimizeImage(buffer: Buffer, mimetype: string): Promise<OptimizedImage> {
  if (mimetype === "image/gif") {
    return { buffer, contentType: mimetype, extension: ".gif" };
  }

  const optimized = await sharp(buffer)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  return { buffer: optimized, contentType: "image/webp", extension: ".webp" };
}

function buildFilePath(safeName: string, extension: string): string {
  const uuid = crypto.randomUUID().slice(0, 8);
  const baseName = safeName.replace(/\.[^.]+$/, "");
  return `posts/${uuid}-${baseName}${extension}`;
}

interface ProcessedImage {
  buffer: Buffer;
  contentType: string;
  filePath: string;
}

export async function processImage(
  originalBuffer: Buffer,
  mimetype: string,
  filename: string,
): Promise<ProcessedImage> {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");

  try {
    const optimized = await optimizeImage(originalBuffer, mimetype);

    if (mimetype !== "image/gif") {
      const reduction = ((1 - optimized.buffer.length / originalBuffer.length) * 100).toFixed(1);
      logger.info(
        `Image optimized: ${originalBuffer.length} → ${optimized.buffer.length} bytes (${reduction}% reduction)`,
      );
    }

    return {
      buffer: optimized.buffer,
      contentType: optimized.contentType,
      filePath: buildFilePath(safeName, optimized.extension),
    };
  } catch (err) {
    logger.warn(`Image optimization failed, uploading original: ${err}`);
    const ext = safeName.match(/\.[^.]+$/)?.[0] || ".png";

    return {
      buffer: originalBuffer,
      contentType: mimetype,
      filePath: buildFilePath(safeName, ext),
    };
  }
}
