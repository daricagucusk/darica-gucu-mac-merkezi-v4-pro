# SDD ledger — plan: docs/superpowers/plans/2026-11-15-askf-program-approval.md

## Setup
- Base branch: develop/v4-pro
- Work branch: feat/askf-program-approval-center
- Workspace ruling: the user's PC is not currently connected to the remote desktop session, so a local Git worktree and local shell cannot be used. The isolated GitHub feature branch and Vercel Preview build are used as the safe equivalent. Cost if wrong: local-device-specific acceptance cannot be performed until the PC is connected.
- Reviewer ruling: no independent subagent/reviewer tool is exposed in this session; final review will be a separate author self-review. Cost if wrong: same-author review is weaker than fresh-context review.
- Pre-flight shared interface: Task 1 produces PendingAskfReview + settings contract; Task 2 consumes it in the monitor and status API; Task 3 consumes the same pending pointer for approval/rejection and previous-live pointer for rollback; Task 4 consumes source-status pendingReview/settings/rollbackAvailable fields.
- Ruling: use existing Vercel Blob storage instead of introducing a new database/service. The project already stores live snapshots and source artifacts there. Cost if wrong: blob pointer updates do not provide a multi-object transaction; approval endpoints must be idempotent and fail closed.
- Ruling: preserve the existing 15:00 UTC cron and implement weekly Tuesday behavior in application settings; daily mode uses the same daily trigger. Cost if wrong: a cron schedule change would require deployment configuration edits; this keeps a single dependable trigger and supports both modes.
- Ruling: Vercel project SSO protection is already enabled for all deployments; mutation APIs additionally enforce same-origin requests. Cost if wrong: if deployment protection is later disabled or broadened, the app needs a dedicated user session/identity layer before public exposure.
- Ruling: overlap prevention uses a short-lived status-state guard and manual cooldown rather than a distributed lock service. Cost if wrong: a very narrow simultaneous-start race remains possible; a future shared atomic lock/KV store is required if concurrent trigger volume increases.

## Task 1: complete (commits c1ce9db..b74e021, tests: pending final green build)
- Added staging contract and tests. Initial red build correctly failed because stage-askf.ts was absent.
- Added staging implementation that writes source archive, immutable snapshot, then pending pointer; no live writer exists in the staging storage interface.
- Added timezone-aware daily/Tuesday schedule and tests.
- Added pending/settings/audit/previous-live Blob paths.

## Task 2: in progress
- Added shared runAskfCheck service.
- Changed Cron from direct live publication to staging-only.
- Added manual same-origin check endpoint, 5-minute manual throttle, daily/weekly settings endpoint, and status endpoint.
- Remaining: final typecheck/build; verify API behavior on Preview; add additional monitoring tests if build review identifies gaps.

## Task 3: in progress
- Added same-origin request validation and bounded JSON body parsing.
- Added explicit approve/reject/rollback API with pending hash check, audit entries, previous-live preservation, and idempotent already-applied handling.
- Remaining: final typecheck/build and Preview verification of approval/rejection/rollback paths.

## Task 4: in progress
- Added responsive ASKF review panel, daily/weekly selector, manual check, pending diff, approve/reject controls, rollback action, and safety notes.
- Connected panel to existing ASKF navigation.
- Remaining: final typecheck/build and visual Preview inspection.

## Verification evidence
- Red phase: Vercel Preview dpl_2X7Z7VqyeMBF9tzdwtFTwHNWtJS5 showed stage-askf.test failing with Cannot find module './stage-askf'; other 39 tests passed.
- Subsequent test run: Vercel Preview dpl_5zLibjS4dLy6SsXdTKWUZfR84RBB ran 9 test files, 46 tests passed. TypeScript then failed on incorrect PublishedSnapshot/PreviousPublishedSnapshot field mapping; this was fixed in commit b897eb8 and follow-up commits.
- Latest preview build: dpl_CReoMgv3VvqU8sKH45d6bJm9y2fh, branch commit 7d9f73e; queued at last inspection. Await final build events before declaring success.

## Final review
- Pending final green build, runtime endpoint checks, and a fresh review pass over the complete branch.
