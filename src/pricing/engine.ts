import { getProduct, getAccount, getPromotions } from '../data'

// Local types
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
  const s = Math.sign(n) || 1
  return s * Math.round(Math.abs(Number(n.toFixed(10))) * 100) / 100
}

export function priceOrder(input: PriceOrderInput): PricedOrder {
  const account = getAccount(input.accountId)
  if (!account) throw new Error(`Unknown account: ${input.accountId}`)

  if (!input.lines || input.lines.length === 0) {
    return { lines: [], orderLevel: { appliedPromoId: null, discount: 0 }, subtotal: 0, total: 0 }
  }

  const promos = getPromotions().filter((p) => {
    // active
    if (!(p.validFrom <= input.date && input.date <= p.validTo)) return false
    // eligible segments
    if (p.eligibleSegments && !p.eligibleSegments.includes(account.segment)) return false
    return true
  })

  const pricedLines: PricedLine[] = input.lines.map((line) => {
    const product = getProduct(line.productId)
    if (!product) throw new Error(`Unknown product: ${line.productId}`)
    if (!Number.isInteger(line.qty) || line.qty <= 0) throw new Error(`Invalid qty for ${line.productId}`)

    const unitPrice = product.unitPrice
    const gross = round2(unitPrice * line.qty)

    // enumerate line-level candidates
    type Candidate = { promoId: string; discount: number; validFrom: string }
    const candidates: Candidate[] = []

    for (const p of promos) {
      if ((p as any).type === 'percent_off') {
        const pp = p as any
        const scope = pp.scope || {}
        let matches = false
        if (scope.category && scope.category === product.category) matches = true
        if (scope.productIds && Array.isArray(scope.productIds) && scope.productIds.includes(product.id)) matches = true
        if (matches) {
          const discount = round2(unitPrice * line.qty * (pp.percent / 100))
          if (discount !== 0) candidates.push({ promoId: pp.id, discount, validFrom: pp.validFrom })
        }
      } else if ((p as any).type === 'bogo') {
        const bp = p as any
        if (bp.productId === product.id) {
          const group = bp.buyQty + bp.getQty
          if (group > 0) {
            const freeUnits = Math.floor(line.qty / group) * bp.getQty
            const discount = round2(freeUnits * unitPrice)
            if (discount !== 0) candidates.push({ promoId: bp.id, discount, validFrom: bp.validFrom })
          }
        }
      }
      // threshold promos ignored here
    }

    let appliedPromoId: string | null = null
    let discount = 0
    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        if (b.discount !== a.discount) return b.discount - a.discount // largest discount first
        if (a.validFrom !== b.validFrom) return a.validFrom < b.validFrom ? -1 : 1 // earliest validFrom
        return a.promoId < b.promoId ? -1 : a.promoId > b.promoId ? 1 : 0
      })
      appliedPromoId = candidates[0].promoId
      discount = candidates[0].discount
    }

    const net = Math.max(0, round2(gross - discount))

    return {
      productId: product.id,
      qty: line.qty,
      unitPrice,
      gross,
      appliedPromoId,
      discount,
      net,
    }
  })

  // Order-level threshold
  const thresholdPromos = promos.filter((p) => (p as any).type === 'threshold') as any[]
  let orderLevel = { appliedPromoId: null as string | null, discount: 0 }

  const qualifying: { promo: any; amountOff: number; validFrom: string }[] = []

  for (const tp of thresholdPromos) {
    // compute categoryNet as round2(sum of line.net where product.category === tp.category)
    let sum = 0
    for (const l of pricedLines) {
      const prod = getProduct(l.productId)
      if (prod && prod.category === tp.category) sum += l.net
    }
    const categoryNet = round2(sum)
    if (categoryNet >= tp.minSubtotal) {
      qualifying.push({ promo: tp, amountOff: tp.amountOff, validFrom: tp.validFrom })
    }
  }

  if (qualifying.length > 0) {
    qualifying.sort((a, b) => {
      if (b.amountOff !== a.amountOff) return b.amountOff - a.amountOff // largest amountOff
      if (a.validFrom !== b.validFrom) return a.validFrom < b.validFrom ? -1 : 1
      return a.promo.id < b.promo.id ? -1 : a.promo.id > b.promo.id ? 1 : 0
    })
    const winner = qualifying[0].promo
    orderLevel = { appliedPromoId: winner.id, discount: round2(winner.amountOff) }
  }

  const subtotal = round2(pricedLines.reduce((s, l) => s + l.net, 0))
  const total = Math.max(0, round2(subtotal - orderLevel.discount))

  return {
    lines: pricedLines,
    orderLevel,
    subtotal,
    total,
  }
}
