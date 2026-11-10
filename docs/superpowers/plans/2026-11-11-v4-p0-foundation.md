# Darıca Gücü Maç Merkezi V4 PRO — P0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish an isolated V4 application and a tested ASKF ingestion/publication core without changing the original or V3 production systems.

**Architecture:** Vite + React + TypeScript frontend, pure TypeScript domain modules, Vercel Node.js API functions, Playwright + Chromium source discovery, Vercel Blob private storage.

**Spec:** `docs/superpowers/specs/2026-11-11-darica-gucu-mac-merkezi-v4-design.md`

## Global constraints
- Original and V3 production deployments remain untouched.
- Work in `D:\beyin2\Projeler\DaricaGucuMacMerkeziV4` on `develop/v4-pro`.
- No original/V3 domain changes.
- Invalid or older snapshots never replace verified state.
- Missing fixtures become `verification_required`, never cancellation.
- No secrets in client code, repository, or logs.
- No paid service upgrade without explicit approval.

## Completed tasks

### Task 1: Project baseline and design assets
- [x] Create isolated Vite + React + TypeScript project.
- [x] Create `DESIGN.md`, design specification, README, and ignore rules.
- [x] Create private GitHub repository and `develop/v4-pro` branch.
- [x] Create separate Vercel project with SSO protection and Node 24.
- [x] Configure Vercel functions and private Blob in Frankfurt.
- [x] Verify typecheck and production build.

### Task 2: Canonical fixture and team identity
- [x] Turkish case/diacritic/punctuation normalization.
- [x] Configurable alias mapping.
- [x] Keep Darıca Gücü and Darıca Kartalgücü distinct.
- [x] Stable fixture identity tests.

### Task 3: Snapshot validation and acceptance
- [x] Validate official source provenance and Excel extension.
- [x] Validate SHA-256, source week, season, checked timestamp, and parser version.
- [x] Reject duplicate fixture IDs.
- [x] Reject older season/week and unchanged hashes.
- [x] Reject abnormal fixture loss while preserving prior state.
- [x] Allow season rollover without comparing old-season fixture counts.

### Task 4: Change classification
- [x] Added, kickoff-changed, venue-changed, and team-changed events.
- [x] Match repeated same-pair fixtures by nearest kickoff.
- [x] Quarantine ambiguous repeated-pair matching rather than guessing.
- [x] Missing fixtures enter `verification_required`.
- [x] No implicit cancellation or deletion.

### Task 5: ASKF workbook parser
- [x] Real `010.HAFTA PROGRAM.xls` fixture added to tests.
- [x] Latest official `011.HAFTA PROGRAM.xls` downloaded from the live ASKF file manager and added as a fixture.
- [x] Legacy XLS signature and file-size validation.
- [x] XLS and XLSX parser adapters.
- [x] U11–U19 category extraction.
- [x] Darıca Gücü identity matching without Kartalgücü collision.
- [x] Unique fixture identity includes season, category, teams, date, time, and venue.
- [x] Parse real official workbooks and verify unique fixture identities.

### Task 6: ASKF file-manager selection
- [x] Select highest numbered weekly workbook.
- [x] Ignore unrelated file types.
- [x] Prefer XLSX if the same week is duplicated in both supported formats.
- [x] Handle file-manager labels that append size metadata.
- [x] Verify live file-manager selectors with Edge + Playwright.
- [x] Successfully download latest official workbook (week 11, 243,200 bytes).

### Task 7: Vercel ingestion and storage integration
- [x] Add Playwright/Chromium official file-manager downloader.
- [x] Add private Blob source and snapshot archive.
- [x] Add final live-pointer write as the publication commit point.
- [x] Add `/api/cron-askf`, `/api/source-status`, and `/api/live`.
- [x] Add sensitive `CRON_SECRET` and private Blob token environment.
- [x] Configure daily Cron; a one-time 18:00 Türkiye-time run is scheduled for integration verification.
- [ ] Prove the first successful V4 Cron run against the live ASKF file manager.
- [ ] Verify raw workbook and versioned JSON snapshot exist in V4 Blob.
- [ ] Verify `/api/live` returns real, verified fixtures.
- [ ] Restore Cron to 16:00 Türkiye time after successful verification.

### Task 8: Final P0 review
- [x] 34 automated tests.
- [x] TypeScript check.
- [x] Vite production build.
- [x] `npm audit` reports zero vulnerabilities.
- [ ] Verify Cron authorization and unauthorized request rejection.
- [ ] Verify failed download and invalid workbook preserve the previous live snapshot.
- [ ] Verify Vercel function logs contain no secrets.
- [ ] Complete the P0 integration acceptance report.

## Current test baseline
- 34 automated tests.
- TypeScript check passes.
- Vite production build passes.
- `npm audit` reports zero vulnerabilities.

## Not yet complete
This P0 stage is not accepted until the first live ASKF Cron succeeds, the private Blob contains the real workbook and snapshot, and the live API returns the verified schedule. V4 remains separate and SSO-protected; do not replace the original or V3 domain.
