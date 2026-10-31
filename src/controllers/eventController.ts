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

// Helper to format event image to absolute URL
function formatEventImage(imagePath: string, req: Request): string {
  if (!imagePath) return "";
  if (imagePath.startsWith("/uploads/")) {
    const baseUrl = process.env.API_URL || `${req.protocol}://${req.hostname}:${process.env.PORT || 5000}`;
    return `${baseUrl}${imagePath}`;
  }
  return imagePath;
}

export async function getEvents(req: Request, res: Response) {
  const { upcoming } = req.query;
  try {
    const whereClause: any = {};
    if (upcoming === "true") {
      whereClause.date = { gte: new Date() };
      whereClause.status = "UPCOMING";
    }

    const events = await prisma.event.findMany({
      where: whereClause,
      orderBy: { date: "asc" },
    });

    const mapped = events.map((event) => ({
      ...event,
      image: formatEventImage(event.image, req)
    }));

    return successResponse(res, "Events fetched successfully.", mapped);
  } catch (error) {
    console.error("getEvents error:", error);
    return errorResponse(res, "Failed to fetch events.", "DB_ERROR", null, 500);
  }
}

export async function getEventById(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return errorResponse(res, "Event not found.", "NOT_FOUND", null, 404);
    }

    const mapped = {
      ...event,
      image: formatEventImage(event.image, req)
    };

    return successResponse(res, "Event fetched successfully.", mapped);
  } catch (error) {
    console.error("getEventById error:", error);
    return errorResponse(res, "Failed to fetch event.", "DB_ERROR", null, 500);
  }
}

export async function createEvent(req: Request, res: Response) {
  const { name, description, date, startTime, endTime, location, image, status } = req.body;
  if (!name || !description || !date || !startTime || !endTime || !location || !image) {
    return errorResponse(res, "All fields are required.", "INVALID_INPUT");
  }

  try {
    const relativeImagePath = getRelativePath(image);

    const event = await prisma.event.create({
      data: {
        name,
        description,
        date: new Date(date),
        startTime,
        endTime,
        location,
        image: relativeImagePath,
        status: status || "UPCOMING",
      },
    });

    const mapped = {
      ...event,
      image: formatEventImage(event.image, req)
    };

    return successResponse(res, "Event created successfully.", mapped, 201);
  } catch (error) {
    console.error("createEvent error:", error);
    return errorResponse(res, "Failed to create event.", "DB_ERROR", null, 500);
  }
}

export async function updateEvent(req: Request, res: Response) {
  const { id } = req.params;
  const { name, description, date, startTime, endTime, location, image, status } = req.body;

  try {
    const existing = await prisma.event.findUnique({ where: { id } });
    const oldImage = existing?.image;

    const relativeImagePath = image !== undefined ? getRelativePath(image) : undefined;

    const event = await prisma.event.update({
      where: { id },
      data: {
        name,
        description,
        date: date ? new Date(date) : undefined,
        startTime,
        endTime,
        location,
        image: relativeImagePath,
        status,
      },
    });

    // Clean up old image from filesystem if it was replaced with a new one
    if (oldImage && relativeImagePath && oldImage !== relativeImagePath) {
      deletePhysicalFile(oldImage);
    }

    const mapped = {
      ...event,
      image: formatEventImage(event.image, req)
    };

    return successResponse(res, "Event updated successfully.", mapped);
  } catch (error) {
    console.error("updateEvent error:", error);
    return errorResponse(res, "Failed to update event.", "DB_ERROR", null, 500);
  }
}

export async function deleteEvent(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const existing = await prisma.event.findUnique({ where: { id } });
    const oldImage = existing?.image;

    await prisma.event.delete({ where: { id } });

    if (oldImage) {
      deletePhysicalFile(oldImage);
    }

    return successResponse(res, "Event deleted successfully.");
  } catch (error) {
    console.error("deleteEvent error:", error);
    return errorResponse(res, "Failed to delete event.", "DB_ERROR", null, 500);
  }
}
