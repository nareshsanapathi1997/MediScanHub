-- Data repair: every booking must have a patient chart (PatientBranchRecord) at its tenant.
-- Without one, the Patient RLS policy hides the patient from that tenant's staff and
-- booking queries that include the patient fail.
INSERT INTO "PatientBranchRecord" ("id", "tenantId", "branchId", "patientId", "mrn", "createdAt")
SELECT gen_random_uuid(), b."tenantId", b."branchId", b."patientId",
       'MIG-' || substr(replace(b."patientId"::text, '-', ''), 1, 12) || '-' || substr(replace(b."branchId"::text, '-', ''), 1, 6),
       now()
FROM (SELECT DISTINCT "tenantId", "branchId", "patientId" FROM "Booking") b
WHERE NOT EXISTS (
  SELECT 1 FROM "PatientBranchRecord" r WHERE r."patientId" = b."patientId" AND r."tenantId" = b."tenantId"
)
ON CONFLICT DO NOTHING;
