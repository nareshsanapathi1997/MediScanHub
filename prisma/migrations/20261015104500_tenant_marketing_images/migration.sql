-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "coverImageUrl" TEXT,
ADD COLUMN "galleryUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
