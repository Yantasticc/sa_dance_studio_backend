import { Router } from "express";
import {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  updateStudentStatus,
  getBirthdaysToday,
  getBirthdaysUpcoming,
} from "../controllers/studentController";
import { authMiddleware } from "../middleware/auth";
import { validateStudentInput } from "../middleware/validation";

const router = Router();

// Protect all student routes
router.use(authMiddleware as any);

// Birthdays
router.get("/birthdays/today", getBirthdaysToday);
router.get("/birthdays/upcoming", getBirthdaysUpcoming);

// CRUD
router.get("/", getStudents);
router.get("/:id", getStudentById);
router.post("/", validateStudentInput as any, createStudent);
router.put("/:id", validateStudentInput as any, updateStudent);
router.patch("/:id/status", updateStudentStatus);

export default router;
