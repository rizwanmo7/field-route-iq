# Brief — Pricing engine (`src/pricing/engine.ts`)

Self-contained. Do not open `SPEC.md` unless something below is genuinely
ambiguous for the case you're deciding.

## Signature

```ts
export function priceOrder(input: PriceOrderInput): PricedOrder
```

## Types (define locally in the file; do not import from anywhere else)

```ts
export interface CartLine { productId: string; qty: number }        // qty is integer >= 1

export interface PriceOrderInput {
  lines: CartLine[]
  accountId: string
  date: string                 // ISO "YYYY-MM-DD", the pricing date
}

export interface PricedLine {
  productId: string
  qty: number
  unitPrice: number            // from the catalog, unrounded
  gross: number                // round2(unitPrice * qty)
  appliedPromoId: string | null
  discount: number             // >= 0, round2
  net: number                  // round2(gross - discount), clamped to 0
}

export interface PricedOrder {
  lines: PricedLine[]
  orderLevel: { appliedPromoId: string | null; discount: number }
  subtotal: number             // round2(sum of line nets)
  total: number                // round2(subtotal - orderLevel.discount), clamped to 0
}
```

## Data access

From `src/data/index.ts`:

- `getProduct(id)` — returns `{ id, name, category, unitPrice } | undefined`.
- `getAccount(id)` — returns `{ id, name, segment, region, address } | undefined`.
- `getPromotions()` — returns `Promotion[]`. Each promotion has `id`, `name`,
  `validFrom` (ISO date), `validTo` (ISO date), optional `eligibleSegments: string[]`,
  plus type-specific fields below.

## Promotion shapes

```ts
// percent_off — LINE-LEVEL
{ type: 'percent_off', percent: number, scope: { category?: string; productIds?: string[] } }

// bogo — LINE-LEVEL
{ type: 'bogo', productId: string, buyQty: number, getQty: number }

// threshold — ORDER-LEVEL
{ type: 'threshold', category: string, minSubtotal: number, amountOff: number }
```

## Validity and eligibility (all promotion types)

- **Active** when `validFrom <= date && date <= validTo` — **both endpoints
  inclusive**, string-compare ISO dates.
- **Eligible** when `eligibleSegments` is absent OR includes the ordering
  account's `segment`.
- Filter to active AND eligible up-front. Ignore the rest entirely.

## Algorithm — the ONLY correct sequence

### 1. Validate the account

```ts
const account = getAccount(input.accountId)
if (!account) throw new Error(`Unknown account: ${input.accountId}`)
```

### 2. Handle empty cart

If `input.lines.length === 0`, return:

```ts
{ lines: [], orderLevel: { appliedPromoId: null, discount: 0 }, subtotal: 0, total: 0 }
```

### 3. Build the active+eligible promotion list once

Filter `getPromotions()` by the two rules above using `account.segment` and
`input.date`.

### 4. Price each line independently

For each `CartLine`:

1. `const product = getProduct(line.productId)`; throw `Error("Unknown product: <productId>")` if undefined.
2. Validate qty: `Number.isInteger(line.qty) && line.qty > 0`; else throw
   `Error("Invalid qty for <productId>")`.
3. `gross = round2(product.unitPrice * line.qty)`.
4. Enumerate LINE-LEVEL candidates from the active+eligible promo list:
   - **percent_off** matches when `scope.category === product.category`
     OR when `scope.productIds` contains `line.productId`.
     Discount = `round2(product.unitPrice * line.qty * promo.percent / 100)`.
   - **bogo** matches when `promo.productId === line.productId`.
     Let `group = promo.buyQty + promo.getQty`.
     `freeUnits = Math.floor(line.qty / group) * promo.getQty` — **the deal
     REPEATS**. E.g. buy2get1 with qty 7 → floor(7/3)=2 groups → 2 free.
     Discount = `round2(freeUnits * product.unitPrice)`.
   - `threshold` is never a line-level candidate — skip.
5. Drop any candidate whose computed discount is **0** (partial-group BOGO,
   zero-percent, etc.). A zero-discount promo is treated as not applicable.
6. Pick the winning candidate:
   - **Largest discount** wins ("best for customer").
   - Tie → **earliest `validFrom`** wins.
   - Still tied → **`id` sorts first lexicographically** wins.
   - No candidates → `appliedPromoId = null`, `discount = 0`.
7. `net = round2(gross - discount)`; if negative, clamp to 0.

### 5. Order-level threshold discount (after all lines are priced)

1. From the active+eligible list, take promos with `type === 'threshold'`.
2. For each, compute `categoryNet = round2(sum of line.net where getProduct(line.productId).category === promo.category)`. Qualify if `categoryNet >= promo.minSubtotal` (inclusive).
3. Pick the winner among qualifying promos:
   - **Largest `amountOff`** wins.
   - Tie → earliest `validFrom`.
   - Still tied → `id` sorts first lexicographically.
4. If a winner exists: `orderLevel = { appliedPromoId: winner.id, discount: round2(winner.amountOff) }`.
5. Otherwise: `orderLevel = { appliedPromoId: null, discount: 0 }`.

Line-level and order-level promotions DO stack — a line promo plus an order
promo on the same order is normal and correct.

### 6. Subtotal and total

- `subtotal = round2(sum of line.net for every priced line)`.
- `total = round2(subtotal - orderLevel.discount)`; if negative, clamp to 0.

## Round2 helper

Every money field goes through this — do NOT use `Math.round(x*100)/100`
without the `toFixed` guard:

```ts
function round2(n: number): number {
  const s = Math.sign(n) || 1
  return s * Math.round(Math.abs(Number(n.toFixed(10))) * 100) / 100
}
```

Rationale: `2.175` is stored as `2.17499999…`; naive rounding gives `2.17`
but the spec requires `2.18`. `toFixed(10)` collapses the artefact to
`"2.1750000000"` before the rounding.

## Exact error strings (interpolate the actual id — do not print `<...>`)

- `Error("Unknown product: <productId>")`
- `Error("Unknown account: <accountId>")`
- `Error("Invalid qty for <productId>")`

## Rules that are commonly gotten WRONG in this repo — do the opposite

- `validTo` is **inclusive**, NOT exclusive. `date <= validTo`, not `date < validTo`.
- Rounding is **half-up**, NOT banker's / half-to-even. `1.005 → 1.01`.
- **One** line-level promo per line (best-for-customer), NOT cumulative stacking of every matching promo.
- BOGO groups **repeat** — `floor(qty / (buyQty+getQty)) * getQty` free units, NOT capped at one group.
- `eligibleSegments` is **enforced** when present, NOT ignored.
- Threshold qualifies on the sum of **line NETs** (post line-discount), NOT on gross.

If you are about to write logic that matches any of the "NOT" clauses above,
you are copying legacy code. Rewrite it to match the "IS" clause.
