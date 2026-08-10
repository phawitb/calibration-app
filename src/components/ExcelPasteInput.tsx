'use client'
import { useState, useRef, useCallback } from 'react'

interface Props {
  /** Expected number of columns (0 = any) */
  expectedCols: number
  /** Column labels for preview table */
  columnLabels?: string[]
  /** Called with parsed 2D number array when user confirms import */
  onImport: (data: (number | null)[][]) => void
  /** Optional: current data to show count */
  currentDataCount?: number
  /** Button label */
  buttonLabel?: string
  /** Unit label (e.g. '°C', 'r/min') */
  unit?: string
}

/**
 * ExcelPasteInput — paste tab-separated data from Excel into a textarea,
 * preview it, then import into a numeric matrix.
 *
 * Supports:
 * - Tab-separated columns (Excel default copy format)
 * - Auto-detect row/column count
 * - Preview before import with validation
 * - Any number of rows; only the column count is validated
 */
export default function ExcelPasteInput({
  expectedCols,
  columnLabels,
  onImport,
  currentDataCount,
  buttonLabel = 'วางข้อมูลจาก Excel',
  unit,
}: Props) {
  const [open, setOpen] = useState(false)
  const [rawText, setRawText] = useState('')
  const [parsed, setParsed] = useState<(number | null)[][] | null>(null)
  const [error, setError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const parseText = useCallback((text: string) => {
    if (!text.trim()) {
      setParsed(null)
      setError('')
      return
    }

    // Split by newlines, then by tabs
    const lines = text.trim().split(/\r?\n/)
    const matrix: (number | null)[][] = []

    for (const line of lines) {
      if (!line.trim()) continue
      const cells = line.split('\t')
      const row = cells.map(cell => {
        const trimmed = cell.trim()
        if (trimmed === '' || trimmed === '-' || trimmed === 'N/A') return null
        const num = Number(trimmed)
        return isNaN(num) ? null : num
      })
      matrix.push(row)
    }

    if (matrix.length === 0) {
      setError('ไม่พบข้อมูล')
      setParsed(null)
      return
    }

    // Validate column count
    const detectedCols = Math.max(...matrix.map(r => r.length))
    if (expectedCols > 0 && detectedCols !== expectedCols) {
      setError(`จำนวนคอลัมน์ไม่ตรง: ตรวจพบ ${detectedCols} คอลัมน์ แต่ต้องการ ${expectedCols} คอลัมน์`)
      setParsed(null)
      return
    }

    // Pad rows to same length
    const normalizedMatrix = matrix.map(row => {
      while (row.length < detectedCols) row.push(null)
      return row
    })

    setError('')
    setParsed(normalizedMatrix)
  }, [expectedCols])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    setRawText(text)
    parseText(text)
  }, [parseText])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setRawText(text)
    parseText(text)
  }, [parseText])

  const handleImport = useCallback(() => {
    if (!parsed) return
    onImport(parsed)
    setOpen(false)
    setRawText('')
    setParsed(null)
    setError('')
  }, [parsed, onImport])

  const handleClose = useCallback(() => {
    setOpen(false)
    setRawText('')
    setParsed(null)
    setError('')
  }, [])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setTimeout(() => textareaRef.current?.focus(), 100)
        }}
        className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-300 rounded px-2 py-1 hover:bg-blue-50 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {buttonLabel}
        {currentDataCount != null && currentDataCount > 0 && (
          <span className="text-gray-400 ml-1">({currentDataCount} rows)</span>
        )}
      </button>
    )
  }

  const detectedRows = parsed?.length ?? 0
  const detectedCols = parsed ? Math.max(...parsed.map(r => r.length)) : 0
  const nonNullCount = parsed ? parsed.flat().filter(v => v !== null).length : 0

  return (
    <div className="border border-blue-300 rounded-lg bg-blue-50 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-blue-900 flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          วางข้อมูลจาก Excel
        </h4>
        <button type="button" onClick={handleClose} className="text-gray-400 hover:text-gray-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <p className="text-xs text-blue-700">
        Copy cells จาก Excel แล้ววางที่นี่ (Ctrl+V / Cmd+V)
        {expectedCols > 0 && (
          <span className="ml-1">— ต้องการ {expectedCols} คอลัมน์</span>
        )}
        {unit && <span className="ml-1">({unit})</span>}
      </p>

      <textarea
        ref={textareaRef}
        className="w-full h-24 text-xs font-mono border border-blue-200 rounded p-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
        placeholder="วางข้อมูลที่นี่... (tab-separated from Excel)"
        value={rawText}
        onChange={handleChange}
        onPaste={handlePaste}
      />

      {error && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          {error}
        </p>
      )}

      {parsed && parsed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-green-700">
            ตรวจพบ: {detectedRows} แถว x {detectedCols} คอลัมน์ ({nonNullCount} ค่า)
          </p>

          {/* Preview table — show first 10 rows max */}
          <div className="overflow-x-auto max-h-48 overflow-y-auto">
            <table className="text-xs border-collapse w-full">
              <thead>
                <tr className="bg-blue-100">
                  <th className="border border-blue-200 px-1.5 py-0.5 text-left w-8">#</th>
                  {Array.from({ length: detectedCols }).map((_, i) => (
                    <th key={i} className="border border-blue-200 px-1.5 py-0.5 text-center">
                      {columnLabels?.[i] || `Col ${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 10).map((row, rIdx) => (
                  <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-blue-50/50'}>
                    <td className="border border-blue-200 px-1.5 py-0.5 text-gray-400">{rIdx + 1}</td>
                    {row.map((val, cIdx) => (
                      <td key={cIdx} className="border border-blue-200 px-1.5 py-0.5 text-center">
                        {val !== null ? val : <span className="text-gray-300">-</span>}
                      </td>
                    ))}
                  </tr>
                ))}
                {parsed.length > 10 && (
                  <tr>
                    <td colSpan={detectedCols + 1} className="border border-blue-200 px-1.5 py-0.5 text-center text-gray-400">
                      ... อีก {parsed.length - 10} แถว
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={handleClose}
              className="text-xs px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100">
              ยกเลิก
            </button>
            <button type="button" onClick={handleImport}
              className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">
              นำเข้าข้อมูล ({detectedRows} แถว)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
