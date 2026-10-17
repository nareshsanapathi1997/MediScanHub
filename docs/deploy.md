# Deploy, backups, and provider setup

Keep dev, staging, and production databases separate. Production does not run `prisma/seed.ts`.

## Roles

Create three database roles:

- A migration owner that can create tables.
- `mediscan_app` with `NOSUPERUSER NOBYPASSRLS` for `DATABASE_URL`.
- `mediscan_admin` with `BYPASSRLS` for `PRIVILEGED_DATABASE_URL`. Use it only for auth, webhooks, and platform aggregates.

`scripts/bootstrap-local.sql` creates the local roles with local passwords. Generate different passwords in production, then run migrations as the owner:

```bash
DATABASE_URL="$MIGRATION_DATABASE_URL" npx prisma migrate deploy
```

## First super admin

There is no public signup for platform admins. After migrate, insert one user with a bcrypt hash and a `SUPER_ADMIN` membership from a trusted shell. Do not reuse `Synthetic#2026`.

## Hosting

The app is a Next.js server. `npm run build` then `npm run start` listens on port 43123. Set `APP_URL` to the public https origin. Terminate TLS at the platform or a proxy. Custom center domains must reach the same app so the host header can brand the public site.

DICOM uploads (`PUT /api/v1/uploads/dicom`) can be up to 500 MB. Allow that body size and a long timeout on the proxy (for nginx: `client_max_body_size 510m; proxy_request_buffering off; proxy_read_timeout 600s;`). The app streams the body to `os.tmpdir()/mediscan-uploads`, so the temp disk needs room for the largest upload in flight. Other uploads are capped at 20 MB.

Schedule `POST /api/v1/notifications/process` with header `x-cron-secret` every few minutes. That call sends the queue, queues booking reminders, and refreshes subscription states.

## Backups and rollback

Take a logical backup before each migration:

```bash
pg_dump --format=custom --file=mediscan.dump "$MIGRATION_DATABASE_URL"
pg_restore --clean --if-exists --dbname="$MIGRATION_DATABASE_URL" mediscan.dump
```

Prisma migrations are forward-only. Roll back by restoring the dump, then redeploy the previous application build. Object storage is not inside the dump; snapshot the bucket or the `storage/` directory with the same timestamp.

## Razorpay

Set `PAYMENT_PROVIDER=razorpay` and the key id, key secret, and webhook secret. The server creates orders, checks the checkout HMAC, and checks the webhook HMAC on the raw body. Point the webhook at `/api/v1/payments/webhook`.

## WhatsApp, email, SMS

`NOTIFICATION_PROVIDER=live` calls the WhatsApp Business Graph API with template messages. Templates must be approved in Meta and may only receive the allowlisted fields (`publicCode`, `link`, `centerName`, `when`, `window`, `recipientName`, `planName`). `EMAIL_PROVIDER=smtp` uses Nodemailer. `SMS_PROVIDER=msg91` uses MSG91. With the mock settings, messages are stored and marked sent without leaving the server. Password-reset and invitation links are returned in the UI only when `NODE_ENV` is not production.

## Storage

`STORAGE_PROVIDER=s3` uses a private bucket and the AWS SDK. Set the endpoint for MinIO or another S3-compatible store. `local` writes under `LOCAL_STORAGE_DIR`, which must not be web-accessible.

## Dependency scan

Run `npm audit` in CI or on a schedule. Review the report before upgrading major versions.
