import { describe, expect, it } from "vitest";
import { assertTransition, BOOKING_TRANSITIONS, REPORT_TRANSITIONS, SAMPLE_TRANSITIONS } from "@/domain/state";
import { DomainError } from "@/lib/errors";
import { assertSafePayload } from "@/lib/services/notify";
import { assertUpload } from "@/lib/adapters/storage";
import { barcodeSvg } from "@/lib/barcode";
import { mockCheckoutSignature, mockWebhookSignature } from "@/lib/adapters/payment";

describe("state machines", () => {
  it("allows the booking path and rejects skips", () => {
    expect(() => assertTransition(BOOKING_TRANSITIONS, "PENDING", "CONFIRMED", "Booking")).not.toThrow();
    expect(() => assertTransition(BOOKING_TRANSITIONS, "PENDING", "COMPLETED", "Booking")).toThrow(DomainError);
    expect(() => assertTransition(SAMPLE_TRANSITIONS, "REJECTED", "RECOLLECTION", "Sample")).not.toThrow();
    expect(() => assertTransition(REPORT_TRANSITIONS, "DRAFT", "RELEASED", "Report")).toThrow(DomainError);
  });

  it("refuses result values in notification payloads", () => {
    expect(() => assertSafePayload({ publicCode: "MS-1", link: "https://example.test/bookings/1" })).not.toThrow();
    expect(() => assertSafePayload({ hemoglobin: "13.2" })).toThrow(DomainError);
  });

  it("rejects uploads that are not PDF or images", () => {
    expect(() => assertUpload(Buffer.from("not a file"), "note.pdf")).toThrow(DomainError);
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n");
    expect(assertUpload(pdf, "report.pdf").kind).toBe("pdf");
    expect(() => assertUpload(pdf, "report.png")).toThrow(/does not match/i);
  });

  it("escapes barcode text", () => {
    const svg = barcodeSvg("A<B>");
    expect(svg).not.toContain("<B>");
    expect(svg).toContain("A&lt;B&gt;");
  });

  it("signs mock payments", () => {
    const signature = mockCheckoutSignature("order_1", "pay_1");
    expect(signature).toHaveLength(64);
    const body = JSON.stringify({ id: "evt_1" });
    expect(mockWebhookSignature(body)).toHaveLength(64);
  });
});
