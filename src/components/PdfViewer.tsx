'use client'
import { PDFViewer, BlobProvider, Document, Page, Text, View, Image, StyleSheet, Font, pdf } from '@react-pdf/renderer'
import { Component, useEffect, useState, type ReactNode } from 'react'
import { fmt } from '@/lib/uncertainty'

/** WOFF จาก /public/fonts — โหลด same-origin กว่า woff2 แบบ remote (มักทำให้ @react-pdf ไม่ render) */
if (typeof window !== 'undefined') {
  try {
    Font.register({
      family: 'NotoSansThai',
      fonts: [
        { src: '/fonts/noto-sans-thai-400.woff', fontWeight: 400 },
        { src: '/fonts/noto-sans-thai-700.woff', fontWeight: 700 },
      ],
    })
  } catch {
    // HMR อาจ register ซ้ำ
  }
}

type SummaryRow = {
  ucName: string
  point: number
  avgUUC: number
  avgSTDRead: number
  correction: number
  uc: number
  U: number
  k: number
  unit: string
}

const s = StyleSheet.create({
  page: { fontFamily: 'NotoSansThai', fontSize: 9, padding: 30, paddingBottom: 50, backgroundColor: '#fff' },
  /* ---- header ---- */
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  logo: { width: 52, height: 52, marginRight: 8 },
  orgName: { fontSize: 10, fontWeight: 700, color: '#111' },
  orgAddr: { fontSize: 8, color: '#111', marginTop: 1 },
  pageNo: { fontSize: 8, textAlign: 'right', color: '#111', marginBottom: 2 },
  certTitle: { fontSize: 14, fontWeight: 700, textAlign: 'center', marginTop: 6, marginBottom: 6, color: '#111' },
  certNo: { fontSize: 10, textAlign: 'right', marginBottom: 6 },
  /* ---- bordered info table ---- */
  infoTable: { border: '1pt solid #111', marginBottom: 4 },
  infoRow: { flexDirection: 'row', borderBottom: '0.5pt solid #999', minHeight: 16 },
  infoRowLast: { flexDirection: 'row', minHeight: 16 },
  infoLabel: { fontSize: 8, fontWeight: 700, paddingHorizontal: 4, paddingVertical: 2, color: '#111' },
  infoValue: { fontSize: 8, paddingHorizontal: 4, paddingVertical: 2, color: '#111' },
  infoLeft: { width: '50%', flexDirection: 'row' },
  infoRight: { width: '50%', flexDirection: 'row' },
  infoLabelW: { width: 90 },
  infoLabelW2: { width: 80 },
  infoValueFlex: { flex: 1 },
  infoFull: { width: '100%', flexDirection: 'row' },
  /* ---- signatures ---- */
  sigRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 },
  sigBox: { width: '40%', alignItems: 'center' },
  sigImg: { maxHeight: 40, maxWidth: 130, objectFit: 'contain', marginBottom: 2 },
  sigLine: { width: '100%', borderTop: '1pt solid #111', marginTop: 4 },
  sigText: { fontSize: 8, marginTop: 3, textAlign: 'center', color: '#111' },
  /* ---- calibration method & disclaimer ---- */
  methodText: { fontSize: 9, marginTop: 10, marginBottom: 6, color: '#111' },
  disclaimer: { fontSize: 7.5, color: '#111', marginTop: 4, lineHeight: 1.4, textIndent: 20 },
  /* ---- page 2+ header ---- */
  p2Header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  p2HeaderText: { fontSize: 9, color: '#111' },
  sectionTitle: { fontSize: 9.5, fontWeight: 700, marginTop: 6, marginBottom: 3, color: '#111' },
  bodyText: { fontSize: 8, color: '#111', lineHeight: 1.35 },
  /* ---- tables ---- */
  table: { border: '0.5pt solid #111', marginTop: 3, marginBottom: 6 },
  tRow: { flexDirection: 'row', borderBottom: '0.5pt solid #999' },
  tRowLast: { flexDirection: 'row' },
  th: { fontSize: 7.5, fontWeight: 700, paddingVertical: 2, paddingHorizontal: 3, textAlign: 'center', color: '#111' },
  td: { fontSize: 7.5, paddingVertical: 2, paddingHorizontal: 3, textAlign: 'center', color: '#111' },
  /* ---- footer ---- */
  footer: { position: 'absolute', bottom: 16, left: 30, right: 30 },
  footerText: { fontSize: 7, color: '#666' },
})

/** Format value — decimals is set per-PDF via CalibrationPDF prop */
let _pdfDecimals = 4
function fmtVal(n: number | undefined | null, decimals?: number) {
  if (n == null || Number.isNaN(Number(n))) return '-'
  return fmt(Number(n), decimals ?? _pdfDecimals)
}

function fmtDate(d: any) {
  if (!d) return '-'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '-'
  const dd = String(dt.getDate()).padStart(2, '0')
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const yyyy = dt.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/** Build per-UC sections for result pages */
function buildUcSections(record: any, summaryRows: SummaryRow[] | null) {
  const ucKeys = ['uc1', 'uc2', 'uc3', 'uc4', 'uc5', 'uc6', 'ucT'] as const
  const sections: {
    index: number
    std: any
    measurement: string
    unit: string
    calPoints: { point: any; avgUUC: number; avgSTD: number; correction: number; uncertainty: number }[]
  }[] = []

  let idx = 0
  for (const key of ucKeys) {
    const uc = record[key]
    if (!uc?.std?.name && !uc?.std?.no) continue
    const pts = uc.calPoints as any[] | undefined
    if (!pts || pts.length === 0) continue

    idx++
    const ucSummary = summaryRows?.filter((sr) => sr.ucName === key) || []
    const calPoints = pts.map((pt: any) => {
      const matchRow = ucSummary.find((sr) => String(sr.point) === String(pt.point))
      const readings = (pt.readings || []).filter((v: any) => v !== '' && v != null).map(Number)
      const standards = (pt.standards || []).filter((v: any) => v !== '' && v != null).map(Number)
      const avgUUC = matchRow ? matchRow.avgUUC : readings.length ? readings.reduce((a: number, b: number) => a + b, 0) / readings.length : NaN
      const avgSTD = matchRow ? matchRow.avgSTDRead : standards.length ? standards.reduce((a: number, b: number) => a + b, 0) / standards.length : NaN
      const correction = matchRow ? matchRow.correction : NaN
      const uncertainty = matchRow ? matchRow.U : NaN
      return { point: pt.point, avgUUC, avgSTD, correction, uncertainty }
    })

    sections.push({
      index: idx,
      std: uc.std,
      measurement: uc.std?.measurement || '-',
      unit: uc.std?.unit || '-',
      calPoints,
    })
  }
  return sections
}

function CalibrationPDF({
  record,
  summaryRows,
  calibratorSignature,
  approverSignature,
  decimals = 4,
}: {
  record: any
  summaryRows: SummaryRow[] | null
  calibratorSignature?: string | null
  approverSignature?: string | null
  decimals?: number
}) {
  _pdfDecimals = decimals
  const r = record
  const f = (v: any) => (v === null || v === undefined || v === '' ? '-' : String(v))
  const certApproved = r.approvalStatus === 'approved'
  const requestedApproverName = f(r.requestedApproverName)
  const approvedDisplayName = certApproved ? f(r.approve) : requestedApproverName
  const std1 = r.std1 || {}
  const ucSections = buildUcSections(r, summaryRows)
  const totalPages = ucSections.length > 4 ? 3 : 2
  // Extract English-only from unitName: "Fort Surasi Hospital(รพ.ค่ายสุรสีห์)" → "Fort Surasi Hospital"
  const customerEn = String(r.unitName || '').replace(/\(.*\)$/, '').trim() || f(r.unitName)
  const locationDisplay = (r.location === 'lab' || r.location === 'Lab') ? 'Medical Depot Division of Royal Thai Army Medical Department' : (r.location === 'outside' ? customerEn : f(r.location))

  /* ---- Reusable info row ---- */
  const InfoRow2 = ({ l1, v1, l2, v2, last }: { l1: string; v1: string; l2?: string; v2?: string; last?: boolean }) => (
    <View style={last ? s.infoRowLast : s.infoRow}>
      <View style={s.infoLeft}>
        <Text style={[s.infoLabel, s.infoLabelW]}>{l1}</Text>
        <Text style={[s.infoValue, s.infoValueFlex]}>{v1}</Text>
      </View>
      {l2 != null && (
        <View style={s.infoRight}>
          <Text style={[s.infoLabel, s.infoLabelW2]}>{l2}</Text>
          <Text style={[s.infoValue, s.infoValueFlex]}>{v2 || '-'}</Text>
        </View>
      )}
    </View>
  )

  const InfoRowFull = ({ label, value, last }: { label: string; value: string; last?: boolean }) => (
    <View style={last ? s.infoRowLast : s.infoRow}>
      <View style={s.infoFull}>
        <Text style={[s.infoLabel, s.infoLabelW]}>{label}</Text>
        <Text style={[s.infoValue, s.infoValueFlex]}>{value}</Text>
      </View>
    </View>
  )

  /* ---- Page 2+ header ---- */
  const PageHeader = ({ pageNum, totalPg }: { pageNum: number; totalPg: number }) => (
    <View style={s.p2Header}>
      <Text style={s.p2HeaderText}>Amed No. {f(r.amedNo)}</Text>
      <Text style={s.p2HeaderText}>Certificate No. {f(r.certNo)}</Text>
      <Text style={s.p2HeaderText}>Page {pageNum}/{totalPg}</Text>
    </View>
  )

  return (
    <Document>
      {/* ===================== PAGE 1 ===================== */}
      <Page size="A4" style={s.page}>
        <Text style={s.pageNo}>Page 1/{totalPages}</Text>

        <View style={s.headerRow}>
          <Image style={s.logo} src="/logo.jpg" />
          <View style={{ flex: 1 }}>
            <Text style={s.orgName}>MEDICAL DEPOT DIVISION OF ROYAL THAI ARMY MEDICAL DEPARTMENT</Text>
            <Text style={s.orgAddr}>8 Phaya Thai Road, Thung Phaya Thai, Ratchathewi, Bangkok, 10400 Thailand</Text>
          </View>
        </View>

        <Text style={s.certTitle}>Calibration Certificate</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 }}>
          <Text style={{ fontSize: 10, fontWeight: 700 }}>Certificate </Text>
          <Text style={{ fontSize: 10 }}>{f(r.certNo)}</Text>
        </View>

        {/* Device info table */}
        <View style={s.infoTable}>
          <InfoRow2 l1="Equipment" v1={f(r.deviceName)} l2="Section" v2={f(r.section)} />
          <InfoRow2 l1="Manufacture" v1={f(r.brand)} l2="Model" v2={f(r.model)} />
          <InfoRow2 l1="Serial No." v1={f(r.serialNo)} l2="Amed No." v2={f(r.amedNo)} />
        </View>

        {/* Customer info table */}
        <View style={s.infoTable}>
          <InfoRowFull label="Hospital No" value={f(r.hpNumber)} />
          <InfoRowFull label="Customer" value={customerEn} />
          <InfoRowFull label="Address" value={f(r.address)} />
          <InfoRow2 l1="Received N" v1={f(r.receivedN)} l2="Issued date" v2={fmtDate(r.issuedDate)} />
          <InfoRow2 l1="Received date" v1={fmtDate(r.receivedDate)} l2="Cal. date" v2={fmtDate(r.calDate)} />
          <InfoRowFull label="Location" value={locationDisplay} />
          <View style={s.infoRow}>
            <View style={s.infoLeft}>
              <Text style={[s.infoLabel, s.infoLabelW]}>Environment</Text>
              <Text style={[s.infoValue, s.infoValueFlex]}></Text>
            </View>
            <View style={s.infoRight}>
              <Text style={[s.infoLabel, { width: 70 }]}>Temperature</Text>
              <Text style={[s.infoValue, { width: 40, textAlign: 'right' }]}>{fmtVal(r.lapTemp, 1)}</Text>
              <Text style={[s.infoValue, { marginLeft: 4 }]}>°C</Text>
            </View>
          </View>
          <View style={s.infoRowLast}>
            <View style={s.infoLeft}>
              <Text style={[s.infoLabel, s.infoLabelW]}></Text>
              <Text style={[s.infoValue, s.infoValueFlex]}></Text>
            </View>
            <View style={s.infoRight}>
              <Text style={[s.infoLabel, { width: 70 }]}>Humidity</Text>
              <Text style={[s.infoValue, { width: 40, textAlign: 'right' }]}>{fmtVal(r.lapHumid, 1)}</Text>
              <Text style={[s.infoValue, { marginLeft: 4 }]}>%RH</Text>
            </View>
          </View>
        </View>

        {/* Calibration method */}
        <Text style={s.methodText}>
          <Text style={{ fontWeight: 700 }}>Calibration method</Text> : By comparison with standard tools. This certificate is traceable to the SI units.
        </Text>

        {/* Signatures */}
        <View style={s.sigRow}>
          <View style={s.sigBox}>
            {calibratorSignature ? <Image style={s.sigImg} src={calibratorSignature} /> : <View style={{ height: 36 }} />}
            <View style={s.sigLine} />
            <Text style={s.sigText}>{f(r.calibrate)}</Text>
            <Text style={s.sigText}>Calibrate</Text>
          </View>
          <View style={s.sigBox}>
            {certApproved && approverSignature ? <Image style={s.sigImg} src={approverSignature} /> : <View style={{ height: 36 }} />}
            <View style={s.sigLine} />
            <Text style={s.sigText}>{approvedDisplayName}</Text>
            <Text style={s.sigText}>Approve</Text>
          </View>
        </View>

        {/* Disclaimer */}
        <Text style={s.disclaimer}>
          This certificate is valid only to the item calibrated on date and place of calibration. The report shall not be reproduced except in full without approval of Medical depot division of royal Thai army medical department.
        </Text>
        <Text style={s.disclaimer}>
          This certificate is issued the units of measurement according to the International System of units (SI unit). It provides traceability of measurement to international or national standard or other recognized national standard laboratories.
        </Text>
        <Text style={s.disclaimer}>
          The measurement uncertainty stated is the expanded uncertainty which is obtained from the standard uncertainty multiplied by the coverage factor ( k = 2 ) to provide a level of confidence of approximately 95%. It is determined in accordance with the Guide to Expression of Uncertainty in Measurement (GUM).
        </Text>
      </Page>

      {/* ===================== PAGE 2+ ===================== */}
      <Page size="A4" style={s.page} wrap>
        <PageHeader pageNum={2} totalPg={totalPages} />

        {/* Environmental – Std1 */}
        <Text style={s.sectionTitle}>Environmental</Text>
        <Text style={[s.bodyText, { fontWeight: 700 }]}>Reference Standard Instrument</Text>
        {(std1.name || std1.no) && (
          <Text style={[s.bodyText, { marginBottom: 2 }]}>- {f(std1.name)}</Text>
        )}
        <View style={s.table}>
          <View style={s.tRow}>
            <Text style={[s.th, { width: '25%' }]}>Manufacture</Text>
            <Text style={[s.th, { width: '15%' }]}>Model</Text>
            <Text style={[s.th, { width: '20%' }]}>Serial NO.</Text>
            <Text style={[s.th, { width: '20%' }]}>Cert. NO.</Text>
            <Text style={[s.th, { width: '20%' }]}>Cal.Date</Text>
          </View>
          <View style={s.tRowLast}>
            <Text style={[s.td, { width: '25%' }]}>{f(std1.manufacture)}</Text>
            <Text style={[s.td, { width: '15%' }]}>{f(std1.model)}</Text>
            <Text style={[s.td, { width: '20%' }]}>{f(std1.serialNo)}</Text>
            <Text style={[s.td, { width: '20%' }]}>{f(std1.certNo)}</Text>
            <Text style={[s.td, { width: '20%' }]}>{f(std1.calDate)}</Text>
          </View>
        </View>

        {/* Temp / Humidity min-max */}
        <View style={s.table}>
          <View style={s.tRow}>
            <Text style={[s.th, { width: '20%' }]}>Temp ( °C )</Text>
            <Text style={[s.th, { width: '15%' }]}>Min.Value</Text>
            <Text style={[s.th, { width: '15%' }]}>Max.Value</Text>
            <Text style={[s.th, { width: '20%' }]}>Humidity(%)</Text>
            <Text style={[s.th, { width: '15%' }]}>Min.Value</Text>
            <Text style={[s.th, { width: '15%' }]}>Max.Value</Text>
          </View>
          <View style={s.tRowLast}>
            <Text style={[s.td, { width: '20%' }]}></Text>
            <Text style={[s.td, { width: '15%' }]}>{fmtVal(std1.tMin, 1)}</Text>
            <Text style={[s.td, { width: '15%' }]}>{fmtVal(std1.tMax, 1)}</Text>
            <Text style={[s.td, { width: '20%' }]}></Text>
            <Text style={[s.td, { width: '15%' }]}>{fmtVal(std1.hMin, 1)}</Text>
            <Text style={[s.td, { width: '15%' }]}>{fmtVal(std1.hMax, 1)}</Text>
          </View>
        </View>

        {/* Calibration Procedure */}
        <Text style={s.sectionTitle}>Calibration Procedure</Text>
        <Text style={s.bodyText}>
          This calibration was performed by direct measurement of the unit under calibration using calibrated standard instrument. The data was recorded in steady state at the calibrate point values.
        </Text>

        {/* Result of Calibration */}
        <Text style={[s.sectionTitle, { marginTop: 8 }]}>Result of Calibration</Text>
        <Text style={[s.bodyText, { fontWeight: 700, marginBottom: 4 }]}>
          STD = Standard Instrument  UUC = Unit Under Calibration
        </Text>

        {/* Per-UC result tables */}
        {ucSections.map((sec) => {
          const colW = { left: '48%', model: '12%', serial: '13%', cert: '14%', caldt: '13%' }
          return (
          <View key={sec.index} wrap={false} style={{ marginBottom: 10 }}>
            {/* Row 1: header labels */}
            <View style={{ flexDirection: 'row' }}>
              <Text style={[s.bodyText, { fontWeight: 700, width: colW.left }]}>
                Reference Standard Instrument {sec.index}
              </Text>
              <Text style={[s.bodyText, { fontWeight: 700, width: colW.model }]}>Model</Text>
              <Text style={[s.bodyText, { fontWeight: 700, width: colW.serial }]}>Serial NO.</Text>
              <Text style={[s.bodyText, { fontWeight: 700, width: colW.cert }]}>Cert. NO.</Text>
              <Text style={[s.bodyText, { fontWeight: 700, width: colW.caldt }]}>Cal.Date</Text>
            </View>
            {/* Row 2: instrument values */}
            <View style={{ flexDirection: 'row', marginBottom: 2 }}>
              <Text style={[s.bodyText, { width: colW.left }]}>- {f(sec.std.name)}</Text>
              <Text style={[s.bodyText, { width: colW.model }]}>{f(sec.std.model)}</Text>
              <Text style={[s.bodyText, { width: colW.serial }]}>{f(sec.std.serialNo)}</Text>
              <Text style={[s.bodyText, { width: colW.cert }]}>{f(sec.std.certNo)}</Text>
              <Text style={[s.bodyText, { width: colW.caldt }]}>{f(sec.std.calDate)}</Text>
            </View>

            {/* Measurement row */}
            <View style={{ flexDirection: 'row', marginBottom: 3 }}>
              <Text style={[s.bodyText, { fontWeight: 700, width: 80 }]}>Measurement</Text>
              <Text style={[s.bodyText, { width: 90 }]}>{sec.measurement}</Text>
              <Text style={[s.bodyText, { fontWeight: 700, width: 80 }]}>Meausre Unit</Text>
              <Text style={[s.bodyText, { width: 60 }]}>{sec.unit}</Text>
              <Text style={[s.bodyText, { fontWeight: 700, width: 50 }]}>Remark</Text>
              <Text style={s.bodyText}>-</Text>
            </View>

            {/* Cal point table */}
            <View style={s.table}>
              <View style={s.tRow}>
                <Text style={[s.th, { width: '20%' }]}>Cal.point</Text>
                <Text style={[s.th, { width: '20%' }]}>UUC reading</Text>
                <Text style={[s.th, { width: '20%' }]}>STD reading</Text>
                <Text style={[s.th, { width: '20%' }]}>Correction</Text>
                <Text style={[s.th, { width: '20%' }]}>± Uncertainty</Text>
              </View>
              {/* Units row */}
              <View style={s.tRow}>
                <Text style={[s.td, { width: '20%' }]}>{sec.unit}</Text>
                <Text style={[s.td, { width: '20%' }]}>{sec.unit}</Text>
                <Text style={[s.td, { width: '20%' }]}>{sec.unit}</Text>
                <Text style={[s.td, { width: '20%' }]}>{sec.unit}</Text>
                <Text style={[s.td, { width: '20%' }]}>{sec.unit}</Text>
              </View>
              {/* Data rows */}
              {sec.calPoints.map((cp, i) => (
                <View key={i} style={i === sec.calPoints.length - 1 ? s.tRowLast : s.tRow}>
                  <Text style={[s.td, { width: '20%' }]}>{cp.point != null ? String(cp.point) : '-'}</Text>
                  <Text style={[s.td, { width: '20%' }]}>{fmtVal(cp.avgUUC)}</Text>
                  <Text style={[s.td, { width: '20%' }]}>{fmtVal(cp.avgSTD)}</Text>
                  <Text style={[s.td, { width: '20%' }]}>{fmtVal(cp.correction)}</Text>
                  <Text style={[s.td, { width: '20%' }]}>{fmtVal(cp.uncertainty)}</Text>
                </View>
              ))}
            </View>
          </View>
          )
        })}

        {/* Remarks */}
        {Array.isArray(r.remarks) && r.remarks.some((rm: string) => rm) && (
          <View style={{ marginTop: 4 }}>
            <Text style={[s.bodyText, { fontWeight: 700, marginBottom: 2 }]}>Remark</Text>
            {r.remarks.filter(Boolean).map((rm: string, i: number) => (
              <Text key={i} style={[s.bodyText, { marginBottom: 1 }]}>- {rm}</Text>
            ))}
          </View>
        )}
      </Page>
    </Document>
  )
}

class PdfRenderErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: '' }

  static getDerivedStateFromError(err: Error) {
    return { hasError: true, message: err?.message || 'Unknown' }
  }

  componentDidCatch() {}

  render() {
    if (this.state.hasError) {
      return (
        <div className="card p-6 space-y-2">
          <p className="text-red-700 font-medium">แสดง PDF ตัวอย่างไม่สำเร็จ</p>
          <p className="text-sm text-gray-600 break-all">{this.state.message}</p>
          <p className="text-xs text-gray-500">ลองรีเฟรช หรือรัน <code className="bg-gray-100 px-1">npm run clean</code> แล้ว dev ใหม่</p>
        </div>
      )
    }
    return this.props.children
  }
}

export default function PdfViewer({ record, recordId }: { record: any; recordId: string }) {
  const [mounted, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [decimals, setDecimals] = useState(4)
  const [summaryRows, setSummaryRows] = useState<SummaryRow[] | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState(false)
  const [calibratorSignature, setCalibratorSignature] = useState<string | null | undefined>(undefined)
  const [approverSignature, setApproverSignature] = useState<string | null | undefined>(undefined)
  const [archiveDone, setArchiveDone] = useState(false)

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!recordId) {
      setSummaryRows(null)
      return
    }
    let cancel = false
    setSummaryLoading(true)
    setSummaryError(false)
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 60_000)
    fetch(`/api/records/${recordId}/calculate`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('calculate failed'))))
      .then((data) => {
        if (cancel) return
        if (Array.isArray(data.summary) && data.summary.length > 0) {
          // SbCal: use summary directly
          setSummaryRows(data.summary)
        } else if (data.isoResult?.calPointSummaries?.length) {
          // ISO: build summary rows from isoResult
          const rows: SummaryRow[] = []
          for (const cps of data.isoResult.calPointSummaries) {
            for (const sr of cps.sensorResults) {
              rows.push({
                ucName: data.isoResult.sensorResults.length > 1 ? `S${sr.sensorIndex + 1}` : data.isoResult.isoMethodCode || 'ISO',
                point: cps.point,
                avgUUC: sr.avgUUC,
                avgSTDRead: sr.avgSTDRead,
                correction: sr.correction,
                uc: sr.uc,
                U: sr.U,
                k: sr.k,
                unit: data.isoResult.unit || '',
              })
            }
          }
          setSummaryRows(rows)
        } else {
          setSummaryRows([])
        }
        setSummaryError(false)
      })
      .catch(() => {
        if (!cancel) {
          setSummaryRows([])
          setSummaryError(true)
        }
      })
      .finally(() => {
        clearTimeout(t)
        if (!cancel) setSummaryLoading(false)
      })
    return () => {
      cancel = true
      controller.abort()
    }
  }, [recordId])

  useEffect(() => {
    setArchiveDone(false)
  }, [recordId, record?.certNo])

  useEffect(() => {
    if (!recordId) {
      setCalibratorSignature(null)
      setApproverSignature(null)
      return
    }
    let cancel = false
    fetch(`/api/records/${recordId}/signatures`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancel || !data) return
        setCalibratorSignature(data.calibratorSignature ?? null)
        setApproverSignature(
          data.showApproverSignature ? (data.approverSignature ?? null) : null
        )
      })
      .catch(() => {
        if (!cancel) {
          setCalibratorSignature(null)
          setApproverSignature(null)
        }
      })
    return () => {
      cancel = true
    }
  }, [recordId])

  useEffect(() => {
    if (!mounted || !recordId || archiveDone) return
    let disposed = false
    ;(async () => {
      try {
        const blob = await pdf(
          <CalibrationPDF
            record={record}
            summaryRows={summaryRows}
            calibratorSignature={calibratorSignature}
            approverSignature={approverSignature}
            decimals={decimals}
          />
        ).toBlob()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(String(r.result || ''))
          r.onerror = () => reject(new Error('read pdf blob failed'))
          r.readAsDataURL(blob)
        })
        await fetch('/api/certificates/archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recordId,
            certNo: String(record?.certNo || ''),
            fileDataUrl: dataUrl,
          }),
        })
      } catch {
        // ถ้า archive ไม่สำเร็จ ระบบยังดู PDF ผ่านหน้า preview ได้ตามปกติ
      } finally {
        if (!disposed) setArchiveDone(true)
      }
    })()
    return () => {
      disposed = true
    }
  }, [mounted, recordId, archiveDone, record, summaryRows, calibratorSignature, approverSignature])

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-64 card">
        <p className="text-gray-400">กำลังเตรียมตัวอย่าง PDF…</p>
      </div>
    )
  }

  const pdfDocument = (
    <CalibrationPDF
      record={record}
      summaryRows={summaryRows}
      calibratorSignature={calibratorSignature}
      approverSignature={approverSignature}
      decimals={decimals}
    />
  )
  const fileName = `calibration-${record?.certNo || recordId}.pdf`

  return (
    <div className="space-y-2">
      {/* Decimal selector */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-600 font-medium">ทศนิยม:</span>
        {[1, 2, 3, 4].map((d) => (
          <label key={d} className="flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name="pdf-decimals"
              checked={decimals === d}
              onChange={() => setDecimals(d)}
              className="text-military-600 focus:ring-military-500"
            />
            <span className={decimals === d ? 'font-semibold text-military-800' : 'text-gray-500'}>{d}</span>
          </label>
        ))}
      </div>
      {summaryLoading && (
        <p className="text-sm text-gray-500">กำลังคำนวณ uncertainty สำหรับตารางสรุป (หน้า 2)…</p>
      )}
      {summaryError && !summaryLoading && (
        <p className="text-sm text-amber-700">
          โหลดสรุป uncertainty ไม่สำเร็จ — แสดง PDF ตามรายการเดิม หน้า 2 อาจเป็นค่า placeholder
        </p>
      )}
      {isMobile && (
        <div className="card p-4 space-y-3">
          <p className="text-sm text-gray-700">
            มือถือบางรุ่นไม่รองรับตัวแสดง PDF แบบฝังหน้าเว็บ ให้เปิดไฟล์ PDF โดยตรงด้านล่าง
          </p>
          <BlobProvider document={pdfDocument}>
            {({ url, loading, error }) => {
              if (loading) return <p className="text-sm text-gray-500">กำลังสร้างไฟล์ PDF…</p>
              if (error || !url) return <p className="text-sm text-red-600">สร้างไฟล์ PDF ไม่สำเร็จ</p>
              return (
                <div className="flex flex-wrap gap-2">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary text-sm"
                  >
                    เปิด PDF
                  </a>
                  <a href={url} download={fileName} className="btn-secondary text-sm">
                    ดาวน์โหลด PDF
                  </a>
                </div>
              )
            }}
          </BlobProvider>
        </div>
      )}
      {!isMobile && (
      <PdfRenderErrorBoundary>
        <div className="card p-0 overflow-hidden min-h-[400px] w-full max-w-full">
          <PDFViewer
            showToolbar
            className="border-0 w-full"
            style={{ width: '100%', height: 800 }}
          >
            {pdfDocument}
          </PDFViewer>
        </div>
      </PdfRenderErrorBoundary>
      )}
    </div>
  )
}
