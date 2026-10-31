import { Request, Response } from "express";
import prisma from "../config/prisma";
import { successResponse, errorResponse } from "../utils/response";
import path from "path";
import fs from "fs";

// ─── Utility: extract YouTube video ID from various URL formats ───────────────
function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────────────

/** Helper to map sections and construct dynamic image URLs without sending heavy BYTEA buffers */
function mapSectionResponse(section: any, baseUrl: string) {
  return {
    ...section,
    photos: (section.photos || []).map((p: any) => ({
      id: p.id,
      sectionId: p.sectionId,
      imagePath: p.imagePath,
      imageUrl: p.imagePath ? `${baseUrl}${p.imagePath}` : `${baseUrl}/api/v1/media/photos/${p.id}`,
      caption: p.caption,
      sortOrder: p.sortOrder,
      createdAt: p.createdAt,
    })),
  };
}

/** GET /gallery/sections — returns all published sections with their photos + videos */
export async function getPublicSections(req: Request, res: Response) {
  try {
    const sections = await prisma.gallerySection.findMany({
      where: { isPublished: true },
      orderBy: { sortOrder: "asc" },
      include: {
        photos: { orderBy: { sortOrder: "asc" } },
        videos: { orderBy: { sortOrder: "asc" } },
      },
    });

    const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
    const mapped = sections.map((s) => mapSectionResponse(s, baseUrl));

    return successResponse(res, "Gallery sections fetched successfully.", mapped);
  } catch (error) {
    console.error("getPublicSections error:", error);
    return errorResponse(res, "Failed to fetch gallery sections.", "DB_ERROR", null, 500);
  }
}

/** GET /gallery/sections/:id — returns one published section with its media */
export async function getPublicSectionById(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const section = await prisma.gallerySection.findFirst({
      where: { id, isPublished: true },
      include: {
        photos: { orderBy: { sortOrder: "asc" } },
        videos: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!section) return errorResponse(res, "Section not found.", "NOT_FOUND", null, 404);

    const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
    const mapped = mapSectionResponse(section, baseUrl);

    return successResponse(res, "Section fetched successfully.", mapped);
  } catch (error) {
    console.error("getPublicSectionById error:", error);
    return errorResponse(res, "Failed to fetch section.", "DB_ERROR", null, 500);
  }
}

// ─── ADMIN ROUTES — SECTIONS ──────────────────────────────────────────────────

/** GET /gallery/admin/sections — all sections (published + unpublished) */
export async function getAdminSections(req: Request, res: Response) {
  try {
    const sections = await prisma.gallerySection.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        photos: { orderBy: { sortOrder: "asc" } },
        videos: { orderBy: { sortOrder: "asc" } },
      },
    });

    const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
    const mapped = sections.map((s) => mapSectionResponse(s, baseUrl));

    return successResponse(res, "All gallery sections fetched.", mapped);
  } catch (error) {
    console.error("getAdminSections error:", error);
    return errorResponse(res, "Failed to fetch sections.", "DB_ERROR", null, 500);
  }
}

/** POST /gallery/admin/sections */
export async function createSection(req: Request, res: Response) {
  const { title, description, sortOrder, isPublished } = req.body;
  if (!title || !title.trim()) {
    return errorResponse(res, "Section title is required.", "INVALID_INPUT");
  }
  try {
    const section = await prisma.gallerySection.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        sortOrder: Number(sortOrder) || 0,
        isPublished: isPublished !== false,
      },
    });
    return successResponse(res, "Section created successfully.", section, 201);
  } catch (error) {
    console.error("createSection error:", error);
    return errorResponse(res, "Failed to create section.", "DB_ERROR", null, 500);
  }
}

/** PUT /gallery/admin/sections/:id */
export async function updateSection(req: Request, res: Response) {
  const { id } = req.params;
  const { title, description, sortOrder, isPublished } = req.body;
  try {
    const section = await prisma.gallerySection.update({
      where: { id },
      data: {
        title: title?.trim(),
        description: description?.trim() || null,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
        isPublished: isPublished !== undefined ? Boolean(isPublished) : undefined,
      },
    });
    return successResponse(res, "Section updated successfully.", section);
  } catch (error) {
    console.error("updateSection error:", error);
    return errorResponse(res, "Failed to update section.", "DB_ERROR", null, 500);
  }
}

/** DELETE /gallery/admin/sections/:id */
export async function deleteSection(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const photos = await prisma.galleryPhoto.findMany({ where: { sectionId: id } });
    for (const photo of photos) {
      if (photo.imagePath) {
        const absolutePath = path.join(__dirname, "../../", photo.imagePath);
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
        }
      }
    }
    await prisma.gallerySection.delete({ where: { id } });
    return successResponse(res, "Section and all its media deleted.");
  } catch (error) {
    console.error("deleteSection error:", error);
    return errorResponse(res, "Failed to delete section.", "DB_ERROR", null, 500);
  }
}

// ─── ADMIN ROUTES — PHOTOS ────────────────────────────────────────────────────

/** POST /gallery/admin/sections/:sectionId/photos — add one or more photos */
export async function addPhotos(req: Request, res: Response) {
  const { sectionId } = req.params;
  // Body can be { photos: [ { imageUrl, caption, sortOrder } ] }
  const { photos } = req.body as { photos: { imageUrl: string; caption?: string; sortOrder?: number }[] };

  if (!photos || !Array.isArray(photos) || photos.length === 0) {
    return errorResponse(res, "At least one photo is required.", "INVALID_INPUT");
  }

  // Validate section exists
  const section = await prisma.gallerySection.findUnique({ where: { id: sectionId } });
  if (!section) return errorResponse(res, "Section not found.", "NOT_FOUND", null, 404);

  try {
    let linkedCount = 0;
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      // Extract UUID from the imageUrl
      const match = p.imageUrl.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
      const photoId = match ? match[1] : null;

      if (photoId) {
        try {
          await prisma.galleryPhoto.update({
            where: { id: photoId },
            data: {
              sectionId,
              caption: p.caption?.trim() || null,
              sortOrder: p.sortOrder ?? i,
              imageUrl: p.imageUrl, // Also store for backward compatibility
            },
          });
          linkedCount++;
        } catch (updateErr) {
          console.warn(`Failed to link photo ID ${photoId}:`, updateErr);
        }
      }
    }
    return successResponse(res, `${linkedCount} photo(s) added.`, { count: linkedCount }, 201);
  } catch (error) {
    console.error("addPhotos error:", error);
    return errorResponse(res, "Failed to add photos.", "DB_ERROR", null, 500);
  }
}

/** PUT /gallery/admin/photos/:id */
export async function updatePhoto(req: Request, res: Response) {
  const { id } = req.params;
  const { caption, sortOrder } = req.body;
  try {
    const photo = await prisma.galleryPhoto.update({
      where: { id },
      data: {
        caption: caption?.trim() || null,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
      },
    });
    return successResponse(res, "Photo updated.", photo);
  } catch (error) {
    console.error("updatePhoto error:", error);
    return errorResponse(res, "Failed to update photo.", "DB_ERROR", null, 500);
  }
}

/** DELETE /gallery/admin/photos/:id */
export async function deletePhoto(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const photo = await prisma.galleryPhoto.findUnique({ where: { id } });
    if (photo && photo.imagePath) {
      const absolutePath = path.join(__dirname, "../../", photo.imagePath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }
    await prisma.galleryPhoto.delete({ where: { id } });
    return successResponse(res, "Photo deleted.");
  } catch (error) {
    console.error("deletePhoto error:", error);
    return errorResponse(res, "Failed to delete photo.", "DB_ERROR", null, 500);
  }
}

// ─── ADMIN ROUTES — VIDEOS ────────────────────────────────────────────────────

/** POST /gallery/admin/sections/:sectionId/videos */
export async function addVideo(req: Request, res: Response) {
  const { sectionId } = req.params;
  const { youtubeUrl, title, sortOrder } = req.body;

  if (!youtubeUrl?.trim()) {
    return errorResponse(res, "YouTube URL is required.", "INVALID_INPUT");
  }

  const youtubeId = extractYoutubeId(youtubeUrl.trim());
  if (!youtubeId) {
    return errorResponse(res, "Invalid YouTube URL. Could not extract video ID.", "INVALID_INPUT");
  }

  const section = await prisma.gallerySection.findUnique({ where: { id: sectionId } });
  if (!section) return errorResponse(res, "Section not found.", "NOT_FOUND", null, 404);

  try {
    const video = await prisma.galleryVideo.create({
      data: {
        sectionId,
        youtubeUrl: youtubeUrl.trim(),
        youtubeId,
        title: title?.trim() || null,
        sortOrder: Number(sortOrder) || 0,
      },
    });
    return successResponse(res, "Video added.", video, 201);
  } catch (error) {
    console.error("addVideo error:", error);
    return errorResponse(res, "Failed to add video.", "DB_ERROR", null, 500);
  }
}

/** PUT /gallery/admin/videos/:id */
export async function updateVideo(req: Request, res: Response) {
  const { id } = req.params;
  const { youtubeUrl, title, sortOrder } = req.body;

  const updateData: any = {
    title: title?.trim() || null,
    sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
  };

  if (youtubeUrl) {
    const youtubeId = extractYoutubeId(youtubeUrl.trim());
    if (!youtubeId) {
      return errorResponse(res, "Invalid YouTube URL.", "INVALID_INPUT");
    }
    updateData.youtubeUrl = youtubeUrl.trim();
    updateData.youtubeId = youtubeId;
  }

  try {
    const video = await prisma.galleryVideo.update({ where: { id }, data: updateData });
    return successResponse(res, "Video updated.", video);
  } catch (error) {
    console.error("updateVideo error:", error);
    return errorResponse(res, "Failed to update video.", "DB_ERROR", null, 500);
  }
}

/** DELETE /gallery/admin/videos/:id */
export async function deleteVideo(req: Request, res: Response) {
  const { id } = req.params;
  try {
    await prisma.galleryVideo.delete({ where: { id } });
    return successResponse(res, "Video deleted.");
  } catch (error) {
    console.error("deleteVideo error:", error);
    return errorResponse(res, "Failed to delete video.", "DB_ERROR", null, 500);
  }
}

/** GET /media/photos/:id — serve image file from filesystem */
export async function servePhoto(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const photo = await prisma.galleryPhoto.findUnique({
      where: { id },
    });

    if (!photo || !photo.imagePath) {
      return res.status(404).send("Image not found.");
    }

    const absolutePath = path.join(__dirname, "../../", photo.imagePath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).send("Physical file not found on server.");
    }

    // Set correct headers
    res.setHeader("Content-Type", photo.mimeType || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable"); // Cache for 1 year

    // Stream the file
    return res.sendFile(absolutePath);
  } catch (error) {
    console.error("servePhoto error:", error);
    return res.status(500).send("Internal server error.");
  }
}
