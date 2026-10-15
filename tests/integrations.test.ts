import { describe, expect, it } from "vitest";
import { ID } from "../prisma/ids";
import { loadActor } from "@/lib/services/auth";
import { logIntegration, sendHl7Order } from "@/lib/services/integrations";
import { prismaPrivileged } from "@/lib/db";

describe("integrations", () => {
  it("logs integration messages", async () => {
    const row = await logIntegration({
      tenantId: ID.apex,
      kind: "HL7",
      direction: "OUTBOUND",
      referenceId: "vitest",
      payload: { test: true },
      status: "QUEUED",
    });
    expect(row.kind).toBe("HL7");
    const found = await prismaPrivileged.integrationMessage.findUnique({ where: { id: row.id } });
    expect(found?.status).toBe("QUEUED");
  });

  it("queues HL7 for a booking", async () => {
    const actor = await loadActor(ID.deskApex, ID.apex, ID.jubilee);
    const msg = await sendHl7Order(actor, ID.bookingAsha);
    expect(msg.direction).toBe("OUTBOUND");
    expect(msg.referenceId).toBe(ID.bookingAsha);
  });
});
