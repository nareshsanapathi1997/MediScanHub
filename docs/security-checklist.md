# Security checklist

## In the application

- Passwords are bcrypt hashes. Payment secrets stay in server env.
- Session cookie is HTTP-only. CSRF cookie is readable by the page and required on cookie-authenticated mutations.
- Login is rate limited per IP and locks after five failures.
- Sessions expire after 12 hours idle or 7 days absolute, and slide when last seen is older than 5 minutes. Password change, logout, suspension, and account deletion revoke sessions.
- Every clinical query derives the tenant from the session or from the branch row, then sets `app.tenant_id` inside the transaction. The runtime role cannot bypass row-level security.
- Cross-tenant and cross-patient reads return 404.
- Booking and payment writes use idempotency keys. Slot capacity is a conditional update. Webhook event ids are stored once.
- Uploads are sniffed. PDF, PNG, and JPEG only, 5 MB, extension must match the bytes.
- Report download rechecks the caller and writes an audit row. Signed links last 5 minutes and still require a session.
- Notifications use an allowlist of fields. Result values cannot be enqueued.
- Patient deletion anonymizes login data and keeps clinical rows. Export is audited.
- Headers: frame denial, nosniff, referrer policy, a tight form-action CSP. A full script CSP is not set, because Next.js hydration needs inline scripts.

## Still required before production

- Replace every local password and secret. Do not load the synthetic seed.
- Password hashes are selected only inside authentication. Directory, ticket, sample, and report queries return name, email, phone, and status. A desk checks permission before it queries, then returns access denied without loading the rows.
- Put Postgres, the app, and object storage on private networks. Take backups and test a restore.
- Use a shared rate-limit store if more than one instance runs. The current limiter is process memory.
- Turn on Razorpay, WhatsApp, SMTP, and S3 only with real credentials. Confirm webhook secrets.
- Run a dependency audit and patch. `npm audit` currently reports vulnerabilities in the tree; do not use `audit fix --force` blindly.
- Have counsel review DPDP, ABDM, and clinical establishment duties. This repository does not claim those certifications.
- Point a custom domain at the app over HTTPS and set `APP_URL`. The host header selects the center brand. DNS and a certificate are outside the app.
