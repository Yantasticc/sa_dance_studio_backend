import { Router } from "express";
import { login, logout, getMe, forgotPassword, resetPassword } from "../controllers/authController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.post("/login", login);
router.post("/logout", logout);
router.get("/me", authMiddleware as any, getMe as any);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
