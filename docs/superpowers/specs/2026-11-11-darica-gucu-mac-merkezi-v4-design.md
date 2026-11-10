# Darıca Gücü Maç Merkezi V4 PRO — Design Specification

## Intent
Create one responsive football operations application for Darıca Gücü and Kocaeli amateur football. Combine the original application's match-day usability and club/venue workflows with V3's ASKF source automation and provenance controls.

## Users and outcomes
Primary user: club coach/administrator using desktop and Samsung Galaxy Z Fold 7. The user can inspect upcoming Darıca Gücü matches, weekly fixtures, tracked clubs/venues, source freshness, and shareable schedules. Missing fixtures are never interpreted as confirmed cancellations or venue vacancies.

## Goals
1. One canonical fixture model and one interface.
2. Reliable ASKF ingestion with SHA-256 provenance and validation.
3. Atomic publication: invalid snapshots cannot replace the last verified snapshot.
4. Deterministic fixture identity and change detection.
5. Responsive desktop, foldable, and compact mobile experience.
6. Offline read access to the latest verified snapshot.
7. Premium Instagram/WhatsApp export and notification center in later phases.

## Non-goals
- Replacing the official ASKF website.
- Treating this application as authority for cancellation without official evidence.
- Rewriting or deleting original/V3 production systems during migration.
- Requiring paid infrastructure before free-tier limits are measured.
- Integrating unrelated MatchBoard or MatchStudio products.

## Constraints
- Original and V3 production deployments remain untouched until acceptance.
- V4 is a separate source project with its own repository and controlled development branch.
- V3 deployed source is not yet connected to a verified Git repository; recovery/porting must be explicit.
- Existing V2 parser and tests are reusable only after independent tests establish behavior.
- Supabase is optional and unverified. No migration before isolation, Auth, and RLS checks.
- Secrets stay server-side and out of logs/client bundles.
- Every published schedule exposes source and freshness metadata.
- Critical mutation paths require automated tests.

## Approaches considered
1. Directly merge V2 and V3 into the original site — rejected due missing source repository, browser-local data risk, and weak rollback boundary.
2. Rebuild the full product in one pass while replacing V3 — rejected due migration risk and unproven ingestion.
3. Create a new V4 source project, port verified domain behavior, and migrate in vertical slices — selected because it preserves existing products and enables isolated tests and preview deployment.

## Architecture
- Frontend: Vite + React + TypeScript, responsive PWA shell.
- API: Vercel Node.js functions.
- Source ingestion: server-side Playwright/Chromium using official KASKF file manager workflow; no invented static XLS URL.
- Parsing: isolated parser adapter ported from V2/V3 with fixture-based tests.
- Storage: Vercel Blob for source artifacts/snapshots; canonical metadata in a transactional store only after provider isolation and security validation.
- Offline: IndexedDB stores the latest verified snapshot only.
- Current stage: isolated V4 foundation and data-trust core; no production promotion.

## Data invariants
- Incoming snapshot accepted only if provenance, file type, hash, source week, parse quality, and fixture-count guardrails pass.
- Failed validation preserves the previous verified snapshot byte-for-byte.
- Fixture identity uses normalized team IDs, category/group, kickoff date/time, and venue identity; ambiguous collisions are quarantined.
- A fixture missing from a new snapshot creates `verification_required`; it is not deleted or marked cancelled.
- A venue with zero listed fixtures is `no_listed_fixture`, not `confirmed_free`.
- Every published snapshot has source file reference, SHA-256, source week/title, checkedAt, parserVersion, and validation summary.

## Release gates
- Original and V3 remain available until acceptance.
- P0: ingestion and atomic publication tests pass against saved source fixtures.
- P1: responsive shell and catalogs work from canonical API data.
- P2: change center, poster exports, and notifications pass.
- P3: offline snapshot and recovery pass.
- P4: device, accessibility, security, and end-to-end acceptance passes.
- V4 remains preview-only until all acceptance gates are signed off.
