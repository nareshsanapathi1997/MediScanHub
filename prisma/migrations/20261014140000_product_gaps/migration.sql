-- Patient dependents, wallet, insurance, chronic care, booking extras, in-app read state, integrations, PACS enum.

ALTER TYPE "PacsStatus" ADD VALUE IF NOT EXISTS 'QUEUED';
ALTER TYPE "PacsStatus" ADD VALUE IF NOT EXISTS 'TRANSMITTED';
ALTER TYPE "PacsStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "PacsStatus" ADD VALUE IF NOT EXISTS 'ACKNOWLEDGED';

CREATE TYPE "IntegrationKind" AS ENUM ('HL7', 'FHIR', 'ABDM', 'PACS');

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "dependentId" UUID;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "prescriptionStorageKey" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "prescriptionFileName" TEXT;

CREATE TABLE "PatientDependent" (
    "id" UUID NOT NULL,
    "guardianPatientId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "sex" "Sex" NOT NULL,
    "relation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PatientDependent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PatientChronicCondition" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "condition" TEXT NOT NULL,
    "since" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatientChronicCondition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PatientWallet" (
    "patientId" UUID NOT NULL,
    "balancePaise" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PatientWallet_pkey" PRIMARY KEY ("patientId")
);

CREATE TABLE "WalletTransaction" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "bookingId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InsurancePolicy" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "tpaName" TEXT,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InsurancePolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationMessage" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "kind" "IntegrationKind" NOT NULL,
    "direction" TEXT NOT NULL,
    "referenceId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatientDependent_guardianPatientId_idx" ON "PatientDependent"("guardianPatientId");
CREATE INDEX "PatientChronicCondition_patientId_idx" ON "PatientChronicCondition"("patientId");
CREATE INDEX "WalletTransaction_patientId_createdAt_idx" ON "WalletTransaction"("patientId", "createdAt");
CREATE INDEX "InsurancePolicy_patientId_idx" ON "InsurancePolicy"("patientId");
CREATE INDEX "IntegrationMessage_tenantId_kind_createdAt_idx" ON "IntegrationMessage"("tenantId", "kind", "createdAt");

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_dependentId_fkey" FOREIGN KEY ("dependentId") REFERENCES "PatientDependent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PatientDependent" ADD CONSTRAINT "PatientDependent_guardianPatientId_fkey" FOREIGN KEY ("guardianPatientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientChronicCondition" ADD CONSTRAINT "PatientChronicCondition_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientWallet" ADD CONSTRAINT "PatientWallet_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InsurancePolicy" ADD CONSTRAINT "InsurancePolicy_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationMessage" ADD CONSTRAINT "IntegrationMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RateLimitHit" (
    "id" UUID NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "hitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RateLimitHit_bucketKey_hitAt_idx" ON "RateLimitHit"("bucketKey", "hitAt");
