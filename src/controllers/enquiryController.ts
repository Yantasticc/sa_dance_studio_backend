import { Request, Response } from "express";
import prisma from "../config/prisma";
import { successResponse, errorResponse } from "../utils/response";

export async function createEnquiry(req: Request, res: Response) {
  const { name, phone, email, age, courseId, preferredTiming, message, source } = req.body;

  // Validate Indian mobile numbers: ^[6-9][0-9]{9}$
  const phoneRegex = /^[6-9][0-9]{9}$/;
  if (phone && !phoneRegex.test(phone)) {
    return errorResponse(res, "Phone number must be a valid 10-digit Indian mobile number.", "INVALID_PHONE", null, 400);
  }

  try {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return errorResponse(res, "Invalid course selected.", "INVALID_COURSE", null, 404);
    }

    const enquiry = await prisma.enquiry.create({
      data: {
        name,
        phone,
        email,
        age: age ? Number(age) : null,
        courseId,
        preferredTiming,
        message,
        source: source || "WEBSITE",
        status: "NEW",
      },
    });

    return successResponse(res, "Enquiry submitted successfully.", {
      id: enquiry.id,
      name: enquiry.name,
      phone: enquiry.phone,
      email: enquiry.email,
      courseTitle: course.name,
      preferredTiming: enquiry.preferredTiming,
      message: enquiry.message,
    }, 201);
  } catch (error) {
    console.error("createEnquiry error:", error);
    return errorResponse(res, "Failed to submit enquiry.", "DB_ERROR", null, 500);
  }
}

export async function getEnquiries(req: Request, res: Response) {
  const { status, search, page = 1, limit = 20 } = req.query;

  const parsedPage = Number(page);
  const parsedLimit = Number(limit);
  const skip = (parsedPage - 1) * parsedLimit;

  try {
    const whereClause: any = {};
    if (status) {
      whereClause.status = status as any;
    }

    if (search) {
      const searchStr = String(search);
      whereClause.OR = [
        { name: { contains: searchStr, mode: "insensitive" } },
        { phone: { contains: searchStr, mode: "insensitive" } },
        { email: { contains: searchStr, mode: "insensitive" } },
      ];
    }

    const [enquiries, total] = await prisma.$transaction([
      prisma.enquiry.findMany({
        where: whereClause,
        include: { course: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: parsedLimit,
      }),
      prisma.enquiry.count({ where: whereClause }),
    ]);

    return successResponse(res, "Enquiries fetched successfully.", {
      enquiries,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    console.error("getEnquiries error:", error);
    return errorResponse(res, "Failed to fetch enquiries.", "DB_ERROR", null, 500);
  }
}

export async function getEnquiryById(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const enquiry = await prisma.enquiry.findUnique({
      where: { id },
      include: { course: true },
    });
    if (!enquiry) {
      return errorResponse(res, "Enquiry not found.", "NOT_FOUND", null, 404);
    }
    return successResponse(res, "Enquiry fetched successfully.", enquiry);
  } catch (error) {
    console.error("getEnquiryById error:", error);
    return errorResponse(res, "Failed to fetch enquiry.", "DB_ERROR", null, 500);
  }
}

export async function updateEnquiryStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !["NEW", "CONTACTED", "CONVERTED", "CLOSED"].includes(status)) {
    return errorResponse(res, "Invalid status. Status must be NEW, CONTACTED, CONVERTED or CLOSED.", "INVALID_INPUT");
  }

  try {
    const enquiry = await prisma.enquiry.update({
      where: { id },
      data: { status },
      include: { course: true },
    });
    return successResponse(res, "Enquiry status updated successfully.", enquiry);
  } catch (error) {
    console.error("updateEnquiryStatus error:", error);
    return errorResponse(res, "Failed to update enquiry status.", "DB_ERROR", null, 500);
  }
}
