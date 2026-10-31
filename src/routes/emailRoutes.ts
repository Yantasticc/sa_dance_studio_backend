import { Router } from "express";
import { previewCampaign, sendBulkEmail, getHistory, getHistoryById, checkEmailHealth, testEmail } from "../controllers/emailController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// All email campaign routes require admin auth
router.use(authMiddleware as any);

router.post("/preview", previewCampaign);
router.post("/bulk", sendBulkEmail as any);
router.get("/history", getHistory);
router.get("/history/:id", getHistoryById);
router.get("/health", checkEmailHealth as any);
router.post("/test", testEmail as any);

export default router;
