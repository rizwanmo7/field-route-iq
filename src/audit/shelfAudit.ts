import { getAccounts, getVisits } from '../data'

export interface AccountAudit {
  accountId: string
  weightedScore: number | null
  trend: 'up' | 'down' | 'flat' | null
  daysSinceVisit: number | null
  overdue: boolean
  status: 'healthy' | 'watch' | 'critical' | 'unvisited'
}

function round2(n: number): number {
  const s = Math.sign(n) || 1
  return s * Math.round(Math.abs(Number(n.toFixed(10))) * 100) / 100
}

function daysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number)
  const [ty, tm, td] = toIso.split('-').map(Number)
  const fromMs = Date.UTC(fy, fm - 1, fd)
  const toMs = Date.UTC(ty, tm - 1, td)
  return Math.round((toMs - fromMs) / 86_400_000)
}

export function auditAccounts(asOf: string): AccountAudit[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error(`Invalid date: ${asOf}`)

  const accounts = getAccounts()
  const visits = getVisits()

  const out: AccountAudit[] = accounts.map((acct) => {
    const counted = visits
      .filter((v) => v.accountId === acct.id && v.date <= asOf)
      .sort((a, b) => {
        if (a.date === b.date) return a.id < b.id ? 1 : a.id > b.id ? -1 : 0 // id desc
        return a.date < b.date ? 1 : -1 // date desc
      })

    // weighted score
    let weightedScore: number | null = null
    if (counted.length === 0) {
      weightedScore = null
    } else {
      const N = Math.min(counted.length, 3)
      const weights = [3, 2, 1]
      let numerator = 0
      let divisor = 0
      for (let i = 0; i < N; i++) {
        numerator += weights[i] * counted[i].shelfScore
        divisor += weights[i]
      }
      weightedScore = round2(numerator / divisor)
    }

    // trend
    let trend: 'up' | 'down' | 'flat' | null = null
    if (counted.length < 2) trend = null
    else {
      const s1 = counted[0].shelfScore
      const s2 = counted[1].shelfScore
      if (s1 > s2) trend = 'up'
      else if (s1 < s2) trend = 'down'
      else trend = 'flat'
    }

    // recency
    let daysSinceVisit: number | null = null
    if (counted.length === 0) daysSinceVisit = null
    else daysSinceVisit = daysBetween(counted[0].date, asOf)

    const overdue = daysSinceVisit === null || daysSinceVisit > 14

    // status
    let status: 'healthy' | 'watch' | 'critical' | 'unvisited'
    if (counted.length === 0) status = 'unvisited'
    else if (weightedScore !== null && weightedScore < 2.5) status = 'critical'
    else if (weightedScore !== null && weightedScore < 3.5) status = 'watch'
    else status = 'healthy'

    return {
      accountId: acct.id,
      weightedScore,
      trend,
      daysSinceVisit,
      overdue,
      status,
    }
  })

  out.sort((a, b) => (a.accountId < b.accountId ? -1 : a.accountId > b.accountId ? 1 : 0))
  return out
}
