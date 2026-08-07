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

const styles = StyleSheet.create({
  page: { fontFamily: 'NotoSansThai', fontSize: 9, padding: 28, backgroundColor: '#fff' },
  headerTop: { marginBottom: 6 },
  orgName: { fontSize: 11, fontWeight: 700, textAlign: 'center', color: '#111' },
  orgSub: { fontSize: 8, textAlign: 'center', color: '#444', marginTop: 2 },
  certTitle: { fontSize: 13, fontWeight: 700, textAlign: 'center', marginTop: 8, color: '#111' },
  certMeta: { fontSize: 8, textAlign: 'right', color: '#333', marginTop: 3 },
  sectionRule: { borderTop: '1px solid #111', marginVertical: 6 },
  block: { marginBottom: 6 },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 115, color: '#222', fontSize: 8, fontWeight: 700 },
  value: { flex: 1, color: '#111', fontSize: 8 },
  envBox: { border: '1px solid #111', padding: 5, marginBottom: 6 },
  envTitle: { fontSize: 8, fontWeight: 700, marginBottom: 3 },
  envRow: { flexDirection: 'row', justifyContent: 'space-between' },
  table: { border: '1px solid #111', marginTop: 4, marginBottom: 8 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f5f5f5', borderBottom: '1px solid #111' },
  tableRow: { flexDirection: 'row', borderTop: '1px solid #ddd' },
  thCell: { padding: '3 2', color: '#111', fontSize: 7, textAlign: 'center', fontWeight: 700 },
  tdCell: { padding: '3 2', color: '#111', fontSize: 7, textAlign: 'center' },
  stdTableName: { width: '40%' },
  stdTableCol: { width: '20%' },
  signatureRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  signatureBox: { width: '42%', alignItems: 'center' },
  signatureLine: { width: '100%', borderTop: '1px solid #111', marginTop: 4 },
  sigImg: { maxHeight: 40, maxWidth: 130, objectFit: 'contain', alignSelf: 'center', marginBottom: 2 },
  sigText: { fontSize: 8, marginTop: 4, textAlign: 'center' },
  smallNote: { fontSize: 7, color: '#333', marginTop: 5, lineHeight: 1.25 },
  footer: { position: 'absolute', bottom: 16, left: 28, right: 28, borderTop: '1px solid #ddd', paddingTop: 5, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#666' },
  sumTh: { fontSize: 6, fontWeight: 700, padding: '2 1', textAlign: 'center', color: '#111' },
  sumTd: { fontSize: 6, padding: '2 1', textAlign: 'center' },
  sumUc: { width: '9%' },
  sumPt: { width: '11%' },
  sumN: { width: '10%' },
})

function formatPdfValue(n: number | undefined | null) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return fmt(Number(n), 4)
}

function CalibrationPDF({
  record,
  summaryRows,
  calibratorSignature,
  approverSignature,
}: {
  record: any
  summaryRows: SummaryRow[] | null
  calibratorSignature?: string | null
  approverSignature?: string | null
}) {
  const r = record
  const f = (v: any) => (v === null || v === undefined || v === '' ? '-' : String(v))
  const certApproved = r.approvalStatus === 'approved'
  const requestedApproverName = f(r.requestedApproverName)
  const approvedDisplayName = certApproved ? f(r.approve) : requestedApproverName
  const formatDate = (d: any) => (d ? new Date(d).toLocaleDateString('th-TH') : '-')

  const standardRows = [
    r.std1,
    r.uc1?.std,
    r.uc2?.std,
    r.uc3?.std,
    r.uc4?.std,
    r.uc5?.std,
    r.uc6?.std,
    r.ucT?.std,
  ].filter((s: any) => s?.name || s?.no)

  const displaySummary =
    summaryRows && summaryRows.length > 0
      ? summaryRows
      : [
          {
            ucName: '—',
            point: 0,
            avgUUC: NaN,
            avgSTDRead: NaN,
            correction: NaN,
            uc: NaN,
            U: NaN,
            k: NaN,
            unit: '',
          },
        ]

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerTop}>
          <Text style={styles.orgName}>กรมแพทย์ทหารบก</Text>
          <Text style={styles.orgSub}>Directorate of Medical Service, Royal Thai Army</Text>
          <Text style={styles.orgSub}>Calibration Laboratory</Text>
          <Text style={styles.certTitle}>CERTIFICATE OF CALIBRATION</Text>
          <Text style={styles.certMeta}>Certificate Number: {f(r.certNo)} | Page: 1 of 2</Text>
        </View>
        <View style={styles.sectionRule} />

        <View style={styles.block}>
          <View style={styles.row}>
            <Text style={styles.label}>Customer:</Text>
            <Text style={styles.value}>
              {f(r.unitName)} {r.section ? `- ${r.section}` : ''}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Address:</Text>
            <Text style={styles.value}>{f(r.address)}</Text>
          </View>
        </View>

        <View style={styles.sectionRule} />
        <View style={styles.block}>
          <View style={styles.row}>
            <Text style={styles.label}>Equipment:</Text>
            <Text style={styles.value}>{f(r.deviceName)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Manufacturer / Model:</Text>
            <Text style={styles.value}>
              {f(r.brand)} / {f(r.model)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Serial Number:</Text>
            <Text style={styles.value}>{f(r.serialNo)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>ID Number (Amed / SB):</Text>
            <Text style={styles.value}>
              {f(r.amedNo)} / {f(r.sbNo)}
            </Text>
          </View>
        </View>

        <View style={styles.sectionRule} />
        <View style={styles.block}>
          <View style={styles.row}>
            <Text style={styles.label}>Calibration place:</Text>
            <Text style={styles.value}>{f(r.location)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Received date:</Text>
            <Text style={styles.value}>{formatDate(r.receivedDate)}</Text>
          </View>
          {r.receivedN && (
          <View style={styles.row}>
            <Text style={styles.label}>Received by:</Text>
            <Text style={styles.value}>{r.receivedN}</Text>
          </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Calibration date:</Text>
            <Text style={styles.value}>{formatDate(r.calDate)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Issued date:</Text>
            <Text style={styles.value}>{formatDate(r.issuedDate)}</Text>
          </View>
        </View>

        <View style={styles.envBox}>
          <Text style={styles.envTitle}>Environmental</Text>
          <View style={styles.envRow}>
            <Text style={styles.value}>Ambient Temperature: {f(r.lapTemp)} °C</Text>
            <Text style={styles.value}>Relative Humidity: {f(r.lapHumid)} %RH</Text>
          </View>
        </View>

        <View style={styles.sectionRule} />
        <View style={styles.row}>
          <Text style={styles.label}>Calibrated By:</Text>
          <Text style={styles.value}>{f(r.calibrate)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Approved By:</Text>
          <Text style={styles.value}>
            {approvedDisplayName}
          </Text>
        </View>

        <View style={styles.signatureRow}>
          <View style={styles.signatureBox}>
            {calibratorSignature ? <Image style={styles.sigImg} src={calibratorSignature} /> : <View style={{ height: 36 }} />}
            <View style={styles.signatureLine} />
            <Text style={styles.sigText}>( {f(r.calibrate)} )</Text>
            <Text style={styles.sigText}>Calibrated By</Text>
          </View>
          <View style={styles.signatureBox}>
            {certApproved && approverSignature ? (
              <Image style={styles.sigImg} src={approverSignature} />
            ) : (
              <View style={{ height: 36 }} />
            )}
            <View style={styles.signatureLine} />
            <Text style={styles.sigText}>( {approvedDisplayName} )</Text>
            <Text style={styles.sigText}>Approved By</Text>
          </View>
        </View>

        <Text style={styles.smallNote}>
          The reported uncertainty is expanded uncertainty at approximately 95% confidence level.
        </Text>
        <Text style={styles.smallNote}>
          This certificate shall not be reproduced except in full, without written approval.
        </Text>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Certificate: {f(r.certNo)}</Text>
          <Text style={styles.footerText}>Printed: {new Date().toLocaleDateString('th-TH')}</Text>
          <Text style={styles.footerText}>Page 1 of 2</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.headerTop}>
          <Text style={styles.orgName}>กรมแพทย์ทหารบก</Text>
          <Text style={styles.orgSub}>Result of Calibration (Without Adjustment)</Text>
          <Text style={styles.certMeta}>Certificate Number: {f(r.certNo)} | Page: 2 of 2</Text>
        </View>
        <View style={styles.sectionRule} />

        <Text style={{ fontSize: 9, fontWeight: 700, marginBottom: 2 }}>Reference Standard</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.thCell, styles.stdTableName]}>Instrument</Text>
            <Text style={[styles.thCell, styles.stdTableCol]}>Serial No.</Text>
            <Text style={[styles.thCell, styles.stdTableCol]}>Certificate No.</Text>
            <Text style={[styles.thCell, styles.stdTableCol]}>Cal.Date</Text>
          </View>
          {(standardRows.length
            ? standardRows
            : [{ name: '-', model: '', serialNo: '-', certNo: '-', calDate: '-' }]
          ).map((s: any, i: number) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tdCell, styles.stdTableName]}>
                {f(s.name)} {s.model ? `(${f(s.model)})` : ''}
              </Text>
              <Text style={[styles.tdCell, styles.stdTableCol]}>{f(s.serialNo)}</Text>
              <Text style={[styles.tdCell, styles.stdTableCol]}>{f(s.certNo)}</Text>
              <Text style={[styles.tdCell, styles.stdTableCol]}>{f(s.calDate)}</Text>
            </View>
          ))}
        </View>

        <Text style={{ fontSize: 9, fontWeight: 700, marginBottom: 2, marginTop: 4 }}>สรุปผล / Uncertainty summary</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.sumTh, styles.sumUc]}>Uc</Text>
            <Text style={[styles.sumTh, styles.sumPt]}>Cal.point</Text>
            <Text style={[styles.sumTh, styles.sumN]}>UUC avg</Text>
            <Text style={[styles.sumTh, styles.sumN]}>STD avg read</Text>
            <Text style={[styles.sumTh, styles.sumN]}>Corr.</Text>
            <Text style={[styles.sumTh, styles.sumN]}>uc</Text>
            <Text style={[styles.sumTh, styles.sumN]}>U (exp.)</Text>
            <Text style={[styles.sumTh, styles.sumN]}>k</Text>
            <Text style={[styles.sumTh, styles.sumN]}>Unit</Text>
          </View>
          {displaySummary.map((row, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.sumTd, styles.sumUc]}>
                {row.ucName}
              </Text>
              <Text style={[styles.sumTd, styles.sumPt]}>
                {summaryRows && summaryRows.length > 0 ? String(row.point) : '—'}
              </Text>
              <Text style={[styles.sumTd, styles.sumN]}>{formatPdfValue(row.avgUUC)}</Text>
              <Text style={[styles.sumTd, styles.sumN]}>{formatPdfValue(row.avgSTDRead)}</Text>
              <Text style={[styles.sumTd, styles.sumN]}>{formatPdfValue(row.correction)}</Text>
              <Text style={[styles.sumTd, styles.sumN]}>{formatPdfValue(row.uc)}</Text>
              <Text style={[styles.sumTd, styles.sumN]}>{formatPdfValue(row.U)}</Text>
              <Text style={[styles.sumTd, styles.sumN]}>{formatPdfValue(row.k)}</Text>
              <Text style={[styles.sumTd, styles.sumN]}>{row.unit || '—'}</Text>
            </View>
          ))}
        </View>
        {Array.isArray(r.remarks) && r.remarks.some((rm: string) => rm) && (
          <View style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 8.5, fontWeight: 700, marginBottom: 2 }}>หมายเหตุ / Remarks</Text>
            {r.remarks.filter(Boolean).map((rm: string, i: number) => (
              <Text key={i} style={{ fontSize: 8, marginBottom: 2 }}>
                - {rm}
              </Text>
            ))}
          </View>
        )}

        <Text style={{ textAlign: 'center', marginTop: 20, fontSize: 9, fontWeight: 700 }}>----- END -----</Text>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Certificate: {f(r.certNo)}</Text>
          <Text style={styles.footerText}>Page 2 of 2</Text>
        </View>
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
        setSummaryRows(Array.isArray(data.summary) ? data.summary : [])
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
    />
  )
  const fileName = `calibration-${record?.certNo || recordId}.pdf`

  return (
    <div className="space-y-2">
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
