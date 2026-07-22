import { getAccounts, getVisits } from "../data/index"

export interface AccountAudit {
  accountId: string
  weightedScore: number | null
  trend: 'up' | 'down' | 'flat' | null
  daysSinceVisit: number | null
  overdue: boolean
  status: 'healthy' | 'watch' | 'critical' | 'unvisited'
}

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

// round2 same implementation as pricing (duplicate for isolation)
function round2(x: number): number {
  if (!Number.isFinite(x)) return x
  const sign = x < 0 ? -1 : 1
  const abs = Math.abs(x)
  const s = abs.toFixed(12)
  const [intPart, fracPart = ""] = s.split('.')
  const f = (fracPart + "000").slice(0, 3)
  const firstTwo = f.slice(0, 2)
  const third = f[2]
  let cents = Number(intPart) * 100 + Number(firstTwo)
  if (Number(third) >= 5) cents += 1
  const result = (cents / 100) * sign
  return Number(result.toFixed(2))
}

export function auditAccounts(asOf: string): AccountAudit[] {
  if (!isIsoDate(asOf)) throw new Error(`Invalid date: ${asOf}`)

  const accounts = getAccounts()
  const visits = getVisits()

  // Build map of visits per account, filtered date <= asOf
  const visitsByAccount: Record<string, any[]> = {}
  for (const v of visits) {
    if (v.date > asOf) continue
    if (!visitsByAccount[v.accountId]) visitsByAccount[v.accountId] = []
    visitsByAccount[v.accountId].push(v)
  }

  // For each account, compute audit
  const result: AccountAudit[] = accounts.map((acc) => {
    const accVisits = visitsByAccount[acc.id] || []
    // sort by date desc, then id desc
    accVisits.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1
      if (a.id !== b.id) return a.id < b.id ? 1 : -1
      return 0
    })

    const counted = accVisits

    let weightedScore: number | null = null
    if (counted.length === 0) {
      weightedScore = null
    } else {
      const take = counted.slice(0, 3)
      const weights = [3, 2, 1]
      let numerator = 0
      let denom = 0
      for (let i = 0; i < take.length; i++) {
        numerator += weights[i] * take[i].shelfScore
        denom += weights[i]
      }
      weightedScore = round2(numerator / denom)
    }

    let trend: 'up' | 'down' | 'flat' | null = null
    if (counted.length >= 2) {
      const s1 = counted[0].shelfScore
      const s2 = counted[1].shelfScore
      if (s1 > s2) trend = 'up'
      else if (s1 < s2) trend = 'down'
      else trend = 'flat'
    } else {
      trend = null
    }

    let daysSinceVisit: number | null = null
    if (counted.length === 0) daysSinceVisit = null
    else {
      const latestDate = counted[0].date
      const d1 = new Date(latestDate + 'T00:00:00')
      const d2 = new Date(asOf + 'T00:00:00')
      const diffMs = d2.getTime() - d1.getTime()
      daysSinceVisit = Math.floor(diffMs / (24 * 60 * 60 * 1000))
    }

    const overdue = daysSinceVisit === null || daysSinceVisit > 14

    let status: 'healthy' | 'watch' | 'critical' | 'unvisited'
    if (counted.length === 0) status = 'unvisited'
    else if (weightedScore !== null && weightedScore < 2.5) status = 'critical'
    else if (weightedScore !== null && weightedScore < 3.5) status = 'watch'
    else status = 'healthy'

    return {
      accountId: acc.id,
      weightedScore,
      trend,
      daysSinceVisit,
      overdue,
      status,
    }
  })

  // sort by accountId ascending
  result.sort((a, b) => (a.accountId < b.accountId ? -1 : a.accountId > b.accountId ? 1 : 0))
  return result
}
