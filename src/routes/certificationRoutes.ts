import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  getPublicCertifications,
  getAdminCertifications,
  createCertification,
  updateCertification,
  deleteCertification,
} from "../controllers/certificationController";

const router = Router();

// ── Public ──────────────────────────────────────────────────────────────────
router.get("/", getPublicCertifications);

// ── Admin (auth required) ───────────────────────────────────────────────────
router.get("/admin", authMiddleware as any, getAdminCertifications);
router.post("/admin", authMiddleware as any, createCertification);
router.put("/admin/:id", authMiddleware as any, updateCertification);
router.delete("/admin/:id", authMiddleware as any, deleteCertification);

export default router;
