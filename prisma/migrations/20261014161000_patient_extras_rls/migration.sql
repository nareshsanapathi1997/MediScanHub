-- RLS for patient-scoped extras (fail closed for mediscan_app)

ALTER TABLE "PatientDependent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PatientDependent" FORCE ROW LEVEL SECURITY;
CREATE POLICY patient_dependent_all ON "PatientDependent" FOR ALL USING (
  "guardianPatientId" = app_patient() OR patient_in_tenant("guardianPatientId", app_tenant())
) WITH CHECK (
  "guardianPatientId" = app_patient() OR patient_in_tenant("guardianPatientId", app_tenant())
);

ALTER TABLE "PatientChronicCondition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PatientChronicCondition" FORCE ROW LEVEL SECURITY;
CREATE POLICY patient_chronic_all ON "PatientChronicCondition" FOR ALL USING (
  "patientId" = app_patient() OR patient_in_tenant("patientId", app_tenant())
) WITH CHECK (
  "patientId" = app_patient() OR patient_in_tenant("patientId", app_tenant())
);

ALTER TABLE "PatientWallet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PatientWallet" FORCE ROW LEVEL SECURITY;
CREATE POLICY patient_wallet_all ON "PatientWallet" FOR ALL USING (
  "patientId" = app_patient() OR patient_in_tenant("patientId", app_tenant())
) WITH CHECK ("patientId" = app_patient());

ALTER TABLE "WalletTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WalletTransaction" FORCE ROW LEVEL SECURITY;
CREATE POLICY wallet_tx_all ON "WalletTransaction" FOR ALL USING (
  "patientId" = app_patient() OR patient_in_tenant("patientId", app_tenant())
) WITH CHECK ("patientId" = app_patient());

ALTER TABLE "InsurancePolicy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InsurancePolicy" FORCE ROW LEVEL SECURITY;
CREATE POLICY insurance_policy_all ON "InsurancePolicy" FOR ALL USING (
  "patientId" = app_patient() OR patient_in_tenant("patientId", app_tenant())
) WITH CHECK ("patientId" = app_patient());

ALTER TABLE "TpaClaim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TpaClaim" FORCE ROW LEVEL SECURITY;
CREATE POLICY tpa_claim_all ON "TpaClaim" FOR ALL USING (
  "tenantId" = app_tenant() OR "patientId" = app_patient()
) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "IntegrationMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntegrationMessage" FORCE ROW LEVEL SECURITY;
CREATE POLICY integration_msg_read ON "IntegrationMessage" FOR SELECT USING (
  "tenantId" IS NULL OR "tenantId" = app_tenant()
);
CREATE POLICY integration_msg_write ON "IntegrationMessage" FOR INSERT WITH CHECK (
  "tenantId" IS NULL OR "tenantId" = app_tenant()
);

ALTER TABLE "RateLimitHit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateLimitHit" FORCE ROW LEVEL SECURITY;
