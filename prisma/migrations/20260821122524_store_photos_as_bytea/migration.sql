/*
  Warnings:

  - Added the required column `fileName` to the `GalleryPhoto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileSize` to the `GalleryPhoto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `imageData` to the `GalleryPhoto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimeType` to the `GalleryPhoto` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GalleryPhoto" ADD COLUMN     "fileName" TEXT NOT NULL,
ADD COLUMN     "fileSize" INTEGER NOT NULL,
ADD COLUMN     "imageData" BYTEA NOT NULL,
ADD COLUMN     "mimeType" TEXT NOT NULL,
ALTER COLUMN "sectionId" DROP NOT NULL,
ALTER COLUMN "imageUrl" DROP NOT NULL;
