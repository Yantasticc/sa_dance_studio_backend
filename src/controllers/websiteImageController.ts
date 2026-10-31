import { Request, Response } from "express";
import prisma from "../config/prisma";
import { successResponse, errorResponse } from "../utils/response";
import path from "path";
import fs from "fs";

// All valid website image slots (keys)
export const VALID_KEYS = [
  "about-us",          // Content photo in About Us section
  "our-courses",       // Content photo in Our Courses / Find Your Rhythm section
  "find-your-rhythm",  // Content photo alongside text in Zumba/Find Your Rhythm section
  "course-dance",      // Card photo for Dance Classes course
  "course-zumba",      // Card photo for Zumba Fitness course
  "course-garba",      // Card photo for Garba course
  "course-workshops",  // Card photo for Special Workshops course
] as const;

type WebsiteImageKey = (typeof VALID_KEYS)[number];

// Helper to safely delete physical file and db record if unreferenced
async function deletePhotoIfUnreferenced(photoId: string) {
  try {
    // Check if referenced by any WebsiteImage
    const websiteRef = await prisma.websiteImage.findFirst({ where: { photoId } });
    if (websiteRef) return;

    // Check if referenced by any Certification
    const certRef = await prisma.certification.findFirst({ where: { photoId } });
    if (certRef) return;

    // Retrieve photo record to get the path
    const photo = await prisma.galleryPhoto.findUnique({ where: { id: photoId } });
    if (!photo) return;

    // Delete database record
    await prisma.galleryPhoto.delete({ where: { id: photoId } });

    // Delete physical file
    if (photo.imagePath) {
      const absolutePath = path.join(__dirname, "../../", photo.imagePath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }
  } catch (err) {
    console.error("deletePhotoIfUnreferenced error:", err);
  }
}

// ─── PUBLIC ──────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/media/website-images
 * Returns a flat map of { key: imageUrl } for all configured slots.
 * Keys that have no image are omitted from the response.
 */
export async function getWebsiteImages(req: Request, res: Response) {
  try {
    const records = await prisma.websiteImage.findMany({
      where: { photoId: { not: null } },
      include: { photo: true }
    });

    const baseUrl =
      process.env.API_URL ||
      `${req.protocol}://${req.hostname}:${process.env.PORT || 5000}`;

    const data: Record<string, string> = {};
    for (const r of records) {
      if (r.photo && r.photo.imagePath) {
        data[r.key] = `${baseUrl}${r.photo.imagePath}`;
      }
    }

    return successResponse(res, "Website images fetched.", data);
  } catch (error) {
    console.error("getWebsiteImages error:", error);
    return errorResponse(res, "Failed to fetch website images.", "DB_ERROR", null, 500);
  }
}

// ─── ADMIN ───────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/media/website-images/admin
 * Returns all slots (including those without an image) with full details.
 */
export async function getWebsiteImagesAdmin(req: Request, res: Response) {
  try {
    const existing = await prisma.websiteImage.findMany({
      include: { photo: { select: { id: true, mimeType: true, fileName: true, fileSize: true, imagePath: true, createdAt: true } } },
    });

    const baseUrl =
      process.env.API_URL ||
      `${req.protocol}://${req.hostname}:${process.env.PORT || 5000}`;

    // Return all valid keys, merging DB data
    const data = VALID_KEYS.map((key) => {
      const record = existing.find((r) => r.key === key);
      return {
        key,
        imageUrl: record?.photo?.imagePath ? `${baseUrl}${record.photo.imagePath}` : null,
        photoId: record?.photoId ?? null,
        photo: record?.photo ?? null,
        updatedAt: record?.updatedAt ?? null,
      };
    });

    return successResponse(res, "Website image slots fetched.", data);
  } catch (error) {
    console.error("getWebsiteImagesAdmin error:", error);
    return errorResponse(res, "Failed to fetch website image slots.", "DB_ERROR", null, 500);
  }
}

/**
 * PUT /api/v1/media/website-images/:key
 * Body: { photoId: string }
 * Upserts the website image slot with the given photoId.
 */
export async function setWebsiteImage(req: Request, res: Response) {
  const { key } = req.params;
  const { photoId } = req.body as { photoId: string };

  if (!VALID_KEYS.includes(key as WebsiteImageKey)) {
    return errorResponse(res, `Invalid key. Must be one of: ${VALID_KEYS.join(", ")}`, "INVALID_INPUT");
  }
  if (!photoId?.trim()) {
    return errorResponse(res, "photoId is required.", "INVALID_INPUT");
  }

  try {
    // Verify the photo actually exists
    const photo = await prisma.galleryPhoto.findUnique({ where: { id: photoId } });
    if (!photo) {
      return errorResponse(res, "Photo not found.", "NOT_FOUND", null, 404);
    }

    // Keep track of the old photoId to delete it if unreferenced
    const existingRecord = await prisma.websiteImage.findUnique({ where: { key } });
    const oldPhotoId = existingRecord?.photoId;

    const record = await prisma.websiteImage.upsert({
      where: { key },
      create: { key, photoId },
      update: { photoId },
    });

    // If there was an old photo that is now replaced, try to clean it up
    if (oldPhotoId && oldPhotoId !== photoId) {
      await deletePhotoIfUnreferenced(oldPhotoId);
    }

    const baseUrl =
      process.env.API_URL ||
      `${req.protocol}://${req.hostname}:${process.env.PORT || 5000}`;

    return successResponse(res, "Website image updated.", {
      key: record.key,
      imageUrl: `${baseUrl}${photo.imagePath}`,
      photoId: record.photoId,
    });
  } catch (error) {
    console.error("setWebsiteImage error:", error);
    return errorResponse(res, "Failed to update website image.", "DB_ERROR", null, 500);
  }
}

/**
 * DELETE /api/v1/media/website-images/:key
 * Removes the image assignment for the given slot (deletes physical file if unreferenced).
 */
export async function removeWebsiteImage(req: Request, res: Response) {
  const { key } = req.params;

  if (!VALID_KEYS.includes(key as WebsiteImageKey)) {
    return errorResponse(res, `Invalid key. Must be one of: ${VALID_KEYS.join(", ")}`, "INVALID_INPUT");
  }

  try {
    const existingRecord = await prisma.websiteImage.findUnique({ where: { key } });
    const oldPhotoId = existingRecord?.photoId;

    await prisma.websiteImage.upsert({
      where: { key },
      create: { key, photoId: null },
      update: { photoId: null },
    });

    if (oldPhotoId) {
      await deletePhotoIfUnreferenced(oldPhotoId);
    }

    return successResponse(res, "Website image removed.");
  } catch (error) {
    console.error("removeWebsiteImage error:", error);
    return errorResponse(res, "Failed to remove website image.", "DB_ERROR", null, 500);
  }
}
