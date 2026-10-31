import { Request, Response } from "express";
import prisma from "../config/prisma";
import { successResponse, errorResponse } from "../utils/response";

export async function getBatches(req: Request, res: Response) {
  const { courseId } = req.query;
  try {
    const batches = await prisma.batch.findMany({
      where: courseId ? { courseId: String(courseId) } : {},
      include: { course: true },
      orderBy: { createdAt: "asc" },
    });
    return successResponse(res, "Batches fetched successfully.", batches);
  } catch (error) {
    console.error("getBatches error:", error);
    return errorResponse(res, "Failed to fetch batches.", "DB_ERROR", null, 500);
  }
}

export async function getBatchById(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const batch = await prisma.batch.findUnique({
      where: { id },
      include: { course: true },
    });
    if (!batch) {
      return errorResponse(res, "Batch not found.", "NOT_FOUND", null, 404);
    }
    return successResponse(res, "Batch fetched successfully.", batch);
  } catch (error) {
    console.error("getBatchById error:", error);
    return errorResponse(res, "Failed to fetch batch.", "DB_ERROR", null, 500);
  }
}

export async function createBatch(req: Request, res: Response) {
  const { name, courseId, days, startTime, endTime, capacity, status } = req.body;
  if (!name || !courseId || !days || !startTime || !endTime || capacity === undefined) {
    return errorResponse(res, "All fields are required.", "INVALID_INPUT");
  }

  try {
    const batch = await prisma.batch.create({
      data: {
        name,
        courseId,
        days,
        startTime,
        endTime,
        capacity: Number(capacity),
        status: status || "ACTIVE",
      },
    });
    return successResponse(res, "Batch created successfully.", batch, 201);
  } catch (error) {
    console.error("createBatch error:", error);
    return errorResponse(res, "Failed to create batch.", "DB_ERROR", null, 500);
  }
}

export async function updateBatch(req: Request, res: Response) {
  const { id } = req.params;
  const { name, courseId, days, startTime, endTime, capacity, status } = req.body;

  try {
    const batch = await prisma.batch.update({
      where: { id },
      data: {
        name,
        courseId,
        days,
        startTime,
        endTime,
        capacity: capacity !== undefined ? Number(capacity) : undefined,
        status,
      },
    });
    return successResponse(res, "Batch updated successfully.", batch);
  } catch (error) {
    console.error("updateBatch error:", error);
    return errorResponse(res, "Failed to update batch.", "DB_ERROR", null, 500);
  }
}

export async function deleteBatch(req: Request, res: Response) {
  const { id } = req.params;
  try {
    await prisma.batch.delete({ where: { id } });
    return successResponse(res, "Batch deleted successfully.");
  } catch (error) {
    console.error("deleteBatch error:", error);
    return errorResponse(res, "Failed to delete batch.", "DB_ERROR", null, 500);
  }
}
