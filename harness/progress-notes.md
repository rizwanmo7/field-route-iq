# Progress notes

Append a one-line entry after each completed module. Keep entries terse —
this file is read at the start of every run.

<!-- Example format:
- 2026-07-23: pricing — done. Round2 via toFixed(10) to avoid 2.175 artefact.
- 2026-07-23: audit — done. daysSinceVisit uses UTC-midnight difference.
- 2026-07-23: settlement — done. Reuses priceOrder; commission uses marginal tiers.
-->
- 2026-07-23: pricing — done. Implemented per harness brief; line & order promos, inclusive dates, half-up rounding.
- 2026-07-23: audit — done. Weighted 3/2/1, UTC-midnight daysBetween, statuses per rounded score.
- 2026-07-23: settlement — done. Reuses priceOrder; computes marginal commission and per-category nets.
