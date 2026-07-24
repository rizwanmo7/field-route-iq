import { getProduct, getRoutes } from '../data'
import { priceOrder } from '../pricing/engine'

export interface CartLine {
  productId: string
  qty: number
}

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
  return s * Math.round(Number((Math.abs(n) * 100).toFixed(10))) / 100
}

export function settleRoute(input: SettleRouteInput): RouteSettlement {
  const route = getRoutes().find((candidate) => candidate.id === input.routeId)
  if (!route) {
    throw new Error(`Unknown route: ${input.routeId}`)
  }

  const stopAccountIds = route.stops.map((stop) => stop.accountId)
  for (const order of input.orders) {
    if (!stopAccountIds.includes(order.accountId)) {
      throw new Error(`Account not on route: ${order.accountId}`)
    }
  }

  const pricedOrders = input.orders.map((order) =>
    priceOrder({ lines: order.lines, accountId: order.accountId, date: input.date }),
  )

  let grossSum = 0
  let lineDiscountSum = 0
  let orderDiscountSum = 0
  let netSum = 0

  const perCategorySums: Record<string, number> = {}
  const promoUsageCounts: Record<string, number> = {}

  for (const pricedOrder of pricedOrders) {
    orderDiscountSum += pricedOrder.orderLevel.discount
    netSum += pricedOrder.total

    if (pricedOrder.orderLevel.appliedPromoId) {
      const promoId = pricedOrder.orderLevel.appliedPromoId
      promoUsageCounts[promoId] = (promoUsageCounts[promoId] ?? 0) + 1
    }

    for (const line of pricedOrder.lines) {
      grossSum += line.gross
      lineDiscountSum += line.discount

      if (line.appliedPromoId) {
        const promoId = line.appliedPromoId
        promoUsageCounts[promoId] = (promoUsageCounts[promoId] ?? 0) + 1
      }

      const product = getProduct(line.productId)
      if (!product) {
        throw new Error(`Unknown product: ${line.productId}`)
      }
      perCategorySums[product.category] = (perCategorySums[product.category] ?? 0) + line.net
    }
  }

  const grossTotal = round2(grossSum)
  const lineDiscountTotal = round2(lineDiscountSum)
  const orderDiscountTotal = round2(orderDiscountSum)
  const discountTotal = round2(lineDiscountTotal + orderDiscountTotal)
  const netTotal = round2(netSum)

  const perCategory: Record<string, number> = {}
  const sortedCategories = Object.keys(perCategorySums).sort((a, b) => a.localeCompare(b))
  for (const category of sortedCategories) {
    perCategory[category] = round2(perCategorySums[category])
  }

  const promoUsage: Record<string, number> = {}
  const sortedPromoIds = Object.keys(promoUsageCounts).sort((a, b) => a.localeCompare(b))
  for (const promoId of sortedPromoIds) {
    promoUsage[promoId] = promoUsageCounts[promoId]
  }

  const t1 = Math.min(netTotal, 200) * 0.02
  const t2 = Math.max(0, Math.min(netTotal, 500) - 200) * 0.05
  const t3 = Math.max(0, netTotal - 500) * 0.08
  const commission = round2(t1 + t2 + t3)

  const orderedSeen = new Set<string>()
  const visitedSet = new Set(input.orders.map((order) => order.accountId))
  const stopsVisited: string[] = []
  const stopsMissed: string[] = []

  for (const stop of route.stops) {
    if (orderedSeen.has(stop.accountId)) {
      continue
    }
    orderedSeen.add(stop.accountId)
    if (visitedSet.has(stop.accountId)) {
      stopsVisited.push(stop.accountId)
    } else {
      stopsMissed.push(stop.accountId)
    }
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
