import { Router } from "express";
import { getBatches, getBatchById, createBatch, updateBatch, deleteBatch } from "../controllers/batchController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.get("/", authMiddleware as any, getBatches);
router.get("/:id", authMiddleware as any, getBatchById);
router.post("/", authMiddleware as any, createBatch);
router.put("/:id", authMiddleware as any, updateBatch);
router.delete("/:id", authMiddleware as any, deleteBatch);

export default router;
