# SUTRO SATHI — Payload-First Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default-Deny Baseline**: Every unspecified document path is denied (`allow read, write: if false`).
2. **PII Isolation**: `/users/{userId}` documents contain `email` and personal preferences; only the owning user (`request.auth.uid == userId`) or a verified admin (`isAdmin()`) may `get`, `list`, `create`, or `update`.
3. **Zero Privilege Escalation**: Standard users creating or updating `/users/{userId}` are forbidden from setting `role` to `'admin'` or changing their `role` or `status` field. Only `isAdmin()` (verified via `/admins/{uid}` OR bootstrapped verified admin email `midulhasan000888@gmail.com` with `email_verified == true`) can write to `/admins`, `/roles`, `/categories`, `/calculators`, `/formulas`, `/formulaVersions`, `/units`, `/reportTemplates`, `/appSettings`, and `/auditLogs`.
4. **Owner-Scoped Private Data**: `/calculationHistory`, `/generatedReports`, `/calendarEvents`, `/reminders`, `/personalNotes` enforce `userId == request.auth.uid` on both single-doc reads and `list` queries (`resource.data.userId == request.auth.uid`), preventing cross-user scraping.
5. **Shadow-Field Prevention**: Every `create` validates exact required and allowed keys (`hasAll` + `hasOnly`), string `.size()` limits, and `isValidId()` regex (`^[a-zA-Z0-9_-]+$`). Every `update` validates `affectedKeys().hasOnly(...)` and preserves immutable keys (`userId`, `createdAt`, `uid`).
6. **Temporal Integrity**: `createdAt` on create and `updatedAt` on update must equal `request.time`.

## 2. Dirty Dozen Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Self-Role Escalation**: Non-admin user creates `/users/{uid}` with `role: "admin"`.
2. **Shadow Field Injection**: User updates `/personalNotes/{id}` adding `{ isVerified: true }`.
3. **Unverified Admin Email Spoof**: User with `email: "midulhasan000888@gmail.com"` and `email_verified: false` tries to write `/calculators/calc1`.
4. **Cross-User Note Read**: Authenticated User B runs `get` or `list` on User A's `/personalNotes/{id}`.
5. **Owner Spoofing**: User B creates `/calculationHistory/{id}` with `userId: "userA_uid"`.
6. **ID Poisoning**: User creates `/personalNotes/invalid..id!with$slashes` or 500-char ID.
7. **Timestamp Forgery**: User creates `/reminders/{id}` with backdated `createdAt` != `request.time`.
8. **Immutable Field Tampering**: User updates `/calendarEvents/{id}` changing `userId` or `createdAt`.
9. **Unauthorized Formula Modification**: Non-admin user updates `/calculators/three-phase-power` formula.
10. **PII Blanket Scrape**: Non-admin user calls `list` on `/users` collection.
11. **Denial-of-Wallet Oversized String**: User creates `/personalNotes/{id}` with 200KB `title` string.
12. **Audit Log Forgery**: Non-admin user attempts to write or delete `/auditLogs/{id}`.
13. **Private PDF Cross-Tenant Access**: User B tries to `get` or `list` User A's `/pdfDocuments/{docId}` (where `sharedWithLink == false`) or its `/pages/{pageId}` subcollection.
14. **Subcollection Master-Gate Bypass**: User B tries to `create` `/pdfDocuments/{docA_id}/pages/page-1` under User A's parent document.
15. **Oversized PDF Page Payload**: User tries to inject >180KB thumbnail or >35KB text into `/pdfDocuments/{docId}/pages/{pageId}`.
16. **Cross-Tenant User Template Read/Edit**: User B tries to `list` or `update` User A's private `/userReportTemplates/{tplId}` or `/reportSections/{secId}`.
17. **Email History Tampering & Forged Status**: User B tries to read User A's `/emailHistory/{emailId}` or inject an invalid `deliveryStatus` outside `['submitted', 'sent', 'delivered', 'failed']`.
18. **Unauthorized Global Report Settings Write**: Non-admin user attempts to modify `/reportSettings/global` or Admin-owned `/reportTemplates/{templateId}`.

