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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    throw new Error(`Invalid date: ${asOf}`)
  }

  const audits = getAccounts().map((account) => {
    const counted = getVisits()
      .filter((visit) => visit.accountId === account.id && visit.date <= asOf)
      .sort((a, b) => {
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date)
        }
        return b.id.localeCompare(a.id)
      })

    const weights = [3, 2, 1]
    const n = Math.min(counted.length, 3)

    let weightedScore: number | null = null
    if (n > 0) {
      let numerator = 0
      let divisor = 0
      for (let i = 0; i < n; i += 1) {
        numerator += counted[i].shelfScore * weights[i]
        divisor += weights[i]
      }
      weightedScore = round2(numerator / divisor)
    }

    let trend: 'up' | 'down' | 'flat' | null = null
    if (counted.length >= 2) {
      const s1 = counted[0].shelfScore
      const s2 = counted[1].shelfScore
      if (s1 > s2) {
        trend = 'up'
      } else if (s1 < s2) {
        trend = 'down'
      } else {
        trend = 'flat'
      }
    }

    const daysSinceVisit = counted.length > 0 ? daysBetween(counted[0].date, asOf) : null
    const overdue = daysSinceVisit === null || daysSinceVisit > 14

    let status: 'healthy' | 'watch' | 'critical' | 'unvisited'
    if (counted.length === 0) {
      status = 'unvisited'
    } else if (weightedScore !== null && weightedScore < 2.5) {
      status = 'critical'
    } else if (weightedScore !== null && weightedScore < 3.5) {
      status = 'watch'
    } else {
      status = 'healthy'
    }

    return {
      accountId: account.id,
      weightedScore,
      trend,
      daysSinceVisit,
      overdue,
      status,
    }
  })

  audits.sort((a, b) => a.accountId.localeCompare(b.accountId))
  return audits
}
