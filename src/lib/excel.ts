import ExcelJS from 'exceljs'
import { NextResponse } from 'next/server'
import { inlineContentDisposition } from '@/lib/contentDisposition'

export type ExcelColumn = { header: string; key: string; width?: number }
export type ExcelSheet = {
  name: string
  columns: ExcelColumn[]
  rows: Record<string, unknown>[]
  /** แถวสรุป (เช่น รวมทั้งสิ้น) ต่อท้ายตาราง จะถูกทำตัวหนา */
  footer?: Record<string, unknown>
  /** ข้อความหัวรายงานเหนือตาราง (ชื่อรายงาน / ตัวกรอง) */
  title?: string[]
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const MAX_SHEET_NAME = 31

function safeSheetName(name: string, index: number, used: Set<string>) {
  let base = String(name || `Sheet${index + 1}`).replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, MAX_SHEET_NAME) || `Sheet${index + 1}`
  let candidate = base
  let n = 2
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n++})`
    candidate = base.slice(0, MAX_SHEET_NAME - suffix.length) + suffix
  }
  used.add(candidate.toLowerCase())
  return candidate
}

function cellValue(value: unknown): ExcelJS.CellValue {
  if (value == null) return ''
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value
  if (typeof value === 'number') return Number.isFinite(value) ? value : ''
  if (typeof value === 'boolean') return value ? 'ใช่' : 'ไม่ใช่'
  return String(value)
}

/** สร้างไฟล์ Excel จากหลายชีต หัวตารางตัวหนา + autofilter + ฟอนต์ไทย */
export async function buildWorkbook(sheets: ExcelSheet[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Calibration App'
  wb.created = new Date()
  const used = new Set<string>()

  sheets.forEach((sheet, index) => {
    const ws = wb.addWorksheet(safeSheetName(sheet.name, index, used), {
      views: [{ state: 'frozen', ySplit: (sheet.title?.length || 0) + 1 }],
    })
    const columnCount = Math.max(1, sheet.columns.length)
    let rowCursor = 0

    for (const line of sheet.title || []) {
      rowCursor += 1
      const row = ws.getRow(rowCursor)
      row.getCell(1).value = line
      row.getCell(1).font = { name: 'TH Sarabun New', size: 16, bold: rowCursor === 1 }
      if (columnCount > 1) ws.mergeCells(rowCursor, 1, rowCursor, columnCount)
    }

    rowCursor += 1
    const headerRow = ws.getRow(rowCursor)
    sheet.columns.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1)
      cell.value = col.header
      cell.font = { name: 'TH Sarabun New', size: 14, bold: true }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
      const column = ws.getColumn(i + 1)
      column.width = col.width ?? Math.min(60, Math.max(10, col.header.length + 4))
    })
    const headerRowNumber = rowCursor

    for (const data of sheet.rows) {
      rowCursor += 1
      const row = ws.getRow(rowCursor)
      sheet.columns.forEach((col, i) => {
        const cell = row.getCell(i + 1)
        cell.value = cellValue(data[col.key])
        cell.font = { name: 'TH Sarabun New', size: 14 }
        if (cell.value instanceof Date) cell.numFmt = 'dd/mm/yyyy'
        else if (typeof cell.value === 'number') cell.numFmt = Number.isInteger(cell.value) ? '#,##0' : '#,##0.00'
        cell.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'thin' }, right: { style: 'thin' } }
      })
    }

    if (sheet.footer) {
      rowCursor += 1
      const row = ws.getRow(rowCursor)
      sheet.columns.forEach((col, i) => {
        const cell = row.getCell(i + 1)
        cell.value = cellValue(sheet.footer?.[col.key])
        cell.font = { name: 'TH Sarabun New', size: 14, bold: true }
        if (typeof cell.value === 'number') cell.numFmt = Number.isInteger(cell.value) ? '#,##0' : '#,##0.00'
        cell.border = { top: { style: 'thin' }, bottom: { style: 'double' }, left: { style: 'thin' }, right: { style: 'thin' } }
      })
    }

    if (sheet.columns.length) {
      ws.autoFilter = {
        from: { row: headerRowNumber, column: 1 },
        to: { row: Math.max(headerRowNumber, headerRowNumber + sheet.rows.length), column: sheet.columns.length },
      }
    }
  })

  const data = await wb.xlsx.writeBuffer()
  return Buffer.from(data as ArrayBuffer)
}

/** contentDisposition.ts มีเฉพาะ inline จึงสลับ disposition เป็น attachment โดยคงการ encode ชื่อไฟล์ไว้ */
export function attachmentContentDisposition(fileName: string) {
  return inlineContentDisposition(fileName).replace(/^inline;/, 'attachment;')
}

/** ตอบกลับไฟล์ .xlsx เป็น attachment พร้อมปิด cache */
export function xlsxResponse(buffer: Buffer, fileName: string) {
  const name = fileName.toLowerCase().endsWith('.xlsx') ? fileName : `${fileName}.xlsx`
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': attachmentContentDisposition(name),
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, no-store',
    },
  })
}

/** ชื่อไฟล์แบบ `prefix_YYYYMMDD-HHmm.xlsx` */
export function stampedFileName(prefix: string, date = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${prefix}_${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}.xlsx`
}
