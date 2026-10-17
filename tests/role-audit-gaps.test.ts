import { describe, expect, it } from "vitest";
import { ID } from "../prisma/ids";
import { loadActor } from "@/lib/services/auth";
import { ROLE_PERMISSIONS } from "@/domain/permissions";
import { homeFor } from "@/domain/actor";
import { getBooking } from "@/lib/services/booking";
import { listBookingReports } from "@/lib/services/report-files";
import { readReportPdf } from "@/lib/services/lab";
import { prismaPrivileged } from "@/lib/db";

const actor = (userId: string, tenantId: string | null) => loadActor(userId, tenantId, null);

describe("role-audit product gaps", () => {
  it("grants desk and manager invoice collection without refunds or clinical write", () => {
    expect(ROLE_PERMISSIONS.RECEPTIONIST).toContain("invoices.manage");
    expect(ROLE_PERMISSIONS.RECEPTIONIST).not.toContain("payments.refund");
    expect(ROLE_PERMISSIONS.RECEPTIONIST).not.toContain("samples.collect");
    expect(ROLE_PERMISSIONS.BRANCH_MANAGER).toContain("invoices.manage");
    expect(ROLE_PERMISSIONS.BRANCH_MANAGER).not.toContain("payments.refund");
    expect(ROLE_PERMISSIONS.ACCOUNTANT).toContain("invoices.manage");
    expect(ROLE_PERMISSIONS.ACCOUNTANT).toContain("payments.refund");
    expect(ROLE_PERMISSIONS.PATHOLOGIST).not.toContain("invoices.manage");
    expect(ROLE_PERMISSIONS.PHLEBOTOMIST).not.toContain("invoices.manage");
  });

  it("keeps receptionists on the front desk home after granting invoices.manage", async () => {
    const desk = await actor(ID.deskApex, ID.apex);
    expect(homeFor(desk)).toBe("/console/desk");
    const accounts = await actor(ID.accountsApex, ID.apex);
    expect(homeFor(accounts)).toBe("/console/finance");
  });

  it("lets a named referral doctor see and download only released reports", async () => {
    const doctor = await actor(ID.doctor, ID.apex);
    const asha = await getBooking(doctor, ID.bookingAsha);
    const meera = await getBooking(doctor, ID.bookingMeera);
    expect(asha.referralUserId).toBe(ID.doctor);
    expect(meera.referralUserId).toBe(ID.doctor);

    const ashaReports = await listBookingReports(doctor, asha);
    expect(ashaReports).toEqual([]);

    const meeraReports = await listBookingReports(doctor, meera);
    expect(meeraReports).toHaveLength(1);
    expect(meeraReports[0]?.status).toBe("RELEASED");

    const pdf = await readReportPdf(doctor, meeraReports[0]!.id);
    expect(pdf.bytes.subarray(0, 4).toString()).toBe("%PDF");

    const draft = await prismaPrivileged.medicalReport.findFirstOrThrow({ where: { bookingId: ID.bookingAsha } });
    await expect(readReportPdf(doctor, draft.id)).rejects.toMatchObject({ status: 404 });
  });
});
