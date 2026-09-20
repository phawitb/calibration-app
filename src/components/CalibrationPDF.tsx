import React from 'react'
import { certificateText, type CertificateTexts } from '@/lib/certificateTexts'
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { buildPdfCertificateInfo, PDF_LABELS } from '@/lib/pdfCertificate'
import { formatPdfDate } from '@/lib/pdfDate'
import { fmt, formatCalibrationValue, parseCalibrationValue } from '@/lib/uncertainty'

export type SummaryRow = {
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
  sigArea: { height: 32, justifyContent: 'flex-end' as const, alignItems: 'center' as const },
  sigImg: { maxHeight: 32, maxWidth: 130, objectFit: 'contain' },
  sigLine: { width: '100%', borderTop: '1pt solid #111', marginTop: 0 },
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

/** Build per-UC sections for result pages */
function buildUcSections(record: any, summaryRows: SummaryRow[] | null) {
  const ucKeys = ['uc1', 'uc2', 'uc3', 'uc4', 'uc5', 'uc6', 'ucT'] as const
  const sections: {
    index: number
    std: any
    measurement: string
    unit: string
    calPoints: { point: any; avgUUC: number; avgSTD: number; correction: number; uncertainty: number; isTime?: boolean }[]
  }[] = []

  let idx = 0
  for (const key of ucKeys) {
    const uc = record[key]
    if (!uc?.std?.name && !uc?.std?.no) continue
    const pts = uc.calPoints as any[] | undefined
    if (!pts || pts.length === 0) continue

    idx++
    const ucSummary = summaryRows?.filter((sr) => sr.ucName === key) || []
    const isTime = String(uc.std?.measurement || '').toLowerCase() === 'time' || String(uc.std?.unit || '').toLowerCase() === 'h:mm:ss'
    const calPoints = pts.map((pt: any, ptIdx: number) => {
      const matchRow = ptIdx < ucSummary.length ? ucSummary[ptIdx] : undefined
      const readings = (pt.readings || []).map(parseCalibrationValue).filter(Number.isFinite)
      const standards = (pt.standards || []).map(parseCalibrationValue).filter(Number.isFinite)
      const avgUUC = matchRow ? matchRow.avgUUC : readings.length ? readings.reduce((a: number, b: number) => a + b, 0) / readings.length : NaN
      const avgSTD = matchRow ? matchRow.avgSTDRead : standards.length ? standards.reduce((a: number, b: number) => a + b, 0) / standards.length : NaN
      const correction = matchRow ? matchRow.correction : NaN
      const uncertainty = matchRow ? matchRow.U : NaN
      return { point: pt.point, avgUUC, avgSTD, correction, uncertainty, isTime }
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

function buildIsoSections(record: any, isoResult: any) {
  const std = record.std1 || record.standardInstrument || {}
  if (!Array.isArray(isoResult?.calPointResults)) {
    // Legacy calculations report one result per sensor at each calibration point.
    const sensors = new Map<number, any[]>()
    for (const point of isoResult?.calPointSummaries || []) {
      for (const sensor of point.sensorResults || []) {
        const rows = sensors.get(sensor.sensorIndex) || []
        rows.push({ point: point.point, avgUUC: sensor.avgUUC, avgSTD: sensor.avgSTDRead,
          correction: sensor.correction, uncertainty: sensor.U, isTime: false })
        sensors.set(sensor.sensorIndex, rows)
      }
    }
    return Array.from(sensors, ([sensorIndex, calPoints], index) => ({
      index: index + 1,
      std,
      measurement: `${isoResult.isoMethodCode || 'ISO calibration'} / Sensor ${sensorIndex + 1}`,
      unit: isoResult.unit || record.unit || '-',
      calPoints,
    }))
  }
  return isoResult.calPointResults.map((point: any, index: number) => ({
    index: index + 1,
    std,
    measurement: isoResult.isoMethodCode || 'ISO calibration',
    unit: isoResult.unit || record.unit || '-',
    calPoints: [{
      point: point.point,
      avgUUC: point.indicatingReading ?? point.sensorResults?.[0]?.mean,
      avgSTD: point.stdMean ?? point.uniformity,
      correction: point.correction ?? point.overallVariation,
      uncertainty: point.reportedU,
      isTime: false,
    }],
  }))
}

export default function CalibrationPDF({
  record,
  summaryRows,
  isoResult,
  calibratorSignature,
  approverSignature,
  decimals = 4,
  logoSrc = "/logo.jpg",
  texts = {},
}: {
  record: any
  summaryRows: SummaryRow[] | null
  isoResult?: any
  calibratorSignature?: string | null
  approverSignature?: string | null
  decimals?: number
  texts?: CertificateTexts
  logoSrc?: string
}) {
  const t = (original: string) => certificateText(original, texts)
  const fmtVal = (n: number | undefined | null, precision = decimals) =>
    n == null || Number.isNaN(Number(n)) ? '-' : fmt(Number(n), precision)
  const r = record
  const f = (v: any) => (v === null || v === undefined || v === '' ? '-' : String(v))
  const certApproved = r.approvalStatus === 'approved'
  const requestedApproverName = f(r.requestedApproverName)
  const approvedDisplayName = certApproved ? f(r.approve) : requestedApproverName
  const std1 = r.std1 || {}
  const ucSections = buildUcSections(r, summaryRows)
  const isoSections = buildIsoSections(r, isoResult)
  const resultSections: any[] = [...ucSections, ...isoSections]
  const totalPages = resultSections.length > 4 ? 3 : 2
  // Extract English-only from unitName: "Fort Surasi Hospital(รพ.ค่ายสุรสีห์)" → "Fort Surasi Hospital"
  const customerEn = String(r.unitName || '').replace(/\(.*\)$/, '').trim() || f(r.unitName)
  const locationDisplay = (r.location === 'lab' || r.location === 'Lab') ? t('Medical Depot Division of Royal Thai Army Medical Department') : (r.location === 'outside' ? customerEn : f(r.location))
  const certificateInfo = buildPdfCertificateInfo(r, customerEn, locationDisplay)

  /* ---- Reusable info row ---- */
  const InfoRow2 = ({ l1, v1, l2, v2, last }: { l1: string; v1: string; l2?: string; v2?: string; last?: boolean }) => (
    <View style={last ? s.infoRowLast : s.infoRow}>
      <View style={s.infoLeft}>
        <Text style={[s.infoLabel, s.infoLabelW]}>{t(l1)}</Text>
        <Text style={[s.infoValue, s.infoValueFlex]}>{v1}</Text>
      </View>
      {l2 != null && (
        <View style={s.infoRight}>
          <Text style={[s.infoLabel, s.infoLabelW2]}>{t(l2 || '')}</Text>
          <Text style={[s.infoValue, s.infoValueFlex]}>{v2 || '-'}</Text>
        </View>
      )}
    </View>
  )

  const InfoRowFull = ({ label, value, last }: { label: string; value: string; last?: boolean }) => (
    <View style={last ? s.infoRowLast : s.infoRow}>
      <View style={s.infoFull}>
        <Text style={[s.infoLabel, s.infoLabelW]}>{t(label)}</Text>
        <Text style={[s.infoValue, s.infoValueFlex]}>{value}</Text>
      </View>
    </View>
  )

  /* ---- Page 2+ header ---- */
  const PageHeader = ({ pageNum, totalPg }: { pageNum: number; totalPg: number }) => (
    <View style={s.p2Header}>
      <Text style={s.p2HeaderText}>{t('Amed No.')} {f(r.amedNo)}</Text>
      <Text style={s.p2HeaderText}>{t('Certificate No.')} {f(r.certNo)}</Text>
      <Text style={s.p2HeaderText}>{t('Page')} {pageNum}/{totalPg}</Text>
    </View>
  )

  return (
    <Document>
      {/* ===================== PAGE 1 ===================== */}
      <Page size="A4" style={s.page}>
        <Text style={s.pageNo}>{t('Page')} 1/{totalPages}</Text>

        <View style={s.headerRow}>
          <Image style={s.logo} src={logoSrc} />
          <View style={{ flex: 1 }}>
            <Text style={s.orgName}>{t("MEDICAL DEPOT DIVISION OF ROYAL THAI ARMY MEDICAL DEPARTMENT")}</Text>
            <Text style={s.orgAddr}>{t("8 Phaya Thai Road, Thung Phaya Thai, Ratchathewi, Bangkok, 10400 Thailand")}</Text>
          </View>
        </View>

        <Text style={s.certTitle}>{t("Calibration Certificate")}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 }}>
          <Text style={{ fontSize: 10, fontWeight: 700 }}>{t("Certificate")} </Text>
          <Text style={{ fontSize: 10 }}>{f(r.certNo)}</Text>
        </View>

        {/* Device info table */}
        <View style={s.infoTable}>
          {certificateInfo.deviceRows.map((row, index) => row.full
            ? <InfoRowFull key={index} label={row.left.label} value={row.left.value} last={index === certificateInfo.deviceRows.length - 1} />
            : <InfoRow2 key={index} l1={row.left.label} v1={row.left.value} l2={row.right?.label} v2={row.right?.value} />
          )}
        </View>

        {/* Customer info table */}
        <View style={s.infoTable}>
          {certificateInfo.customerRows.map((row, index) => row.full
            ? <InfoRowFull key={index} label={row.left.label} value={row.left.value} />
            : <InfoRow2 key={index} l1={row.left.label} v1={row.left.value} l2={row.right?.label} v2={row.right?.value} />
          )}
          <View style={s.infoRow}>
            <View style={s.infoLeft}>
              <Text style={[s.infoLabel, s.infoLabelW]}>{t("Environment")}</Text>
              <Text style={[s.infoValue, s.infoValueFlex]}></Text>
            </View>
            <View style={s.infoRight}>
              <Text style={[s.infoLabel, { width: 70 }]}>{t("Temperature")}</Text>
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
              <Text style={[s.infoLabel, { width: 70 }]}>{t("Humidity")}</Text>
              <Text style={[s.infoValue, { width: 40, textAlign: 'right' }]}>{fmtVal(r.lapHumid, 1)}</Text>
              <Text style={[s.infoValue, { marginLeft: 4 }]}>%RH</Text>
            </View>
          </View>
        </View>

        {/* Calibration method */}
        <Text style={s.methodText}>
          <Text style={{ fontWeight: 700 }}>{t("Calibration method")}</Text> : {t('By comparison with standard tools. This certificate is traceable to the SI units.')}
        </Text>

        {/* Signatures */}
        <View style={s.sigRow}>
          <View style={s.sigBox}>
            <View style={s.sigArea}>
              {calibratorSignature ? <Image style={s.sigImg} src={calibratorSignature} /> : null}
            </View>
            <View style={s.sigLine} />
            <Text style={s.sigText}>{f(r.calibrate)}</Text>
            <Text style={s.sigText}>{t("Calibrate")}</Text>
          </View>
          <View style={s.sigBox}>
            <View style={s.sigArea}>
              {certApproved && approverSignature ? <Image style={s.sigImg} src={approverSignature} /> : null}
            </View>
            <View style={s.sigLine} />
            <Text style={s.sigText}>{approvedDisplayName}</Text>
            <Text style={s.sigText}>{t("Approve")}</Text>
          </View>
        </View>

        {/* Disclaimer */}
        <Text style={s.disclaimer}>{t("This certificate is valid only to the item calibrated on date and place of calibration. The report shall not be reproduced except in full without approval of Medical depot division of royal Thai army medical department.")}</Text>
        <Text style={s.disclaimer}>{t("This certificate is issued the units of measurement according to the International System of units (SI unit). It provides traceability of measurement to international or national standard or other recognized national standard laboratories.")}</Text>
        <Text style={s.disclaimer}>{t("The measurement uncertainty stated is the expanded uncertainty which is obtained from the standard uncertainty multiplied by the coverage factor ( k = 2 ) to provide a level of confidence of approximately 95%. It is determined in accordance with the Guide to Expression of Uncertainty in Measurement (GUM).")}</Text>
      </Page>

      {/* ===================== PAGE 2+ ===================== */}
      <Page size="A4" style={s.page} wrap>
        <PageHeader pageNum={2} totalPg={totalPages} />

        {/* Environmental – Std1 */}
        <Text style={s.sectionTitle}>{t("Environmental")}</Text>
        <Text style={[s.bodyText, { fontWeight: 700 }]}>{t("Reference Standard Instrument")}</Text>
        {(std1.name || std1.no) && (
          <Text style={[s.bodyText, { marginBottom: 2 }]}>- {f(std1.name)}</Text>
        )}
        <View style={s.table}>
          <View style={s.tRow}>
            <Text style={[s.th, { width: '25%' }]}>{t(PDF_LABELS.manufacturer)}</Text>
            <Text style={[s.th, { width: '15%' }]}>{t("Model")}</Text>
            <Text style={[s.th, { width: '20%' }]}>{t("Serial NO.")}</Text>
            <Text style={[s.th, { width: '20%' }]}>{t("Cert. NO.")}</Text>
            <Text style={[s.th, { width: '20%' }]}>{t("Cal.Date")}</Text>
          </View>
          <View style={s.tRowLast}>
            <Text style={[s.td, { width: '25%' }]}>{f(std1.manufacture)}</Text>
            <Text style={[s.td, { width: '15%' }]}>{f(std1.model)}</Text>
            <Text style={[s.td, { width: '20%' }]}>{f(std1.serialNo)}</Text>
            <Text style={[s.td, { width: '20%' }]}>{f(std1.certNo)}</Text>
            <Text style={[s.td, { width: '20%' }]}>{formatPdfDate(std1.calDate)}</Text>
          </View>
        </View>

        {/* Temp / Humidity min-max */}
        <View style={s.table}>
          <View style={s.tRow}>
            <Text style={[s.th, { width: '20%' }]}>{t("Temp ( °C )")}</Text>
            <Text style={[s.th, { width: '15%' }]}>{t("Min.Value")}</Text>
            <Text style={[s.th, { width: '15%' }]}>{t("Max.Value")}</Text>
            <Text style={[s.th, { width: '20%' }]}>{t("Humidity(%)")}</Text>
            <Text style={[s.th, { width: '15%' }]}>{t("Min.Value")}</Text>
            <Text style={[s.th, { width: '15%' }]}>{t("Max.Value")}</Text>
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
        <Text style={s.sectionTitle}>{t("Calibration Procedure")}</Text>
        <Text style={s.bodyText}>{t("This calibration was performed by direct measurement of the unit under calibration using calibrated standard instrument. The data was recorded in steady state at the calibrate point values.")}</Text>

        {/* Result of Calibration */}
        <Text style={[s.sectionTitle, { marginTop: 8 }]}>{t("Result of Calibration")}</Text>
        <Text style={[s.bodyText, { fontWeight: 700, marginBottom: 4 }]}>{t("STD = Standard Instrument  UUC = Unit Under Calibration")}</Text>

        {/* Per-UC result tables */}
        {resultSections.map((sec) => {
          const colW = { left: '48%', model: '12%', serial: '13%', cert: '14%', caldt: '13%' }
          return (
          <View key={sec.index} wrap={false} style={{ marginBottom: 10 }}>
            {/* Row 1: header labels */}
            <View style={{ flexDirection: 'row' }}>
              <Text style={[s.bodyText, { fontWeight: 700, width: colW.left }]}>
                {t('Reference Standard Instrument')} {sec.index}
              </Text>
              <Text style={[s.bodyText, { fontWeight: 700, width: colW.model }]}>{t("Model")}</Text>
              <Text style={[s.bodyText, { fontWeight: 700, width: colW.serial }]}>{t("Serial NO.")}</Text>
              <Text style={[s.bodyText, { fontWeight: 700, width: colW.cert }]}>{t("Cert. NO.")}</Text>
              <Text style={[s.bodyText, { fontWeight: 700, width: colW.caldt }]}>{t("Cal.Date")}</Text>
            </View>
            {/* Row 2: instrument values */}
            <View style={{ flexDirection: 'row', marginBottom: 2 }}>
              <Text style={[s.bodyText, { width: colW.left }]}>- {f(sec.std.name)}</Text>
              <Text style={[s.bodyText, { width: colW.model }]}>{f(sec.std.model)}</Text>
              <Text style={[s.bodyText, { width: colW.serial }]}>{f(sec.std.serialNo)}</Text>
              <Text style={[s.bodyText, { width: colW.cert }]}>{f(sec.std.certNo)}</Text>
              <Text style={[s.bodyText, { width: colW.caldt }]}>{formatPdfDate(sec.std.calDate)}</Text>
            </View>

            {/* Measurement row */}
            <View style={{ flexDirection: 'row', marginBottom: 3 }}>
              <Text style={[s.bodyText, { fontWeight: 700, width: 80 }]}>{t("Measurement")}</Text>
              <Text style={[s.bodyText, { width: 90 }]}>{sec.measurement}</Text>
              <Text style={[s.bodyText, { fontWeight: 700, width: 80 }]}>{t(PDF_LABELS.measureUnit)}</Text>
              <Text style={[s.bodyText, { width: 60 }]}>{sec.unit}</Text>
              <Text style={[s.bodyText, { fontWeight: 700, width: 50 }]}>{t("Remark")}</Text>
              <Text style={s.bodyText}>-</Text>
            </View>

            {/* Cal point table */}
            <View style={s.table}>
              <View style={s.tRow}>
                <Text style={[s.th, { width: '20%' }]}>{t("Cal.point")}</Text>
                <Text style={[s.th, { width: '20%' }]}>{t("UUC reading")}</Text>
                <Text style={[s.th, { width: '20%' }]}>{t("STD reading")}</Text>
                <Text style={[s.th, { width: '20%' }]}>{t("Correction")}</Text>
                <Text style={[s.th, { width: '20%' }]}>{t("± Uncertainty")}</Text>
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
              {sec.calPoints.map((cp: any, i: number) => (
                <View key={i} style={i === sec.calPoints.length - 1 ? s.tRowLast : s.tRow}>
                  <Text style={[s.td, { width: '20%' }]}>{cp.isTime ? formatCalibrationValue(parseCalibrationValue(cp.point), true) : (cp.point != null ? String(cp.point) : '-')}</Text>
                  <Text style={[s.td, { width: '20%' }]}>{cp.isTime ? formatCalibrationValue(cp.avgUUC, true) : fmtVal(cp.avgUUC)}</Text>
                  <Text style={[s.td, { width: '20%' }]}>{cp.isTime ? formatCalibrationValue(cp.avgSTD, true) : fmtVal(cp.avgSTD)}</Text>
                  <Text style={[s.td, { width: '20%' }]}>{cp.isTime ? formatCalibrationValue(cp.correction, true) : fmtVal(cp.correction)}</Text>
                  <Text style={[s.td, { width: '20%' }]}>{cp.isTime ? formatCalibrationValue(cp.uncertainty, true, 1) : fmtVal(cp.uncertainty)}</Text>
                </View>
              ))}
            </View>
          </View>
          )
        })}

        {/* Remarks */}
        {Array.isArray(r.remarks) && r.remarks.some((rm: string) => rm) && (
          <View style={{ marginTop: 4 }}>
            <Text style={[s.bodyText, { fontWeight: 700, marginBottom: 2 }]}>{t("Remark")}</Text>
            {r.remarks.filter(Boolean).map((rm: string, i: number) => (
              <Text key={i} style={[s.bodyText, { marginBottom: 1 }]}>- {rm}</Text>
            ))}
          </View>
        )}
      </Page>
    </Document>
  )
}

