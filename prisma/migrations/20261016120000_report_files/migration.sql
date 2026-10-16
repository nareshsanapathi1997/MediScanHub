-- CreateEnum
CREATE TYPE "ReportFileKind" AS ENUM ('LAB_REPORT', 'SCAN_IMAGE', 'SCAN_REPORT', 'OTHER');

-- CreateTable
CREATE TABLE "ReportFile" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "bookingItemId" UUID,
    "kind" "ReportFileKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "ReportFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportFile_tenantId_reportId_idx" ON "ReportFile"("tenantId", "reportId");

-- AddForeignKey
ALTER TABLE "ReportFile" ADD CONSTRAINT "ReportFile_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "MedicalReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportFile" ADD CONSTRAINT "ReportFile_bookingItemId_fkey" FOREIGN KEY ("bookingItemId") REFERENCES "BookingItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportFile" ADD CONSTRAINT "ReportFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-level security: center staff see their own tenant's files; a patient sees a file only
-- when it is not removed and its report is released to them.
ALTER TABLE "ReportFile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReportFile" FORCE ROW LEVEL SECURITY;
CREATE POLICY report_file_staff ON "ReportFile" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());
CREATE POLICY report_file_patient ON "ReportFile" FOR SELECT USING (
  "removedAt" IS NULL AND EXISTS (
    SELECT 1 FROM "MedicalReport" r
    WHERE r.id = "ReportFile"."reportId"
      AND r.status IN ('RELEASED', 'AMENDED')
      AND booking_owned_by_patient(r."bookingId", app_patient())
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON "ReportFile" TO mediscan_app, mediscan_admin;
