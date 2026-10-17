# HTTP API

Base path: `/api/v1`. Responses are `{ "ok": true, "data": ... }` or `{ "ok": false, "error": { "code", "message", "details" } }`.

Every state-changing call (`POST`, `PUT`, `PATCH`, `DELETE`, including file uploads and file removal) passes one central CSRF check (`src/server/csrf.ts`):

1. If the browser sends `Sec-Fetch-Site`, it must be `same-origin` (or `none`). `cross-site` and `same-site` are refused with `403 CSRF_CROSS_SITE`.
2. If `Origin` is sent (or, without it, `Referer`), it must be this app's origin. `Origin: null` is refused. Error: `403 CSRF_ORIGIN`.
3. The `x-csrf-token` header must equal the `ms_csrf` cookie (double submit) and the secret stored with the session. Error: `403 CSRF`. Login returns the token in `data.csrf` as well.

Login, registration, password recovery and center registration have no session yet, so only checks 1 and 2 apply. The payment webhook and the notification worker are server-to-server: the webhook is authenticated with `x-razorpay-signature` or `x-mediscan-signature` over the raw body, and the worker sends `x-cron-secret`. Server actions (the HTML forms) are protected by Next.js's own Origin check.

Bookings and payment orders accept an `Idempotency-Key` header.

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/api/health` | Public |
| POST | `/api/v1/auth/login` | Public, rate limited |
| POST | `/api/v1/auth/logout` | Session |
| POST | `/api/v1/auth/register` | Public |
| POST | `/api/v1/auth/forgot` | Public |
| POST | `/api/v1/auth/recover` | Public |
| GET | `/api/v1/auth/session` | Optional |
| GET | `/api/v1/centers` | Public |
| GET | `/api/v1/centers/:slug` | Public |
| POST | `/api/v1/centers/register` | Public |
| POST | `/api/v1/admin/tenants/:id/decision` | Super admin |
| GET | `/api/v1/catalog/search` | Public |
| GET | `/api/v1/packages` | Public |
| GET | `/api/v1/slots?branchId&day&kind` | Public. `kind=IMAGING` also needs `modality=XR\|CT\|MR\|US` and returns only open slots of active machines of that type, outside maintenance |
| GET | `/api/v1/plans` | Public |
| GET | `/api/v1/bookings` | Session |
| POST | `/api/v1/bookings` | Patient |
| GET | `/api/v1/bookings/:id` | Owner, staff, or referred doctor |
| GET | `/api/v1/bookings/:id/prescription` | Owner or staff (when uploaded) |
| GET | `/api/v1/patient/dependents` | Patient |
| POST | `/api/v1/patient/dependents` | Patient |
| DELETE | `/api/v1/patient/dependents/:id` | Patient |
| GET | `/api/v1/patient/wallet` | Patient |
| GET | `/api/v1/patient/insurance` | Patient |
| POST | `/api/v1/patient/insurance` | Patient |
| DELETE | `/api/v1/patient/insurance/:id` | Patient |
| GET | `/api/v1/patient/inbox` | Patient |
| POST | `/api/v1/patient/inbox/:id/read` | Patient |
| POST | `/api/v1/patient/inbox/read-all` | Patient |
| GET | `/api/v1/patient/chronic` | Patient |
| POST | `/api/v1/patient/chronic` | Patient |
| DELETE | `/api/v1/patient/chronic/:id` | Patient |
| POST | `/api/v1/finance/wallet-apply` | Billing staff |
| GET | `/api/v1/finance/tpa-claims` | Billing staff or patient |
| POST | `/api/v1/finance/tpa-claims` | Billing staff |
| POST | `/api/v1/finance/tpa-claims/:id` | Billing staff |
| POST | `/api/v1/bookings/:id/transition` | Staff or the patient, for cancel |
| POST | `/api/v1/bookings/:id/reschedule` | Staff or the patient |
| POST | `/api/v1/payments/orders` | Patient or billing staff |
| POST | `/api/v1/payments/verify` | Patient or billing staff |
| POST | `/api/v1/payments/webhook` | Provider signature |
| GET | `/api/v1/samples` | Lab staff |
| POST | `/api/v1/samples/:id/transition` | Lab staff |
| POST | `/api/v1/samples/:id/assign` | Result entry. Body `{ assigneeId }` assigns a lab technician or pathologist at the center |
| POST | `/api/v1/samples/:id/results` | Lab staff |
| GET | `/api/v1/reports` | Staff, or the patient for released reports |
| POST | `/api/v1/reports/:id/transition` | Approver |
| GET | `/api/v1/reports/:id/download` | Session, rechecked |
| GET | `/api/v1/files/signed?token` | Session plus a 5-minute signature |
| GET | `/api/v1/files/signed?file` | Session plus a 5-minute signature. PDFs and images open inline; DICOM and zip download as the original file (streamed) |
| GET | `/api/v1/reports/:id/open` | Owner (released only) or staff. Redirects to a 5-minute signed PDF link |
| GET | `/api/v1/report-files/:id/open` | Owner (released only) or staff. Redirects to a 5-minute signed file link |
| POST | `/api/v1/reports/:id/files` | Lab or radiology staff. Multipart `file`, `kind`, `bookingItemId`. PDF, JPG or PNG up to 20 MB |
| PUT | `/api/v1/uploads/dicom?reportId&name&bookingItemId` | Radiology staff, imaging reports only. Raw body (`application/octet-stream`) is a `.dcm` file or a `.zip` of a study, up to 500 MB |
| DELETE | `/api/v1/report-files/:id` | Lab or radiology staff, while the report is open |
| GET | `/api/v1/subscriptions` | Center staff |
| POST | `/api/v1/subscriptions` | Center owner |
| POST | `/api/v1/notifications/process` | Cron secret |
| GET | `/api/v1/analytics/platform` | Super admin |
| GET | `/api/v1/analytics/tenant` | Center analytics |
| GET | `/api/v1/exports/bookings` | Center analytics |
| GET | `/api/v1/patients/export` | Patient |
| POST | `/api/v1/tickets` | Session |
| POST | `/api/v1/invitations` | Staff manager |
| POST | `/api/v1/imaging/studies/:id` | Radiology |
| GET | `/api/v1/verification/:id` | Owning center or super admin |

A cross-tenant id returns 404. The server recalculates price and slot capacity. A browser field that says payment succeeded is ignored.

## Scan scheduling

X-ray (`XR`), CT, MRI (`MR`) and ultrasound (`US`) services are booked against a slot of a machine of that type (`AvailabilitySlot.kind = IMAGING` with `equipmentId`). `POST /api/v1/bookings` refuses a general, home or other-machine slot with `400 SLOT_TYPE`, scans with home collection with `400 VISIT`, and two scan types in one booking with `400 SCAN_MIX`. Capacity is taken with one conditional `UPDATE` that also checks the machine is active, of the right type and not inside a maintenance block, so two patients cannot both take the last place (`409 SLOT_FULL`). Staff manage machines, technician shifts, maintenance blocks and slots at `/console/imaging/rooms`.

## DICOM uploads

`PUT /api/v1/uploads/dicom` takes the file as the raw request body and streams it to a private temp file (never into memory), then:

- refuses more than 500 MB (`413 UPLOAD_TOO_LARGE`, checked from `Content-Length` and while streaming);
- accepts a single DICOM Part 10 file (`DICM` at byte 128, name ending `.dcm` or `.dicom`) or a `.zip` holding at least one such file (`DICOMDIR`, folders and hidden files are skipped);
- reads only modality, study date, body part, and series/image counts with `dicom-parser` (headers only, pixel data is never parsed). Patient names, IDs and UIDs are not stored;
- stores the original privately and records it as a `ReportFile` (kind `SCAN_IMAGE`, `dicomMeta`) with an audit entry.

Patients download the original through the usual 5-minute signed link after the report is released. There is no PACS integration and no image viewer.
