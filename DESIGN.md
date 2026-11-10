# Design System: Darıca Gücü Maç Merkezi V4 PRO

## 1. Visual Theme & Atmosphere
A premium football operations cockpit: precise, calm, authoritative, and built for rapid match-day decisions. Density 7/10, variance 5/10, motion 3/10. The interface favors information hierarchy over decoration. It should feel like a professional competition control room, not a generic SaaS dashboard.

## 2. Color Palette & Roles
Use one coherent cool-neutral graphite palette throughout.
- **Deep Pitch** (#101820) — application canvas; never pure black.
- **Graphite Panel** (#18232D) — primary elevated surface.
- **Slate Surface** (#202E39) — secondary surface and selected rows.
- **Steel Border** (#354550) — separators and control outlines.
- **Ice Text** (#F1F5F7) — primary text.
- **Muted Steel** (#A4B2BC) — secondary labels and metadata.
- **Darıca Green** (#6CBF9B) — the single accent for primary actions, selected state, and focus.
- **Amber Signal** (#E4B765) — semantic warning only.
- **Red Signal** (#D97878) — destructive/error state only.
Semantic status colors are not decorative accents and must always be paired with explicit text labels.

## 3. Typography Rules
- **Display / UI:** Satoshi, with a local/system sans-serif fallback.
- **Body:** Satoshi, relaxed line-height, max reading width 68ch.
- **Mono:** JetBrains Mono for timestamps, hashes, IDs, and technical metadata.
- Use tabular numerals for dates, times, scores, and countdowns.
- Avoid oversized headlines; hierarchy comes from weight, spacing, and contrast.
- Inter and generic serif fonts are not used.

## 4. Component Stylings
- **Buttons:** Minimum 44×44 px. Primary uses Darıca Green with dark text. Secondary uses transparent graphite with a steel border. Active state translates 1px; focus is a 2px accent ring.
- **Match rows:** Dense but legible; home/away teams, category, date/time, venue, and verification state occupy predictable zones. Never hide the data provenance.
- **Cards:** Use only when grouping a real operational unit. Dense schedules use divider-separated rows rather than equal card grids.
- **Inputs:** Label above field, helper text below, inline validation. Filters remain visible while scrolling on desktop.
- **Status labels:** Text plus color and optional icon. Never color alone.
- **Loading:** Skeletons matching final layout dimensions; no blocking spinner for the entire application.
- **Empty states:** Explain whether no result means no match, no filter result, or source not checked. Never infer an empty venue from an empty schedule.
- **Error states:** Preserve last verified data and show the failed refresh time and reason.

## 5. Layout Principles
- Desktop: 260px navigation rail, flexible central match workspace, 320px source/notification rail when width permits.
- Wide foldable: two-column schedule with a contextual detail pane.
- Compact/mobile: single column, bottom navigation, prominent next Darıca Gücü match, quick filters.
- Use CSS Grid for major layouts; avoid percentage-based flex hacks.
- Content max width 1600px. No horizontal overflow.
- Match details must remain readable at 360px viewport width.
- Keep the source freshness and verification state visible on the main screen.

## 6. Motion & Interaction
- Motion intensity is restrained. Use 140–220ms transitions for state changes.
- Animate transform and opacity only.
- Respect prefers-reduced-motion.
- No perpetual decorative animation; live countdowns update without layout shifts.
- Preserve scroll and selection state when filters or team selections change.

## 7. Responsive Behavior
- Below 768px: single-column layout, compact top bar, bottom navigation, touch targets at least 44×44px.
- 768–1199px: foldable/tablet two-pane layout where width allows; collapse to one column otherwise.
- 1200px and above: navigation + schedule + contextual side panel.
- Support Samsung Galaxy Z Fold 7 closed and open viewport sizes without relying on device detection.
- Use viewport width and CSS container queries, not user-agent sniffing.

## 8. Data Trust & Operational States
- Distinguish `verified`, `stale`, `awaiting_first_run`, `refresh_failed`, and `not_configured`.
- Every published schedule includes source file, source week, SHA-256, checked timestamp, parser version, and validation summary.
- Removed fixtures enter `verification_required`; never silently delete or mark cancelled.
- Invalid incoming data never replaces the last verified snapshot.
- Offline UI must explicitly label the snapshot timestamp and freshness.

## 9. Anti-Patterns (Banned)
- No emoji as navigation or status iconography.
- No Inter, generic serif, or pure black.
- No neon gradients, purple glow, glassmorphism overload, or decorative shadows.
- No equal three-column card grids.
- No invented live fixtures, fake counts, or fabricated source timestamps.
- No silent fixture deletion or inferred cancellations.
- No horizontal scrolling on mobile.
- No hidden source provenance.
- No generic SaaS filler copy or fake percentage metrics.
