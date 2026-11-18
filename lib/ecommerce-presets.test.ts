import { describe, expect, it } from "vitest"
import {
  applyPresetMappings,
  detectEcommercePreset,
  ECOMMERCE_PRESETS,
  parseCurrencyAmount,
  parseImportDate,
} from "./ecommerce-presets"

describe("parseCurrencyAmount", () => {
  it("parses plain numbers and strings to integer cents", () => {
    expect(parseCurrencyAmount(19.99)).toBe(1999)
    expect(parseCurrencyAmount("19.99")).toBe(1999)
    expect(parseCurrencyAmount("100")).toBe(10000)
    expect(parseCurrencyAmount(0)).toBe(0)
    expect(parseCurrencyAmount("")).toBe(0)
    expect(parseCurrencyAmount(null)).toBe(0)
  })

  it("handles currency symbols and whitespace", () => {
    expect(parseCurrencyAmount("$19.99")).toBe(1999)
    expect(parseCurrencyAmount("€ 24.50")).toBe(2450)
    expect(parseCurrencyAmount("£1,234.56")).toBe(123456)
    expect(parseCurrencyAmount("¥ 1500")).toBe(150000)
  })

  it("handles thousands separators and European decimal commas", () => {
    expect(parseCurrencyAmount("1,234.56")).toBe(123456)
    expect(parseCurrencyAmount("1.234,56")).toBe(123456)
    expect(parseCurrencyAmount("12,50")).toBe(1250)
  })

  it("handles negative amounts and parentheses accounting format", () => {
    expect(parseCurrencyAmount("-19.99")).toBe(-1999)
    expect(parseCurrencyAmount("-$19.99")).toBe(-1999)
    expect(parseCurrencyAmount("($25.00)")).toBe(-2500)
    expect(parseCurrencyAmount("(120.50)")).toBe(-12050)
  })

  it("avoids floating point rounding drift", () => {
    // 19.99 * 100 in vanilla JS is 1998.9999999999998
    expect(parseCurrencyAmount("19.99")).toBe(1999)
    // 0.29 * 100 in vanilla JS is 28.999999999999996
    expect(parseCurrencyAmount("0.29")).toBe(29)
  })
})

describe("parseImportDate", () => {
  it("parses YYYY-MM-DD to UTC midnight without timezone shift", () => {
    const d = parseImportDate("2026-11-15")
    expect(d).not.toBeNull()
    expect(d?.toISOString()).toBe("2026-11-15T00:00:00.000Z")
  })

  it("parses slash date formats", () => {
    const d1 = parseImportDate("2026/11/15")
    expect(d1?.toISOString()).toBe("2026-11-15T00:00:00.000Z")

    const d2 = parseImportDate("11/15/2026")
    expect(d2?.toISOString()).toBe("2026-11-15T00:00:00.000Z")
  })

  it("returns null for invalid values", () => {
    expect(parseImportDate("")).toBeNull()
    expect(parseImportDate("invalid-date-string")).toBeNull()
  })
})

describe("Ecommerce Presets and Auto-Detection", () => {
  it("detects Shopify export headers", () => {
    const shopifyHeaders = [
      "Name",
      "Financial Status",
      "Fulfillment Status",
      "Lineitem name",
      "Total",
      "Currency",
      "Created at",
    ]
    const detected = detectEcommercePreset(shopifyHeaders)
    expect(detected?.id).toBe("shopify")

    const mappings = applyPresetMappings(
      shopifyHeaders,
      detected!,
      ["name", "total", "currencyCode", "issuedAt", "type", "description"]
    )
    expect(mappings).toContain("name")
    expect(mappings).toContain("total")
    expect(mappings).toContain("currencyCode")
    expect(mappings).toContain("issuedAt")
  })

  it("detects Amazon Seller export headers", () => {
    const amazonHeaders = ["order-id", "posted-date", "principal", "currency", "marketplace", "settlement id"]
    const detected = detectEcommercePreset(amazonHeaders)
    expect(detected?.id).toBe("amazon_seller")
  })

  it("detects Stripe export headers", () => {
    const stripeHeaders = ["balance transaction id", "gross", "fee", "net", "currency", "created (utc)"]
    const detected = detectEcommercePreset(stripeHeaders)
    expect(detected?.id).toBe("stripe")
  })

  it("detects PayPal export headers", () => {
    const paypalHeaders = ["Date", "Time", "Name", "Type", "Gross", "Fee", "Net", "From Email Address"]
    const detected = detectEcommercePreset(paypalHeaders)
    expect(detected?.id).toBe("paypal")
  })
})
