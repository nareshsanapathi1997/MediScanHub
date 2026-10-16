import { getEnv } from "@/lib/env";
import { DomainError } from "@/lib/errors";

export type OutboundMessage = {
  channel: "EMAIL" | "WHATSAPP" | "SMS" | "IN_APP";
  to: string;
  subject: string;
  text: string;
  templateKey: string;
};

const delivered: OutboundMessage[] = [];

async function sendEmail(message: OutboundMessage) {
  const env = getEnv();
  if (env.EMAIL_PROVIDER === "mock" || env.NOTIFICATION_PROVIDER === "mock") {
    delivered.push(message);
    return;
  }
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  await transport.sendMail({ from: env.SMTP_FROM, to: message.to, subject: message.subject, text: message.text });
}

async function sendWhatsApp(message: OutboundMessage) {
  const env = getEnv();
  if (env.NOTIFICATION_PROVIDER === "mock") {
    delivered.push(message);
    return;
  }
  const response = await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: message.to.replace(/\D/g, ""),
      type: "template",
      template: {
        name: message.templateKey,
        language: { code: "en" },
        components: [{ type: "body", parameters: [{ type: "text", text: message.text.slice(0, 900) }] }],
      },
    }),
  });
  if (!response.ok) throw new DomainError("WHATSAPP", "WhatsApp Business delivery failed", 502);
}

async function sendSms(message: OutboundMessage) {
  const env = getEnv();
  if (env.SMS_PROVIDER === "mock" || env.NOTIFICATION_PROVIDER === "mock") {
    delivered.push(message);
    return;
  }
  const response = await fetch("https://control.msg91.com/api/v5/sms/send", {
    method: "POST",
    headers: { authkey: env.MSG91_AUTH_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: env.MSG91_SENDER_ID ?? "MEDSCN",
      route: "4",
      sms: [{ message: message.text, to: [message.to.replace(/\D/g, "")] }],
    }),
  });
  if (!response.ok) throw new DomainError("SMS", "SMS delivery failed", 502);
}

export async function deliverMessage(message: OutboundMessage) {
  if (message.channel === "IN_APP") {
    delivered.push(message);
    return;
  }
  if (message.channel === "EMAIL") return sendEmail(message);
  if (message.channel === "WHATSAPP") return sendWhatsApp(message);
  return sendSms(message);
}
