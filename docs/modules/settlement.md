# Route settlement — `src/settlement/settle.ts`

## Purpose

Aggregate a route's worth of orders into an end-of-day settlement: money totals,
per-category nets, promotion usage, commission, and stop coverage.

## Deliverable

```ts
export function settleRoute(input: SettleRouteInput): RouteSettlement
```

Types (`SettleRouteInput`, `RouteSettlement`) are defined in
[`SPEC.md` §11.1](../../SPEC.md#111-signature--types).

## Cross-module dependency (required by spec)

This module must import and reuse the pricing engine:

```ts
import { priceOrder } from '../pricing/engine'
```

The settlement module is judged through *your* `priceOrder` — a pricing bug will
surface as settlement failures too. Do not duplicate pricing logic here.

## Data dependencies

Read via [`src/data/index.ts`](../../src/data/index.ts):

- `getRoutes()` — the route definition (validation of `routeId` and the canonical
  stop ordering).
- `getProduct(id)` — used when aggregating per-category totals.

## Spec sections that govern behaviour

- Signature and types: [§11.1](../../SPEC.md#111-signature--types)
- Validation and pricing: [§11.2](../../SPEC.md#112-validation--pricing)
- Money totals: [§11.3](../../SPEC.md#113-money-totals-all-rounded-per-6-half-up-2dp)
- Per-category nets: [§11.4](../../SPEC.md#114-per-category-nets)
- Promotion usage counts: [§11.5](../../SPEC.md#115-promotion-usage)
- Commission (marginal tiers): [§11.6](../../SPEC.md#116-commission--marginal-tiers-on-nettotal)
- Stops visited / missed: [§11.7](../../SPEC.md#117-stops)

## Design notes

- Pure function: no I/O, no React.
- Order of operations: validate the route, validate every order's `accountId` against
  the route's stops, price each order via `priceOrder`, then aggregate.
- Rounding is applied per §6 at the aggregation points described in each §11
  subsection; do the arithmetic in accumulators and round at the documented boundary.
