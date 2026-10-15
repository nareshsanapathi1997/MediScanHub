-- Row Level Security for tenant isolation.
-- The runtime role mediscan_app cannot bypass RLS.
-- mediscan_admin (BYPASSRLS) is reserved for auth lookups and super-admin workflows.
-- Policies fail closed: empty session settings match nothing.

CREATE OR REPLACE FUNCTION app_setting(p_key text) RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting(p_key, true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_tenant() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT app_setting('app.tenant_id') $$;
CREATE OR REPLACE FUNCTION app_user() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT app_setting('app.user_id') $$;
CREATE OR REPLACE FUNCTION app_patient() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT app_setting('app.patient_id') $$;

CREATE OR REPLACE FUNCTION tenant_is_public(p_tenant uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM "Tenant" t
    WHERE t.id = p_tenant AND t.status = 'ACTIVE' AND t."deletedAt" IS NULL
  )
$$;

CREATE OR REPLACE FUNCTION user_in_tenant(p_user uuid, p_tenant uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_user IS NOT NULL AND p_tenant IS NOT NULL AND EXISTS (
    SELECT 1 FROM "TenantMembership" m
    WHERE m."userId" = p_user AND m."tenantId" = p_tenant AND m.status = 'ACTIVE'
  )
$$;

CREATE OR REPLACE FUNCTION patient_in_tenant(p_patient uuid, p_tenant uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_patient IS NOT NULL AND p_tenant IS NOT NULL AND EXISTS (
    SELECT 1 FROM "PatientBranchRecord" r
    WHERE r."patientId" = p_patient AND r."tenantId" = p_tenant
  )
$$;

CREATE OR REPLACE FUNCTION booking_owned_by_patient(p_booking uuid, p_patient uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_booking IS NOT NULL AND p_patient IS NOT NULL AND EXISTS (
    SELECT 1 FROM "Booking" b WHERE b.id = p_booking AND b."patientId" = p_patient
  )
$$;

REVOKE ALL ON FUNCTION app_setting(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_tenant() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_patient() FROM PUBLIC;
REVOKE ALL ON FUNCTION tenant_is_public(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION user_in_tenant(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION patient_in_tenant(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION booking_owned_by_patient(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app_setting(text) TO mediscan_app, mediscan_admin;
GRANT EXECUTE ON FUNCTION app_tenant() TO mediscan_app, mediscan_admin;
GRANT EXECUTE ON FUNCTION app_user() TO mediscan_app, mediscan_admin;
GRANT EXECUTE ON FUNCTION app_patient() TO mediscan_app, mediscan_admin;
GRANT EXECUTE ON FUNCTION tenant_is_public(uuid) TO mediscan_app, mediscan_admin;
GRANT EXECUTE ON FUNCTION user_in_tenant(uuid, uuid) TO mediscan_app, mediscan_admin;
GRANT EXECUTE ON FUNCTION patient_in_tenant(uuid, uuid) TO mediscan_app, mediscan_admin;
GRANT EXECUTE ON FUNCTION booking_owned_by_patient(uuid, uuid) TO mediscan_app, mediscan_admin;

-- Privileged-only tables: RLS enabled, no policies, app role sees nothing.
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" FORCE ROW LEVEL SECURITY;
ALTER TABLE "PasswordReset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasswordReset" FORCE ROW LEVEL SECURITY;
ALTER TABLE "WebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookEvent" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invitation" FORCE ROW LEVEL SECURITY;

-- Invitation is tenant business data, so staff of that tenant may read it.
CREATE POLICY invitation_tenant ON "Invitation"
  FOR ALL USING ("tenantId" = app_tenant())
  WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
CREATE POLICY user_select ON "User" FOR SELECT USING (
  id = app_user() OR user_in_tenant(id, app_tenant())
);
CREATE POLICY user_update ON "User" FOR UPDATE USING (id = app_user()) WITH CHECK (id = app_user());

ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Role" FORCE ROW LEVEL SECURITY;
CREATE POLICY role_read ON "Role" FOR SELECT USING (true);

ALTER TABLE "Permission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Permission" FORCE ROW LEVEL SECURITY;
CREATE POLICY permission_read ON "Permission" FOR SELECT USING (true);

ALTER TABLE "RolePermission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RolePermission" FORCE ROW LEVEL SECURITY;
CREATE POLICY role_permission_read ON "RolePermission" FOR SELECT USING (true);

ALTER TABLE "ServiceCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceCategory" FORCE ROW LEVEL SECURITY;
CREATE POLICY category_read ON "ServiceCategory" FOR SELECT USING (true);

ALTER TABLE "SubscriptionPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubscriptionPlan" FORCE ROW LEVEL SECURITY;
CREATE POLICY plan_read ON "SubscriptionPlan" FOR SELECT USING (true);
CREATE POLICY plan_write ON "SubscriptionPlan" FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE "PlatformSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformSetting" FORCE ROW LEVEL SECURITY;
CREATE POLICY setting_read ON "PlatformSetting" FOR SELECT USING (true);

ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON "Tenant" FOR SELECT USING (
  id = app_tenant() OR (status = 'ACTIVE' AND "deletedAt" IS NULL)
);
CREATE POLICY tenant_update ON "Tenant" FOR UPDATE USING (id = app_tenant()) WITH CHECK (id = app_tenant());

ALTER TABLE "TenantMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantMembership" FORCE ROW LEVEL SECURITY;
CREATE POLICY membership_all ON "TenantMembership" FOR ALL USING (
  "userId" = app_user() OR "tenantId" = app_tenant()
) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "Branch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Branch" FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_read ON "Branch" FOR SELECT USING (
  "tenantId" = app_tenant()
  OR (active = true AND "deletedAt" IS NULL AND tenant_is_public("tenantId"))
);
CREATE POLICY branch_write ON "Branch" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "StaffAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffAssignment" FORCE ROW LEVEL SECURITY;
CREATE POLICY staff_tenant ON "StaffAssignment" FOR ALL
  USING ("tenantId" = app_tenant() OR "userId" = app_user())
  WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "CenterVerification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CenterVerification" FORCE ROW LEVEL SECURITY;
CREATE POLICY verification_tenant ON "CenterVerification" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" FORCE ROW LEVEL SECURITY;
CREATE POLICY subscription_tenant ON "Subscription" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "DiagnosticService" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiagnosticService" FORCE ROW LEVEL SECURITY;
CREATE POLICY service_read ON "DiagnosticService" FOR SELECT USING (
  "tenantId" = app_tenant()
  OR ("published" = true AND "archivedAt" IS NULL AND tenant_is_public("tenantId"))
);
CREATE POLICY service_write ON "DiagnosticService" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "TestParameter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TestParameter" FORCE ROW LEVEL SECURITY;
CREATE POLICY parameter_read ON "TestParameter" FOR SELECT USING (true);
CREATE POLICY parameter_write ON "TestParameter" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "ReferenceRange" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReferenceRange" FORCE ROW LEVEL SECURITY;
CREATE POLICY range_read ON "ReferenceRange" FOR SELECT USING (true);
CREATE POLICY range_write ON "ReferenceRange" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "TestPackage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TestPackage" FORCE ROW LEVEL SECURITY;
CREATE POLICY package_read ON "TestPackage" FOR SELECT USING (
  "tenantId" = app_tenant()
  OR ("published" = true AND "archivedAt" IS NULL AND tenant_is_public("tenantId"))
);
CREATE POLICY package_write ON "TestPackage" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "PackageItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PackageItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY package_item_read ON "PackageItem" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "TestPackage" p
    WHERE p.id = "PackageItem"."packageId"
      AND (p."tenantId" = app_tenant() OR (p.published = true AND p."archivedAt" IS NULL AND tenant_is_public(p."tenantId")))
  )
);
CREATE POLICY package_item_write ON "PackageItem" FOR ALL USING (
  EXISTS (SELECT 1 FROM "TestPackage" p WHERE p.id = "PackageItem"."packageId" AND p."tenantId" = app_tenant())
) WITH CHECK (
  EXISTS (SELECT 1 FROM "TestPackage" p WHERE p.id = "PackageItem"."packageId" AND p."tenantId" = app_tenant())
);

ALTER TABLE "BranchService" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BranchService" FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_service_read ON "BranchService" FOR SELECT USING (
  "tenantId" = app_tenant() OR tenant_is_public("tenantId")
);
CREATE POLICY branch_service_write ON "BranchService" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "ServicePrice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServicePrice" FORCE ROW LEVEL SECURITY;
CREATE POLICY price_read ON "ServicePrice" FOR SELECT USING (
  "tenantId" = app_tenant() OR tenant_is_public("tenantId")
);
CREATE POLICY price_write ON "ServicePrice" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "AvailabilitySlot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AvailabilitySlot" FORCE ROW LEVEL SECURITY;
CREATE POLICY slot_read ON "AvailabilitySlot" FOR SELECT USING (
  "tenantId" = app_tenant() OR tenant_is_public("tenantId")
);
CREATE POLICY slot_write ON "AvailabilitySlot" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "Patient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Patient" FORCE ROW LEVEL SECURITY;
CREATE POLICY patient_read ON "Patient" FOR SELECT USING (
  "userId" = app_user()
  OR id = app_patient()
  OR patient_in_tenant(id, app_tenant())
);
CREATE POLICY patient_update ON "Patient" FOR UPDATE USING (
  "userId" = app_user() OR patient_in_tenant(id, app_tenant())
) WITH CHECK (
  "userId" = app_user() OR patient_in_tenant(id, app_tenant())
);

ALTER TABLE "PatientConsent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PatientConsent" FORCE ROW LEVEL SECURITY;
CREATE POLICY consent_all ON "PatientConsent" FOR ALL USING (
  "userId" = app_user() OR "patientId" = app_patient() OR "tenantId" = app_tenant()
) WITH CHECK (
  "userId" = app_user() OR "tenantId" = app_tenant()
);

ALTER TABLE "PatientBranchRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PatientBranchRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY pbr_all ON "PatientBranchRecord" FOR ALL USING (
  "tenantId" = app_tenant() OR "patientId" = app_patient()
) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "Booking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Booking" FORCE ROW LEVEL SECURITY;
CREATE POLICY booking_all ON "Booking" FOR ALL USING (
  "tenantId" = app_tenant() OR "patientId" = app_patient()
) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "BookingItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BookingItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY booking_item_all ON "BookingItem" FOR ALL USING (
  "tenantId" = app_tenant() OR booking_owned_by_patient("bookingId", app_patient())
) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "BookingStatusHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BookingStatusHistory" FORCE ROW LEVEL SECURITY;
CREATE POLICY booking_history_all ON "BookingStatusHistory" FOR ALL USING (
  "tenantId" = app_tenant() OR booking_owned_by_patient("bookingId", app_patient())
) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "HomeCollectionTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HomeCollectionTask" FORCE ROW LEVEL SECURITY;
CREATE POLICY collection_all ON "HomeCollectionTask" FOR ALL USING (
  "tenantId" = app_tenant() OR booking_owned_by_patient("bookingId", app_patient())
) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "LabOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LabOrder" FORCE ROW LEVEL SECURITY;
CREATE POLICY lab_order_all ON "LabOrder" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "Sample" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sample" FORCE ROW LEVEL SECURITY;
CREATE POLICY sample_all ON "Sample" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "SampleBarcode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SampleBarcode" FORCE ROW LEVEL SECURITY;
CREATE POLICY barcode_all ON "SampleBarcode" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "SampleEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SampleEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY sample_event_all ON "SampleEvent" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "LabResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LabResult" FORCE ROW LEVEL SECURITY;
CREATE POLICY result_all ON "LabResult" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "MedicalReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MedicalReport" FORCE ROW LEVEL SECURITY;
CREATE POLICY report_staff ON "MedicalReport" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());
CREATE POLICY report_patient_released ON "MedicalReport" FOR SELECT USING (
  status IN ('RELEASED', 'AMENDED') AND booking_owned_by_patient("bookingId", app_patient())
);

ALTER TABLE "ReportApproval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReportApproval" FORCE ROW LEVEL SECURITY;
CREATE POLICY approval_all ON "ReportApproval" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "ReportVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReportVersion" FORCE ROW LEVEL SECURITY;
CREATE POLICY version_staff ON "ReportVersion" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());
CREATE POLICY version_patient ON "ReportVersion" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "MedicalReport" r
    WHERE r.id = "ReportVersion"."reportId"
      AND r.status IN ('RELEASED', 'AMENDED')
      AND booking_owned_by_patient(r."bookingId", app_patient())
  )
);

ALTER TABLE "Equipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Equipment" FORCE ROW LEVEL SECURITY;
CREATE POLICY equipment_read ON "Equipment" FOR SELECT USING (
  "tenantId" = app_tenant() OR tenant_is_public("tenantId")
);
CREATE POLICY equipment_write ON "Equipment" FOR INSERT WITH CHECK ("tenantId" = app_tenant());
CREATE POLICY equipment_update ON "Equipment" FOR UPDATE
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());
CREATE POLICY equipment_delete ON "Equipment" FOR DELETE USING ("tenantId" = app_tenant());

ALTER TABLE "EquipmentSchedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EquipmentSchedule" FORCE ROW LEVEL SECURITY;
CREATE POLICY equipment_schedule_all ON "EquipmentSchedule" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "ImagingOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImagingOrder" FORCE ROW LEVEL SECURITY;
CREATE POLICY imaging_order_all ON "ImagingOrder" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "ImagingStudy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImagingStudy" FORCE ROW LEVEL SECURITY;
CREATE POLICY study_all ON "ImagingStudy" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" FORCE ROW LEVEL SECURITY;
CREATE POLICY invoice_all ON "Invoice" FOR ALL USING (
  "tenantId" = app_tenant() OR "patientId" = app_patient()
) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" FORCE ROW LEVEL SECURITY;
CREATE POLICY payment_all ON "Payment" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "Refund" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Refund" FORCE ROW LEVEL SECURITY;
CREATE POLICY refund_all ON "Refund" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" FORCE ROW LEVEL SECURITY;
CREATE POLICY notification_all ON "Notification" FOR ALL USING (
  "tenantId" = app_tenant() OR "userId" = app_user()
) WITH CHECK ("tenantId" = app_tenant() OR "userId" = app_user());

ALTER TABLE "NotificationDeliveryAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationDeliveryAttempt" FORCE ROW LEVEL SECURITY;
CREATE POLICY delivery_read ON "NotificationDeliveryAttempt" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "Notification" n
    WHERE n.id = "NotificationDeliveryAttempt"."notificationId"
      AND (n."tenantId" = app_tenant() OR n."userId" = app_user())
  )
);

ALTER TABLE "IdempotencyRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IdempotencyRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY idempotency_tenant ON "IdempotencyRecord" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_tenant ON "AuditLog" FOR ALL
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "SupportTicket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportTicket" FORCE ROW LEVEL SECURITY;
CREATE POLICY ticket_all ON "SupportTicket" FOR ALL USING (
  "tenantId" = app_tenant() OR "requesterId" = app_user()
) WITH CHECK ("tenantId" = app_tenant() OR "requesterId" = app_user());

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO mediscan_app, mediscan_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mediscan_app, mediscan_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mediscan_app, mediscan_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mediscan_app, mediscan_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO mediscan_app, mediscan_admin;
