# Darıca Gücü Maç Merkezi V4 PRO

Single-source match operations application for Darıca Gücü and Kocaeli amateur football.

## Current state
V4 is under isolated development. The original site and V3 production application remain untouched. Until an official ASKF workbook passes source, parser, season, hash, and fixture-count validation, the UI will not invent fixtures.

## Implemented
- Vite + React + TypeScript responsive shell with live API-backed source and fixture status.
- Canonical Turkish club identity and fixture identity.
- Snapshot acceptance guardrails: official provenance, SHA-256, duplicate fixture rejection, season rollover, older-week rejection, and abnormal fixture-loss rejection.
- Added/changed/missing fixture classification; repeated same-pair matches are matched by nearest kickoff with ambiguity protection.
- Missing matches are `verification_required`, never silently cancelled.
- Real ASKF `.xls` parser test fixtures for weeks 10 and 11, including the latest file downloaded from the official ASKF file manager.
- U11–U19 parsing and Darıca Gücü / Darıca Kartalgücü disambiguation.
- `.xlsx` parser adapter.
- ASKF file-manager candidate selection by highest week and real browser download test.
- Vercel API routes: `/api/cron-askf`, `/api/source-status`, `/api/live`.
- Private Vercel Blob store in Frankfurt and sensitive `CRON_SECRET` environment variable.
- Vercel Cron configured for a one-time integration run at 18:00 Türkiye time; after verification it will be restored to 16:00 Türkiye time.

## Current integration gate
The first successful V4 Cron execution has not yet been proven. The live official file manager was successfully opened in Edge and its latest `011.HAFTA PROGRAM.xls` file was downloaded (243,200 bytes). That exact workbook is now a parser fixture and passes the V4 parser tests. The Vercel-hosted Playwright + Chromium run must still complete, archive the source workbook and versioned JSON snapshot in the V4 private Blob store, and publish a verified live snapshot.

## Development
- Node.js 24+
- `npm install`
- `npm run dev`
- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm audit`

## Storage and cost guardrails
V4 uses a separate private Blob store in the Frankfurt region. The Vercel Hobby documentation lists 1 GB/month storage, 10 GB/month Blob data transfer, 10,000 simple operations, and 2,000 advanced operations as included usage. The current daily ingestion pattern is intentionally low-volume. If limits are exceeded, Hobby access is paused rather than silently upgraded to a paid plan. No paid upgrade is authorized.

## Architecture and decisions
See `DESIGN.md` and `docs/superpowers/specs/2026-11-11-darica-gucu-mac-merkezi-v4-design.md`.

## Safety invariants
- Missing fixtures are quarantined for verification, never silently cancelled.
- Invalid source snapshots cannot replace the last verified snapshot.
- Raw workbook and versioned snapshot are archived before the live pointer changes.
- Secrets remain server-side.
- V4 is a separate SSO-protected deployment; no original/V3 domain is replaced.
