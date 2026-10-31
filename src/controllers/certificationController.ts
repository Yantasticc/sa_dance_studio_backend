import { Request, Response } from "express";
import prisma from "../config/prisma";
import { successResponse, errorResponse } from "../utils/response";
import path from "path";
import fs from "fs";

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
 * GET /api/v1/certifications
 * Returns all published certifications with image URLs.
 */
export async function getPublicCertifications(req: Request, res: Response) {
  try {
    const certs = await prisma.certification.findMany({
      where: { isPublished: true },
      orderBy: { sortOrder: "asc" },
      include: { photo: true },
    });

    const baseUrl =
      process.env.API_URL ||
      `${req.protocol}://${req.hostname}:${process.env.PORT || 5000}`;

    const data = certs.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      sortOrder: c.sortOrder,
      imageUrl: c.photo?.imagePath ? `${baseUrl}${c.photo.imagePath}` : null,
      createdAt: c.createdAt,
    }));

    return successResponse(res, "Certifications fetched.", data);
  } catch (error) {
    console.error("getPublicCertifications error:", error);
    return errorResponse(res, "Failed to fetch certifications.", "DB_ERROR", null, 500);
  }
}

// ─── ADMIN ───────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/certifications/admin
 * Returns all certifications (published + drafts) for admin management.
 */
export async function getAdminCertifications(req: Request, res: Response) {
  try {
    const certs = await prisma.certification.findMany({
      orderBy: { sortOrder: "asc" },
      include: { photo: { select: { id: true, fileName: true, fileSize: true, imagePath: true } } },
    });

    const baseUrl =
      process.env.API_URL ||
      `${req.protocol}://${req.hostname}:${process.env.PORT || 5000}`;

    const data = certs.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      sortOrder: c.sortOrder,
      isPublished: c.isPublished,
      imageUrl: c.photo?.imagePath ? `${baseUrl}${c.photo.imagePath}` : null,
      photoId: c.photoId,
      photo: c.photo,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    return successResponse(res, "Certifications fetched.", data);
  } catch (error) {
    console.error("getAdminCertifications error:", error);
    return errorResponse(res, "Failed to fetch certifications.", "DB_ERROR", null, 500);
  }
}

/**
 * POST /api/v1/certifications/admin
 * Body: { title, description?, photoId?, sortOrder?, isPublished? }
 */
export async function createCertification(req: Request, res: Response) {
  const { title, description, photoId, sortOrder, isPublished } = req.body;

  if (!title?.trim()) {
    return errorResponse(res, "Title is required.", "INVALID_INPUT");
  }

  try {
    // Verify photoId if provided
    if (photoId) {
      const photo = await prisma.galleryPhoto.findUnique({ where: { id: photoId } });
      if (!photo) return errorResponse(res, "Photo not found.", "NOT_FOUND", null, 404);
    }

    const cert = await prisma.certification.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        photoId: photoId || null,
        sortOrder: Number(sortOrder) || 0,
        isPublished: isPublished !== false,
      },
    });
    return successResponse(res, "Certification created.", cert, 201);
  } catch (error) {
    console.error("createCertification error:", error);
    return errorResponse(res, "Failed to create certification.", "DB_ERROR", null, 500);
  }
}

/**
 * PUT /api/v1/certifications/admin/:id
 */
export async function updateCertification(req: Request, res: Response) {
  const { id } = req.params;
  const { title, description, photoId, sortOrder, isPublished } = req.body;

  try {
    if (photoId !== undefined && photoId !== null) {
      const photo = await prisma.galleryPhoto.findUnique({ where: { id: photoId } });
      if (!photo) return errorResponse(res, "Photo not found.", "NOT_FOUND", null, 404);
    }

    // Keep track of old photoId
    const existing = await prisma.certification.findUnique({ where: { id } });
    const oldPhotoId = existing?.photoId;

    const cert = await prisma.certification.update({
      where: { id },
      data: {
        title: title?.trim() ?? undefined,
        description: description?.trim() ?? undefined,
        photoId: photoId === null ? null : photoId ?? undefined,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
        isPublished: isPublished !== undefined ? Boolean(isPublished) : undefined,
      },
    });

    // Clean up old photo if it was replaced
    if (oldPhotoId && photoId !== undefined && oldPhotoId !== photoId) {
      await deletePhotoIfUnreferenced(oldPhotoId);
    }

    return successResponse(res, "Certification updated.", cert);
  } catch (error) {
    console.error("updateCertification error:", error);
    return errorResponse(res, "Failed to update certification.", "DB_ERROR", null, 500);
  }
}

/**
 * DELETE /api/v1/certifications/admin/:id
 * Deletes the certification record and cleans up the physical file + db record if unreferenced.
 */
export async function deleteCertification(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const existing = await prisma.certification.findUnique({ where: { id } });
    const oldPhotoId = existing?.photoId;

    await prisma.certification.delete({ where: { id } });

    if (oldPhotoId) {
      await deletePhotoIfUnreferenced(oldPhotoId);
    }

    return successResponse(res, "Certification deleted.");
  } catch (error) {
    console.error("deleteCertification error:", error);
    return errorResponse(res, "Failed to delete certification.", "DB_ERROR", null, 500);
  }
}
