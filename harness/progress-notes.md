# Progress notes

Append a one-line entry after each completed module. Keep entries terse —
this file is read at the start of every run.

<!-- Example format:
- 2026-07-23: pricing — done. Round2 via toFixed(10) to avoid 2.175 artefact.
- 2026-07-23: audit — done. daysSinceVisit uses UTC-midnight difference.
- 2026-07-23: settlement — done. Reuses priceOrder; commission uses marginal tiers.
-->
- 2026-07-24: pricing — done. Best single line promo per line with inclusive validity and segment gating.
- 2026-07-24: audit — done. Weighted recent scores, UTC-day recency, and status thresholds from rounded score.
- 2026-07-24: settlement — done. Reuses priceOrder, computes sorted per-category/promo aggregates, and marginal commission.
