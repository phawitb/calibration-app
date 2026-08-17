import { formatPdfDate } from './pdfDate'

export const PDF_LABELS = {
  manufacturer: 'Manufacturer',
  measureUnit: 'Measure Unit',
} as const

type InfoCell = { label: string; value: string }

export type PdfInfoRow = {
  left: InfoCell
  right?: InfoCell
  full?: boolean
}

const display = (value: unknown) => (
  value === null || value === undefined || value === '' ? '-' : String(value)
)

export function buildPdfCertificateInfo(record: any, customerName: string, location: string) {
  const deviceRows: PdfInfoRow[] = [
    { left: { label: 'Equipment', value: display(record.deviceName) }, right: { label: 'Section', value: display(record.section) } },
    { left: { label: PDF_LABELS.manufacturer, value: display(record.brand) }, right: { label: 'Model', value: display(record.model) } },
    { left: { label: 'Serial No.', value: display(record.serialNo) }, right: { label: 'Amed No.', value: display(record.amedNo) } },
    { left: { label: 'Hospital No.', value: display(record.hpNumber) }, full: true },
  ]
  const customerRows: PdfInfoRow[] = [
    { left: { label: 'Customer', value: customerName }, full: true },
    { left: { label: 'Address', value: display(record.address) }, full: true },
    { left: { label: 'Received No.', value: display(record.receivedN) }, right: { label: 'Issued date', value: formatPdfDate(record.issuedDate) } },
    { left: { label: 'Received date', value: formatPdfDate(record.receivedDate) }, right: { label: 'Cal. date', value: formatPdfDate(record.calDate) } },
    { left: { label: 'Location', value: location }, full: true },
  ]

  return { deviceRows, customerRows }
}
