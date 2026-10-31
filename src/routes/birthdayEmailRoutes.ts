import { Router } from "express";
import { runBirthdayJobManual, getBirthdayEmailHistory } from "../controllers/birthdayEmailController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// All birthday email management routes require admin auth
router.use(authMiddleware as any);

router.post("/run", runBirthdayJobManual);
router.get("/history", getBirthdayEmailHistory);

export default router;
