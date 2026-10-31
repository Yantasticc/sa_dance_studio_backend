-- CreateTable
CREATE TABLE "WebsiteImage" (
    "key" TEXT NOT NULL,
    "photoId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteImage_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "photoId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteImage_photoId_key" ON "WebsiteImage"("photoId");

-- CreateIndex
CREATE UNIQUE INDEX "Certification_photoId_key" ON "Certification"("photoId");

-- AddForeignKey
ALTER TABLE "WebsiteImage" ADD CONSTRAINT "WebsiteImage_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "GalleryPhoto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "GalleryPhoto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
