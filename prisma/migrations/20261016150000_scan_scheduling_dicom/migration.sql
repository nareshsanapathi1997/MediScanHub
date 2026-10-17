-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN     "slotMinutes" INTEGER NOT NULL DEFAULT 20;

-- AlterTable
ALTER TABLE "ReportFile" ADD COLUMN     "dicomMeta" JSONB;

-- CreateTable
CREATE TABLE "EquipmentBlock" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EquipmentBlock_tenantId_equipmentId_startsAt_idx" ON "EquipmentBlock"("tenantId", "equipmentId", "startsAt");

-- AddForeignKey
ALTER TABLE "EquipmentBlock" ADD CONSTRAINT "EquipmentBlock_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security: anyone may read blocks of a public center (slot search hides blocked times);
-- only the center's own staff may write them.
ALTER TABLE "EquipmentBlock" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EquipmentBlock" FORCE ROW LEVEL SECURITY;
CREATE POLICY equipment_block_read ON "EquipmentBlock" FOR SELECT USING (
  "tenantId" = app_tenant() OR tenant_is_public("tenantId")
);
CREATE POLICY equipment_block_write ON "EquipmentBlock" FOR INSERT WITH CHECK ("tenantId" = app_tenant());
CREATE POLICY equipment_block_update ON "EquipmentBlock" FOR UPDATE
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());
CREATE POLICY equipment_block_delete ON "EquipmentBlock" FOR DELETE USING ("tenantId" = app_tenant());
GRANT SELECT, INSERT, UPDATE, DELETE ON "EquipmentBlock" TO mediscan_app, mediscan_admin;
