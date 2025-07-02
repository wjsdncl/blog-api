import express from "express";
import multer from "multer";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requiredAuthenticate } from "../middleware/auth.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

// Supabase 클라이언트 생성
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// 허용된 이미지 파일 형식
const ALLOWED_MIME_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

// Multer 설정 (파일 업로드 미들웨어)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error("허용된 이미지 파일 형식만 업로드할 수 있습니다."), false);
    }
  },
});

// 이미지 처리 및 Supabase에 업로드 함수
async function processAndUploadImage(buffer, originalName) {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const fileName = `${timestamp}-${randomId}-${originalName}`;

  try {
    // Sharp를 사용하여 이미지 최적화
    const optimizedBuffer = await sharp(buffer)
      .resize(1920, 1080, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 85,
        progressive: true,
      })
      .toBuffer();

    // Supabase Storage에 업로드
    const { data, error } = await supabase.storage.from("blog-images").upload(fileName, optimizedBuffer, {
      contentType: "image/jpeg",
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      logger.error("Supabase upload error", { error: error.message, fileName });
      throw new Error(`이미지 업로드 실패: ${error.message}`);
    }

    // 공개 URL 생성
    const { data: publicUrlData } = supabase.storage.from("blog-images").getPublicUrl(fileName);

    logger.info("Image uploaded successfully", { fileName, url: publicUrlData.publicUrl });
    return publicUrlData.publicUrl;
  } catch (error) {
    logger.error("Image processing error", { error: error.message, originalName });
    throw error;
  }
}

// POST /upload -> 이미지 업로드 API
router.post(
  "/",
  requiredAuthenticate,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "이미지 파일을 업로드하세요.",
      });
    }

    try {
      // HD 해상도로 이미지 처리 및 업로드
      const url = await processAndUploadImage(req.file.buffer, req.file.originalname);

      logger.info("File uploaded", {
        userId: req.user.userId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        url,
      });

      res.json({
        success: true,
        data: { url },
      });
    } catch (error) {
      logger.error("Upload failed", {
        error: error.message,
        userId: req.user.userId,
        fileName: req.file.originalname,
      });

      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  })
);

export default router;
