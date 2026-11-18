/**
 * E-Commerce Presets and Financial Parsing Utilities
 * Provides presets for Shopify, Amazon Seller, Stripe, PayPal, and WooCommerce/Standard reports.
 */

export interface EcommercePreset {
  id: string
  name: string
  description: string
  detectKeywords: string[]
  mappings: Record<string, string[]> // fieldCode -> list of possible header names (lowercase)
  defaultType?: "income" | "expense"
  defaultMerchant?: string
}

export const ECOMMERCE_PRESETS: EcommercePreset[] = [
  {
    id: "shopify",
    name: "Shopify Orders / Payouts",
    description: "Shopify order export or transaction reports",
    detectKeywords: ["financial status", "fulfillment status", "lineitem name", "taxes", "shipping"],
    defaultType: "income",
    defaultMerchant: "Shopify Store",
    mappings: {
      name: ["name", "order id", "order name", "id"],
      merchant: ["vendor", "source", "billing name", "channel"],
      description: ["lineitem name", "notes", "tags", "customer"],
      total: ["total", "total amount", "net amount", "gross sales", "subtotal"],
      currencyCode: ["currency", "presentment currency", "order currency"],
      type: ["financial status", "transaction type", "type"],
      issuedAt: ["created at", "paid at", "processed at", "date", "created_at"],
      note: ["note", "notes", "customer note", "special instructions"],
    },
  },
  {
    id: "amazon_seller",
    name: "Amazon Seller Central",
    description: "Amazon orders, settlement, and transaction statements",
    detectKeywords: ["settlement id", "order id", "sku", "quantity-purchased", "item-price"],
    defaultType: "income",
    defaultMerchant: "Amazon",
    mappings: {
      name: ["order id", "order-id", "amazon-order-id", "transaction-id"],
      merchant: ["marketplace", "merchant", "fulfillment-channel"],
      description: ["product sales", "sku", "item-description", "title"],
      total: ["total", "item-price", "principal", "other-amount", "total-amount", "amount"],
      currencyCode: ["currency", "currency-code"],
      type: ["transaction-type", "type", "order-type"],
      issuedAt: ["posted-date", "order-date", "date/time", "date", "posted date"],
      note: ["fulfillment-channel", "sales-channel", "merchant-order-id"],
    },
  },
  {
    id: "stripe",
    name: "Stripe Payments & Balance",
    description: "Stripe balance transactions and payment exports",
    detectKeywords: ["balance transaction id", "gross", "fee", "net", "customer description", "source_id"],
    defaultType: "income",
    defaultMerchant: "Stripe",
    mappings: {
      name: ["id", "balance transaction id", "payment intent id", "charge id"],
      merchant: ["customer description", "customer email", "customer id", "source"],
      description: ["description", "memo", "plan", "product name"],
      total: ["net", "gross", "amount", "total"],
      currencyCode: ["currency"],
      type: ["type", "reporting_category"],
      issuedAt: ["created (utc)", "created", "available on (utc)", "date"],
      note: ["dispute reason", "status", "fee"],
    },
  },
  {
    id: "paypal",
    name: "PayPal Activity Statement",
    description: "PayPal transaction logs and activity downloads",
    detectKeywords: ["gross", "fee", "net", "transaction id", "from email address", "to email address"],
    defaultType: "income",
    defaultMerchant: "PayPal",
    mappings: {
      name: ["transaction id", "invoice number", "reference tx id"],
      merchant: ["name", "from email address", "counterparty", "to email address"],
      description: ["item title", "subject", "note", "type"],
      total: ["gross", "net", "amount", "total"],
      currencyCode: ["currency"],
      type: ["type", "status"],
      issuedAt: ["date", "timestamp", "time"],
      note: ["note", "custom number"],
    },
  },
  {
    id: "standard_ecommerce",
    name: "Standard E-Commerce (Orders / Invoices)",
    description: "General multi-channel e-commerce order or invoice sheet",
    detectKeywords: ["order_id", "order_number", "order date", "grand total", "total amount"],
    defaultType: "income",
    defaultMerchant: "E-Commerce",
    mappings: {
      name: ["order id", "order_id", "order number", "order_number", "invoice", "invoice number"],
      merchant: ["store", "channel", "platform", "merchant", "vendor"],
      description: ["product", "items", "description", "details"],
      total: ["total", "grand total", "total amount", "amount", "order total", "price"],
      currencyCode: ["currency", "currency code", "currency_code"],
      type: ["order status", "payment status", "type", "direction"],
      issuedAt: ["order date", "date", "created at", "time", "paid date"],
      categoryCode: ["category", "category code"],
      projectCode: ["project", "store code", "store id"],
      note: ["comment", "memo", "customer note", "note"],
    },
  },
]

/**
 * Robustly parses financial currency strings into integer cents (e.g. $19.99 -> 1999, -50.00 -> -5000).
 * Handles:
 * - Currency symbols: $, €, £, ¥, etc.
 * - Thousands separators: 1,234.56 -> 1234.56
 * - Negative amounts with parentheses: ($10.50) -> -1050
 * - Trailing/leading minus signs: 10.50- or -10.50 -> -1050
 * - Decimal comma: 12,50 (if no decimal dot present)
 */
export function parseCurrencyAmount(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === "number") {
    if (isNaN(value)) return 0
    return Math.round(value * 100)
  }

  let str = String(value).trim()
  if (!str) return 0

  // Check for parenthesis negative: (123.45) or ($123.45)
  let isNegative = false
  if (str.startsWith("(") && str.endsWith(")")) {
    isNegative = true
    str = str.slice(1, -1).trim()
  } else if (str.startsWith("-") || str.endsWith("-")) {
    isNegative = true
    str = str.replace(/-/g, "").trim()
  }

  // Remove currency symbols, spaces, letters
  // Keep digits, commas, dots
  let cleaned = str.replace(/[^0-9.,]/g, "")
  if (!cleaned) return 0

  // Determine decimal separator:
  // e.g., "1,234.56" vs "1.234,56" vs "12,50"
  if (cleaned.includes(",") && cleaned.includes(".")) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      // European format: 1.234,56
      cleaned = cleaned.replace(/\./g, "").replace(",", ".")
    } else {
      // US format: 1,234.56
      cleaned = cleaned.replace(/,/g, "")
    }
  } else if (cleaned.includes(",")) {
    const parts = cleaned.split(",")
    if (parts.length === 2 && parts[1].length <= 2) {
      // Likely decimal comma e.g. "12,50" -> 12.50
      cleaned = cleaned.replace(",", ".")
    } else {
      // Thousands comma e.g. "1,000" -> 1000
      cleaned = cleaned.replace(/,/g, "")
    }
  }

  const num = parseFloat(cleaned)
  if (isNaN(num)) return 0

  const cents = Math.round(num * 100)
  return isNegative ? -cents : cents
}

/**
 * Standardizes date parsing to UTC midnight for calendar dates, avoiding timezone shifts.
 */
export function parseImportDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value
  }

  const str = String(value).trim()
  if (!str) return null

  // Date-only ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(`${str}T00:00:00.000Z`)
  }

  // Slash format: YYYY/MM/DD
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(str)) {
    const [y, m, d] = str.split("/").map((s) => s.padStart(2, "0"))
    return new Date(`${y}-${m}-${d}T00:00:00.000Z`)
  }

  // US Slash format: MM/DD/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const [m, d, y] = str.split("/").map((s) => s.padStart(2, "0"))
    return new Date(`${y}-${m}-${d}T00:00:00.000Z`)
  }

  // General Date parse (e.g. ISO string or standard datetime)
  try {
    const parsed = new Date(str)
    return isNaN(parsed.getTime()) ? null : parsed
  } catch (_e) {
    return null
  }
}

/**
 * Automatically inspects CSV headers and scores against known presets.
 */
export function detectEcommercePreset(headers: string[]): EcommercePreset | null {
  if (!headers || headers.length === 0) return null

  const normalized = headers.map((h) => h.toLowerCase().trim())
  let bestPreset: EcommercePreset | null = null
  let maxScore = 0

  for (const preset of ECOMMERCE_PRESETS) {
    let score = 0

    // Check keyword hits
    for (const kw of preset.detectKeywords) {
      if (normalized.some((h) => h === kw || h.includes(kw))) {
        score += 3
      }
    }

    // Check mapped header matches
    for (const [, candidates] of Object.entries(preset.mappings)) {
      if (normalized.some((h) => candidates.includes(h))) {
        score += 1
      }
    }

    if (score > maxScore && score >= 3) {
      maxScore = score
      bestPreset = preset
    }
  }

  return bestPreset
}

/**
 * Computes suggested column mappings for a given preset and array of headers.
 */
export function applyPresetMappings(
  headers: string[],
  preset: EcommercePreset,
  availableFieldCodes: string[]
): string[] {
  const normalized = headers.map((h) => h.toLowerCase().trim())
  const validCodes = new Set(availableFieldCodes)
  const mapped = new Array<string>(headers.length).fill("")

  for (const [fieldCode, aliases] of Object.entries(preset.mappings)) {
    if (!validCodes.has(fieldCode)) continue

    // Find the best header index for this field
    for (let i = 0; i < normalized.length; i++) {
      if (mapped[i]) continue // already mapped
      const header = normalized[i]
      if (aliases.includes(header)) {
        mapped[i] = fieldCode
        break
      }
    }
  }

  return mapped
}
