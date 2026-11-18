import { describe, expect, it } from "vitest"
import { EXPORT_AND_IMPORT_FIELD_MAP } from "./export_and_import"

describe("EXPORT_AND_IMPORT_FIELD_MAP", () => {
  it("imports total amounts with currency symbols and comma separators correctly into integer cents", async () => {
    const totalField = EXPORT_AND_IMPORT_FIELD_MAP.total
    expect(totalField).toBeDefined()
    expect(totalField.import).toBeDefined()

    const result1 = await totalField.import!("test-user", "$49.99")
    expect(result1).toBe(4999)

    const result2 = await totalField.import!("test-user", "€ 1,250.00")
    expect(result2).toBe(125000)

    const result3 = await totalField.import!("test-user", "(35.50)")
    expect(result3).toBe(-3550)
  })

  it("exports total amounts back to decimal units", async () => {
    const totalField = EXPORT_AND_IMPORT_FIELD_MAP.total
    const result = await totalField.export!("test-user", 4999)
    expect(result).toBe(49.99)
  })

  it("imports issuedAt in UTC midnight", async () => {
    const dateField = EXPORT_AND_IMPORT_FIELD_MAP.issuedAt
    const date = await dateField.import!("test-user", "2026-11-15")
    expect(date).toBeInstanceOf(Date)
    expect((date as Date).toISOString()).toBe("2026-11-15T00:00:00.000Z")
  })
})
