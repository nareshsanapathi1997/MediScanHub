-- Invoice wallet/insurance, TPA claims workflow

CREATE TYPE "TpaClaimStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'PAID', 'REJECTED');

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "walletRedeemPaise" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "insurancePolicyId" UUID;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "tpaReference" TEXT;

CREATE TABLE "TpaClaim" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "insurancePolicyId" UUID NOT NULL,
    "status" "TpaClaimStatus" NOT NULL DEFAULT 'SUBMITTED',
    "claimedPaise" INTEGER NOT NULL,
    "approvedPaise" INTEGER,
    "paidPaise" INTEGER,
    "externalReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TpaClaim_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TpaClaim_tenantId_status_idx" ON "TpaClaim"("tenantId", "status");
CREATE INDEX "TpaClaim_patientId_idx" ON "TpaClaim"("patientId");
CREATE INDEX "TpaClaim_invoiceId_idx" ON "TpaClaim"("invoiceId");
CREATE INDEX "Invoice_insurancePolicyId_idx" ON "Invoice"("insurancePolicyId");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_insurancePolicyId_fkey" FOREIGN KEY ("insurancePolicyId") REFERENCES "InsurancePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TpaClaim" ADD CONSTRAINT "TpaClaim_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TpaClaim" ADD CONSTRAINT "TpaClaim_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TpaClaim" ADD CONSTRAINT "TpaClaim_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TpaClaim" ADD CONSTRAINT "TpaClaim_insurancePolicyId_fkey" FOREIGN KEY ("insurancePolicyId") REFERENCES "InsurancePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
