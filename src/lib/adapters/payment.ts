import { getEnv } from "@/lib/env";
import { hmacSha256, randomToken, safeEqual } from "@/lib/crypto";
import { DomainError } from "@/lib/errors";

export type PaymentOrder = { orderId: string; amountPaise: number; currency: "INR"; keyId: string | null };

export interface PaymentProvider {
  name: "mock" | "razorpay";
  createOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }): Promise<PaymentOrder>;
  verifyCheckoutSignature(input: { orderId: string; paymentId: string; signature: string }): boolean;
  verifyWebhook(rawBody: string, signature: string | null): boolean;
  refund(input: { providerPaymentId: string; amountPaise: number }): Promise<{ refundId: string }>;
}

function mockSecret() {
  return `${getEnv().SESSION_SECRET}:mock-payments`;
}

const mockProvider: PaymentProvider = {
  name: "mock",
  async createOrder(input) {
    return { orderId: `order_mock_${randomToken(9)}`, amountPaise: input.amountPaise, currency: "INR", keyId: null };
  },
  verifyCheckoutSignature(input) {
    const expected = hmacSha256(mockSecret(), `${input.orderId}|${input.paymentId}`);
    return safeEqual(expected, input.signature);
  },
  verifyWebhook(rawBody, signature) {
    if (!signature) return false;
    return safeEqual(hmacSha256(mockSecret(), rawBody), signature);
  },
  async refund() {
    return { refundId: `rfnd_mock_${randomToken(9)}` };
  },
};

export function mockCheckoutSignature(orderId: string, paymentId: string) {
  return hmacSha256(mockSecret(), `${orderId}|${paymentId}`);
}

export function mockWebhookSignature(rawBody: string) {
  return hmacSha256(mockSecret(), rawBody);
}

const razorpayProvider: PaymentProvider = {
  name: "razorpay",
  async createOrder(input) {
    const env = getEnv();
    const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: input.amountPaise, currency: "INR", receipt: input.receipt, notes: input.notes }),
    });
    if (!response.ok) {
      throw new DomainError("PAYMENT_PROVIDER", "Razorpay order creation failed", 502);
    }
    const body = (await response.json()) as { id: string; amount: number };
    return { orderId: body.id, amountPaise: body.amount, currency: "INR", keyId: env.RAZORPAY_KEY_ID ?? null };
  },
  verifyCheckoutSignature(input) {
    const expected = hmacSha256(getEnv().RAZORPAY_KEY_SECRET!, `${input.orderId}|${input.paymentId}`);
    return safeEqual(expected, input.signature);
  },
  verifyWebhook(rawBody, signature) {
    if (!signature) return false;
    return safeEqual(hmacSha256(getEnv().RAZORPAY_WEBHOOK_SECRET!, rawBody), signature);
  },
  async refund(input) {
    const env = getEnv();
    const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const response = await fetch(`https://api.razorpay.com/v1/payments/${input.providerPaymentId}/refund`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: input.amountPaise }),
    });
    if (!response.ok) throw new DomainError("PAYMENT_PROVIDER", "Razorpay refund failed", 502);
    const body = (await response.json()) as { id: string };
    return { refundId: body.id };
  },
};

export function paymentProvider(): PaymentProvider {
  return getEnv().PAYMENT_PROVIDER === "razorpay" ? razorpayProvider : mockProvider;
}
