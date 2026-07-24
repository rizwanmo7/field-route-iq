# Brief — Shelf audit (`src/audit/shelfAudit.ts`)

Self-contained. Do not open `SPEC.md`.

## Signature

```ts
export function auditAccounts(asOf: string): AccountAudit[]
```

## Types (define locally in the file)

```ts
export interface AccountAudit {
  accountId: string
  weightedScore: number | null                            // §Weighted score
  trend: 'up' | 'down' | 'flat' | null                    // §Trend
  daysSinceVisit: number | null                           // §Recency
  overdue: boolean
  status: 'healthy' | 'watch' | 'critical' | 'unvisited'  // §Status
}
```

## Data access

From `src/data/index.ts`:

- `getAccounts()` — returns `Account[]`, each with an `id`. **Every account
  in this list must appear in the output**, even accounts with no visits.
- `getVisits()` — returns `Visit[]`, each with `{ id, accountId, date, notes, shelfScore }`.
  `shelfScore` is a number in 1..5.

## Algorithm

### 1. Validate `asOf`

Must match `/^\d{4}-\d{2}-\d{2}$/`. If not, throw:

```ts
throw new Error(`Invalid date: ${asOf}`)
```

### 2. For each account (returned by `getAccounts()`), compute the audit

**Counted visits** for that account: every visit with
`v.accountId === account.id` **AND** `v.date <= asOf` (string-compare ISO).

**Sort counted visits most recent first**:
1. Primary: `date` descending.
2. Tie-break: `id` descending.

Call the sorted list `counted`. Below, `counted[0]` is the "latest" visit.

#### Weighted score

- If `counted.length === 0`: `weightedScore = null`.
- Otherwise take the first `N = min(counted.length, 3)` visits.
  Weights are `[3, 2, 1]` (index 0 gets 3, index 1 gets 2, index 2 gets 1).
  - `numerator = Σ weight_i * counted[i].shelfScore`
  - `divisor   = Σ weight_i` — **3** when N=1, **5** when N=2, **6** when N=3.
  - `weightedScore = round2(numerator / divisor)`.

Use the same `round2` helper as pricing (half-up with `toFixed(10)` guard):

```ts
function round2(n: number): number {
  const s = Math.sign(n) || 1
  return s * Math.round(Math.abs(Number(n.toFixed(10))) * 100) / 100
}
```

#### Trend

- If `counted.length < 2`: `trend = null`.
- Otherwise let `s1 = counted[0].shelfScore`, `s2 = counted[1].shelfScore`:
  - `s1 > s2` → `'up'`
  - `s1 < s2` → `'down'`
  - `s1 === s2` → `'flat'`

#### Recency

- If `counted.length === 0`: `daysSinceVisit = null`.
- Otherwise compute **whole calendar days** from `counted[0].date` to `asOf`.
  Use UTC midnights to avoid DST:

  ```ts
  function daysBetween(fromIso: string, toIso: string): number {
    const [fy, fm, fd] = fromIso.split('-').map(Number)
    const [ty, tm, td] = toIso.split('-').map(Number)
    const fromMs = Date.UTC(fy, fm - 1, fd)
    const toMs   = Date.UTC(ty, tm - 1, td)
    return Math.round((toMs - fromMs) / 86_400_000)
  }
  ```

  Same day → 0. Because we filtered visits with `date <= asOf`, this is
  always ≥ 0.

- `overdue = (daysSinceVisit === null) || (daysSinceVisit > 14)`.
  Exactly 14 → **not** overdue.

#### Status

Decisions are made on the **rounded `weightedScore`** (the same value being
returned).

- `counted.length === 0` → `'unvisited'`.
- Else `weightedScore < 2.5` → `'critical'`.
- Else `weightedScore < 3.5` → `'watch'`.
- Else → `'healthy'`.

Boundary rows: `weightedScore === 2.5` → `'watch'`; `weightedScore === 3.5`
→ `'healthy'`.

### 3. Sort the output by `accountId` ascending (string compare) and return.

## Common pitfalls

- Include **every** account from `getAccounts()`, even ones with zero
  counted visits (they get `null`/`null`/`null`/`overdue: true`/`'unvisited'`).
- Weighted-score divisor is the SUM of the weights actually used
  (3, 5, or 6) — NOT 6 with padding for missing visits.
- Days-since-visit uses calendar days (UTC midnights). Do NOT use
  `Date.now()` or the local `Date` constructor without `Date.UTC` — DST
  shifts near spring/fall will silently off-by-one.
- `overdue` is `> 14`, not `>= 14`.
- Status boundaries use the rounded score, not the raw weighted average.
