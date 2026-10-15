import { describe, expect, it } from "vitest";
import { ID } from "../prisma/ids";
import { loadActor } from "@/lib/services/auth";
import { creditWallet, debitWallet, formatChronicSummary, getWallet, saveDependent } from "@/lib/services/patient-extras";

describe("patient extras", () => {
  it("credits and debits wallet with ledger rows", async () => {
    const actor = await loadActor(ID.asha, null, null);
    await creditWallet(actor.patientId!, 5000, "Test credit");
    const afterCredit = await getWallet(actor);
    expect(afterCredit.wallet.balancePaise).toBeGreaterThanOrEqual(5000);
    await debitWallet(actor.patientId!, 2000, "Test debit");
    const afterDebit = await getWallet(actor);
    expect(afterDebit.wallet.balancePaise).toBe(afterCredit.wallet.balancePaise - 2000);
    expect(afterDebit.transactions.some((row) => row.amountPaise === -2000)).toBe(true);
  });

  it("formats chronic summaries", () => {
    expect(formatChronicSummary([])).toBe("");
    expect(formatChronicSummary([{ condition: "Type 2 diabetes", since: new Date("2020-01-15") }])).toContain("Type 2 diabetes");
  });

  it("saves a dependent for the guardian patient", async () => {
    const actor = await loadActor(ID.asha, null, null);
    const row = await saveDependent(actor, {
      name: "Vitest Dependent",
      dateOfBirth: new Date("2015-06-01"),
      sex: "FEMALE",
      relation: "Child",
    });
    expect(row.guardianPatientId).toBe(actor.patientId);
  });
});
