import express, { Request, Response } from "express";
import multer from "multer";
import sharp from "sharp";
import path from "path";
import { randomUUID } from "crypto";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requiredAuthenticate } from "../middleware/auth.js";
import { AuthenticatedRequest } from "../types/express.js";

const router = express.Router();

// Multer 설정
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("이미지 파일만 업로드 가능합니다."));
    }
  },
});

// POST /upload/image -> 이미지 업로드
router.post(
  "/image",
  requiredAuthenticate,
  upload.single("image"),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: "이미지 파일이 필요합니다.",
      });
      return;
    }

    try {
      // 이미지 처리
      const filename = `${randomUUID()}.webp`;
      const outputPath = path.join(process.cwd(), "uploads", filename);

      await sharp(req.file.buffer)
        .resize(1200, 800, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toFile(outputPath);

      const imageUrl = `/uploads/${filename}`;

      res.json({
        success: true,
        data: {
          url: imageUrl,
          filename,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: "이미지 처리 중 오류가 발생했습니다.",
      });
    }
  })
);

export default router;
