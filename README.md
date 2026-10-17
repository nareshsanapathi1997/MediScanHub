# MediScan Hub

Multi-tenant software for diagnostic centers. Patients book lab tests, imaging slots, and home collection from a shared directory. Each center runs its own branches, catalog, samples, reports, and invoices. A center can also be served from its own hostname.

The stack is Next.js (App Router), TypeScript, Tailwind, shadcn/ui, Prisma, and PostgreSQL. Payments, WhatsApp, email, SMS, and object storage sit behind adapters. Without credentials they use a local provider that still verifies signatures and records delivery.

Synthetic demo records are labeled. They are not real patients.

## Run it locally

PostgreSQL 16 is required. `docker compose up -d` starts one, or use a local cluster.

```bash
cp .env.example .env
cp .env.example .env.test
# Use mediscan_hub in .env and mediscan_test in .env.test (see .env.example comments).
npm install
npm run db:ensure
npm run db:setup
npm run dev
```

`npm run db:ensure` creates `mediscan_hub` and `mediscan_test` if missing and applies `scripts/bootstrap-local.sql` to both. `npm run db:setup` runs migrations and seed using `.env`.

Country, state, and city dropdowns on registration and center onboarding come from master tables populated from [dr5hn/countries-states-cities-database](https://github.com/dr5hn/countries-states-cities-database). After migrations:

```bash
npm run geo:fetch    # downloads JSON into scripts/geo/
npm run geo:import   # loads GeoCountry / GeoState / GeoCity (cities take several minutes)
```

Repeat `geo:import` against `mediscan_test` if tests need populated geo data. Until import finishes, location pickers stay empty.

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

`db:setup` migrates and seeds with `DATABASE_URL` from `.env`. If your shell already exported `DATABASE_URL`, unset it before `npm run dev`.

Create `mediscan_test` before tests. `npm test` migrates and reseeds that database.

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

Playwright uses Chromium (`npx playwright install chromium`) and reuses the dev server. Before E2E: `npm run db:seed` with `.env` pointing at `mediscan_hub`, then `npm run test:e2e`.

Background jobs (reminders, notification delivery, subscription refresh): call `POST /api/v1/notifications/process` with header `x-cron-secret` matching `CRON_SECRET`, or run `npm run cron:worker` on a schedule.

## Demo sign-in

Local password for every synthetic user except the support inbox: `Synthetic#2026`.

| Email | Desk |
| --- | --- |
| super@mediscan.test | Platform admin |
| owner.apex@mediscan.test | Apex owner (Hyderabad, two branches) |
| manager.apex@mediscan.test | Jubilee Hills manager |
| desk.apex@mediscan.test | Reception |
| phleb.apex@mediscan.test | Phlebotomist |
| tech.apex@mediscan.test | Lab technician |
| path.apex@mediscan.test | Pathologist |
| radio.apex@mediscan.test | Radiology |
| accounts.apex@mediscan.test | Finance |
| owner.nimbus@mediscan.test | Nimbus, starter plan |
| owner.coastal@mediscan.test | Coastal, pending review |
| doctor.rao@mediscan.test | Referral doctor |
| patient.asha@mediscan.test | Patient with an open report |
| patient.meera@mediscan.test | Patient with a released PDF |
| patient.ravi@mediscan.test | Patient with a pending home collection |

Do not load this seed, these passwords, or `scripts/bootstrap-local.sql` into production.

## What the desks do

Public pages search tests, packages, imaging, and home collection, then check out with server-side prices and consent. The patient desk shows appointments, released reports, invoices, export, and account deletion.

Center staff manage branches, catalog, discounts, packages, invitations, slots, walk-ins, collections, samples, results, report release, imaging rooms, and refunds. A booking moves only through the allowed states. A report PDF is created on release. Unreleased results are not downloadable by the patient.

X-ray, CT, MRI and ultrasound are booked against slots of a machine of that type. Staff set up machines, radiographer shifts, maintenance blocks and slots at `/console/imaging/rooms`. Radiology uploads PDFs, images and DICOM studies (`.dcm` or a zipped study, up to 500 MB, streamed) per booking item. The app shows only modality, study date and series and image counts, and the patient downloads the original file after release. See `docs/api.md` for the API and CSRF rules.

Platform admins see live counts, approve centers, edit plan prices and limits, suspend users, read the audit log, and run the notification worker.

## Remaining provider setup

Copy `.env.example`. Mock mode needs no third-party accounts.

- Razorpay: set `PAYMENT_PROVIDER=razorpay` and the three secrets. Webhook URL is `/api/v1/payments/webhook`.
- WhatsApp: set `NOTIFICATION_PROVIDER=live`, a token, and a phone number id. Templates must already be approved and must not include result values.
- Email: set `EMAIL_PROVIDER=smtp` and the SMTP fields.
- SMS: set `SMS_PROVIDER=msg91`.
- Files: set `STORAGE_PROVIDER=s3` and the bucket credentials. The bucket stays private.

Details, backups, and the first real super admin are in [docs/deploy.md](docs/deploy.md). The API is in [docs/api.md](docs/api.md), the model in [docs/er-diagram.md](docs/er-diagram.md), and the control list in [docs/security-checklist.md](docs/security-checklist.md). A Postman collection is at [postman/mediscan.postman_collection.json](postman/mediscan.postman_collection.json).

Indian DPDP, ABDM, and clinical establishment rules need a legal review. This project does not claim those certifications. Imaging orders record a modality and an accession. They do not connect to a PACS, and there is no DICOM viewer.

## Troubleshooting

- Empty public pages after a fresh database: run `npm run db:seed`.
- Staff can sign in but every clinical page is empty: the server is using a superuser URL and you are looking at the wrong symptom, or the app role was never granted. Re-run migrations as the owner.
- A reset link does not arrive: mock mode prints the development link on the forgot-password page. Production never returns that link.
- Slot says it was just taken: capacity is enforced in one update. Pick another time.
