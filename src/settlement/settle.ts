import { priceOrder } from '../pricing/engine'
import { getRoutes, getProduct } from '../data'

export interface CartLine { productId: string; qty: number }

export interface SettleRouteInput {
  routeId: string
  date: string
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

function round2(n: number): number {
  const s = Math.sign(n) || 1
  return s * Math.round(Math.abs(Number(n.toFixed(10))) * 100) / 100
}

export function settleRoute(input: SettleRouteInput): RouteSettlement {
  const routes = getRoutes()
  const route = routes.find((r) => r.id === input.routeId)
  if (!route) throw new Error(`Unknown route: ${input.routeId}`)

  const stopAccountIds = route.stops.map((s) => s.accountId)

  for (const order of input.orders) {
    if (!stopAccountIds.includes(order.accountId)) {
      throw new Error(`Account not on route: ${order.accountId}`)
    }
  }

  const priced = input.orders.map((o) =>
    priceOrder({ lines: o.lines, accountId: o.accountId, date: input.date })
  )

  // Totals
  const grossTotal = round2(priced.reduce((s, po) => s + po.lines.reduce((ss, l) => ss + l.gross, 0), 0))
  const lineDiscountTotal = round2(priced.reduce((s, po) => s + po.lines.reduce((ss, l) => ss + l.discount, 0), 0))
  const orderDiscountTotal = round2(priced.reduce((s, po) => s + po.orderLevel.discount, 0))
  const discountTotal = round2(lineDiscountTotal + orderDiscountTotal)
  const netTotal = round2(priced.reduce((s, po) => s + po.total, 0))

  // per-category nets
  const catMap: Record<string, { total: number; count: number }> = {}
  for (const po of priced) {
    for (const l of po.lines) {
      const prod = getProduct(l.productId)
      const cat = prod ? prod.category : 'UNKNOWN'
      if (!catMap[cat]) catMap[cat] = { total: 0, count: 0 }
      catMap[cat].total += l.net
      catMap[cat].count += 1
    }
  }

  const perCategory: Record<string, number> = {}
  const catKeys = Object.keys(catMap).sort()
  for (const k of catKeys) {
    // include categories that had at least one line
    perCategory[k] = round2(catMap[k].total)
  }

  // promo usage
  const usageMap: Record<string, number> = {}
  for (const po of priced) {
    for (const l of po.lines) {
      if (l.appliedPromoId) {
        usageMap[l.appliedPromoId] = (usageMap[l.appliedPromoId] || 0) + 1
      }
    }
    if (po.orderLevel && po.orderLevel.appliedPromoId) {
      const id = po.orderLevel.appliedPromoId
      usageMap[id] = (usageMap[id] || 0) + 1
    }
  }
  const promoUsage: Record<string, number> = {}
  for (const k of Object.keys(usageMap).sort()) promoUsage[k] = usageMap[k]

  // commission (marginal)
  const t1 = Math.min(netTotal, 200) * 0.02
  const t2 = Math.max(0, Math.min(netTotal, 500) - 200) * 0.05
  const t3 = Math.max(0, netTotal - 500) * 0.08
  const commission = round2(t1 + t2 + t3)

  // stops visited / missed
  const seen = new Set<string>()
  const stopsVisited: string[] = []
  const stopsMissed: string[] = []
  const orderedSeen = new Set<string>(input.orders.map((o) => o.accountId))

  for (const s of route.stops) {
    const aid = s.accountId
    if (seen.has(aid)) continue
    seen.add(aid)
    if (orderedSeen.has(aid)) stopsVisited.push(aid)
    else stopsMissed.push(aid)
  }

  return {
    routeId: input.routeId,
    date: input.date,
    grossTotal,
    lineDiscountTotal,
    orderDiscountTotal,
    discountTotal,
    netTotal,
    perCategory,
    promoUsage,
    commission,
    stopsVisited,
    stopsMissed,
  }
}
