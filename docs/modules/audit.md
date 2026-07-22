# Shelf audit — `src/audit/shelfAudit.ts`

## Purpose

Produce a per-account health readout from the visit log: one `AccountAudit` entry per
account in the roster, sorted ascending by `accountId`.

## Deliverable

```ts
export function auditAccounts(asOf: string): AccountAudit[]
```

The `AccountAudit` type is defined in
[`SPEC.md` §10.1](../../SPEC.md#101-signature--types).

## Data dependencies

Read via [`src/data/index.ts`](../../src/data/index.ts):

- `getAccounts()` — the account roster. The output must include every account.
- `getVisits()` — the visit log.

## Spec sections that govern behaviour

- Signature, `asOf` validation, and sort order:
  [§10.1](../../SPEC.md#101-signature--types)
- Counted visits and ordering: [§10.2](../../SPEC.md#102-counted-visits)
- Weighted score: [§10.3](../../SPEC.md#103-weighted-score)
- Trend: [§10.4](../../SPEC.md#104-trend)
- Recency and `overdue`: [§10.5](../../SPEC.md#105-recency)
- Status classification: [§10.6](../../SPEC.md#106-status)
- Rounding of `weightedScore` follows [§6](../../SPEC.md#6-rounding--money).

## Design notes

- Pure function: no I/O, no React.
- Independent of the pricing and settlement modules.
- Every account must appear in the output — including accounts with no counted visits
  (their audit fields take the "no data" values described in §10.6 / §10.5 / §10.3).
