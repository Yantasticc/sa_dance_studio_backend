import { Request, Response } from "express";
import prisma from "../config/prisma";
import { successResponse, errorResponse } from "../utils/response";
import { getKolkataDateInfo } from "../services/birthdayEmailService";

export async function getStudents(req: Request, res: Response) {
  const { page = 1, limit = 20, search, courseId, batchId, status } = req.query;

  const parsedPage = Number(page);
  const parsedLimit = Number(limit);
  const skip = (parsedPage - 1) * parsedLimit;

  try {
    const whereClause: any = {};

    if (courseId) {
      whereClause.courseId = String(courseId);
    }
    if (batchId) {
      whereClause.batchId = String(batchId);
    }
    if (status) {
      whereClause.status = String(status) as any;
    }

    if (search) {
      const searchStr = String(search);
      whereClause.OR = [
        { fullName: { contains: searchStr, mode: "insensitive" } },
        { phone: { contains: searchStr, mode: "insensitive" } },
        { whatsappNumber: { contains: searchStr, mode: "insensitive" } },
        { email: { contains: searchStr, mode: "insensitive" } },
      ];
    }

    const [students, total] = await prisma.$transaction([
      prisma.student.findMany({
        where: whereClause,
        include: {
          course: true,
          batch: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parsedLimit,
      }),
      prisma.student.count({ where: whereClause }),
    ]);

    return successResponse(res, "Students fetched successfully.", {
      students,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    console.error("getStudents error:", error);
    return errorResponse(res, "Failed to fetch students.", "DB_ERROR", null, 500);
  }
}

export async function getStudentById(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        course: true,
        batch: true,
      },
    });
    if (!student) {
      return errorResponse(res, "Student not found.", "NOT_FOUND", null, 404);
    }
    return successResponse(res, "Student fetched successfully.", student);
  } catch (error) {
    console.error("getStudentById error:", error);
    return errorResponse(res, "Failed to fetch student.", "DB_ERROR", null, 500);
  }
}

export async function createStudent(req: Request, res: Response) {
  const {
    fullName,
    phone,
    whatsappNumber,
    email,
    dateOfBirth,
    gender,
    address,
    guardianName,
    guardianPhone,
    emergencyContact,
    courseId,
    batchId,
    enrollmentDate,
    status,
    notes,
  } = req.body;

  // Validate Indian mobile numbers: ^[6-9][0-9]{9}$
  const phoneRegex = /^[6-9][0-9]{9}$/;
  if (phone && !phoneRegex.test(phone)) {
    return errorResponse(res, "Phone number must be a valid 10-digit Indian mobile number.", "INVALID_PHONE", null, 400);
  }
  if (whatsappNumber && !phoneRegex.test(whatsappNumber)) {
    return errorResponse(res, "Phone number must be a valid 10-digit Indian mobile number.", "INVALID_WHATSAPP", null, 400);
  }
  if (guardianPhone && !phoneRegex.test(guardianPhone)) {
    return errorResponse(res, "Phone number must be a valid 10-digit Indian mobile number.", "INVALID_GUARDIAN_PHONE", null, 400);
  }
  if (emergencyContact && !phoneRegex.test(emergencyContact)) {
    return errorResponse(res, "Phone number must be a valid 10-digit Indian mobile number.", "INVALID_EMERGENCY_CONTACT", null, 400);
  }

  try {
    const student = await prisma.student.create({
      data: {
        fullName,
        phone,
        whatsappNumber,
        email,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        address,
        guardianName,
        guardianPhone,
        emergencyContact,
        courseId,
        batchId,
        enrollmentDate: enrollmentDate ? new Date(enrollmentDate) : new Date(),
        status: status || "ACTIVE",
        notes,
      },
    });
    return successResponse(res, "Student enrolled successfully.", student, 201);
  } catch (error) {
    console.error("createStudent error:", error);
    return errorResponse(res, "Failed to create student.", "DB_ERROR", null, 500);
  }
}

export async function updateStudent(req: Request, res: Response) {
  const { id } = req.params;
  const {
    fullName,
    phone,
    whatsappNumber,
    email,
    dateOfBirth,
    gender,
    address,
    guardianName,
    guardianPhone,
    emergencyContact,
    courseId,
    batchId,
    enrollmentDate,
    status,
    notes,
  } = req.body;

  // Validate Indian mobile numbers: ^[6-9][0-9]{9}$
  const phoneRegex = /^[6-9][0-9]{9}$/;
  if (phone && !phoneRegex.test(phone)) {
    return errorResponse(res, "Phone number must be a valid 10-digit Indian mobile number.", "INVALID_PHONE", null, 400);
  }
  if (whatsappNumber && !phoneRegex.test(whatsappNumber)) {
    return errorResponse(res, "Phone number must be a valid 10-digit Indian mobile number.", "INVALID_WHATSAPP", null, 400);
  }
  if (guardianPhone && !phoneRegex.test(guardianPhone)) {
    return errorResponse(res, "Phone number must be a valid 10-digit Indian mobile number.", "INVALID_GUARDIAN_PHONE", null, 400);
  }
  if (emergencyContact && !phoneRegex.test(emergencyContact)) {
    return errorResponse(res, "Phone number must be a valid 10-digit Indian mobile number.", "INVALID_EMERGENCY_CONTACT", null, 400);
  }

  try {
    const student = await prisma.student.update({
      where: { id },
      data: {
        fullName,
        phone,
        whatsappNumber,
        email,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        gender,
        address,
        guardianName,
        guardianPhone,
        emergencyContact,
        courseId,
        batchId,
        enrollmentDate: enrollmentDate ? new Date(enrollmentDate) : undefined,
        status,
        notes,
      },
    });
    return successResponse(res, "Student records updated successfully.", student);
  } catch (error) {
    console.error("updateStudent error:", error);
    return errorResponse(res, "Failed to update student.", "DB_ERROR", null, 500);
  }
}

export async function updateStudentStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status } = req.body;

  if (status !== "ACTIVE" && status !== "INACTIVE") {
    return errorResponse(res, "Status must be ACTIVE or INACTIVE.", "INVALID_INPUT");
  }

  try {
    const student = await prisma.student.update({
      where: { id },
      data: { status },
    });
    return successResponse(res, "Student status updated successfully.", student);
  } catch (error) {
    console.error("updateStudentStatus error:", error);
    return errorResponse(res, "Failed to update student status.", "DB_ERROR", null, 500);
  }
}

export async function getBirthdaysToday(req: Request, res: Response) {
  try {
    const todayInfo = getKolkataDateInfo();

    // Optimize: Fetch only students whose birthday is today using raw query
    const todayIds: any[] = await prisma.$queryRawUnsafe(`
      SELECT id FROM "Student"
      WHERE EXTRACT(MONTH FROM "dateOfBirth") = ${todayInfo.month}
        AND EXTRACT(DAY FROM "dateOfBirth") = ${todayInfo.day}
        AND status = 'ACTIVE'
    `);
    
    const ids = todayIds.map((row) => row.id);

    const birthdayStudents = await prisma.student.findMany({
      where: { id: { in: ids } },
      include: {
        course: true,
        batch: true,
        birthdayLogs: {
          where: { birthdayDate: todayInfo.dateStr },
        },
      },
    });

    const currentYear = todayInfo.year;
    const result = birthdayStudents.map((s) => {
      const todayLog = s.birthdayLogs && s.birthdayLogs.length > 0 ? s.birthdayLogs[0] : null;
      return {
        id: s.id,
        fullName: s.fullName,
        phone: s.phone,
        whatsappNumber: s.whatsappNumber,
        email: s.email,
        dateOfBirth: s.dateOfBirth,
        courseName: s.course ? s.course.name : "",
        age: s.dateOfBirth ? currentYear - new Date(s.dateOfBirth).getFullYear() : null,
        birthdayEmailStatus: todayLog ? todayLog.status : "NOT_SENT",
        birthdayEmailSentAt: todayLog ? todayLog.sentAt : null,
        birthdayEmailError: todayLog ? todayLog.errorMessage : null,
      };
    });

    return successResponse(res, "Birthdays today fetched successfully.", result);
  } catch (error) {
    console.error("getBirthdaysToday error:", error);
    return errorResponse(res, "Failed to detect birthdays.", "DB_ERROR", null, 500);
  }
}

export async function getBirthdaysUpcoming(req: Request, res: Response) {
  try {
    const upcoming: any[] = await prisma.$queryRawUnsafe(`
      SELECT s.id, s."fullName", s.phone, s."whatsappNumber", s.email, s."dateOfBirth", c.name as "courseName"
      FROM "Student" s
      LEFT JOIN "Course" c ON s."courseId" = c.id
      WHERE 
        (
          to_char(s."dateOfBirth", 'MM-DD') > to_char(CURRENT_DATE, 'MM-DD')
          AND to_char(s."dateOfBirth", 'MM-DD') <= to_char(CURRENT_DATE + INTERVAL '7 days', 'MM-DD')
        )
        AND s.status = 'ACTIVE'
      ORDER BY to_char(s."dateOfBirth", 'MM-DD') ASC
    `);

    return successResponse(res, "Upcoming birthdays fetched successfully.", upcoming);
  } catch (error) {
    console.error("getBirthdaysUpcoming error:", error);
    return errorResponse(res, "Failed to fetch upcoming birthdays.", "DB_ERROR", null, 500);
  }
}
