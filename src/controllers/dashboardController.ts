import { Request, Response } from "express";
import prisma from "../config/prisma";
import { successResponse, errorResponse } from "../utils/response";

export async function getStats(req: Request, res: Response) {
  try {
    const [
      totalStudents,
      activeStudents,
      totalCourses,
      upcomingEvents,
      newEnquiries,
      birthdaysCountRaw
    ] = await Promise.all([
      prisma.student.count(),
      prisma.student.count({ where: { status: "ACTIVE" } }),
      prisma.course.count({ where: { status: "ACTIVE" } }),
      prisma.event.count({ where: { status: "UPCOMING" } }),
      prisma.enquiry.count({ where: { status: "NEW" } }),
      prisma.$queryRawUnsafe<any[]>(`
        SELECT COUNT(*)::int as count
        FROM "Student"
        WHERE EXTRACT(MONTH FROM "dateOfBirth") = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(DAY FROM "dateOfBirth") = EXTRACT(DAY FROM CURRENT_DATE)
          AND status = 'ACTIVE'
      `)
    ]);

    const todayBirthdaysCount = birthdaysCountRaw[0]?.count || 0;

    return successResponse(res, "Dashboard stats fetched successfully.", {
      totalStudents,
      activeStudents,
      totalCourses,
      upcomingEvents,
      newEnquiries,
      todayBirthdaysCount,
    });
  } catch (error) {
    console.error("getStats error:", error);
    return errorResponse(res, "Failed to retrieve dashboard statistics.", "DB_ERROR", null, 500);
  }
}
