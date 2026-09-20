'use client'
import {useEffect, useState} from 'react'
import {CERTIFICATE_TEXT_FIELDS, defaultCertificateTexts, type CertificateTexts} from '@/lib/certificateTexts'
export default function AdminCertificateTexts() {
  const [texts,setTexts] = useState<CertificateTexts>({})
  const [revision,setRevision] = useState(0)
  const [loading,setLoading] = useState(true)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [saved,setSaved] = useState(false)
  async function load() {
    setLoading(true);setError('');setSaved(false)
    try { const r=await fetch('/api/certificate-texts',{cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error);setTexts(data.texts);setRevision(data.revision) }
    catch(e:any){setError(e.message || 'โหลดข้อความไม่สำเร็จ')} finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[])
  async function save() {
    setBusy(true);setError('');setSaved(false)
    try {const r=await fetch('/api/certificate-texts',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({texts,revision})});const data=await r.json();if(!r.ok)throw Error(data.error);setTexts(data.texts);setRevision(data.revision);setSaved(true)}
    catch(e:any){setError(e.message || 'บันทึกไม่สำเร็จ')}finally{setBusy(false)}
  }
  const groups=Array.from(new Set(CERTIFICATE_TEXT_FIELDS.map(field=>field.group)))
  return <div className="space-y-4">
    <div><h2 className="text-xl font-semibold text-military-900">จัดการข้อความในใบรับรอง</h2><p className="mt-1 text-sm text-gray-500">ข้อความที่บันทึกจะใช้เมื่อสร้าง PDF ใหม่ ทั้งหน้าตัวอย่างและ Download all ไฟล์ PDF ที่จัดเก็บไว้แล้วจะไม่ถูกแก้ไขทันที</p></div>
    {error && <div role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error} <button disabled={busy} onClick={load} className="underline">โหลดข้อมูลใหม่</button></div>}
    {saved && <p role="status" className="rounded bg-green-50 p-3 text-sm text-green-700">บันทึกข้อความแล้ว เปิดหน้าตัวอย่างใบรับรองใหม่เพื่อดูผล</p>}
    {loading ? <p>กำลังโหลดข้อความ…</p> : <fieldset disabled={busy || !Object.keys(texts).length} className="space-y-4">
      {groups.map(group=><section key={group} className="card space-y-4"><h3 className="font-semibold text-military-800">{group}</h3><div className="grid gap-4 md:grid-cols-2">
        {CERTIFICATE_TEXT_FIELDS.filter(field=>field.group===group).map(field=><label key={field.key} className={field.maxLength>250?'md:col-span-2':''}>
          <span className="block text-sm font-medium text-gray-700">{field.label}</span>
          <textarea rows={field.maxLength>250?4:2} maxLength={field.maxLength} value={texts[field.key] ?? field.defaultValue} onChange={event=>{setTexts(previous=>({...previous,[field.key]:event.target.value}));setSaved(false)}} className="input-field mt-1 text-sm" />
          <button type="button" className="mt-1 text-xs text-military-600 underline" onClick={()=>{setTexts(previous=>({...previous,[field.key]:field.defaultValue}));setSaved(false)}}>คืนค่าเดิม</button>
        </label>)}
      </div></section>)}
      <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 rounded border bg-white p-3 shadow-sm"><button type="button" className="btn-secondary" onClick={()=>{setTexts({...defaultCertificateTexts});setSaved(false)}}>คืนค่าเดิมทั้งหมด</button><button type="button" className="btn-primary" onClick={save}>{busy?'กำลังบันทึก…':'บันทึกข้อความ'}</button></div>
    </fieldset>}
  </div>
}
