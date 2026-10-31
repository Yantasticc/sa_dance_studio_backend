import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { errorResponse, successResponse } from "../utils/response";
import { authMiddleware } from "../middleware/auth";
import prisma from "../config/prisma";

const router = Router();

// Configure multer memory storage
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Allowed 10MB in multer parsing, custom validate to 2MB to return exact error message
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|webp/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Please upload a JPG, JPEG, PNG, or WebP image."));
  }
});

// Helper to determine target upload directory and paths using a pre-generated ID
function getUploadPaths(context: string, originalName: string, uniqueId: string) {
  const allowedContexts = ["website", "gallery", "courses", "events", "certifications"];
  const targetContext = allowedContexts.includes(context) ? context : "gallery";

  const ext = path.extname(originalName).toLowerCase();
  const uniqueFileName = `${uniqueId}${ext}`;

  const relativePath = `/uploads/${targetContext}/${uniqueFileName}`;
  const absolutePath = path.join(__dirname, "../../uploads", targetContext, uniqueFileName);

  return { relativePath, absolutePath };
}

// ── Single image upload ──────────────────────────────────────────────────────
router.post("/", authMiddleware as any, (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to parse upload request."
      });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No image uploaded" });
  }

  // 1. Enforce 2MB size limit on Backend
  if (req.file.size > 2 * 1024 * 1024) {
    return res.status(400).json({
      success: false,
      message: "Image size must be 2 MB or less. Please reduce the image size and try again."
    });
  }

  try {
    const context = (req.query.context as string) || "gallery";
    const uniqueId = crypto.randomUUID();
    const { relativePath, absolutePath } = getUploadPaths(context, req.file.originalname, uniqueId);

    // Save physical file into backend uploads folder
    fs.writeFileSync(absolutePath, req.file.buffer);

    // Save relative image path, database ID (matching physical filename UUID) and metadata in PostgreSQL
    const photo = await prisma.galleryPhoto.create({
      data: {
        id: uniqueId,
        imagePath: relativePath,
        mimeType: req.file.mimetype,
        fileName: req.file.originalname,
        fileSize: req.file.size,
      },
    });

    const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
    const fileUrl = `${baseUrl}${relativePath}`;

    return successResponse(res, "Image uploaded successfully", { url: fileUrl, id: photo.id, path: relativePath });
  } catch (error: any) {
    console.error("Single upload error:", error);
    return res.status(500).json({ success: false, message: "Failed to save image to server." });
  }
});

// ── Multiple images upload (up to 20, for gallery bulk upload) ───────────────
router.post("/multiple", authMiddleware as any, (req, res, next) => {
  upload.array("images", 20)(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to parse upload request."
      });
    }
    next();
  });
}, async (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return res.status(400).json({ success: false, message: "No images uploaded" });
  }

  // 1. Enforce 2MB size limit per file on Backend
  for (const file of files) {
    if (file.size > 2 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: `Image size must be 2 MB or less. File "${file.originalname}" exceeds this limit.`
      });
    }
  }

  try {
    const context = (req.query.context as string) || "gallery";

    const savedPhotos = await Promise.all(
      files.map((file) => {
        const uniqueId = crypto.randomUUID();
        const { relativePath, absolutePath } = getUploadPaths(context, file.originalname, uniqueId);

        // Save physical file
        fs.writeFileSync(absolutePath, file.buffer);

        // Save metadata/relative path in database, matching physical filename UUID with database ID
        return prisma.galleryPhoto.create({
          data: {
            id: uniqueId,
            imagePath: relativePath,
            mimeType: file.mimetype,
            fileName: file.originalname,
            fileSize: file.size,
          },
        });
      })
    );

    const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
    const urls = savedPhotos.map((p) => ({
      url: `${baseUrl}${p.imagePath}`,
      originalName: p.fileName,
      id: p.id,
      path: p.imagePath
    }));

    return successResponse(res, `${files.length} image(s) uploaded successfully`, { urls });
  } catch (error: any) {
    console.error("Multiple upload error:", error);
    return res.status(500).json({ success: false, message: "Failed to save images to server." });
  }
});

export default router;
