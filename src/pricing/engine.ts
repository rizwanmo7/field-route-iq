import { getPromotions, getProduct, getAccount } from '../data/index'

// Local types per SPEC.md
export interface CartLine { productId: string; qty: number }

export interface PriceOrderInput {
  lines: CartLine[]
  accountId: string
  date: string
}

export interface PricedLine {
  productId: string
  qty: number
  unitPrice: number
  gross: number
  appliedPromoId: string | null
  discount: number
  net: number
}

export interface PricedOrder {
  lines: PricedLine[]
  orderLevel: { appliedPromoId: string | null; discount: number }
  subtotal: number
  total: number
}

function round2(n: number): number {
  // Convert to a fixed decimal string to avoid binary float rounding issues,
  // then perform half-up rounding on cents.
  const s = n.toFixed(12) // plenty of precision
  const v = Number(s)
  const cents = Math.floor(v * 100 + 0.5)
  return cents / 100
}

function clampZero(n: number) {
  return n < 0 ? 0 : n
}

export function priceOrder(input: PriceOrderInput): PricedOrder {
  const { lines, accountId, date } = input
  const account = getAccount(accountId)
  if (!account) throw new Error(`Unknown account: ${accountId}`)

  if (!Array.isArray(lines) || lines.length === 0) {
    return {
      lines: [],
      orderLevel: { appliedPromoId: null, discount: 0 },
      subtotal: 0,
      total: 0,
    }
  }

  const promos = getPromotions()

  const activePromos = promos.filter((p) => {
    // validFrom <= date <= validTo
    if (p.validFrom > date) return false
    if (p.validTo < date) return false
    if ((p as any).eligibleSegments && (p as any).eligibleSegments.length > 0) {
      const eligible = (p as any).eligibleSegments as string[]
      return eligible.includes(account.segment)
    }
    return true
  })

  const pricedLines: PricedLine[] = lines.map((ln) => {
    const { productId, qty } = ln
    const product = getProduct(productId)
    if (!product) throw new Error(`Unknown product: ${productId}`)
    if (!Number.isInteger(qty) || qty <= 0) throw new Error(`Invalid qty for ${productId}`)

    const unitPrice = product.unitPrice
    const grossRaw = unitPrice * qty
    const gross = round2(grossRaw)

    // find applicable line-level promos
    const linePromos = activePromos.filter((p) => p.type === 'percent_off' || p.type === 'bogo')

    const candidates: { id: string; discount: number; validFrom: string }[] = []

    for (const p of linePromos as any) {
      if (p.type === 'percent_off') {
        const scope = p.scope || {}
        let matches = false
        if (scope.category) {
          matches = product.category === scope.category
        } else if (scope.productIds && Array.isArray(scope.productIds)) {
          matches = scope.productIds.includes(productId)
        }
        if (!matches) continue
        const rawDiscount = (unitPrice * qty) * (p.percent / 100)
        const discount = round2(rawDiscount)
        if (discount <= 0) continue
        candidates.push({ id: p.id, discount, validFrom: p.validFrom })
      } else if (p.type === 'bogo') {
        if (p.productId !== productId) continue
        const group = p.buyQty + p.getQty
        const groups = Math.floor(qty / group)
        const freeUnits = groups * p.getQty
        const discount = round2(freeUnits * unitPrice)
        if (discount <= 0) continue
        candidates.push({ id: p.id, discount, validFrom: p.validFrom })
      }
    }

    let appliedPromoId: string | null = null
    let discount = 0

    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        if (b.discount !== a.discount) return b.discount - a.discount
        if (a.validFrom !== b.validFrom) return a.validFrom < b.validFrom ? -1 : 1
        return a.id < b.id ? -1 : 1
      })
      appliedPromoId = candidates[0].id
      discount = round2(candidates[0].discount)
    }

    const net = clampZero(round2(gross - discount))

    return {
      productId,
      qty,
      unitPrice,
      gross,
      appliedPromoId,
      discount,
      net,
    }
  })

  const subtotal = round2(pricedLines.reduce((s, l) => s + l.net, 0))

  // order-level threshold promos
  const thresholdPromos = activePromos.filter((p) => p.type === 'threshold') as any[]
  const qualifying: { id: string; amountOff: number; validFrom: string }[] = []
  for (const p of thresholdPromos) {
    const category = p.category
    const minSubtotal = p.minSubtotal
    const sumForCategory = pricedLines
      .filter((l) => {
        const prod = getProduct(l.productId)
        return prod && prod.category === category
      })
      .reduce((s, l) => s + l.net, 0)
    const sumRounded = round2(sumForCategory)
    if (sumRounded >= minSubtotal) {
      qualifying.push({ id: p.id, amountOff: p.amountOff, validFrom: p.validFrom })
    }
  }

  let orderLevel = { appliedPromoId: null as string | null, discount: 0 }
  if (qualifying.length > 0) {
    qualifying.sort((a, b) => {
      if (b.amountOff !== a.amountOff) return b.amountOff - a.amountOff
      if (a.validFrom !== b.validFrom) return a.validFrom < b.validFrom ? -1 : 1
      return a.id < b.id ? -1 : 1
    })
    orderLevel.appliedPromoId = qualifying[0].id
    orderLevel.discount = round2(qualifying[0].amountOff)
  }

  const total = clampZero(round2(subtotal - orderLevel.discount))

  return {
    lines: pricedLines,
    orderLevel,
    subtotal,
    total,
  }
}
