# Darıca Gücü Maç Merkezi V4 PRO — P0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish an isolated V4 source project and a tested, fail-closed fixture/snapshot domain core without changing original or V3 production.

**Architecture:** Vite + React + TypeScript frontend with framework-neutral TypeScript domain modules. The first deliverable is canonical fixture identity, snapshot validation, and change classification. No cloud publication until real source and storage credentials are independently verified.

**Tech Stack:** Node.js 24, Vite, React, TypeScript, Vitest, Vercel-compatible API boundary.

**Spec:** `docs/superpowers/specs/2026-11-11-darica-gucu-mac-merkezi-v4-design.md`

## Global Constraints
- Original and V3 production deployments remain untouched.
- Work only in `D:\beyin2\Projeler\DaricaGucuMacMerkeziV4` on branch `develop/v4-pro`.
- No live source publish or Vercel production deployment in this plan.
- Invalid or older snapshots never replace verified state.
- Missing fixtures become `verification_required`, never cancellation.
- No secrets in client code, repository, or logs.
- Test-first for every behavior change.

## Review Focus
1. Same match represented with different team spelling must resolve to the same canonical team IDs.
2. Darıca Gücü and Darıca Kartalgücü must remain distinct teams.
3. Same fixture played at a different venue/time must not be silently conflated.
4. A newer file with abnormal match loss must be rejected while preserving prior state.
5. A removed match must become verification-required, not deleted or cancelled.

---

### Task 1: Project baseline and design assets

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- Create: `src/main.tsx`, `src/App.tsx`, `src/styles.css`
- Create: `DESIGN.md`, `README.md`, `.gitignore`

**Interfaces:** Runnable React/TypeScript application shell and baseline test command.

- [ ] Create Vite React TypeScript project configuration.
- [ ] Add an accessible shell that displays `awaiting_first_run` until a verified snapshot exists.
- [ ] Run typecheck and production build.

### Task 2: Canonical fixture and team identity

**Files:**
- Create: `src/domain/identity.ts`
- Test: `src/domain/identity.test.ts`

**Interfaces:**
- `normalizeTeamName(name: string): string`
- `canonicalTeamId(name: string, aliases?: Record<string, string>): string`
- `fixtureIdentity(fixture: FixtureIdentityInput): string`

- [ ] Add tests for Turkish casing, punctuation, whitespace, aliases, and Darıca Gücü vs Darıca Kartalgücü.
- [ ] Run tests and observe expected RED failures.
- [ ] Implement deterministic normalization and identity.
- [ ] Run targeted and full suite GREEN.

### Task 3: Snapshot validation and atomic-acceptance decision

**Files:**
- Create: `src/domain/snapshot.ts`
- Test: `src/domain/snapshot.test.ts`

**Interfaces:**
- `evaluateSnapshot(previous: VerifiedSnapshot | null, incoming: IncomingSnapshot): SnapshotDecision`
- Validate SHA-256 shape, provenance, source week monotonicity, fixture minimum, and abnormal-loss threshold.
- No storage side effects in this pure domain module.

- [ ] Add tests for first valid snapshot, invalid provenance, malformed hash, older week, unchanged hash, and abnormal fixture loss.
- [ ] Run tests and observe expected RED failures.
- [ ] Implement fail-closed decision logic.
- [ ] Run targeted and full suite GREEN.

### Task 4: Change classification and removal quarantine

**Files:**
- Create: `src/domain/changes.ts`
- Test: `src/domain/changes.test.ts`

**Interfaces:**
- `diffFixtures(previous: Fixture[], incoming: Fixture[]): FixtureChange[]`
- Added, changed, and missing fixtures are distinct event types.
- Missing fixtures always have status `verification_required`.

- [ ] Add tests for added, kickoff change, venue change, unchanged, and removed fixtures.
- [ ] Run tests and observe expected RED failures.
- [ ] Implement deterministic diff.
- [ ] Run targeted and full suite GREEN.

### Task 5: Review and handoff readiness

**Files:**
- Modify: `README.md`, plan ledger.
- Test: full test/typecheck/build.

- [ ] Run complete test suite.
- [ ] Run TypeScript check and production build.
- [ ] Review changed files for accidental source/secret leakage.
- [ ] Keep deployment preview-only; do not connect production domain or replace V3.
- [ ] Record unresolved integration prerequisites.

## Completion criteria
- All domain tests pass.
- TypeScript check and production build pass.
- UI distinguishes unavailable/unverified source data from an empty fixture list.
- Original site and V3 remain unchanged.
- Later ingestion plan can consume the pure domain interfaces without changing semantics.
