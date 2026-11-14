# Canlı V4 PRO — Premium Dashboard, Afiş Stüdyosu ve Bildirim Merkezi

**Date:** 2026-11-15  
**Target:** Production line `develop/v4-pro`  
**Implementation branch:** `feat/live-premium-dashboard-poster-notifications`  
**Base:** `feat/askf-program-approval-center` (50 commits ahead of Production; includes the previously requested pending-only ASKF approval center)

## Intent
Bring the live Darıca Gücü Maç Merkezi V4 PRO to a polished club-operations experience. The first screen becomes a dynamic command dashboard, the current text-only sharing page becomes a real poster-production studio, and notifications become a first-class in-app + opt-in Web Push service.

## User outcomes
- A coach/club operator can see upcoming fixtures, match counts, category distribution, recent changes, and source freshness at a glance.
- The operator can generate a high-quality shareable image for Instagram, WhatsApp groups, and WhatsApp Status without manually designing it elsewhere.
- The operator can enable notifications on supported devices and receive programme and fixture reminders when the app is closed.
- Existing match, club, venue, ASKF, archive, and user-local tracking behaviors remain intact.

## Visual direction — Luxury Football Command Center
A premium, expressive dark interface with luminous but restrained sport colors and frosted-glass cards:
- Canvas: midnight navy/ink `#0A1220`, secondary canvas `#101D30`.
- Glass surfaces: translucent navy with 18–24px backdrop blur, 1px white/blue-tinted edge, soft layered shadow.
- Primary accent: vivid pitch emerald `#29D391`; secondary accents: cyan `#4BC8F2`, amber `#F7B955`, coral `#F47C78`, periwinkle `#9B91F5`.
- Typography: retain Satoshi for UI and JetBrains Mono for timestamps/metadata; strong typographic contrast for headings and poster headlines.
- Cards: contextual color-coded metrics, a featured next-match hero, compact event/activity rail, category bars and responsive glass panels. Avoid flat identical metric grids.
- Motion: brief staggered reveals, subtle hover lift, animated status indicators and smooth screen transitions using transform/opacity only. Respect `prefers-reduced-motion`; no perpetual distracting motion.
- Accessibility: WCAG AA contrast, keyboard focus, labelled controls, touch targets >=44px.

## Scope

### 1. Command dashboard
- Add a true Dashboard as the default screen and preserve the dedicated Match Center.
- KPI cards: total fixtures, Darıca Gücü fixtures, tracked clubs, upcoming matches, changes awaiting review, source freshness.
- Featured next-match component with time/date/category/venue and quick actions.
- Category distribution and recent schedule-change/activity panels.
- One-tap routes to Afiş Stüdyosu, Match Center, ASKF review, and Notification Center.
- Keep all data derived from verified live program/status APIs; never invent fixture data.

### 2. Afiş Stüdyosu
- Replace the text-only “Paylaşım Stüdyosu” with a visual poster editor and preview.
- Presets: Matchday, Haftalık Program, Maç Sonucu, Kulüp Duyurusu.
- Output canvases:
  - Social portrait / WhatsApp group post: 1080×1350 (4:5)
  - Square post: 1080×1080 (1:1)
  - Story / WhatsApp Status: 1080×1920 (9:16)
- Use actual verified fixtures only for fixture/result templates. Club announcement template is editable text and does not assert fixture facts.
- Editable title, subtitle/caption, team/category/date/time/venue, color theme, and optional user-supplied team photo.
- Design backgrounds are drawn locally with Canvas gradients, pitch/line geometry and disciplined typography; no synthetic or invented club crest. Use the existing Darıca Gücü textual identity.
- Export a crisp PNG, download it, copy the caption, and use the native Web Share API with a file where supported. On unsupported clients, download the PNG and offer a WhatsApp text-share link as fallback.
- Do not send unattended WhatsApp group messages. WhatsApp delivery remains a deliberate user action through the device share sheet.

### 3. Notifications
- Add an in-app notification center with unread count, mark-read/mark-all-read, time, source and action link.
- Add opt-in browser push using Push API + service worker + VAPID Web Push on supported browsers/devices.
- Register/unregister subscriptions per device. The user explicitly enables notifications via a user gesture; never prompt automatically at page load.
- Events:
  1. New official ASKF programme staged and awaiting approval.
  2. Programme approved/rejected (in-app activity record).
  3. Verified Darıca Gücü match within the next 30 hours, deduplicated by fixture id/date/time.
  4. Source fetch/verification failure only when it materially affects programme freshness.
- Reuse existing daily Vercel Cron at 15:00 UTC (18:00 Europe/Istanbul); do not add a higher-frequency cron that might exceed the project's current Vercel plan. The same server check runs the notification digest after ASKF ingestion.
- Store push subscriptions, notifications and delivery keys in existing private Vercel Blob storage. Keep `CRON_SECRET`, VAPID private key and Blob token server-only.
- Remove endpoints returning HTTP 404/410 during push dispatch; keep other transient failures for retry.
- The UI clearly shows whether the current device is enabled and supports a manual test notification.

### 4. App shell and PWA support
- Add responsive glass header, section navigation, accessible mobile bottom navigation and notification entry.
- Add `manifest.webmanifest`, app icon, and service worker. The service worker handles push display/click only; it must not cache API or authenticated private content.
- Add a small offline fallback for static shell; no offline fixture mutation is introduced.

## Approaches considered
1. **CSS-only restyle + text export:** low effort, but still leaves the operator with plain-text sharing and no real notification delivery. Rejected.
2. **New external design/notification platform:** offers advanced graphics or delivery but adds accounts, service dependencies and recurring cost. Rejected for the first release.
3. **In-app design system + Canvas poster renderer + native Web Share + Vercel Blob/Web Push:** recommended. It builds on the current React/Vite/Vercel stack, works without a paid graphic service, supports WhatsApp through the phone's native share sheet, and keeps scheduled notification delivery on existing infrastructure.

## Non-goals / anti-goals
- Do not replace the verified ASKF source or silently publish pending programmes.
- Do not change existing match records or fabricate data for empty states.
- Do not send WhatsApp messages automatically to groups or scrape group contacts.
- Do not add a paid design SaaS or a new paid backend for this iteration.
- Do not remove existing club, venue, change tracking or ASKF screens.
- Do not deploy visual experiments directly to Production.

## Technical decisions
- Keep React 19 + TypeScript + Vite + Vercel Node.js Functions + private Vercel Blob.
- Use `web-push` with VAPID keys in Vercel environment variables.
- Keep the current CRON route and invoke daily push digest after the ASKF run.
- Use one notification store document with bounded histories and deduplication keys; the app is single-user with multiple personal devices.
- Use Canvas 2D for PNG poster generation. Keep source data and editable copy separate from rasterized output.
- Use the existing local club tracking settings; do not sync personal tracked-club preferences to server in this scope.

## Acceptance criteria
1. Production base remains untouched until preview tests and final branch review pass.
2. Dashboard is the default screen, responsive from Fold/mobile through desktop, and displays only API-backed verified numbers.
3. Match Center, Clubs, Venues, Changes and ASKF screens remain navigable and functional.
4. All three poster formats export PNGs at the exact output dimensions.
5. A selected verified match produces correct teams/category/date/time/venue in the poster and caption.
6. Web Share sends a real image file when supported; fallback downloads the file and opens WhatsApp with the caption.
7. Notification permission is requested only from the explicit enable action.
8. Subscription can be added/removed per device; push service worker shows notification and opens the correct screen on click.
9. Cron creates no duplicate upcoming-match reminders and new staged-program events are recorded.
10. All protected secrets stay server-side; same-origin checks protect mutations.
11. Existing ASKF manual approval gate remains mandatory.
12. All automated tests, typecheck and Vercel preview build pass.
13. After review, merge the feature branch to `develop/v4-pro` and confirm the new Production deployment is READY before declaring completion.
