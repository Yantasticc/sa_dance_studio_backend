import { Router } from "express";
import { getStats } from "../controllers/dashboardController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.get("/stats", authMiddleware as any, getStats);

export default router;
