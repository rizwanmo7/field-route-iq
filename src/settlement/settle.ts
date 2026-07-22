import { getRoutes, getProduct } from '../data/index'
import { priceOrder } from '../pricing/engine'

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
  const s = n.toFixed(12)
  const v = Number(s)
  const cents = Math.floor(v * 100 + 0.5)
  return cents / 100
}

export function settleRoute(input: SettleRouteInput): RouteSettlement {
  const { routeId, date, orders } = input
  const routes = getRoutes()
  const route = routes.find((r) => r.id === routeId)
  if (!route) throw new Error(`Unknown route: ${routeId}`)

  const stopAccountIds = route.stops.map((s) => s.accountId)
  for (const o of orders) {
    if (!stopAccountIds.includes(o.accountId)) throw new Error(`Account not on route: ${o.accountId}`)
  }

  // Price each order
  const pricedOrders = orders.map((o) => priceOrder({ lines: o.lines, accountId: o.accountId, date }))

  // Totals
  const grossTotal = round2(
    pricedOrders.reduce((acc, po) => acc + po.lines.reduce((s, l) => s + l.gross, 0), 0)
  )
  const lineDiscountTotal = round2(
    pricedOrders.reduce((acc, po) => acc + po.lines.reduce((s, l) => s + l.discount, 0), 0)
  )
  const orderDiscountTotal = round2(pricedOrders.reduce((acc, po) => acc + po.orderLevel.discount, 0))
  const discountTotal = round2(lineDiscountTotal + orderDiscountTotal)
  const netTotal = round2(pricedOrders.reduce((acc, po) => acc + po.total, 0))

  // perCategory
  const perCategoryMap: Record<string, number> = {}
  for (const po of pricedOrders) {
    for (const ln of po.lines) {
      const prod = getProduct(ln.productId)
      const cat = prod ? prod.category : 'unknown'
      perCategoryMap[cat] = (perCategoryMap[cat] || 0) + ln.net
    }
  }
  // round per category and remove zero/absent
  const perCategoryEntries = Object.entries(perCategoryMap)
    .map(([k, v]) => [k, round2(v)] as const)
    .filter(([_, v]) => v !== 0)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
  const perCategory: Record<string, number> = {}
  for (const [k, v] of perCategoryEntries) perCategory[k] = v

  // promoUsage
  const usage: Record<string, number> = {}
  for (const po of pricedOrders) {
    for (const ln of po.lines) {
      if (ln.appliedPromoId) usage[ln.appliedPromoId] = (usage[ln.appliedPromoId] || 0) + 1
    }
    if (po.orderLevel && po.orderLevel.appliedPromoId) {
      const id = po.orderLevel.appliedPromoId
      usage[id] = (usage[id] || 0) + 1
    }
  }
  const promoUsageEntries = Object.entries(usage).sort((a, b) => (a[0] < b[0] ? -1 : 1))
  const promoUsage: Record<string, number> = {}
  for (const [k, v] of promoUsageEntries) promoUsage[k] = v

  // commission marginal tiers on netTotal
  let remaining = netTotal
  let commission = 0
  const tier1 = Math.min(remaining, 200)
  commission += tier1 * 0.02
  remaining -= tier1
  if (remaining > 0) {
    const tier2 = Math.min(remaining, 300)
    commission += tier2 * 0.05
    remaining -= tier2
  }
  if (remaining > 0) {
    commission += remaining * 0.08
  }
  commission = round2(commission)

  // stopsVisited and stopsMissed
  const visitedSet = new Set<string>()
  for (const o of orders) {
    visitedSet.add(o.accountId)
  }
  const stopsVisited: string[] = []
  const stopsMissed: string[] = []
  const seen = new Set<string>()
  for (const s of route.stops) {
    if (!seen.has(s.accountId)) {
      seen.add(s.accountId)
      if (visitedSet.has(s.accountId)) stopsVisited.push(s.accountId)
      else stopsMissed.push(s.accountId)
    }
  }

  return {
    routeId,
    date,
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
