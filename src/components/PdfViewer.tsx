'use client'
import { PDFViewer, BlobProvider, Font, pdf } from '@react-pdf/renderer'
import { Component, useEffect, useState, type ReactNode } from 'react'
import { type CertificateTexts } from '@/lib/certificateTexts'
import CalibrationPDF, { type SummaryRow } from './CalibrationPDF'

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
  const [texts, setTexts] = useState<CertificateTexts | null>(null)
  const [textError, setTextError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/certificate-texts', {cache: 'no-store', signal: controller.signal})
      .then(response => { if (!response.ok) throw Error('Text settings unavailable'); return response.json() })
      .then(data => setTexts(data.texts))
      .catch(() => { if (!controller.signal.aborted) setTextError(true) })
    return () => controller.abort()
  }, [])
  const [mounted, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [decimals, setDecimals] = useState(1)
  const [summaryRows, setSummaryRows] = useState<SummaryRow[] | null>(null)
  const [isoResult, setIsoResult] = useState<any>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState(false)
  const [calibratorSignature, setCalibratorSignature] = useState<string | null | undefined>(undefined)
  const [approverSignature, setApproverSignature] = useState<string | null | undefined>(undefined)
  const [archiveDone, setArchiveDone] = useState(false)
  const [calculationReadyKey, setCalculationReadyKey] = useState<string | null>(null)
  const [signaturesReadyKey, setSignaturesReadyKey] = useState<string | null>(null)
  const requestKey = JSON.stringify([recordId, record?.certificateRevision || 0, record?.certNo, record?.approvalStatus, record?.calibratedById, record?.approvedById])

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
      setIsoResult(null)
      return
    }
    let cancel = false
    setCalculationReadyKey(null)
    setSummaryLoading(true)
    setSummaryError(false)
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 60_000)
    fetch(`/api/records/${recordId}/calculate`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('calculate failed'))))
      .then((data) => {
        if (cancel) return
        setIsoResult(data.isoResult || null)
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
        setCalculationReadyKey(requestKey)
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
  }, [recordId, requestKey])

  useEffect(() => {
    setArchiveDone(false)
  }, [requestKey])

  useEffect(() => {
    if (!recordId) {
      setCalibratorSignature(null)
      setApproverSignature(null)
      return
    }
    let cancel = false
    setSignaturesReadyKey(null)
    fetch(`/api/records/${recordId}/signatures`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancel || !data) return
        setSignaturesReadyKey(requestKey)
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
  }, [recordId, requestKey])

  useEffect(() => {
    if (!texts || !mounted || !recordId || archiveDone || summaryLoading || summaryError ||
      calculationReadyKey !== requestKey || signaturesReadyKey !== requestKey) return
    let disposed = false
    ;(async () => {
      try {
        const blob = await pdf(
          <CalibrationPDF
            texts={texts}
            record={record}
            summaryRows={summaryRows}
            isoResult={isoResult}
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
        if (disposed) return
        const response = await fetch('/api/certificates/archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recordId,
            certificateRevision: record?.certificateRevision || 0,
            recordUpdatedAt: record?.updatedAt,
            certNo: String(record?.certNo || ''),
            fileDataUrl: dataUrl,
          }),
        })
        if (!response.ok) throw new Error('archive failed')
        if (!disposed) setArchiveDone(true)
      } catch {
        // ถ้า archive ไม่สำเร็จ ระบบยังดู PDF ผ่านหน้า preview ได้ตามปกติ
      }
    })()
    return () => {
      disposed = true
    }
  }, [texts, mounted, recordId, archiveDone, record, summaryRows, isoResult, calibratorSignature, approverSignature, decimals, summaryLoading, summaryError, calculationReadyKey, signaturesReadyKey, requestKey])

  if (textError) return <div role="alert" className="card text-red-700">โหลดข้อความในใบรับรองไม่สำเร็จ กรุณารีเฟรชหน้า</div>
  if (!mounted || !texts) {
    return (
      <div className="flex items-center justify-center h-64 card">
        <p className="text-gray-400">กำลังเตรียมตัวอย่าง PDF…</p>
      </div>
    )
  }

  const pdfDocument = (
    <CalibrationPDF
            texts={texts}
      record={record}
      summaryRows={summaryRows}
      isoResult={isoResult}
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
