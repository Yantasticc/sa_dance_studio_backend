/*
  Warnings:

  - You are about to drop the column `imageData` on the `GalleryPhoto` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "GalleryPhoto" DROP COLUMN "imageData",
ADD COLUMN     "imagePath" TEXT;
