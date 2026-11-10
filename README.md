# Darıca Gücü Maç Merkezi V4 PRO

Single-source match operations application for Darıca Gücü and Kocaeli amateur football.

## Current state
V4 is under isolated development. The original site and V3 production application remain untouched. Until an official ASKF workbook passes source, parser, season, hash, and fixture-count validation, the UI will not invent fixtures.

## Implemented
- Vite + React + TypeScript responsive shell.
- Canonical Turkish club identity and fixture identity.
- Snapshot acceptance guardrails, including duplicate fixture IDs, season rollover, older-week rejection, and abnormal fixture-loss rejection.
- Added/changed/missing fixture classification; missing matches are `verification_required`.
- Real ASKF `.xls` parser test fixture and U11–U19 parsing.
- `.xlsx` parser adapter.
- ASKF file-manager candidate selection by highest week.
- Vercel API routes: `/api/cron-askf`, `/api/source-status`, `/api/live`.
- Private Vercel Blob store and sensitive `CRON_SECRET` environment variable.
- Daily Cron schedule at 13:00 UTC (16:00 Türkiye time).

## Current integration gate
The first successful V4 Cron execution has not yet been proven. The ASKF Playwright download flow must pass against the live official file manager, then a real workbook must be archived and published to the V4 private Blob store. Until that happens, the API correctly reports `awaiting_first_run` / `not_configured`.

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
- V4 is a separate deployment protected by Vercel SSO; no original/V3 domain is replaced.
