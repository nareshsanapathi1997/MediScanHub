# Data model

Money is stored in paise. Clinical rows carry `tenantId`. Files live in private storage; the database keeps the key, checksum, and access audit.

```mermaid
erDiagram
  User ||--o{ Session : has
  User ||--o| Patient : is
  User ||--o{ TenantMembership : joins
  Role ||--o{ TenantMembership : grants
  Role }o--o{ Permission : includes
  Tenant ||--o{ Branch : operates
  Tenant ||--o{ TenantMembership : scopes
  Tenant ||--o{ Subscription : bills
  SubscriptionPlan ||--o{ Subscription : defines
  Branch ||--o{ StaffAssignment : assigns
  User ||--o{ StaffAssignment : works
  Tenant ||--o{ DiagnosticService : publishes
  ServiceCategory ||--o{ DiagnosticService : groups
  DiagnosticService ||--o{ TestParameter : measures
  TestParameter ||--o{ ReferenceRange : bounds
  DiagnosticService ||--o{ ServicePrice : prices
  Branch ||--o{ ServicePrice : lists
  TestPackage ||--o{ PackageItem : bundles
  DiagnosticService ||--o{ PackageItem : included
  Branch ||--o{ AvailabilitySlot : opens
  Patient ||--o{ Booking : books
  Branch ||--o{ Booking : hosts
  Booking ||--o{ BookingItem : contains
  Booking ||--o{ BookingStatusHistory : tracks
  Booking ||--o| HomeCollectionTask : collects
  Booking ||--o| LabOrder : orders
  LabOrder ||--o{ Sample : draws
  Sample ||--o| SampleBarcode : labels
  Sample ||--o{ SampleEvent : timestamps
  Sample ||--o{ LabResult : records
  User ||--o{ Sample : "technician"
  TestParameter ||--o{ LabResult : defines
  Booking ||--o{ MedicalReport : reports
  MedicalReport ||--o{ ReportApproval : signs
  MedicalReport ||--o{ ReportVersion : versions
  Booking ||--o| ImagingOrder : schedules
  ImagingOrder ||--o{ ImagingStudy : acquires
  Equipment ||--o{ EquipmentSchedule : staffs
  Booking ||--o| Invoice : bills
  Invoice ||--o{ Payment : settles
  Payment ||--o{ Refund : returns
  Tenant ||--o{ Notification : queues
  Notification ||--o{ NotificationDeliveryAttempt : retries
  User ||--o{ AuditLog : writes
  User ||--o{ SupportTicket : opens
  Tenant ||--o{ CenterVerification : uploads
```

Extra tables used by the implementation: `SubscriptionPlan`, `Invitation`, `PasswordReset`, `Equipment`, `PackageItem`, `WebhookEvent`, `IdempotencyRecord`.
