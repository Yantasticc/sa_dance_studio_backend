import { Request, Response } from "express";
import prisma from "../config/prisma";
import { successResponse, errorResponse } from "../utils/response";
import path from "path";
import fs from "fs";

// Helper to strip base URL and return only the relative path /uploads/...
function getRelativePath(urlOrPath: string): string {
  if (!urlOrPath) return "";
  const match = urlOrPath.match(/(\/uploads\/.+)/);
  return match ? match[1] : urlOrPath;
}

// Helper to delete physical file from server filesystem
function deletePhysicalFile(relativePath: string) {
  if (!relativePath || !relativePath.startsWith("/uploads/")) return;
  try {
    const absolutePath = path.join(__dirname, "../../", relativePath);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (err) {
    console.error("deletePhysicalFile error:", err);
  }
}

// Helper to format course image to absolute URL
function formatCourseImage(imagePath: string, req: Request): string {
  if (!imagePath) return "";
  if (imagePath.startsWith("/uploads/")) {
    const baseUrl = process.env.API_URL || `${req.protocol}://${req.hostname}:${process.env.PORT || 5000}`;
    return `${baseUrl}${imagePath}`;
  }
  return imagePath;
}

export async function getCourses(req: Request, res: Response) {
  try {
    const courses = await prisma.course.findMany({
      include: {
        batches: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const mapped = courses.map((course) => ({
      ...course,
      image: formatCourseImage(course.image, req)
    }));

    return successResponse(res, "Courses fetched successfully.", mapped);
  } catch (error) {
    console.error("getCourses error:", error);
    return errorResponse(res, "Failed to fetch courses.", "DB_ERROR", null, 500);
  }
}

export async function getCourseById(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const course = await prisma.course.findUnique({
      where: { id },
      include: { batches: true },
    });
    if (!course) {
      return errorResponse(res, "Course not found.", "NOT_FOUND", null, 404);
    }

    const mapped = {
      ...course,
      image: formatCourseImage(course.image, req)
    };

    return successResponse(res, "Course fetched successfully.", mapped);
  } catch (error) {
    console.error("getCourseById error:", error);
    return errorResponse(res, "Failed to fetch course.", "DB_ERROR", null, 500);
  }
}

export async function createCourse(req: Request, res: Response) {
  const { name, description, image, status } = req.body;
  if (!name || !description || !image) {
    return errorResponse(res, "Name, description and image are required.", "INVALID_INPUT");
  }

  try {
    const relativeImagePath = getRelativePath(image);

    const course = await prisma.course.create({
      data: {
        name,
        description,
        image: relativeImagePath,
        status: status || "ACTIVE",
      },
    });

    const mapped = {
      ...course,
      image: formatCourseImage(course.image, req)
    };

    return successResponse(res, "Course created successfully.", mapped, 201);
  } catch (error) {
    console.error("createCourse error:", error);
    return errorResponse(res, "Failed to create course.", "DB_ERROR", null, 500);
  }
}

export async function updateCourse(req: Request, res: Response) {
  const { id } = req.params;
  const { name, description, image, status } = req.body;

  try {
    const existing = await prisma.course.findUnique({ where: { id } });
    const oldImage = existing?.image;

    const relativeImagePath = image !== undefined ? getRelativePath(image) : undefined;

    const course = await prisma.course.update({
      where: { id },
      data: {
        name,
        description,
        image: relativeImagePath,
        status,
      },
    });

    // Clean up old image if replaced with a new one
    if (oldImage && relativeImagePath && oldImage !== relativeImagePath) {
      deletePhysicalFile(oldImage);
    }

    const mapped = {
      ...course,
      image: formatCourseImage(course.image, req)
    };

    return successResponse(res, "Course updated successfully.", mapped);
  } catch (error) {
    console.error("updateCourse error:", error);
    return errorResponse(res, "Failed to update course.", "DB_ERROR", null, 500);
  }
}

export async function updateCourseStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status } = req.body;

  if (status !== "ACTIVE" && status !== "INACTIVE") {
    return errorResponse(res, "Invalid status. Must be ACTIVE or INACTIVE.", "INVALID_INPUT");
  }

  try {
    const course = await prisma.course.update({
      where: { id },
      data: { status },
    });

    const mapped = {
      ...course,
      image: formatCourseImage(course.image, req)
    };

    return successResponse(res, "Course status updated successfully.", mapped);
  } catch (error) {
    console.error("updateCourseStatus error:", error);
    return errorResponse(res, "Failed to update course status.", "DB_ERROR", null, 500);
  }
}
