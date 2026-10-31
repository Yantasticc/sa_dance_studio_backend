import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { getPublicSections, servePhoto } from "../controllers/galleryController";
import {
  getWebsiteImages,
  getWebsiteImagesAdmin,
  setWebsiteImage,
  removeWebsiteImage,
} from "../controllers/websiteImageController";

const router = Router();

// ── Gallery public media retrieval ─────────────────────────────────────────
router.get("/sections", getPublicSections);
router.get("/photos/:id", servePhoto);

// ── Website Images — Public ─────────────────────────────────────────────────
// Returns { key: imageUrl } map for all configured slots
router.get("/website-images", getWebsiteImages);

// ── Website Images — Admin (auth required) ──────────────────────────────────
router.get("/website-images/admin", authMiddleware as any, getWebsiteImagesAdmin);
router.put("/website-images/:key", authMiddleware as any, setWebsiteImage);
router.delete("/website-images/:key", authMiddleware as any, removeWebsiteImage);

export default router;
