---
target: the changelog
total_score: 26
p0_count: 0
p1_count: 1
timestamp: 2026-06-23T18-08-11Z
slug: src-pages-changelog-astro
---
# Critique: Changelog (src/pages/changelog.astro + ChangelogEntry.astro)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Static page; recency conveyed by dates. |
| 2 | Match System / Real World | 3 | Standard changelog, but every entry calls itself "the latest update." |
| 3 | User Control and Freedom | 3 | Nav back available. |
| 4 | Consistency and Standards | 2 | Broken timeline spine + asterisk bullets contradict linework system; badge vocabulary unused. |
| 5 | Error Prevention | n/a | No input surface. |
| 6 | Recognition Rather Than Recall | 2 | Changes aren't typed (New/Improved/Fixed). |
| 7 | Flexibility and Efficiency | 2 | No per-entry anchors, no filtering, no follow/RSS. |
| 8 | Aesthetic and Minimalist Design | 2 | Redundant header stack; dead pb-10 void; broken spine. |
| 9 | Error Recovery | n/a | No error states. |
| 10 | Help and Documentation | 3 | The page is documentation; reads clearly. |
| Total | | 26/40 | Acceptable — real structural defects, fixable in one pass |

## Anti-Patterns Verdict

LLM: Partly AI-feeling — uppercase "WEBSITE UPDATES" eyebrow above an H1 saying the same thing; templated copy ("The latest website update introduces…" x4); literal `*` asterisk as list bullet.

Deterministic scan: detect.mjs over both files returned [] (exit 0). Palette and dashed-border vocabulary match the system. Detector can't see CSS-grid structural bugs, which is where the real problems are.

Visual overlays: No browser automation available; findings are from source analysis.

## Overall Impression

On-brand and quiet, but the central motif — the vertical timeline — is structurally broken: the dashed spine is a fixed min-h-20 (80px) stub while cards run 200–280px tall, so the line never reaches the next node. The defining element doesn't actually draw a connected line. Fixing the spine snaps the page into its "technical ledger" intent.

## What's Working

- Palette and material discipline: dashed neutral borders, transparent surfaces, no shadows. Faithful to DESIGN.md.
- Semantics: <ol aria-label>, <time datetime>, aria-hidden on decorative marks, correct h1→h2 order.
- Body contrast is right: summaries/points use neutral-700, not washed-out gray.

## Priority Issues

[P1] Timeline spine doesn't connect entries. ChangelogEntry.astro:18-20 connector is fixed min-h-20 in a grid column whose auto rows don't stretch; card column is taller, so a gap appears before the next node. Last entry leaves a dangling stub. Fix: continuous spine via grid-rows-[auto_1fr] line that stretch-fills, or one ::before line behind the <ol> with dots over it; suppress connector on :last-child. → /impeccable layout

[P2] Dead pb-10 void in every card (ChangelogEntry.astro:23). Likely a workaround for the broken spine; pure dead space with gap-4 already between entries. Fix: drop to p-4 once spine is fixed. → /impeccable layout

[P2] Redundant header stack (changelog.astro:72-87): uppercase eyebrow + H1 + intro paragraph all say "changelog." Fix: H1 + one sentence, cut the eyebrow. → /impeccable distill

[P2] Changes aren't typed; defined badge vocabulary unused. Add per-entry badge (New/Improved) using the existing chip component. → /impeccable colorize

[P2] Templated, factually-off copy: three of four summaries open "The latest website update…" though only one is latest. Rewrite to describe each change directly. → /impeccable clarify

## Persona Red Flags

Jordan (first-timer client): three stacked headers before content; can't tell feature vs fix (no type label); broken spine looks glitchy, denting trust.

Riley (stress tester): long-title or points-less future entries widen the spine gap; final entry has a stub pointing at nothing.

Casey (mobile): layout holds, but no per-entry anchor links and no follow/subscribe despite meta promising "follow the latest."

## Minor Observations

- Asterisk bullets (ChangelogEntry.astro:40) read as footnote markers; use a real marker.
- Asymmetric pl-3 on <main> (changelog.astro:70) shifts the centered column right; the H1's own border-l pl-3 is the alignment wanted.
- Date is de-emphasized vs H2; neutral-500 on neutral-50 ~4.5:1, right at AA floor (WCAG 3 Gold aspiration).

## Questions to Consider

- Should the date be the primary index and the title secondary?
- Is a typed badge system worth it at four entries, or only as the list grows?
- Should each entry be an anchor target for linking in client emails?
