import { Router } from "express";
import { getEvents, getEventById, createEvent, updateEvent, deleteEvent } from "../controllers/eventController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Public route to get events
router.get("/", getEvents);
router.get("/:id", getEventById);

// Protected routes to modify events
router.post("/", authMiddleware as any, createEvent);
router.put("/:id", authMiddleware as any, updateEvent);
router.delete("/:id", authMiddleware as any, deleteEvent);

export default router;
