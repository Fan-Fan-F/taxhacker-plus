/**
 * Reconciliation and Tax Audit Utilities
 * Provides financial reconciliation metrics, receipt audit status classification,
 * net balance netting, and CSV audit export generation.
 */

export interface TransactionLike {
  id: string
  name?: string | null
  merchant?: string | null
  total?: number | null
  currencyCode?: string | null
  convertedTotal?: number | null
  convertedCurrencyCode?: string | null
  type?: string | null
  files?: unknown
  issuedAt?: Date | string | null
  note?: string | null
}

export interface ReconciliationSummary {
  totalCount: number
  withReceiptCount: number
  missingReceiptCount: number
  receiptComplianceRate: number // 0 - 100 percentage
  totalIncomeCents: number
  totalExpenseCents: number
  netBalanceCents: number // totalIncome - totalExpense
  currencies: string[]
}

export interface ReconciliationItem {
  id: string
  date: string
  name: string
  merchant: string
  direction: "income" | "expense"
  originalAmount: string
  currency: string
  convertedAmount: string
  convertedCurrency: string
  effectiveRate: string
  auditStatus: "Receipt Attached" | "Missing Receipt"
  attachmentCount: number
  attachedFiles: string
  note: string
}

function hasReceiptFiles(files: unknown): boolean {
  if (!files) return false
  if (Array.isArray(files)) {
    return files.length > 0
  }
  if (typeof files === "string") {
    try {
      const parsed = JSON.parse(files)
      return Array.isArray(parsed) && parsed.length > 0
    } catch {
      return files.trim().length > 0 && files !== "[]"
    }
  }
  return false
}

function getReceiptFilesCount(files: unknown): number {
  if (!files) return 0
  if (Array.isArray(files)) return files.length
  if (typeof files === "string") {
    try {
      const parsed = JSON.parse(files)
      return Array.isArray(parsed) ? parsed.length : 0
    } catch {
      return 0
    }
  }
  return 0
}

/**
 * Calculates aggregate reconciliation and audit metrics across a set of transactions.
 */
export function calculateReconciliationSummary(transactions: TransactionLike[]): ReconciliationSummary {
  let totalCount = 0
  let withReceiptCount = 0
  let totalIncomeCents = 0
  let totalExpenseCents = 0
  const currencySet = new Set<string>()

  for (const t of transactions) {
    totalCount++
    if (hasReceiptFiles(t.files)) {
      withReceiptCount++
    }

    const curr = t.currencyCode || t.convertedCurrencyCode || "USD"
    currencySet.add(curr)

    // Use convertedTotal if available, else total
    const effectiveCents = t.convertedTotal !== null && t.convertedTotal !== undefined ? t.convertedTotal : (t.total || 0)

    if (t.type === "income") {
      totalIncomeCents += effectiveCents
    } else {
      totalExpenseCents += effectiveCents
    }
  }

  const missingReceiptCount = totalCount - withReceiptCount
  const receiptComplianceRate = totalCount > 0 ? Math.round((withReceiptCount / totalCount) * 10000) / 100 : 0
  const netBalanceCents = totalIncomeCents - totalExpenseCents

  return {
    totalCount,
    withReceiptCount,
    missingReceiptCount,
    receiptComplianceRate,
    totalIncomeCents,
    totalExpenseCents,
    netBalanceCents,
    currencies: Array.from(currencySet),
  }
}

/**
 * Builds individual reconciliation and audit line items.
 */
export function buildReconciliationItems(
  transactions: TransactionLike[],
  fileNamesMap?: Record<string, string[]>
): ReconciliationItem[] {
  return transactions.map((t) => {
    const hasReceipt = hasReceiptFiles(t.files)
    const attachedCount = fileNamesMap?.[t.id]?.length ?? getReceiptFilesCount(t.files)
    const fileList = (fileNamesMap?.[t.id] || []).join("; ")

    let dateStr = ""
    if (t.issuedAt) {
      if (t.issuedAt instanceof Date) {
        dateStr = t.issuedAt.toISOString().slice(0, 10)
      } else {
        dateStr = String(t.issuedAt).slice(0, 10)
      }
    }

    const origCents = t.total ?? 0
    const convCents = t.convertedTotal ?? null
    const origDec = (origCents / 100).toFixed(2)
    const convDec = convCents !== null ? (convCents / 100).toFixed(2) : ""

    let effectiveRate = "1.0000"
    if (convCents !== null && origCents !== 0) {
      effectiveRate = (convCents / origCents).toFixed(4)
    } else if (convCents === null) {
      effectiveRate = "N/A"
    }

    return {
      id: t.id,
      date: dateStr,
      name: t.name || "",
      merchant: t.merchant || "",
      direction: t.type === "income" ? "income" : "expense",
      originalAmount: origDec,
      currency: t.currencyCode || "USD",
      convertedAmount: convDec,
      convertedCurrency: t.convertedCurrencyCode || "",
      effectiveRate,
      auditStatus: hasReceipt ? "Receipt Attached" : "Missing Receipt",
      attachmentCount: attachedCount,
      attachedFiles: fileList,
      note: t.note || "",
    }
  })
}

function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return ""
  const str = String(val)
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Formats reconciliation audit summary and line items into structured CSV with metadata header.
 */
export function formatReconciliationCSV(summary: ReconciliationSummary, items: ReconciliationItem[]): string {
  const lines: string[] = []

  // Reconciliation summary comments header
  lines.push("# --- TAXHACKER FINANCIAL RECONCILIATION & AUDIT REPORT ---")
  lines.push(`# Report Generated: ${new Date().toISOString()}`)
  lines.push(`# Total Transactions: ${summary.totalCount}`)
  lines.push(`# Receipts Attached: ${summary.withReceiptCount}`)
  lines.push(`# Missing Receipts: ${summary.missingReceiptCount}`)
  lines.push(`# Receipt Compliance Rate: ${summary.receiptComplianceRate.toFixed(2)}%`)
  lines.push(`# Total Income: ${(summary.totalIncomeCents / 100).toFixed(2)}`)
  lines.push(`# Total Expense: ${(summary.totalExpenseCents / 100).toFixed(2)}`)
  lines.push(`# Net Balance: ${(summary.netBalanceCents / 100).toFixed(2)}`)
  lines.push("# ---------------------------------------------------------")

  // Column headers
  const headers = [
    "Transaction ID",
    "Date",
    "Name / Order",
    "Merchant",
    "Direction",
    "Original Amount",
    "Currency",
    "Converted Amount",
    "Base Currency",
    "Effective Rate",
    "Audit Status",
    "Attachment Count",
    "Attached Files",
    "Notes",
  ]
  lines.push(headers.join(","))

  for (const item of items) {
    const row = [
      escapeCsv(item.id),
      escapeCsv(item.date),
      escapeCsv(item.name),
      escapeCsv(item.merchant),
      escapeCsv(item.direction),
      escapeCsv(item.originalAmount),
      escapeCsv(item.currency),
      escapeCsv(item.convertedAmount),
      escapeCsv(item.convertedCurrency),
      escapeCsv(item.effectiveRate),
      escapeCsv(item.auditStatus),
      escapeCsv(item.attachmentCount),
      escapeCsv(item.attachedFiles),
      escapeCsv(item.note),
    ]
    lines.push(row.join(","))
  }

  return lines.join("\n") + "\n"
}
