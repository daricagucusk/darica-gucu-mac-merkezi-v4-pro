# Darıca Gücü Maç Merkezi V4 PRO

Single-source match operations application for Darıca Gücü and Kocaeli amateur football.

## Current state
V4 foundation is under isolated development. Original and V3 production applications remain untouched. Until a verified ASKF snapshot is accepted, the interface must show `awaiting_first_run` and must not invent fixtures.

## Development
- Node.js 24+
- `npm install`
- `npm run dev`
- `npm test`
- `npm run typecheck`
- `npm run build`

## Architecture
See `docs/superpowers/specs/2026-11-11-darica-gucu-mac-merkezi-v4-design.md` and `DESIGN.md`.

## Safety invariants
- Missing fixtures are quarantined for verification, never silently cancelled.
- Invalid source snapshots cannot replace the last verified snapshot.
- Secrets remain server-side.
- V4 remains preview-only until acceptance.
