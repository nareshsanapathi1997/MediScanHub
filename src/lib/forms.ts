import { z } from "zod";
import { DomainError } from "@/lib/errors";

/** Shared form schemas. The browser validates with React Hook Form; the server action re-validates with the same schema. */

const email = z.string().trim().toLowerCase().email("Enter a valid email address");
const phone = z.string().trim().regex(/^\+?[0-9][0-9\s-]{7,15}$/, "Enter a phone number with 8 to 15 digits, e.g. +91 98765 43210");
const strongPassword = z
  .string()
  .min(10, "Use at least 10 characters")
  .regex(/[a-z]/, "Add a lower-case letter")
  .regex(/[A-Z]/, "Add an upper-case letter")
  .regex(/[0-9]/, "Add a digit");
const pastDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date <= new Date() && date.getUTCFullYear() >= 1900;
  }, "Date of birth must be a real date in the past");
const sex = z.enum(["FEMALE", "MALE", "INTERSEX", "UNKNOWN"]);
const optionalText = z.string().trim().max(500).optional().or(z.literal(""));

export const schemas = {
  login: z.object({ email, password: z.string().min(1, "Enter your password"), next: z.string().optional() }),
  register: z.object({ name: z.string().trim().min(2, "Enter the full name"), email, phone, dateOfBirth: pastDate, sex, city: optionalText, password: strongPassword }),
  forgot: z.object({ email }),
  recover: z
    .object({ token: z.string().min(10, "This link is incomplete"), password: strongPassword, confirm: z.string() })
    .refine((value) => value.password === value.confirm, { message: "Passwords do not match", path: ["confirm"] }),
  center: z.object({
    ownerName: z.string().trim().min(2, "Enter your name"),
    email,
    phone,
    password: strongPassword,
    centerName: z.string().trim().min(2, "Enter the center name"),
    legalName: z.string().trim().min(2, "Enter the registered legal name"),
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower-case letters, digits, and single hyphens").min(3).max(48),
    city: z.string().trim().min(2, "Enter the city"),
    state: z.string().trim().min(2, "Enter the state"),
    address: z.string().trim().min(8, "Enter the full address"),
    gstin: z.string().trim().toUpperCase().regex(/^[0-9]{2}[A-Z0-9]{10}[0-9A-Z]{3}$/, "GSTIN is 15 characters, e.g. 36ABCDE1234F1Z5").optional().or(z.literal("")),
  }),
  walkIn: z.object({
    branchId: z.string().uuid("Choose a branch"),
    name: z.string().trim().min(2, "Enter the patient's full name"),
    email,
    phone,
    dateOfBirth: pastDate,
    sex,
    serviceIds: z.string().uuid("Choose a service"),
  }),
  checkout: z
    .object({
      branchId: z.string().uuid(),
      slotId: z.string().uuid(),
      serviceIds: z.string(),
      packageIds: z.string(),
      visitType: z.enum(["CENTER_VISIT", "HOME_COLLECTION"]),
      idempotencyKey: z.string().min(8),
      address: z.string().trim().max(500).optional().or(z.literal("")),
      notes: optionalText,
      referralEmail: email.optional().or(z.literal("")),
      consent: z.preprocess((v) => (v === true || v === "on" ? "on" : ""), z.literal("on", { message: "Please tick the consent box to continue" })),
    })
    .refine((value) => value.visitType !== "HOME_COLLECTION" || (value.address ?? "").length >= 8, { message: "Enter the full pickup address", path: ["address"] }),
  contact: z.object({ name: z.string().trim().min(2, "Enter your name"), email, subject: z.string().trim().min(3, "Add a subject"), body: z.string().trim().min(10, "Tell us a little more (10+ characters)") }),
} as const;

export type SchemaId = keyof typeof schemas;

export function parseForm<K extends SchemaId>(id: K, form: FormData): z.output<(typeof schemas)[K]> {
  const raw: Record<string, string> = {};
  for (const [key, value] of form.entries()) if (typeof value === "string") raw[key] = value;
  const result = schemas[id].safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new DomainError("VALIDATION", first?.message ?? "Check the highlighted fields", 400);
  }
  return result.data as z.output<(typeof schemas)[K]>;
}
