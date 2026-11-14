# ASKF Program Approval Center Implementation Plan

> **For agentic workers:** Implement task-by-task with test-first discipline. Each task is independently testable; do not promote this branch to production.

**Goal:** Add hybrid KASKF schedule monitoring that downloads verified programs to a pending review queue and changes live fixtures only after explicit approval.

**Architecture:** Reuse the existing Vercel Cron, Playwright KASKF downloader, XLS/XLSX parser, Vercel Blob store, and fixture diff engine. Separate staging from publication with pending/settings/audit records and same-origin review APIs; the client never receives CRON_SECRET.

**Tech Stack:** Vite, React 19, TypeScript, Vercel Node.js Functions, Vercel Cron, Vercel Blob, Playwright, Vitest.

**Spec:** docs/superpowers/specs/2026-11-15-askf-program-approval-design.md

## Global Constraints
- Work only on feat/askf-program-approval-center; never modify develop/v4-pro or production directly.
- Keep the Vercel Cron at 15:00 UTC (18:00 Europe/Istanbul); weekly mode is Tuesday-only, daily mode runs every day.
- KASKF is the only authoritative source.
- Accept only validated .xls/.xlsx files up to 12 MB.
- Live pointer changes only after explicit review approval.
- A missing fixture is verification_required, never an automatic cancellation.
- CRON_SECRET remains server-only.
- Preserve previous live snapshot and raw source artifacts.

## Review Focus
- Duplicate delivery of the same file/hash: no duplicate pending item.
- Corrupt or renamed non-Excel payload: reject without touching pending/live.
- Season rollover or older week: keep current live data and require review.
- Two overlapping manual/cron checks: pending pointer must not regress.
- Pending snapshot changes between review and approval: reject stale approval.

---

### Task 1: Settings and staging domain contracts

**Files:**
- Modify: src/ingestion/publish.ts
- Create: src/ingestion/stage-askf.ts
- Create: src/ingestion/stage-askf.test.ts
- Modify: api/_lib/blob-store.ts

**Interfaces:**
- AskfMonitorSettings = { frequency: 'daily' | 'weekly'; weekday: 2; hour: 18; timeZone: 'Europe/Istanbul' }
- stageVerifiedSnapshot(input): Promise<PublicationResult> validates against live snapshot, archives source and immutable snapshot, returns staged snapshot, and MUST NOT write PATH_LIVE.
- PendingAskfReview = { snapshot: PublishedSnapshot; stagedAt: string; state: 'pending_review' }

- [ ] Write tests proving stage success writes source + immutable snapshot + pending pointer but never live pointer.
- [ ] Test unchanged hash, invalid snapshot, abnormal fixture loss, and season rollover rejection.
- [ ] Implement staging service by extracting shared snapshot construction from publish.ts.
- [ ] Add pending/settings/audit Blob path constants and typed read/write helpers.
- [ ] Run npm test -- --run src/ingestion/stage-askf.test.ts.

### Task 2: Shared ingestion service and scheduled/manual checks

**Files:**
- Create: api/_lib/askf-monitor.ts
- Create: api/askf-check.ts
- Modify: api/cron-askf.ts
- Modify: api/source-status.ts
- Modify: api/_lib/blob-store.ts
- Create: api/_lib/askf-monitor.test.ts

**Interfaces:**
- shouldRunScheduledCheck(settings, now): boolean
- runAskfCheck(trigger: 'cron' | 'manual'): Promise<AskfCheckResult>
- AskfCheckResult = { status: 'staged' | 'unchanged' | 'rejected' | 'skipped' | 'failed'; pending?: PendingAskfReview; reason?: string }

- [ ] Test Tuesday-only weekly scheduling, daily scheduling, Istanbul timezone boundary, duplicate hashes, and no-live-write behavior.
- [ ] Extract download/hash/parse/validation/staging into one shared service.
- [ ] Change Cron to skip when weekly mode is not due and stage rather than publish.
- [ ] Add same-origin POST manual-check endpoint with a minimum 5-minute cooldown and no client secret.
- [ ] Extend source-status with frequency, pending metadata, and last check result.
- [ ] Run targeted tests and TypeScript check.

### Task 3: Review, approval, rejection, and audit APIs

**Files:**
- Create: api/askf-review.ts
- Create: api/askf-settings.ts
- Create: api/_lib/request-security.ts
- Create: api/_lib/askf-review.test.ts

**Interfaces:**
- POST /api/askf-review body { action: 'approve' | 'reject'; expectedHash: string }
- GET/POST /api/askf-settings returns/updates AskfMonitorSettings
- assertSameOrigin(req): void rejects missing/mismatched Origin/Host.
- Approval verifies pending hash, archives previous live snapshot, then writes PATH_LIVE and clears pending.
- Rejection clears pending only; raw source and immutable snapshot remain archived.

- [ ] Test approval publishes only the exact reviewed hash.
- [ ] Test stale hash, missing pending, invalid action, cross-origin request, and Blob write failure.
- [ ] Implement approve/reject with audit records and fail-closed ordering.
- [ ] Implement settings validation and persistence.
- [ ] Run targeted tests and TypeScript check.

### Task 4: ASKF Management UI

**Files:**
- Modify: src/App.tsx
- Modify: src/styles.css
- Create: src/components/AskfReviewPanel.tsx
- Create: src/components/AskfReviewPanel.test.tsx (only if existing test environment supports DOM; otherwise API/domain tests cover behavior)

**Interfaces:**
- AskfReviewPanel receives source status, pending snapshot summary, settings, and callbacks for refresh/check/review/settings.
- UI states: idle, checking, staged, unchanged, rejected, failed, approving, rejecting.

- [ ] Add failing component tests for pending review summary and explicit approve/reject controls.
- [ ] Add Şimdi kontrol et, daily/weekly selector, next scheduled time, last attempt, and pending file metadata.
- [ ] Render added/changed/missing fixture diff; label missing as “iptal değil — doğrulama gerekli”.
- [ ] Add approve/reject confirmation and loading/error feedback.
- [ ] Ensure touch targets >=44px and contrast >=4.5:1; responsive Fold/phone/tablet/desktop.
- [ ] Run tests and typecheck.

### Task 5: End-to-end verification and preview deployment

**Files:**
- Modify: package.json (only if needed to include tests in build gate)
- Create: tests/askf-review-flow.test.ts

- [ ] Test end-to-end: check -> staged -> review -> reject keeps live unchanged.
- [ ] Test check -> staged -> approve changes live pointer and preserves previous snapshot.
- [ ] Test manual and cron concurrent execution, duplicate file, invalid payload, and rollback.
- [ ] Run npm test, npm run typecheck, and npm run build.
- [ ] Deploy this feature branch to Vercel Preview only.
- [ ] Verify preview routes, mobile layout, manual check, review approval, and no production alias changes.
- [ ] Report preview URL and acceptance results; do not promote to production.

## Self-review
- Spec coverage: schedule modes, manual check, official source, staging, provenance, diff, explicit approval, rejection, audit, rollback preservation, errors, and responsive UI are assigned to Tasks 1–5.
- No task is permitted to switch the live pointer during automated checks.
- The only live pointer write path is the explicit approval API.
- Production promotion is intentionally excluded from this plan.
