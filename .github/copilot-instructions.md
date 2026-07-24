# Copilot instructions — Field Operations Suite

You are implementing three business-logic modules for this repo. Everything
you need to write correct code is in **this file** and the three module
briefs under `harness/`. Do not open the full spec unless a brief is silent
on the exact case you're deciding.

## Read only these — in this order — then write code

1. **`harness/run-scope.md`** — which module(s) to build THIS run.
2. **`harness/progress-notes.md`** — what's already done.
3. The brief(s) for the module(s) named in run-scope:
   - Pricing → `harness/brief-pricing.md`
   - Shelf audit → `harness/brief-audit.md`
   - Route settlement → `harness/brief-settlement.md`
4. **`src/data/index.ts`** — the only allowed data-access surface (loader
   signatures + shared types like `Promotion`, `Product`, `Account`,
   `RouteDef`, `Visit`).

Then write the module file(s) and stop. Do not read anything else.

## Files that are WRONG — do not import from them, do not copy their rules

The repo intentionally ships historical / misleading material. Each file
below **directly contradicts the correct behaviour** described by `SPEC.md`
and the briefs. Do not import from them or use them as a reference:

| File | Why it is wrong |
|---|---|
| `src/legacy/pricingV1.ts` | Uses banker's rounding (spec = half-up); treats `validTo` as exclusive (spec = inclusive); stacks every matching line promo cumulatively (spec = one line promo per line); grants at most one BOGO group per line (spec = repeat groups); ignores `eligibleSegments` (spec = enforce). All five rules are inverted. |
| `src/legacy/discountMatrix.ts` | Fabricates a tier/uplift/SKU-override/grandfathered-flat-rate system that does not exist in the spec at all. |
| `docs/NOTES.md` | Informal meeting notes with WRONG "consensus" on rounding, BOGO groups, threshold basis (gross vs net), `validTo` semantics, and segment gating. |

## Reference material — authoritative if a brief is genuinely silent

`SPEC.md` is the canonical behavioural specification and the source of truth
when it conflicts with anything else in the repo. The three briefs in
`harness/` are **derived from `SPEC.md`** (§2–§7 for pricing, §10 for audit,
§11 for settlement) and inline the exact rules that apply to each module.

**Read the matching brief first.** If it does not cover your specific case,
open the relevant `SPEC.md` section directly — do not guess.

`docs/ARCHITECTURE.md` and `docs/CONTRIBUTING.md` are human-facing repo
docs. They are not needed to implement the three modules; skip them by
default.

## Deliverables

Three files, each exporting exactly one function:

- `src/pricing/engine.ts` — `export function priceOrder(input: PriceOrderInput): PricedOrder`
- `src/audit/shelfAudit.ts` — `export function auditAccounts(asOf: string): AccountAudit[]`
- `src/settlement/settle.ts` — `export function settleRoute(input: SettleRouteInput): RouteSettlement`

`settle.ts` **must** import and reuse `priceOrder`:

```ts
import { priceOrder } from '../pricing/engine'
```

Do not duplicate pricing logic in settlement. Settlement is judged through
*your* `priceOrder`, so a pricing bug will fail settlement tests too.

## Global rules that apply to all three modules

- **Money rounding: half-up to 2 decimals, guarded against float artifacts.**
  A naive `Math.round(x*100)/100` gives `2.17` for `2.175` because
  `2.175 === 2.17499999…` in IEEE-754. The spec requires `2.18`. Use:

  ```ts
  function round2(n: number): number {
    // toFixed(10) collapses the artefact (e.g. 2.17499… → "2.1750000000")
    const s = Math.sign(n) || 1
    return s * Math.round(Math.abs(Number(n.toFixed(10))) * 100) / 100
  }
  ```

  Round every money output field: `gross`, `discount`, `net`, `subtotal`,
  `total`, `orderLevel.discount`, all settlement totals, per-category, and
  `commission`.

- **Validity windows: BOTH endpoints inclusive.** A promotion is active when
  `validFrom <= date && date <= validTo`, comparing ISO date strings
  lexicographically. No time-of-day component.

- **Data access only through `src/data/index.ts`** — no `import … from
  '../data/*.json'`, no `fetch`, no reading fixture files directly.

- **Pure functions.** No React, no I/O, no module-level mutable state, no
  logging in the three business modules.

- **`import type` for type-only imports.** `verbatimModuleSyntax` is on, so
  a value-import of a type-only symbol is a compile error.

- **`noUnusedLocals` is on.** Any unused import, parameter, or local is a
  compile error. Remove them.

- **Named exports only.** No `export default`.

## Scope you may write to

Write **only** these three files:

- `src/pricing/engine.ts`
- `src/audit/shelfAudit.ts`
- `src/settlement/settle.ts`

Do **not** touch anything else — no `src/data/`, no `src/pages/`, no
`src/state/`, no `src/App.tsx`, no `src/legacy/`, no `docs/`, no
`SPEC.md`, no `RULES.md`, no `AGENTS.md`, no `harness/`, no `.github/`,
no config files, and **do not add any dependencies**.

## Do not run

Do not write tests. Do not run tests. Do not run the app. Do not "verify"
your work — the harness runs `tsc --noEmit` automatically after you exit.

## When to update progress-notes.md

After you finish writing a module (or all of them), append a one-line entry
to `harness/progress-notes.md`:

```
- <date>: <module> — done. <one-line summary of any decision worth
  remembering next run>.
```

This is the only file outside `src/` you may modify.
