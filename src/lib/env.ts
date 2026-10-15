import "dotenv/config";
import { z } from "zod";

const blank = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

const optionalText = z.preprocess(blank, z.string().min(1).optional());
const optionalUrl = z.preprocess(blank, z.string().url().optional());

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.string().url(),
    DATABASE_URL: z.string().min(1),
    PRIVILEGED_DATABASE_URL: z.preprocess(blank, z.string().min(1).optional()),
    SESSION_SECRET: z.string().min(32),
    FILE_SIGNING_SECRET: z.string().min(32),
    PAYMENT_PROVIDER: z.enum(["mock", "razorpay"]).default("mock"),
    RAZORPAY_KEY_ID: optionalText,
    RAZORPAY_KEY_SECRET: optionalText,
    RAZORPAY_WEBHOOK_SECRET: optionalText,
    NOTIFICATION_PROVIDER: z.enum(["mock", "live"]).default("mock"),
    WHATSAPP_TOKEN: optionalText,
    WHATSAPP_PHONE_NUMBER_ID: optionalText,
    WHATSAPP_TEMPLATE_NAMESPACE: optionalText,
    EMAIL_PROVIDER: z.enum(["mock", "smtp"]).default("mock"),
    SMTP_HOST: optionalText,
    SMTP_PORT: z.preprocess(blank, z.coerce.number().int().positive().default(587)),
    SMTP_USER: optionalText,
    SMTP_PASSWORD: optionalText,
    SMTP_FROM: z.string().min(1).default("MediScan Hub <no-reply@localhost>"),
    SMS_PROVIDER: z.enum(["mock", "msg91"]).default("mock"),
    MSG91_AUTH_KEY: optionalText,
    MSG91_SENDER_ID: optionalText,
    STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
    LOCAL_STORAGE_DIR: z.string().min(1).default("storage"),
    S3_ENDPOINT: optionalUrl,
    S3_REGION: z.string().min(1).default("ap-south-1"),
    S3_BUCKET: optionalText,
    S3_ACCESS_KEY_ID: optionalText,
    S3_SECRET_ACCESS_KEY: optionalText,
    CRON_SECRET: z.string().min(8),
    BOOTSTRAP_SECRET: optionalText,
    PACS_ENDPOINT: optionalUrl,
    ABDM_HIP_ID: optionalText,
  })
  .superRefine((env, ctx) => {
    const need = (cond: boolean, key: keyof typeof env, message: string) => {
      if (cond && !env[key]) ctx.addIssue({ code: "custom", path: [key], message });
    };
    need(env.PAYMENT_PROVIDER === "razorpay", "RAZORPAY_KEY_ID", "Required when PAYMENT_PROVIDER=razorpay");
    need(env.PAYMENT_PROVIDER === "razorpay", "RAZORPAY_KEY_SECRET", "Required when PAYMENT_PROVIDER=razorpay");
    need(env.PAYMENT_PROVIDER === "razorpay", "RAZORPAY_WEBHOOK_SECRET", "Required when PAYMENT_PROVIDER=razorpay");
    need(env.NOTIFICATION_PROVIDER === "live", "WHATSAPP_TOKEN", "Required when NOTIFICATION_PROVIDER=live");
    need(env.NOTIFICATION_PROVIDER === "live", "WHATSAPP_PHONE_NUMBER_ID", "Required when NOTIFICATION_PROVIDER=live");
    need(env.EMAIL_PROVIDER === "smtp", "SMTP_HOST", "Required when EMAIL_PROVIDER=smtp");
    need(env.SMS_PROVIDER === "msg91", "MSG91_AUTH_KEY", "Required when SMS_PROVIDER=msg91");
    need(env.STORAGE_PROVIDER === "s3", "S3_BUCKET", "Required when STORAGE_PROVIDER=s3");
    need(env.STORAGE_PROVIDER === "s3", "S3_ACCESS_KEY_ID", "Required when STORAGE_PROVIDER=s3");
    need(env.STORAGE_PROVIDER === "s3", "S3_SECRET_ACCESS_KEY", "Required when STORAGE_PROVIDER=s3");
  });

export type Env = Omit<z.infer<typeof schema>, "PRIVILEGED_DATABASE_URL"> & { PRIVILEGED_DATABASE_URL: string };

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid environment: ${details}`);
  }
  cached = {
    ...parsed.data,
    PRIVILEGED_DATABASE_URL: parsed.data.PRIVILEGED_DATABASE_URL ?? parsed.data.DATABASE_URL,
  } satisfies Env;
  return cached;
}

export function resetEnvCache() {
  cached = null;
}
