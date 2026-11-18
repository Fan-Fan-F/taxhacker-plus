import { describe, expect, it } from "vitest"
import {
  buildReconciliationItems,
  calculateReconciliationSummary,
  formatReconciliationCSV,
  TransactionLike,
} from "./reconciliation"

describe("Reconciliation Utilities", () => {
  const sampleTransactions: TransactionLike[] = [
    {
      id: "tx-1",
      name: "Shopify Order #1001",
      merchant: "Shopify Store",
      total: 5000, // $50.00
      currencyCode: "USD",
      convertedTotal: 5000,
      convertedCurrencyCode: "USD",
      type: "income",
      files: ["file-1"],
      issuedAt: new Date("2026-11-01T00:00:00.000Z"),
      note: "Standard sale",
    },
    {
      id: "tx-2",
      name: "AWS Server Hosting",
      merchant: "Amazon Web Services",
      total: 2000, // $20.00
      currencyCode: "USD",
      convertedTotal: 2000,
      convertedCurrencyCode: "USD",
      type: "expense",
      files: [], // Missing receipt
      issuedAt: new Date("2026-11-02T00:00:00.000Z"),
      note: "Cloud infra",
    },
    {
      id: "tx-3",
      name: "European Client Invoice",
      merchant: "Client EU",
      total: 10000, // €100.00
      currencyCode: "EUR",
      convertedTotal: 10850, // $108.50
      convertedCurrencyCode: "USD",
      type: "income",
      files: '["file-2", "file-3"]',
      issuedAt: "2026-11-03",
      note: "Consulting",
    },
  ]

  describe("calculateReconciliationSummary", () => {
    it("computes totals, income, expense, and net balance correctly", () => {
      const summary = calculateReconciliationSummary(sampleTransactions)

      expect(summary.totalCount).toBe(3)
      expect(summary.withReceiptCount).toBe(2)
      expect(summary.missingReceiptCount).toBe(1)
      expect(summary.receiptComplianceRate).toBe(66.67)

      // Total Income: 5000 + 10850 = 15850 cents ($158.50)
      expect(summary.totalIncomeCents).toBe(15850)
      // Total Expense: 2000 cents ($20.00)
      expect(summary.totalExpenseCents).toBe(2000)
      // Net Balance: 15850 - 2000 = 13850 cents ($138.50)
      expect(summary.netBalanceCents).toBe(13850)
      expect(summary.currencies).toContain("USD")
      expect(summary.currencies).toContain("EUR")
    })

    it("handles empty transaction lists gracefully", () => {
      const summary = calculateReconciliationSummary([])
      expect(summary.totalCount).toBe(0)
      expect(summary.withReceiptCount).toBe(0)
      expect(summary.missingReceiptCount).toBe(0)
      expect(summary.receiptComplianceRate).toBe(0)
      expect(summary.netBalanceCents).toBe(0)
    })
  })

  describe("buildReconciliationItems", () => {
    it("builds line items with correct audit status and effective rates", () => {
      const items = buildReconciliationItems(sampleTransactions, {
        "tx-1": ["invoice-1001.pdf"],
        "tx-3": ["contract.pdf", "receipt.jpg"],
      })

      expect(items.length).toBe(3)

      // Item 1
      expect(items[0].id).toBe("tx-1")
      expect(items[0].auditStatus).toBe("Receipt Attached")
      expect(items[0].attachmentCount).toBe(1)
      expect(items[0].attachedFiles).toBe("invoice-1001.pdf")
      expect(items[0].originalAmount).toBe("50.00")
      expect(items[0].effectiveRate).toBe("1.0000")

      // Item 2 (Missing receipt)
      expect(items[1].id).toBe("tx-2")
      expect(items[1].auditStatus).toBe("Missing Receipt")
      expect(items[1].attachmentCount).toBe(0)
      expect(items[1].direction).toBe("expense")

      // Item 3 (Multi-currency)
      expect(items[2].id).toBe("tx-3")
      expect(items[2].currency).toBe("EUR")
      expect(items[2].convertedCurrency).toBe("USD")
      expect(items[2].effectiveRate).toBe("1.0850")
      expect(items[2].auditStatus).toBe("Receipt Attached")
      expect(items[2].attachmentCount).toBe(2)
    })
  })

  describe("formatReconciliationCSV", () => {
    it("generates CSV with summary comments and header row", () => {
      const summary = calculateReconciliationSummary(sampleTransactions)
      const items = buildReconciliationItems(sampleTransactions)
      const csv = formatReconciliationCSV(summary, items)

      expect(csv).toContain("# --- TAXHACKER FINANCIAL RECONCILIATION & AUDIT REPORT ---")
      expect(csv).toContain("# Total Transactions: 3")
      expect(csv).toContain("# Receipts Attached: 2")
      expect(csv).toContain("# Missing Receipts: 1")
      expect(csv).toContain("# Net Balance: 138.50")
      expect(csv).toContain("Transaction ID,Date,Name / Order,Merchant")
      expect(csv).toContain("Receipt Attached")
      expect(csv).toContain("Missing Receipt")
    })
  })
})
