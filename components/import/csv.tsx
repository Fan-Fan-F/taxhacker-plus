"use client"

import { parseCSVAction, saveTransactionsAction } from "@/app/(app)/import/csv/actions"
import { FormError } from "@/components/forms/error"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  applyPresetMappings,
  detectEcommercePreset,
  ECOMMERCE_PRESETS,
} from "@/lib/ecommerce-presets"
import { Field } from "@/prisma/client"
import { CheckCircle2, CopyCheck, Loader2, Play, Sparkles, Store, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { startTransition, useActionState, useEffect, useState } from "react"

const MAX_PREVIEW_ROWS = 100

export function ImportCSVTable({ fields }: { fields: Field[] }) {
  const router = useRouter()
  const [parseState, parseAction, isParsing] = useActionState(parseCSVAction, null)
  const [saveState, saveAction, isSaving] = useActionState(saveTransactionsAction, null)

  const [csvSettings, setCSVSettings] = useState({
    skipHeader: true,
  })
  const [csvData, setCSVData] = useState<string[][]>([])
  const [columnMappings, setColumnMappings] = useState<string[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<string>("")
  const [detectedPresetName, setDetectedPresetName] = useState<string | null>(null)
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "overwrite" | "keepBoth">("skip")

  // Auto detect or default mapping upon CSV load
  useEffect(() => {
    if (parseState?.success && parseState.data) {
      const parsedData = parseState.data as string[][]
      setCSVData(parsedData)

      if (parsedData.length > 0) {
        const headers = parsedData[0]
        const availableCodes = fields.map((f) => f.code)
        const detected = detectEcommercePreset(headers)

        if (detected) {
          setSelectedPresetId(detected.id)
          setDetectedPresetName(detected.name)
          const presetMappings = applyPresetMappings(headers, detected, availableCodes)
          setColumnMappings(presetMappings)
        } else {
          setSelectedPresetId("")
          setDetectedPresetName(null)
          setColumnMappings(
            headers.map((value) => {
              const field = fields.find((f) => f.code.toLowerCase() === value.toLowerCase() || f.name.toLowerCase() === value.toLowerCase())
              return field?.code || ""
            })
          )
        }
      } else {
        setColumnMappings([])
      }
    }
  }, [parseState, fields])

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId)
    if (!presetId || csvData.length === 0) return

    const preset = ECOMMERCE_PRESETS.find((p) => p.id === presetId)
    if (preset) {
      const headers = csvData[0]
      const availableCodes = fields.map((f) => f.code)
      const mapped = applyPresetMappings(headers, preset, availableCodes)
      setColumnMappings(mapped)
    }
  }

  const handleAutoDetect = () => {
    if (csvData.length === 0) return
    const headers = csvData[0]
    const detected = detectEcommercePreset(headers)
    if (detected) {
      setSelectedPresetId(detected.id)
      setDetectedPresetName(detected.name)
      const availableCodes = fields.map((f) => f.code)
      setColumnMappings(applyPresetMappings(headers, detected, availableCodes))
    } else {
      alert("No matching e-commerce preset identified with high confidence. You can manually map columns below.")
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append("file", file)

    startTransition(async () => {
      await parseAction(formData)
    })
  }

  const handleMappingChange = (columnIndex: number, fieldCode: string) => {
    setColumnMappings((prev) => {
      const state = [...prev]
      state[columnIndex] = fieldCode
      return state
    })
  }

  const handleSave = async () => {
    if (csvData.length === 0) return

    if (!isAtLeastOneFieldMapped(columnMappings)) {
      alert("Please map at least one column to a field")
      return
    }

    const startIndex = csvSettings.skipHeader ? 1 : 0
    const processedRows = csvData.slice(startIndex).map((row) => {
      const processedRow: Record<string, unknown> = {}

      columnMappings.forEach((fieldCode, columnIndex) => {
        if (!fieldCode || !row[columnIndex]) return
        processedRow[fieldCode] = row[columnIndex]
      })

      return processedRow
    })

    const formData = new FormData()
    formData.append("rows", JSON.stringify(processedRows))
    formData.append("duplicateStrategy", duplicateStrategy)

    startTransition(async () => {
      await saveAction(formData)
    })
  }

  const handleReset = () => {
    setCSVData([])
    setColumnMappings([])
    setSelectedPresetId("")
    setDetectedPresetName(null)
  }

  return (
    <>
      {csvData.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 h-full min-h-[400px]">
          <p className="text-muted-foreground">Upload your CSV file to import orders and transactions</p>
          <div className="flex flex-row gap-5 mt-8">
            <div>
              <input type="file" accept=".csv" className="hidden" id="csv-file" onChange={handleFileChange} />
              <Button type="button" onClick={() => document.getElementById("csv-file")?.click()}>
                {isParsing ? "Parsing..." : <Upload className="mr-2" />} Import from CSV
              </Button>
            </div>
          </div>
          {parseState?.error && <FormError>{parseState.error}</FormError>}
        </div>
      )}

      {csvData.length > 0 && (
        <div className="flex flex-col gap-6">
          {/* Success Banner if import completed */}
          {saveState?.success && saveState.data && (
            <div className="p-6 border rounded-lg bg-green-50/10 border-green-500/30 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-green-600 font-semibold text-lg">
                <CheckCircle2 className="w-5 h-5" />
                Import Completed Successfully
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="p-3 bg-muted rounded-md border">
                  <div className="text-2xl font-bold">{saveState.data.totalProcessed}</div>
                  <div className="text-xs text-muted-foreground">Total Rows Processed</div>
                </div>
                <div className="p-3 bg-muted rounded-md border">
                  <div className="text-2xl font-bold text-green-500">{saveState.data.createdCount}</div>
                  <div className="text-xs text-muted-foreground">Newly Created</div>
                </div>
                <div className="p-3 bg-muted rounded-md border">
                  <div className="text-2xl font-bold text-amber-500">{saveState.data.skippedCount}</div>
                  <div className="text-xs text-muted-foreground">Skipped (Duplicates)</div>
                </div>
                <div className="p-3 bg-muted rounded-md border">
                  <div className="text-2xl font-bold text-blue-500">{saveState.data.updatedCount}</div>
                  <div className="text-xs text-muted-foreground">Updated / Overwritten</div>
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-2">
                <Button variant="outline" onClick={handleReset}>
                  Import Another File
                </Button>
                <Button onClick={() => router.push("/transactions")}>
                  View All Transactions
                </Button>
              </div>
            </div>
          )}

          {!saveState?.success && (
            <>
              <header className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                    Import {csvData.length} items from CSV
                  </h2>
                  {detectedPresetName && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Store className="w-4 h-4 text-primary" />
                      <span>Auto-detected:</span>
                      <Badge variant="outline" className="font-semibold text-primary">
                        {detectedPresetName}
                      </Badge>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="animate-spin mr-2" /> Importing...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2" /> Import {csvData.length} transactions
                      </>
                    )}
                  </Button>
                </div>
              </header>

              {saveState?.error && <FormError>{saveState.error}</FormError>}

              {/* Controls bar: Preset Selection and Deduplication Strategy */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-card">
                {/* Preset mapping selector */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold flex items-center gap-1.5">
                      <Store className="w-4 h-4" /> E-Commerce Platform Preset:
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoDetect}
                      className="text-xs flex items-center gap-1 text-primary hover:underline"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Re-detect
                    </button>
                  </div>
                  <select
                    className="p-2 text-sm border rounded-md bg-background"
                    value={selectedPresetId}
                    onChange={(e) => handlePresetChange(e.target.value)}
                  >
                    <option value="">Custom / Manual Mapping</option>
                    {ECOMMERCE_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-muted-foreground">
                    Automatically maps order ID, merchant, sales amounts, and payment dates for selected platforms.
                  </span>
                </div>

                {/* Duplicate Strategy selector */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold flex items-center gap-1.5">
                    <CopyCheck className="w-4 h-4" /> Duplicate Handling Strategy:
                  </label>
                  <select
                    className="p-2 text-sm border rounded-md bg-background"
                    value={duplicateStrategy}
                    onChange={(e) => setDuplicateStrategy(e.target.value as "skip" | "overwrite" | "keepBoth")}
                  >
                    <option value="skip">Skip duplicates (Safe default, no duplicate orders)</option>
                    <option value="overwrite">Overwrite existing records (Update order details)</option>
                    <option value="keepBoth">Keep both (Import all records unconditionally)</option>
                  </select>
                  <span className="text-xs text-muted-foreground">
                    Matches existing orders by amount, date, and order name or merchant.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    id="skip-header"
                    checked={csvSettings.skipHeader}
                    onChange={(e) => setCSVSettings({ ...csvSettings, skipHeader: e.target.checked })}
                  />
                  <span>First row is a header (do not import as transaction)</span>
                </label>
              </div>

              <div className="rounded-md border">
                <div className="relative w-full overflow-auto">
                  <table className="w-full caption-bottom text-sm">
                    <thead className="[&_tr]:border-b">
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        {csvData[0].map((_, index) => (
                          <th key={index} className="h-12 min-w-[200px] px-4 text-left align-middle font-medium">
                            <select
                              className="w-full p-2 border rounded-md bg-background text-sm font-normal"
                              value={columnMappings[index] || ""}
                              onChange={(e) => handleMappingChange(index, e.target.value)}
                            >
                              <option value="">Skip column</option>
                              {fields.map((field) => (
                                <option key={field.code} value={field.code}>
                                  {field.name}
                                </option>
                              ))}
                            </select>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                      {csvData.slice(0, MAX_PREVIEW_ROWS).map((row, rowIndex) => (
                        <tr
                          key={rowIndex}
                          className={`border-b transition-colors hover:bg-muted/50 ${
                            rowIndex === 0 && csvSettings.skipHeader ? "line-through text-muted-foreground bg-muted/20" : ""
                          }`}
                        >
                          {csvData[0].map((_, colIndex) => (
                            <td key={colIndex} className="p-4 align-middle">
                              {(row[colIndex] || "").toString().slice(0, 256)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {csvData.length > MAX_PREVIEW_ROWS && (
                <p className="text-muted-foreground text-sm">and {csvData.length - MAX_PREVIEW_ROWS} more entries...</p>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}

function isAtLeastOneFieldMapped(columnMappings: string[]) {
  return columnMappings.some((mapping) => mapping !== "")
}
