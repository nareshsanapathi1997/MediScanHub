-- Staff need the patient account name. Patients need the names of people who acted on their own visits.
CREATE OR REPLACE FUNCTION patient_user_in_tenant(p_user uuid, p_tenant uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_user IS NOT NULL AND p_tenant IS NOT NULL AND EXISTS (
    SELECT 1 FROM "Patient" p
    JOIN "PatientBranchRecord" r ON r."patientId" = p.id
    WHERE p."userId" = p_user AND r."tenantId" = p_tenant
  )
$$;

CREATE OR REPLACE FUNCTION user_visible_to_patient(p_user uuid, p_patient uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_user IS NOT NULL AND p_patient IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM "Booking" b
      WHERE b."patientId" = p_patient AND (b."createdById" = p_user OR b."referralUserId" = p_user)
    )
    OR EXISTS (
      SELECT 1 FROM "BookingStatusHistory" h
      JOIN "Booking" b ON b.id = h."bookingId"
      WHERE b."patientId" = p_patient AND h."actorId" = p_user
    )
    OR EXISTS (
      SELECT 1 FROM "HomeCollectionTask" t
      JOIN "Booking" b ON b.id = t."bookingId"
      WHERE b."patientId" = p_patient AND t."assigneeId" = p_user
    )
    OR EXISTS (
      SELECT 1 FROM "ReportApproval" a
      JOIN "MedicalReport" r ON r.id = a."reportId"
      JOIN "Booking" b ON b.id = r."bookingId"
      WHERE b."patientId" = p_patient AND a."approverId" = p_user
    )
  )
$$;

REVOKE ALL ON FUNCTION patient_user_in_tenant(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION user_visible_to_patient(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION patient_user_in_tenant(uuid, uuid) TO mediscan_app, mediscan_admin;
GRANT EXECUTE ON FUNCTION user_visible_to_patient(uuid, uuid) TO mediscan_app, mediscan_admin;

DROP POLICY user_select ON "User";
CREATE POLICY user_select ON "User" FOR SELECT USING (
  id = app_user()
  OR user_in_tenant(id, app_tenant())
  OR patient_user_in_tenant(id, app_tenant())
  OR user_visible_to_patient(id, app_patient())
);
