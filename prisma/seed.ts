import { config } from "dotenv";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { renderReportPdf } from "../src/lib/pdf";
import { sha256 } from "../src/lib/crypto";
import { PERMISSIONS, ROLE_KEYS, ROLE_NAMES, ROLE_PERMISSIONS } from "../src/domain/permissions";
import { DEMO_PASSWORD, ID } from "./ids";

config();
const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL or MIGRATION_DATABASE_URL is required to seed");

const prisma = new PrismaClient({ datasources: { db: { url } } });

function at(dayOffset: number, time: string) {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + dayOffset);
  return new Date(`${day.toISOString().slice(0, 10)}T${time}:00+05:30`);
}

async function main() {
  await prisma.$executeRawUnsafe(`
    DO $$ DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;
  `);

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const inboxHash = await hashPassword(`inbox-${sha256("mediscan-inbox").slice(0, 24)}`);

  for (const key of PERMISSIONS) {
    await prisma.permission.create({ data: { key, description: key } });
  }
  for (const key of ROLE_KEYS) {
    const role = await prisma.role.create({ data: { key, name: ROLE_NAMES[key], description: ROLE_NAMES[key], isSystem: true } });
    const permissions = await prisma.permission.findMany({ where: { key: { in: [...ROLE_PERMISSIONS[key]] } } });
    await prisma.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })) });
  }
  const roles = Object.fromEntries((await prisma.role.findMany()).map((role) => [role.key, role.id]));

  await prisma.subscriptionPlan.createMany({
    data: [
      { id: ID.planStarter, tier: "STARTER", name: "Starter", description: "One branch for a new collection center.", monthlyPricePaise: 499900, annualPricePaise: 4999000, maxBranches: 1, maxUsers: 8, maxBookingsPerMonth: 200, trialDays: 14, features: ["1 branch", "8 staff seats", "200 bookings / month", "Email notifications"] },
      { id: ID.planPro, tier: "PROFESSIONAL", name: "Professional", description: "Multi-branch diagnostics with lab and imaging workflows.", monthlyPricePaise: 1499900, annualPricePaise: 14999000, maxBranches: 5, maxUsers: 40, maxBookingsPerMonth: 2000, trialDays: 14, features: ["5 branches", "40 staff seats", "Lab + imaging", "WhatsApp templates"] },
      { id: ID.planEnt, tier: "ENTERPRISE", name: "Enterprise", description: "Group networks that need higher limits and audit exports.", monthlyPricePaise: 3999900, annualPricePaise: 39999000, maxBranches: null, maxUsers: null, maxBookingsPerMonth: null, trialDays: 14, features: ["Unlimited branches", "Dedicated success review", "Audit exports"] },
    ],
  });
  await prisma.platformSetting.createMany({
    data: [
      { key: "billing.patientGstBps", value: 0 },
      { key: "billing.subscriptionGstBps", value: 1800 },
      { key: "retention.clinicalDays", value: 3650 },
      { key: "brand.name", value: "MediScan Hub" },
    ],
  });
  await prisma.serviceCategory.createMany({
    data: [
      { id: ID.catHeme, name: "Hematology", slug: "hematology", kind: "LAB", description: "Blood counts and related studies." },
      { id: ID.catChem, name: "Biochemistry", slug: "biochemistry", kind: "LAB", description: "Chemistry panels used for routine screening." },
      { id: ID.catThyroid, name: "Thyroid", slug: "thyroid", kind: "LAB", description: "Thyroid function tests." },
      { id: ID.catImaging, name: "Imaging", slug: "imaging", kind: "IMAGING", description: "Ultrasound, radiography, and MRI slots." },
    ],
  });

  const people: Array<{ id: string; email: string; name: string; phone?: string; patient?: { id: string; dob: string; sex: "FEMALE" | "MALE" } }> = [
    { id: ID.super, email: "super@mediscan.test", name: "Synth Admin Meera Iyer" },
    { id: ID.ownerApex, email: "owner.apex@mediscan.test", name: "Synth Owner Anil Rao", phone: "+919800000001" },
    { id: ID.managerApex, email: "manager.apex@mediscan.test", name: "Synth Manager Leela Nair", phone: "+919800000002" },
    { id: ID.deskApex, email: "desk.apex@mediscan.test", name: "Synth Desk Karthik", phone: "+919800000003" },
    { id: ID.phlebApex, email: "phleb.apex@mediscan.test", name: "Synth Phlebotomist Divya", phone: "+919800000004" },
    { id: ID.techApex, email: "tech.apex@mediscan.test", name: "Synth Technician Imran", phone: "+919800000005" },
    { id: ID.pathApex, email: "path.apex@mediscan.test", name: "Synth Pathologist Dr. Sen", phone: "+919800000006" },
    { id: ID.radioApex, email: "radio.apex@mediscan.test", name: "Synth Radiologist Dr. Kapoor", phone: "+919800000007" },
    { id: ID.accountsApex, email: "accounts.apex@mediscan.test", name: "Synth Accountant Priya", phone: "+919800000008" },
    { id: ID.ownerNimbus, email: "owner.nimbus@mediscan.test", name: "Synth Owner Nimbus", phone: "+919800000009" },
    { id: ID.ownerCoastal, email: "owner.coastal@mediscan.test", name: "Synth Owner Coastal", phone: "+919800000010" },
    { id: ID.doctor, email: "doctor.rao@mediscan.test", name: "Synth Dr. Rao (referral)", phone: "+919800000011" },
    { id: ID.asha, email: "patient.asha@mediscan.test", name: "Synth Patient Asha Rao", phone: "+919811110001", patient: { id: ID.patientAsha, dob: "1992-04-12", sex: "FEMALE" } },
    { id: ID.ravi, email: "patient.ravi@mediscan.test", name: "Synth Patient Ravi Menon", phone: "+919811110002", patient: { id: ID.patientRavi, dob: "1984-11-02", sex: "MALE" } },
    { id: ID.meera, email: "patient.meera@mediscan.test", name: "Synth Patient Meera Das", phone: "+919811110003", patient: { id: ID.patientMeera, dob: "1978-01-20", sex: "FEMALE" } },
  ];
  for (const person of people) {
    await prisma.user.create({
      data: {
        id: person.id,
        email: person.email,
        name: person.name,
        phone: person.phone,
        passwordHash,
        isSynthetic: true,
        emailVerifiedAt: new Date(),
        patient: person.patient ? { create: { id: person.patient.id, dateOfBirth: new Date(person.patient.dob), sex: person.patient.sex, city: "Hyderabad", isSynthetic: true } } : undefined,
      },
    });
  }
  await prisma.user.create({ data: { id: ID.inbox, email: "inbox@mediscan.test", name: "MediScan Support Inbox", passwordHash: inboxHash, isSynthetic: true } });
  await prisma.tenantMembership.create({ data: { userId: ID.super, roleId: roles.SUPER_ADMIN, status: "ACTIVE", acceptedAt: new Date() } });
  await prisma.tenantMembership.create({ data: { userId: ID.asha, roleId: roles.PATIENT, status: "ACTIVE", acceptedAt: new Date() } });
  await prisma.tenantMembership.create({ data: { userId: ID.ravi, roleId: roles.PATIENT, status: "ACTIVE", acceptedAt: new Date() } });
  await prisma.tenantMembership.create({ data: { userId: ID.meera, roleId: roles.PATIENT, status: "ACTIVE", acceptedAt: new Date() } });

  const apexAbout = [
    "Apex Diagnostics is a full-service pathology and imaging network in Hyderabad, with flagship operations in Jubilee Hills and a growing Gachibowli branch for the Financial District.",
    "Patients choose us for same-day routine panels, transparent branch-wise pricing, and digital reports delivered to MediScan. Corporate wellness programs, executive checkups, and doctor-referred imaging slots are supported end to end.",
    "Jubilee Hills offers home sample collection across central Hyderabad, a dedicated ultrasound suite, and extended evening hours. Gachibowli focuses on walk-in lab work with fast turnarounds for nearby tech parks.",
    "This is a synthetic demonstration profile for MediScan Hub — bookings, pricing, and workflows behave like production, but no real clinical services are provided.",
  ].join("\n\n");

  await prisma.tenant.create({
    data: {
      id: ID.apex,
      name: "Apex Diagnostics",
      legalName: "Apex Diagnostics Pvt Ltd (synthetic)",
      slug: "apex-diagnostics",
      status: "ACTIVE",
      brandColor: "#0F766E",
      accentColor: "#155E75",
      logoUrl: "/centers/apex-diagnostics/logo.svg",
      coverImageUrl: "/centers/apex-diagnostics/cover.svg",
      galleryUrls: [
        "/centers/apex-diagnostics/gallery-reception.svg",
        "/centers/apex-diagnostics/gallery-lab.svg",
        "/centers/apex-diagnostics/gallery-imaging.svg",
        "/centers/apex-diagnostics/gallery-home-collection.svg",
      ],
      customDomain: "apex.mediscan.local",
      email: "hello.apex@mediscan.test",
      phone: "+914040001111",
      city: "Hyderabad",
      state: "Telangana",
      address: "Road No. 36, Jubilee Hills, Hyderabad",
      about: apexAbout,
      gstin: "36SYNTH0000A1Z1",
      isSynthetic: true,
    },
  });
  await prisma.tenant.create({
    data: {
      id: ID.nimbus,
      name: "Nimbus Labs",
      legalName: "Nimbus Labs LLP (synthetic)",
      slug: "nimbus-labs",
      status: "ACTIVE",
      brandColor: "#1D4ED8",
      accentColor: "#0F766E",
      email: "hello.nimbus@mediscan.test",
      phone: "+918040002222",
      city: "Bengaluru",
      state: "Karnataka",
      address: "100 Feet Road, Indiranagar, Bengaluru",
      about: "Synthetic single-branch lab on the Starter plan. Used to prove tenant isolation.",
      isSynthetic: true,
    },
  });
  await prisma.tenant.create({
    data: {
      id: ID.coastal,
      name: "Coastal Imaging",
      legalName: "Coastal Imaging (synthetic)",
      slug: "coastal-imaging",
      status: "PENDING",
      email: "hello.coastal@mediscan.test",
      phone: "+912240003333",
      city: "Mumbai",
      state: "Maharashtra",
      address: "Linking Road, Bandra West, Mumbai",
      about: "Synthetic center waiting for verification. Hidden from public search.",
      isSynthetic: true,
    },
  });

  await prisma.branch.createMany({
    data: [
      { id: ID.jubilee, tenantId: ID.apex, name: "Jubilee Hills", code: "JUB", address: "Road No. 36, Jubilee Hills", city: "Hyderabad", state: "Telangana", phone: "+914040001112", homeCollection: true, opensAt: "07:00", closesAt: "20:00" },
      { id: ID.gachibowli, tenantId: ID.apex, name: "Gachibowli", code: "GAC", address: "Financial District", city: "Hyderabad", state: "Telangana", phone: "+914040001113", homeCollection: false },
      { id: ID.indiranagar, tenantId: ID.nimbus, name: "Indiranagar", code: "IND", address: "100 Feet Road", city: "Bengaluru", state: "Karnataka", phone: "+918040002223", homeCollection: true },
      { id: ID.bandra, tenantId: ID.coastal, name: "Bandra", code: "BAN", address: "Linking Road", city: "Mumbai", state: "Maharashtra", phone: "+912240003334", homeCollection: false, active: false },
    ],
  });

  const staff: Array<[string, string, string, string]> = [
    [ID.ownerApex, ID.apex, "CENTER_OWNER", ""],
    [ID.managerApex, ID.apex, "BRANCH_MANAGER", ID.jubilee],
    [ID.deskApex, ID.apex, "RECEPTIONIST", ID.jubilee],
    [ID.phlebApex, ID.apex, "PHLEBOTOMIST", ID.jubilee],
    [ID.techApex, ID.apex, "LAB_TECHNICIAN", ID.jubilee],
    [ID.pathApex, ID.apex, "PATHOLOGIST", ID.jubilee],
    [ID.radioApex, ID.apex, "RADIOLOGY", ID.jubilee],
    [ID.accountsApex, ID.apex, "ACCOUNTANT", ID.jubilee],
    [ID.doctor, ID.apex, "DOCTOR", ""],
    [ID.ownerNimbus, ID.nimbus, "CENTER_OWNER", ""],
    [ID.ownerCoastal, ID.coastal, "CENTER_OWNER", ""],
  ];
  for (const [userId, tenantId, roleKey, branchId] of staff) {
    await prisma.tenantMembership.create({ data: { userId, tenantId, roleId: roles[roleKey], status: "ACTIVE", acceptedAt: new Date() } });
    if (branchId) await prisma.staffAssignment.create({ data: { tenantId, userId, branchId, roleId: roles[roleKey] } });
  }

  async function labService(input: { id: string; tenantId: string; categoryId: string; name: string; slug: string; code: string; description: string; sampleType: string; tatHours: number; price: number; branchIds: string[] }) {
    await prisma.diagnosticService.create({
      data: {
        id: input.id,
        tenantId: input.tenantId,
        categoryId: input.categoryId,
        name: input.name,
        slug: input.slug,
        code: input.code,
        kind: "LAB",
        description: input.description,
        sampleType: input.sampleType,
        preparation: "No special preparation unless the center tells you otherwise. This is demonstration copy.",
        tatHours: input.tatHours,
        published: true,
      },
    });
    for (const branchId of input.branchIds) {
      await prisma.branchService.create({ data: { tenantId: input.tenantId, branchId, serviceId: input.id, active: true } });
      await prisma.servicePrice.create({ data: { tenantId: input.tenantId, branchId, serviceId: input.id, pricePaise: input.price, discountPaise: 0 } });
    }
  }

  await labService({ id: ID.cbc, tenantId: ID.apex, categoryId: ID.catHeme, name: "Complete Blood Count", slug: "cbc", code: "CBC", description: "Counts of red cells, white cells, and platelets. Synthetic catalog item.", sampleType: "EDTA blood", tatHours: 6, price: 45000, branchIds: [ID.jubilee, ID.gachibowli] });
  await labService({ id: ID.lipid, tenantId: ID.apex, categoryId: ID.catChem, name: "Lipid Profile", slug: "lipid-profile", code: "LIPID", description: "Cholesterol and triglyceride panel. Synthetic catalog item.", sampleType: "Serum", tatHours: 12, price: 79900, branchIds: [ID.jubilee] });
  await labService({ id: ID.tsh, tenantId: ID.apex, categoryId: ID.catThyroid, name: "TSH", slug: "tsh", code: "TSH", description: "Thyroid stimulating hormone. Synthetic catalog item.", sampleType: "Serum", tatHours: 12, price: 35000, branchIds: [ID.jubilee, ID.gachibowli] });
  await labService({ id: ID.hba1c, tenantId: ID.apex, categoryId: ID.catChem, name: "HbA1c", slug: "hba1c", code: "HBA1C", description: "Glycated hemoglobin. Synthetic catalog item.", sampleType: "EDTA blood", tatHours: 12, price: 55000, branchIds: [ID.jubilee] });
  await labService({ id: ID.nimbusCbc, tenantId: ID.nimbus, categoryId: ID.catHeme, name: "Complete Blood Count", slug: "cbc", code: "CBC", description: "Nimbus synthetic CBC. Prices differ from Apex on purpose.", sampleType: "EDTA blood", tatHours: 8, price: 39900, branchIds: [ID.indiranagar] });

  await prisma.diagnosticService.create({
    data: {
      id: ID.usg,
      tenantId: ID.apex,
      categoryId: ID.catImaging,
      name: "Ultrasound Abdomen",
      slug: "usg-abdomen",
      code: "USG-ABD",
      kind: "IMAGING",
      modality: "US",
      description: "Abdominal ultrasound slot. DICOM/PACS is not connected.",
      preparation: "Fast for 6 hours when the center confirms it. Demonstration instruction only.",
      tatHours: 24,
      published: true,
    },
  });
  await prisma.branchService.create({ data: { tenantId: ID.apex, branchId: ID.jubilee, serviceId: ID.usg, active: true } });
  await prisma.servicePrice.create({ data: { tenantId: ID.apex, branchId: ID.jubilee, serviceId: ID.usg, pricePaise: 180000 } });

  await prisma.testParameter.create({
    data: {
      id: ID.hb,
      tenantId: ID.apex,
      serviceId: ID.cbc,
      name: "Hemoglobin",
      unit: "g/dL",
      resultType: "NUMERIC",
      position: 0,
      ranges: { create: [{ tenantId: ID.apex, sex: "FEMALE", low: 12, high: 15.5, criticalLow: 7, criticalHigh: 20, label: "Adult female" }, { tenantId: ID.apex, sex: "MALE", low: 13, high: 17, criticalLow: 7, criticalHigh: 20, label: "Adult male" }] },
    },
  });
  await prisma.testParameter.create({
    data: {
      id: ID.wbc,
      tenantId: ID.apex,
      serviceId: ID.cbc,
      name: "WBC",
      unit: "10^3/µL",
      resultType: "NUMERIC",
      position: 1,
      ranges: { create: [{ tenantId: ID.apex, low: 4, high: 11, criticalLow: 1, criticalHigh: 30, label: "Adult" }] },
    },
  });
  await prisma.testPackage.create({
    data: {
      id: ID.pkgWell,
      tenantId: ID.apex,
      name: "Wellness Screen",
      slug: "wellness-screen",
      description: "Synthetic package combining CBC, TSH, and HbA1c.",
      pricePaise: 119900,
      published: true,
      items: { create: [{ serviceId: ID.cbc }, { serviceId: ID.tsh }, { serviceId: ID.hba1c }] },
    },
  });

  const equipment = await prisma.equipment.create({ data: { tenantId: ID.apex, branchId: ID.jubilee, name: "USG Room 2", modality: "US", room: "Imaging 2" } });
  await prisma.equipmentSchedule.create({ data: { tenantId: ID.apex, equipmentId: equipment.id, staffUserId: ID.radioApex, startsAt: at(1, "09:00"), endsAt: at(1, "13:00") } });

  const slotTimes = ["07:30", "08:00", "08:30", "09:00", "16:00"];
  for (const day of [1, 2, 3]) {
    for (const time of slotTimes) {
      await prisma.availabilitySlot.create({ data: { tenantId: ID.apex, branchId: ID.jubilee, kind: "CENTER", startsAt: at(day, time), endsAt: new Date(at(day, time).getTime() + 30 * 60 * 1000), capacity: 4 } });
      await prisma.availabilitySlot.create({ data: { tenantId: ID.apex, branchId: ID.jubilee, kind: "HOME", startsAt: at(day, time), endsAt: new Date(at(day, time).getTime() + 60 * 60 * 1000), capacity: 2 } });
    }
    await prisma.availabilitySlot.create({ data: { tenantId: ID.apex, branchId: ID.jubilee, kind: "IMAGING", startsAt: at(day, "11:00"), endsAt: at(day, "11:30"), capacity: 2, equipmentId: equipment.id } });
    await prisma.availabilitySlot.create({ data: { tenantId: ID.nimbus, branchId: ID.indiranagar, kind: "CENTER", startsAt: at(day, "09:30"), endsAt: at(day, "10:00"), capacity: 3 } });
  }
  await prisma.availabilitySlot.create({ data: { id: ID.slotRace, tenantId: ID.apex, branchId: ID.jubilee, kind: "CENTER", startsAt: at(4, "18:00"), endsAt: at(4, "18:30"), capacity: 1 } });

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
  await prisma.subscription.create({ data: { tenantId: ID.apex, planId: ID.planPro, status: "ACTIVE", billingCycle: "MONTHLY", currentPeriodStart: now, currentPeriodEnd: periodEnd } });
  await prisma.subscription.create({ data: { tenantId: ID.nimbus, planId: ID.planStarter, status: "TRIALING", billingCycle: "MONTHLY", trialEndsAt: periodEnd, currentPeriodStart: now, currentPeriodEnd: periodEnd } });

  await prisma.patientBranchRecord.create({ data: { tenantId: ID.apex, branchId: ID.jubilee, patientId: ID.patientAsha, mrn: "JUB-00001" } });
  await prisma.patientBranchRecord.create({ data: { tenantId: ID.apex, branchId: ID.jubilee, patientId: ID.patientRavi, mrn: "JUB-00002" } });
  await prisma.patientBranchRecord.create({ data: { tenantId: ID.apex, branchId: ID.jubilee, patientId: ID.patientMeera, mrn: "JUB-00003" } });

  const consent = await prisma.patientConsent.create({ data: { tenantId: ID.apex, patientId: ID.patientAsha, userId: ID.asha, purpose: "diagnostic-booking", version: "2026-10-01" } });

  const ashaSlot = at(1, "08:00");
  await prisma.booking.create({
    data: {
      id: ID.bookingAsha,
      tenantId: ID.apex,
      branchId: ID.jubilee,
      patientId: ID.patientAsha,
      consentId: consent.id,
      createdById: ID.asha,
      referralUserId: ID.doctor,
      publicCode: "MS-ASHA01",
      visitType: "CENTER_VISIT",
      status: "IN_PROGRESS",
      scheduledAt: ashaSlot,
      totalPaise: 45000,
      idempotencyKey: `${ID.apex}:booking:seed-asha`,
      isSynthetic: true,
      items: { create: [{ tenantId: ID.apex, serviceId: ID.cbc, name: "Complete Blood Count", pricePaise: 45000 }] },
      history: { create: [{ tenantId: ID.apex, toStatus: "CONFIRMED", actorId: ID.asha }, { tenantId: ID.apex, fromStatus: "CONFIRMED", toStatus: "CHECKED_IN", actorId: ID.deskApex }, { tenantId: ID.apex, fromStatus: "CHECKED_IN", toStatus: "IN_PROGRESS", actorId: ID.techApex }] },
      invoice: { create: { tenantId: ID.apex, kind: "PATIENT", status: "PAID", number: "INV-ASHA01", patientId: ID.patientAsha, subtotalPaise: 45000, taxPaise: 0, totalPaise: 45000, lines: [{ name: "Complete Blood Count", amountPaise: 45000 }] } },
    },
  });
  const ashaInvoice = await prisma.invoice.findFirstOrThrow({ where: { bookingId: ID.bookingAsha } });
  await prisma.payment.create({ data: { tenantId: ID.apex, invoiceId: ashaInvoice.id, provider: "mock", providerOrderId: "order_seed_asha", providerPaymentId: "pay_seed_asha", amountPaise: 45000, status: "CAPTURED", idempotencyKey: `${ID.apex}:payment:seed-asha` } });

  const ashaOrder = await prisma.labOrder.create({ data: { tenantId: ID.apex, branchId: ID.jubilee, bookingId: ID.bookingAsha, status: "PROCESSING" } });
  const ashaSample = await prisma.sample.create({ data: { tenantId: ID.apex, labOrderId: ashaOrder.id, serviceId: ID.cbc, status: "PROCESSING", assigneeId: ID.techApex, collectedAt: new Date(), receivedAt: new Date() } });
  await prisma.sampleBarcode.create({ data: { tenantId: ID.apex, sampleId: ashaSample.id, code: "BCASHA0001", printedAt: new Date() } });
  await prisma.sampleEvent.createMany({
    data: [
      { tenantId: ID.apex, sampleId: ashaSample.id, type: "COLLECTED", actorId: ID.phlebApex },
      { tenantId: ID.apex, sampleId: ashaSample.id, type: "RECEIVED", actorId: ID.techApex },
      { tenantId: ID.apex, sampleId: ashaSample.id, type: "PROCESSING", actorId: ID.techApex },
      { tenantId: ID.apex, sampleId: ashaSample.id, type: "ASSIGNED", actorId: ID.pathApex, note: "Technician assigned" },
    ],
  });
  await prisma.labResult.create({ data: { tenantId: ID.apex, sampleId: ashaSample.id, parameterId: ID.hb, numericValue: 13.2, flag: "NORMAL", status: "ENTERED", enteredById: ID.techApex, enteredAt: new Date() } });
  await prisma.labResult.create({ data: { tenantId: ID.apex, sampleId: ashaSample.id, parameterId: ID.wbc, numericValue: 14.2, flag: "HIGH", status: "ENTERED", enteredById: ID.techApex, enteredAt: new Date() } });
  await prisma.medicalReport.create({ data: { tenantId: ID.apex, bookingId: ID.bookingAsha, labOrderId: ashaOrder.id, status: "ENTERED", title: "Laboratory report" } });

  await prisma.booking.create({
    data: {
      id: ID.bookingRavi,
      tenantId: ID.apex,
      branchId: ID.jubilee,
      patientId: ID.patientRavi,
      createdById: ID.ravi,
      publicCode: "MS-RAVI01",
      visitType: "HOME_COLLECTION",
      status: "PENDING",
      scheduledAt: at(2, "08:30"),
      address: "Synthetic apartment 12, Banjara Hills, Hyderabad",
      totalPaise: 79900,
      idempotencyKey: `${ID.apex}:booking:seed-ravi`,
      isSynthetic: true,
      items: { create: [{ tenantId: ID.apex, serviceId: ID.lipid, name: "Lipid Profile", pricePaise: 79900 }] },
      history: { create: [{ tenantId: ID.apex, toStatus: "PENDING", actorId: ID.ravi, reason: "Awaiting payment" }] },
      invoice: { create: { tenantId: ID.apex, kind: "PATIENT", status: "ISSUED", number: "INV-RAVI01", patientId: ID.patientRavi, subtotalPaise: 79900, taxPaise: 0, totalPaise: 79900, lines: [{ name: "Lipid Profile", amountPaise: 79900 }] } },
      collection: { create: { tenantId: ID.apex, status: "REQUESTED", windowStart: at(2, "08:30"), windowEnd: at(2, "09:30"), address: "Synthetic apartment 12, Banjara Hills, Hyderabad" } },
    },
  });

  await prisma.booking.create({
    data: {
      id: ID.bookingMeera,
      tenantId: ID.apex,
      branchId: ID.jubilee,
      patientId: ID.patientMeera,
      createdById: ID.deskApex,
      publicCode: "MS-MEERA1",
      visitType: "WALK_IN",
      status: "COMPLETED",
      scheduledAt: at(-1, "10:00"),
      totalPaise: 35000,
      idempotencyKey: `${ID.apex}:booking:seed-meera`,
      isSynthetic: true,
      items: { create: [{ tenantId: ID.apex, serviceId: ID.tsh, name: "TSH", pricePaise: 35000 }] },
      history: { create: [{ tenantId: ID.apex, toStatus: "COMPLETED", actorId: ID.pathApex, reason: "Seeded released report" }] },
      invoice: { create: { tenantId: ID.apex, kind: "PATIENT", status: "PAID", number: "INV-MEERA1", patientId: ID.patientMeera, subtotalPaise: 35000, taxPaise: 0, totalPaise: 35000, lines: [{ name: "TSH", amountPaise: 35000 }] } },
    },
  });
  const meeraOrder = await prisma.labOrder.create({ data: { tenantId: ID.apex, branchId: ID.jubilee, bookingId: ID.bookingMeera, status: "RESULTED" } });
  const report = await prisma.medicalReport.create({
    data: {
      tenantId: ID.apex,
      bookingId: ID.bookingMeera,
      labOrderId: meeraOrder.id,
      status: "RELEASED",
      title: "Laboratory report",
      currentVersion: 1,
      releasedAt: new Date(),
      approvals: { create: { tenantId: ID.apex, approverId: ID.pathApex, decision: "RELEASED", comment: "Reviewed synthetic values. No diagnosis stated." } },
    },
  });
  const pdf = await renderReportPdf({
    centerName: "Apex Diagnostics",
    branchName: "Jubilee Hills",
    patientName: "Synth Patient Meera Das",
    synthetic: true,
    publicCode: "MS-MEERA1",
    title: "Laboratory report",
    version: 1,
    approvedBy: "Synth Pathologist Dr. Sen",
    releasedAt: new Date(),
    rows: [{ name: "TSH: TSH", value: "2.4", unit: "µIU/mL", range: "0.4 – 4.5", flag: "NORMAL" }],
    disclaimer: "Reference flags compare a value with the center's configured range. They are not a diagnosis. This file is synthetic demonstration data.",
  });
  const storageKey = `tenants/${ID.apex}/reports/${report.id}/v1.pdf`;
  const root = path.resolve(process.cwd(), process.env.LOCAL_STORAGE_DIR || "storage");
  await mkdir(path.dirname(path.join(root, storageKey)), { recursive: true });
  await writeFile(path.join(root, storageKey), pdf);
  await prisma.reportVersion.create({ data: { tenantId: ID.apex, reportId: report.id, version: 1, storageKey, checksum: sha256(pdf.toString("base64")), createdById: ID.pathApex, note: "Initial release" } });

  await prisma.booking.create({
    data: {
      id: ID.bookingNimbus,
      tenantId: ID.nimbus,
      branchId: ID.indiranagar,
      patientId: ID.patientRavi,
      createdById: ID.ravi,
      publicCode: "MS-NIMB01",
      visitType: "CENTER_VISIT",
      status: "CONFIRMED",
      scheduledAt: at(1, "09:30"),
      totalPaise: 39900,
      idempotencyKey: `${ID.nimbus}:booking:seed-nimbus`,
      isSynthetic: true,
      items: { create: [{ tenantId: ID.nimbus, serviceId: ID.nimbusCbc, name: "Complete Blood Count", pricePaise: 39900 }] },
      history: { create: [{ tenantId: ID.nimbus, toStatus: "CONFIRMED", actorId: ID.ownerNimbus }] },
    },
  });

  await prisma.supportTicket.create({ data: { tenantId: ID.coastal, requesterId: ID.ownerCoastal, subject: "Verification follow-up", body: "Synthetic ticket: please review the pending center application.", priority: "NORMAL", status: "OPEN" } });
  await prisma.auditLog.create({ data: { tenantId: ID.apex, actorId: ID.ownerApex, action: "CREATE", entityType: "Tenant", entityId: ID.apex, metadata: { synthetic: true } as Prisma.InputJsonValue } });
  await prisma.notification.create({
    data: {
      tenantId: ID.apex,
      userId: ID.asha,
      channel: "EMAIL",
      templateKey: "booking_confirmed",
      toAddress: "patient.asha@mediscan.test",
      payload: { publicCode: "MS-ASHA01", centerName: "Apex Diagnostics", when: ashaSlot.toISOString(), link: "http://127.0.0.1:43123/bookings/" + ID.bookingAsha },
      status: "SENT",
      attempts: 1,
    },
  });

  console.log("Seeded synthetic MediScan Hub data. Demo password:", DEMO_PASSWORD);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
