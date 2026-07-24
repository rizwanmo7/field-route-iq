# Brief — Route settlement (`src/settlement/settle.ts`)

Self-contained. Do not open `SPEC.md`.

## Signature

```ts
export function settleRoute(input: SettleRouteInput): RouteSettlement
```

## Required import — Part C is scored through your Part A

```ts
import { priceOrder } from '../pricing/engine'
```

Do **not** re-implement pricing logic here. Any error thrown by `priceOrder`
must propagate unchanged.

## Types (define locally in the file)

```ts
export interface CartLine { productId: string; qty: number }

export interface SettleRouteInput {
  routeId: string
  date: string                                             // pricing date, passed to priceOrder
  orders: Array<{ accountId: string; lines: CartLine[] }>
}

export interface RouteSettlement {
  routeId: string
  date: string
  grossTotal: number
  lineDiscountTotal: number
  orderDiscountTotal: number
  discountTotal: number
  netTotal: number
  perCategory: Record<string, number>
  promoUsage: Record<string, number>
  commission: number
  stopsVisited: string[]
  stopsMissed: string[]
}
```

## Data access

From `src/data/index.ts`:

- `getRoutes()` — returns `RouteDef[]`; each route has `id`, `name`, `day`,
  and `stops: Array<{ accountId: string; plannedTime: string }>`. **The
  stop list may contain duplicate `accountId`s** — handle dedup at first
  occurrence (see stops section below).
- `getProduct(id)` — used to look up `category` for `perCategory`.

## Algorithm

### 1. Validate the route

```ts
const route = getRoutes().find(r => r.id === input.routeId)
if (!route) throw new Error(`Unknown route: ${input.routeId}`)
```

### 2. Validate every order's account belongs to a route stop

Let `stopAccountIds = route.stops.map(s => s.accountId)` (may contain
duplicates — that's fine here, `includes` check is enough).

```ts
for (const order of input.orders) {
  if (!stopAccountIds.includes(order.accountId)) {
    throw new Error(`Account not on route: ${order.accountId}`)
  }
}
```

Multiple orders for the same stop are allowed. An empty `input.orders`
array is valid.

### 3. Price each order

```ts
const priced = input.orders.map(o =>
  priceOrder({ lines: o.lines, accountId: o.accountId, date: input.date })
)
```

Errors from `priceOrder` propagate unchanged.

### 4. Money totals (each rounded half-up to 2dp)

```ts
grossTotal         = round2( Σ line.gross    over all priced.lines )
lineDiscountTotal  = round2( Σ line.discount over all priced.lines )
orderDiscountTotal = round2( Σ po.orderLevel.discount over priced )
discountTotal      = round2( lineDiscountTotal + orderDiscountTotal )
netTotal           = round2( Σ po.total over priced )
```

`round2` uses the same half-up-with-toFixed(10) helper as pricing:

```ts
function round2(n: number): number {
  const s = Math.sign(n) || 1
  return s * Math.round(Math.abs(Number(n.toFixed(10))) * 100) / 100
}
```

### 5. Per-category nets

- For every priced line across all orders, look up
  `getProduct(line.productId).category` and add `line.net` to a running
  total for that category.
- After the pass, `round2` each category's total.
- **Order-level discounts are NOT allocated to categories.**
- Categories with no lines are **absent** — do not emit a `0` entry.
- Emit keys in **ascending** order (build the object by iterating sorted
  keys, or sort at the end).

### 6. Promotion usage

Count applications:

- For every priced **line** with a non-null `appliedPromoId`, add 1 to that
  promo id's count.
- For every priced **order** whose `orderLevel.appliedPromoId` is non-null,
  add 1.
- Promotions with zero applications are absent.
- Emit keys in **ascending** order.

### 7. Commission — marginal tiers on `netTotal`

Marginal, like tax brackets. Do the arithmetic unrounded, `round2` only at
the end:

| Tier | Portion of `netTotal` | Rate |
|---|---|---|
| 1 | first `200.00` | 2% |
| 2 | over `200.00` up to `500.00` | 5% |
| 3 | over `500.00` | 8% |

```ts
const t1 = Math.min(netTotal, 200) * 0.02
const t2 = Math.max(0, Math.min(netTotal, 500) - 200) * 0.05
const t3 = Math.max(0, netTotal - 500) * 0.08
const commission = round2(t1 + t2 + t3)
```

Worked example (from spec): `netTotal = 316.86` →
`200*0.02 + 116.86*0.05 = 4.00 + 5.843 = 9.843 → 9.84`.

### 8. Stops visited / missed

Iterate `route.stops` in order once, emitting each `accountId` **the first
time** you see it:

- If any order in `input.orders` has this `accountId` → append to
  `stopsVisited`.
- Otherwise → append to `stopsMissed`.

Subsequent occurrences of the same `accountId` in `route.stops` are
skipped (dedupe by first-position). Together the two arrays cover the
distinct set of stop accountIds, in route order.

### 9. Return

```ts
return {
  routeId: input.routeId,
  date: input.date,
  grossTotal, lineDiscountTotal, orderDiscountTotal, discountTotal, netTotal,
  perCategory, promoUsage, commission,
  stopsVisited, stopsMissed,
}
```

## Common pitfalls

- Do NOT roll your own pricing here — import `priceOrder`. Settlement is
  judged through it.
- Commission is **marginal** (2% on first 200, 5% on next 300, 8% on the
  rest). A single-rate reading (e.g. "5% of netTotal") is wrong.
- Rounding is applied per subsection, at the boundary shown — do the
  intermediate sums unrounded and `round2` at the aggregation point.
- `perCategory` **excludes** order-level discounts.
- Absent ≠ zero: a category or promo id with zero activity is **not
  emitted**, rather than emitted with value `0`.
- `stopsVisited` / `stopsMissed` follow **route stop order**, dedupe at
  the first occurrence, and never contain the same accountId twice.
