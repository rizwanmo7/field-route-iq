import { getAccount, getProduct, getPromotions } from '../data'
import type { BogoPromotion, PercentOffPromotion, Promotion, ThresholdPromotion } from '../data'

export interface CartLine {
  productId: string
  qty: number
}

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

interface LinePromoPick {
  id: string
  validFrom: string
  discount: number
}

function round2(n: number): number {
  const s = Math.sign(n) || 1
  return s * Math.round(Number((Math.abs(n) * 100).toFixed(10))) / 100
}

function isActiveAndEligible(promo: Promotion, date: string, segment: string): boolean {
  if (promo.validFrom > date || promo.validTo < date) {
    return false
  }
  if (!promo.eligibleSegments) {
    return true
  }
  return promo.eligibleSegments.includes(segment)
}

function betterLinePromo(a: LinePromoPick, b: LinePromoPick): LinePromoPick {
  if (a.discount !== b.discount) {
    return a.discount > b.discount ? a : b
  }
  if (a.validFrom !== b.validFrom) {
    return a.validFrom < b.validFrom ? a : b
  }
  return a.id < b.id ? a : b
}

function betterThresholdPromo(a: ThresholdPromotion, b: ThresholdPromotion): ThresholdPromotion {
  if (a.amountOff !== b.amountOff) {
    return a.amountOff > b.amountOff ? a : b
  }
  if (a.validFrom !== b.validFrom) {
    return a.validFrom < b.validFrom ? a : b
  }
  return a.id < b.id ? a : b
}

function percentOffDiscount(promo: PercentOffPromotion, unitPrice: number, qty: number): number {
  return round2((unitPrice * qty * promo.percent) / 100)
}

function bogoDiscount(promo: BogoPromotion, unitPrice: number, qty: number): number {
  const group = promo.buyQty + promo.getQty
  if (group <= 0) {
    return 0
  }
  const freeUnits = Math.floor(qty / group) * promo.getQty
  return round2(freeUnits * unitPrice)
}

export function priceOrder(input: PriceOrderInput): PricedOrder {
  const account = getAccount(input.accountId)
  if (!account) {
    throw new Error(`Unknown account: ${input.accountId}`)
  }

  if (input.lines.length === 0) {
    return { lines: [], orderLevel: { appliedPromoId: null, discount: 0 }, subtotal: 0, total: 0 }
  }

  const activeEligible = getPromotions().filter((promo) =>
    isActiveAndEligible(promo, input.date, account.segment),
  )

  const pricedLines: PricedLine[] = []
  const categoryNetSums: Record<string, number> = {}

  for (const line of input.lines) {
    const product = getProduct(line.productId)
    if (!product) {
      throw new Error(`Unknown product: ${line.productId}`)
    }
    if (!Number.isInteger(line.qty) || line.qty <= 0) {
      throw new Error(`Invalid qty for ${line.productId}`)
    }

    const gross = round2(product.unitPrice * line.qty)
    let best: LinePromoPick | null = null

    for (const promo of activeEligible) {
      if (promo.type === 'threshold') {
        continue
      }

      let discount = 0
      if (promo.type === 'percent_off') {
        const categoryMatch = promo.scope.category === product.category
        const productMatch = promo.scope.productIds?.includes(line.productId) ?? false
        if (categoryMatch || productMatch) {
          discount = percentOffDiscount(promo, product.unitPrice, line.qty)
        }
      } else if (promo.type === 'bogo' && promo.productId === line.productId) {
        discount = bogoDiscount(promo, product.unitPrice, line.qty)
      }

      if (discount > 0) {
        const candidate: LinePromoPick = { id: promo.id, validFrom: promo.validFrom, discount }
        best = best ? betterLinePromo(best, candidate) : candidate
      }
    }

    const discount = best ? best.discount : 0
    const appliedPromoId = best ? best.id : null
    const net = Math.max(0, round2(gross - discount))

    pricedLines.push({
      productId: line.productId,
      qty: line.qty,
      unitPrice: product.unitPrice,
      gross,
      appliedPromoId,
      discount,
      net,
    })

    categoryNetSums[product.category] = (categoryNetSums[product.category] ?? 0) + net
  }

  let winningThreshold: ThresholdPromotion | null = null
  for (const promo of activeEligible) {
    if (promo.type !== 'threshold') {
      continue
    }
    const categoryNet = round2(categoryNetSums[promo.category] ?? 0)
    if (categoryNet >= promo.minSubtotal) {
      winningThreshold = winningThreshold
        ? betterThresholdPromo(winningThreshold, promo)
        : promo
    }
  }

  const orderLevel = winningThreshold
    ? { appliedPromoId: winningThreshold.id, discount: round2(winningThreshold.amountOff) }
    : { appliedPromoId: null, discount: 0 }

  const subtotal = round2(pricedLines.reduce((sum, line) => sum + line.net, 0))
  const total = Math.max(0, round2(subtotal - orderLevel.discount))

  return { lines: pricedLines, orderLevel, subtotal, total }
}
