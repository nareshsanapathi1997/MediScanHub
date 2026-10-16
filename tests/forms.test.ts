import { describe, expect, it } from "vitest";
import { parseForm, schemas } from "@/lib/forms";

const fd = (values: Record<string, string>) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
};

describe("shared form schemas", () => {
  it("rejects weak passwords, future birth dates, and bad phones on registration", () => {
    const base = { name: "Synth Person", email: "a@b.test", phone: "+919876543210", dateOfBirth: "1990-01-01", sex: "FEMALE", password: "Synthetic#2026" };
    expect(schemas.register.safeParse(base).success).toBe(true);
    expect(schemas.register.safeParse({ ...base, password: "short" }).success).toBe(false);
    expect(schemas.register.safeParse({ ...base, password: "alllowercase123" }).success).toBe(false);
    expect(schemas.register.safeParse({ ...base, dateOfBirth: "2999-01-01" }).success).toBe(false);
    expect(schemas.register.safeParse({ ...base, dateOfBirth: "" }).success).toBe(false);
    expect(schemas.register.safeParse({ ...base, phone: "12" }).success).toBe(false);
  });

  it("requires consent and a pickup address for home collection at checkout", () => {
    const base = { branchId: crypto.randomUUID(), slotId: crypto.randomUUID(), serviceIds: "x", packageIds: "", visitType: "CENTER_VISIT", idempotencyKey: "abcdefgh12", consent: "on" };
    expect(schemas.checkout.safeParse(base).success).toBe(true);
    expect(schemas.checkout.safeParse({ ...base, consent: "" }).success).toBe(false);
    expect(schemas.checkout.safeParse({ ...base, visitType: "HOME_COLLECTION", address: "" }).success).toBe(false);
    expect(schemas.checkout.safeParse({ ...base, visitType: "HOME_COLLECTION", address: "12 Synthetic Road, Hyderabad" }).success).toBe(true);
  });

  it("validates center slugs and GSTIN, and surfaces the first message on the server", () => {
    expect(() => parseForm("forgot", fd({ email: "nope" }))).toThrow(/valid email/);
    expect(schemas.center.shape.slug.safeParse("Apex Labs").success).toBe(false);
    expect(schemas.center.shape.slug.safeParse("apex-labs").success).toBe(true);
    expect(schemas.center.shape.gstin.safeParse("36ABCDE1234F1Z5").success).toBe(true);
    expect(schemas.center.shape.gstin.safeParse("123").success).toBe(false);
    expect(schemas.recover.safeParse({ token: "0123456789ab", password: "Synthetic#2026", confirm: "Synthetic#2027" }).success).toBe(false);
  });
});

import { istDayKey, istDayStart } from "@/lib/format";

describe("India day boundaries", () => {
  it("uses IST midnight regardless of the server clock", () => {
    const lateUtc = new Date("2026-10-15T19:00:00Z"); // 00:30 IST on 16 Oct
    expect(istDayKey(lateUtc)).toBe("2026-10-16");
    expect(istDayStart(lateUtc).toISOString()).toBe("2026-10-15T18:30:00.000Z");
    expect(istDayStart(lateUtc, 1).toISOString()).toBe("2026-10-16T18:30:00.000Z");
    expect(istDayStart(new Date("2026-10-15T18:00:00Z")).toISOString()).toBe("2026-10-14T18:30:00.000Z");
  });
});

describe("checkbox consent from the browser form", () => {
  it("accepts a boolean true from react-hook-form and the 'on' string from FormData", async () => {
    const { schemas } = await import("@/lib/forms");
    const base = { branchId: "40000000-0000-4000-8000-000000000001", slotId: "91000000-0000-4000-8000-000000000099", visitType: "CENTER_VISIT", services: "x" };
    for (const consent of [true, "on"]) {
      const r = schemas.checkout.safeParse({ ...base, consent });
      expect(r.success ? "on" : r.error.issues.map((i) => i.path.join(".")).join(",")).not.toContain("consent");
    }
    const no = schemas.checkout.safeParse({ ...base, consent: false });
    expect(no.success).toBe(false);
  });
});
