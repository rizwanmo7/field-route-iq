# Pricing engine — `src/pricing/engine.ts`

## Purpose

Compute the full pricing breakdown for a single order: per-line gross, applied
promotion, discount, and net, plus the order-level threshold discount and totals.

## Deliverable

```ts
export function priceOrder(input: PriceOrderInput): PricedOrder
```

Types (`PriceOrderInput`, `PricedLine`, `PricedOrder`) are defined in
[`SPEC.md` §2](../../SPEC.md#2-types).

## Data dependencies

Read via [`src/data/index.ts`](../../src/data/index.ts):

- `getProduct(id)` — catalog lookup for `unitPrice` and `category`.
- `getAccount(id)` — the account's `segment` (used for promotion eligibility).
- `getPromotions()` — the full promotion set; filter by validity, eligibility, and
  applicability inside the engine.

Do not import JSON files directly and do not `fetch`.

## Spec sections that govern behaviour

- Promotion definitions: [§3](../../SPEC.md#3-promotion-types)
- Validity and eligibility: [§4](../../SPEC.md#4-validity--eligibility-all-promotion-types)
- Stacking and selection: [§5](../../SPEC.md#5-stacking--selection-rules)
- Rounding and money: [§6](../../SPEC.md#6-rounding--money)
- Edge cases and error paths: [§7](../../SPEC.md#7-edge-cases-the-engine-must-handle)

## Design notes

- Pure function: no I/O, no React, no module-level mutable state.
- Called frequently: potentially many times per second by the UI ([§8](../../SPEC.md)) and
  once per order by the settlement module. Keep allocations reasonable.
- Prefer small local helpers for repeated concerns (validity check, per-promo-type
  discount calculation, rounding). Keep them file-local; do not export.
- The spec's rounding rule ([§6](../../SPEC.md#6-rounding--money)) has a worked
  example; consult it directly rather than assuming any particular JS idiom is correct.
