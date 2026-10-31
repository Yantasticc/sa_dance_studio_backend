import { Router } from "express";
import { getCourses, getCourseById, createCourse, updateCourse, updateCourseStatus } from "../controllers/courseController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Public route to list courses
router.get("/", getCourses);
router.get("/:id", getCourseById);

// Protected admin routes
router.post("/", authMiddleware as any, createCourse);
router.put("/:id", authMiddleware as any, updateCourse);
router.patch("/:id/status", authMiddleware as any, updateCourseStatus);

export default router;
