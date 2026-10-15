# HTTP API

Base path: `/api/v1`. Responses are `{ "ok": true, "data": ... }` or `{ "ok": false, "error": { "code", "message", "details" } }`.

Mutations that use the session cookie send `x-csrf-token` equal to the `ms_csrf` cookie, and the `Origin` host must match. Login, registration, password recovery, the payment webhook, and the notification worker are exempt. The webhook is authenticated with `x-razorpay-signature` or `x-mediscan-signature` over the raw body. The worker sends `x-cron-secret`.

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
| GET | `/api/v1/slots?branchId&day&kind` | Public |
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
