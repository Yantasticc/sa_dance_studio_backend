import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  getPublicSections,
  getPublicSectionById,
  getAdminSections,
  createSection,
  updateSection,
  deleteSection,
  addPhotos,
  updatePhoto,
  deletePhoto,
  addVideo,
  updateVideo,
  deleteVideo,
} from "../controllers/galleryController";

const router = Router();

// ── Public ──────────────────────────────────────────────────────────────────
// Returns only published sections with their media
router.get("/sections", getPublicSections);
router.get("/sections/:id", getPublicSectionById);

// ── Admin — Sections (auth required) ────────────────────────────────────────
router.get("/admin/sections", authMiddleware as any, getAdminSections);
router.post("/admin/sections", authMiddleware as any, createSection);
router.put("/admin/sections/:id", authMiddleware as any, updateSection);
router.delete("/admin/sections/:id", authMiddleware as any, deleteSection);

// ── Admin — Photos (auth required) ──────────────────────────────────────────
router.post("/admin/sections/:sectionId/photos", authMiddleware as any, addPhotos);
router.put("/admin/photos/:id", authMiddleware as any, updatePhoto);
router.delete("/admin/photos/:id", authMiddleware as any, deletePhoto);

// ── Admin — Videos (auth required) ──────────────────────────────────────────
router.post("/admin/sections/:sectionId/videos", authMiddleware as any, addVideo);
router.put("/admin/videos/:id", authMiddleware as any, updateVideo);
router.delete("/admin/videos/:id", authMiddleware as any, deleteVideo);

export default router;
