import { Request, Response } from "express";
import prisma from "../config/prisma";
import { successResponse, errorResponse } from "../utils/response";
import { runBirthdayEmailJob } from "../services/birthdayEmailService";

/**
 * POST /api/v1/birthday-emails/run
 * Manual trigger endpoint for testing or forced execution of birthday email job.
 * Enforces duplicate protection and Asia/Kolkata timezone logic.
 */
export async function runBirthdayJobManual(req: Request, res: Response) {
  try {
    const result = await runBirthdayEmailJob();
    return successResponse(res, "Birthday email job completed successfully.", result);
  } catch (error: any) {
    console.error("runBirthdayJobManual error:", error);
    return errorResponse(
      res,
      `Failed to execute birthday email job: ${error.message || String(error)}`,
      "JOB_EXECUTION_FAILED",
      null,
      500
    );
  }
}

/**
 * GET /api/v1/birthday-emails/history
 * Fetches the log history of automatic and manual birthday email attempts.
 */
export async function getBirthdayEmailHistory(req: Request, res: Response) {
  try {
    const logs = await prisma.birthdayEmailLog.findMany({
      include: {
        student: {
          include: {
            course: true,
            batch: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return successResponse(res, "Birthday email history retrieved successfully.", logs);
  } catch (error: any) {
    console.error("getBirthdayEmailHistory error:", error);
    return errorResponse(res, "Failed to fetch birthday email history.", "DB_ERROR", null, 500);
  }
}
