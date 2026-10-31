import { Router } from "express";
import { createEnquiry, getEnquiries, getEnquiryById, updateEnquiryStatus } from "../controllers/enquiryController";
import { authMiddleware } from "../middleware/auth";
import { enquiryRateLimiter, validateEnquiryInput } from "../middleware/validation";

const router = Router();

// Public route to submit enquiries (with rate limiter & input validation)
router.post("/", enquiryRateLimiter, validateEnquiryInput as any, createEnquiry);

// Protected admin routes
router.get("/", authMiddleware as any, getEnquiries);
router.get("/:id", authMiddleware as any, getEnquiryById);
router.patch("/:id/status", authMiddleware as any, updateEnquiryStatus);

export default router;
