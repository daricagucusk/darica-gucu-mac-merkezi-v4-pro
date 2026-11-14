# Live Premium Dashboard, Poster Studio & Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Upgrade the live Darıca Gücü Maç Merkezi with a premium command dashboard, image-based social poster studio, and opt-in in-app/Web Push notifications.

**Architecture:** Extend the current React/Vite client with reusable dashboard, poster and notification components. Use Canvas for PNG output and Web Share for WhatsApp/group sharing. Use Vercel Blob for per-device push subscriptions and notification history, web-push/VAPID for delivery, and the existing daily ASKF Cron for deduplicated fixture/program notifications.

**Tech Stack:** React 19, TypeScript 5.8, Vite 7, Vitest 5, Vercel Node.js Functions, Vercel Blob, web-push, Web Push API, Service Worker, Canvas 2D.

**Spec:** docs/superpowers/specs/2026-11-15-live-premium-dashboard-poster-notifications-design.md

## Global Constraints
- Work on `feat/live-premium-dashboard-poster-notifications`; do not edit `develop/v4-pro` directly.
- Keep the ASKF pending-review approval gate intact.
- Never include secrets in client bundles or logs.
- Web Push permission is opt-in and requested only after a button click.
- WhatsApp sharing is a user-initiated Web Share flow; no unattended group sends.
- Poster fixtures/results must come only from verified API data.
- The only scheduled job is the existing daily 15:00 UTC ASKF cron.
- Service worker does not cache private API responses or fixture data.
- Preserve Fold/mobile/tablet/desktop responsiveness and reduced-motion behavior.

## Review Focus
- Browser does not support file sharing: PNG download plus WhatsApp text fallback works.
- Browser blocks notification permission or PushManager: in-app notifications remain available and UI reports the limitation.
- Expired push endpoint returns 404/410: subscription is removed without failing other deliveries.
- Cron re-runs the same fixture/program: delivery key prevents duplicate push/in-app records.
- Invalid/corrupt subscription or missing VAPID env: no fixture data or API response leaks secrets; cron continues.
- A pending ASKF programme already exists: notification state remains pending; live fixtures remain unchanged.

---

### Task 1: Design tokens, app shell and dashboard

**Files**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Create: `src/components/Dashboard.tsx`
- Create: `src/components/AppHeader.tsx`
- Create: `src/components/MetricCard.tsx`
- Create: `src/dashboard/metrics.ts`
- Create: `src/dashboard/metrics.test.ts`

**Interfaces**
- `buildDashboardMetrics(matches, daricaMatches, trackedClubs, changes, today)` returns typed counts and upcoming next-match summary.
- `Dashboard` receives verified live snapshot, source status, tracked-club count, and navigation callbacks.
- Navigation ids include `dashboard`, `matches`, `clubs`, `venues`, `changes`, `posters`, `source`.

- [ ] Write tests for verified, empty, stale and malformed fixture arrays.
- [ ] Verify RED for dashboard metric tests.
- [ ] Implement metric derivation with no fake/fallback fixture values.
- [ ] Build Dashboard with featured next-match hero, differentiated KPI cards, category distribution and activity/quick-action areas.
- [ ] Refactor App shell to make Dashboard the default route/screen while retaining existing modules.
- [ ] Replace the flat slate theme with semantic premium glass tokens and responsive layouts.
- [ ] Add reduced-motion CSS, visible focus states and 44px minimum controls.
- [ ] Run all Vitest tests, typecheck and Vite build.

### Task 2: Poster rendering engine and Afiş Stüdyosu

**Files**
- Create: `src/poster/poster-types.ts`
- Create: `src/poster/poster-renderer.ts`
- Create: `src/poster/poster-renderer.test.ts`
- Create: `src/components/PosterStudio.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces**
- `PosterFormat` = `'portrait' | 'square' | 'story'`.
- `PosterTemplate` = `'matchday' | 'weekly-program' | 'result' | 'announcement'`.
- `getPosterDimensions(format)` returns exact pixel dimensions.
- `buildPosterCopy(template, fixture, editableCopy)` returns structured poster copy and WhatsApp caption.
- `renderPoster(canvas, posterInput)` draws the exact-size output and resolves when images/fonts are ready.

- [ ] Test exact dimensions, verified-fixture guard and Turkish caption formatting.
- [ ] Verify RED for new poster tests.
- [ ] Implement deterministic Canvas drawing, template layouts, photo crop and safe text wrapping.
- [ ] Implement preview scaling independent of export resolution.
- [ ] Add template/format/match selector, copy editing, optional image upload, PNG download and caption copy.
- [ ] Add Web Share API file sharing with capability check; fallback to PNG download and WhatsApp caption URL.
- [ ] Run all tests, typecheck and build.

### Task 3: Notification storage and Web Push service

**Files**
- Modify: `package.json`
- Modify: `api/_lib/blob-store.ts`
- Create: `api/_lib/notifications.ts`
- Create: `api/_lib/push.ts`
- Create: `api/_lib/notifications.test.ts`

**Interfaces**
- `NotificationRecord` contains id, type, title, body, createdAt, readAt, href and dedupeKey.
- `PushSubscriptionRecord` contains endpoint, keys, createdAt, lastSuccessAt.
- `createNotification(input)` persists a deduplicated in-app notification and dispatches best-effort push.
- `sendPushToAll(payload)` sends to every stored personal device and prunes expired subscriptions.
- `buildMatchReminderKey(match)` produces a stable idempotency key from season, fixture id, date and kickoff.

- [ ] Test dedupe key, notification cap, endpoint validation and 404/410 subscription pruning with a storage adapter.
- [ ] Verify RED before implementation.
- [ ] Add web-push dependency and VAPID key configuration.
- [ ] Implement private Blob read/write, bounded history and per-device subscription storage.
- [ ] Implement safe best-effort push dispatch with per-endpoint failure isolation.
- [ ] Keep credentials out of responses and logs.
- [ ] Run tests and typecheck.

### Task 4: Notification APIs, service worker and client center

**Files**
- Create: `api/notifications.ts`
- Create: `api/push-subscribe.ts`
- Create: `api/push-unsubscribe.ts`
- Create: `public/sw.js`
- Create: `public/manifest.webmanifest`
- Create: `public/icon.svg`
- Create: `src/components/NotificationCenter.tsx`
- Create: `src/notifications/push-client.ts`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Modify: `index.html`
- Modify: `src/styles.css`

**Interfaces**
- `GET /api/notifications` returns latest 30 notifications, unread count, current device subscription status and VAPID public key.
- `POST /api/notifications` supports `mark_read` and `mark_all_read`.
- `POST /api/push-subscribe` validates and upserts a browser subscription.
- `POST /api/push-unsubscribe` removes the current browser endpoint.
- Client helper `enablePushNotifications()` requests permission only after the explicit user click, subscribes and POSTs the endpoint.

- [ ] Test payload validation and same-origin enforcement for mutations.
- [ ] Verify RED for API/domain behavior tests.
- [ ] Implement service-worker push/show/click handling; never cache private APIs.
- [ ] Implement app notification drawer, unread state, refresh and mark-read actions.
- [ ] Add user-initiated enable/disable push controls and unsupported-browser messaging.
- [ ] Add PWA manifest and register the worker.
- [ ] Run tests, typecheck and build.

### Task 5: Connect ASKF and fixture lifecycle events

**Files**
- Modify: `api/_lib/askf-monitor.ts`
- Modify: `api/cron-askf.ts`
- Modify: `api/askf-review.ts`
- Create: `api/_lib/notification-digest.ts`
- Create: `api/_lib/notification-digest.test.ts`

**Interfaces**
- `dispatchDailyFixtureReminders(now)` checks only verified Darıca fixtures within the next 30 hours, emits once per fixture using stable keys.
- New staged programme calls `createNotification({ type: 'askf_pending_review', ... })`.
- Approval/rejection writes an in-app activity event and does not change push settings.
- Cron dispatch failures are isolated from the schedule-fetch result and never cause live/pending pointer changes.

- [ ] Test 30-hour window boundaries, already-played fixtures, duplicate cron execution and pending-vs-live integrity.
- [ ] Verify RED.
- [ ] Connect event notification to stage/approve/reject paths.
- [ ] Dispatch daily match reminder digest from existing cron after ASKF check.
- [ ] Add safe audit events and ensure no duplicate notification delivery.
- [ ] Run all tests and typecheck.

### Task 6: Integration QA and Production release

**Files**
- Modify: `docs/superpowers/plans/2026-11-15-live-premium-dashboard-poster-notifications-progress.md`

- [ ] Run the entire Vitest suite.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Deploy feature branch to Vercel Preview.
- [ ] Verify dashboard, all existing routes, poster dimensions/export, sharing fallback, notification opt-in/API and service-worker response.
- [ ] Run a test notification without changing live fixtures.
- [ ] Run a read-only source and security review of Blob permissions, VAPID, CRON_SECRET, same-origin checks and service-worker scope.
- [ ] Create PR targeting `develop/v4-pro`; include ASKF approval-center changes from base branch.
- [ ] Merge only after all checks are green.
- [ ] Confirm the Vercel Production deployment from `develop/v4-pro` is READY and verify the production alias points to that deployment.
- [ ] Report Production URL, commit, deployment state, tests, and remaining device-specific checks.

## Self-review
- Dashboard and poster are independent UI deliverables with independent tests.
- Notification storage/push service is independent of its UI/API consumer and has explicit contracts.
- Cron integration happens after both notification storage and API/client are defined.
- Production promotion is the final task only after a green preview and pull-request checks.
- No requirement silently mutates ASKF live fixtures or sends WhatsApp messages.
