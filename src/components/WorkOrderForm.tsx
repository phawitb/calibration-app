'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import type {
  OrderDevice,
  OrderMember,
  WorkOrderInput,
  WorkOrderSummary,
} from '@/lib/workOrderTypes'
import WorkOrderDocuments from './WorkOrderDocuments'
import { validateOrderPdf } from '@/lib/workOrderValidation'
const empty: WorkOrderInput = {
  orderNo: '',
  title: '',
  startDate: '',
  endDate: '',
  notes: '',
  hospitals: [],
  memberIds: [],
}
export default function WorkOrderForm({
  order,
  onSaved,
  onCancel,
}: {
  order: WorkOrderSummary | null
  onSaved: (o: WorkOrderSummary) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<WorkOrderInput>(order || empty),
    [saved, setSaved] = useState(order),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [documentVersion, setDocumentVersion] = useState(0)
  const [checkingFiles, setCheckingFiles] = useState(false)
  const [users, setUsers] = useState<OrderMember[]>([]),
    [hospitals, setHospitals] = useState<string[]>([]),
    [devices, setDevices] = useState<Record<string, OrderDevice[]>>({}),
    [deviceErrors, setDeviceErrors] = useState<Record<string, string>>({}),
    [active, setActive] = useState(''),
    [query, setQuery] = useState(''),
    [userQuery, setUserQuery] = useState(''),
    [hospitalQuery, setHospitalQuery] = useState(''),
    [optionsLoading, setOptionsLoading] = useState(true)
  useEffect(() => {
    let live = true
    fetch('/api/orders/options')
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw Error(j.error)
        if (live) {
          setUsers(j.data.users)
          setHospitals(j.data.hospitals)
        }
      })
      .catch((e) => {
        if (live) setError(e.message)
      })
      .finally(() => {
        if (live) setOptionsLoading(false)
      })
    return () => {
      live = false
    }
  }, [])
  useEffect(() => {
    if (!active || devices[active]) return
    const controller = new AbortController()
    const unit = active
    fetch(`/api/ameddevices?unitName=${encodeURIComponent(unit)}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw Error(j.error)
        setDevices((prev) => ({ ...prev, [unit]: j.data }))
        setDeviceErrors((prev) => ({ ...prev, [unit]: '' }))
      })
      .catch((e) => {
        if (e.name !== 'AbortError')
          setDeviceErrors((prev) => ({ ...prev, [unit]: e.message }))
      })
    return () => controller.abort()
  }, [active, devices])
  const patch = (key: keyof WorkOrderInput, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }))
  const toggleHospital = (unitName: string) => {
    const selected = form.hospitals.find((h) => h.unitName === unitName)
    if (
      selected?.deviceIds.length &&
      !confirm('นำโรงพยาบาลและรายการเครื่องมือที่เลือกออกจากคำสั่ง?')
    )
      return
    patch(
      'hospitals',
      selected
        ? form.hospitals.filter((h) => h.unitName !== unitName)
        : [...form.hospitals, { unitName, deviceIds: [] }]
    )
    setActive(selected ? '' : unitName)
    setQuery('')
  }
  const toggleDevice = (id: string) =>
    patch(
      'hospitals',
      form.hospitals.map((h) =>
        h.unitName === active
          ? {
              ...h,
              deviceIds: h.deviceIds.includes(id)
                ? h.deviceIds.filter((x) => x !== id)
                : [...h.deviceIds, id],
            }
          : h
      )
    )
  async function selectFiles(files: File[]) {
    setCheckingFiles(true)
    setError('')
    try {
      for (const file of files) {
        validateOrderPdf(
          file,
          new Uint8Array(await file.slice(0, 5).arrayBuffer())
        )
      }
      setPendingFiles((previous) => [
        ...previous,
        ...files.filter(
          (file) =>
            !previous.some(
              (existing) =>
                existing.name === file.name &&
                existing.size === file.size &&
                existing.lastModified === file.lastModified
            )
        ),
      ])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCheckingFiles(false)
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (busy || checkingFiles) return
    setBusy(true)
    setError('')
    try {
      const r = await fetch(
          saved ? `/api/orders/${saved._id}` : '/api/orders',
          {
            method: saved ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...form,
              ...(saved ? { revision: saved.revision } : {}),
            }),
          }
        ),
        j = await r.json()
      if (!r.ok) throw Error(j.error)
      setSaved(j.data)
      setForm(j.data)
      const failed: File[] = []
      const failures: string[] = []
      for (const file of pendingFiles) {
        try {
          const body = new FormData()
          body.append('file', file)
          const upload = await fetch(`/api/orders/${j.data._id}/documents`, {
            method: 'POST',
            body,
          })
          const result = await upload.json()
          if (!upload.ok) throw Error(result.error || 'อัปโหลดไม่สำเร็จ')
          setDocumentVersion((value) => value + 1)
        } catch (e) {
          failed.push(file)
          failures.push(`${file.name}: ${(e as Error).message}`)
        }
      }
      setPendingFiles(failed)
      if (failures.length) {
        setError(
          `บันทึกข้อมูลคำสั่งแล้ว แต่บางไฟล์อัปโหลดไม่สำเร็จ กรุณาลองบันทึกอีกครั้ง: ${failures.join('; ')}`
        )
        return
      }
      onSaved(j.data)
      toast.success('บันทึกคำสั่งแล้ว')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const availableUsers = [
    ...users,
    ...(saved?.members || []).filter(
      (u) => !users.some((x) => x._id === u._id)
    ),
  ]
  const availableHospitals = Array.from(
    new Set([...hospitals, ...form.hospitals.map((h) => h.unitName)])
  )
  const listedDevices = [
    ...(devices[active] || []),
    ...(saved?.devices || []).filter(
      (d) =>
        d.unitName === active && !devices[active]?.some((x) => x._id === d._id)
    ),
  ]
  const visible = listedDevices.filter((d) =>
    [d.amedNo, d.deviceName, d.model, d.serialNo]
      .join(' ')
      .toLowerCase()
      .includes(query.toLowerCase())
  )
  return (
    <div className="card space-y-6">
      <div className="flex justify-between gap-3">
        <h2 className="text-xl font-semibold">
          {saved ? 'แก้ไขคำสั่ง' : 'เพิ่มคำสั่ง'}
        </h2>
        <button
          className="text-sm text-gray-600"
          onClick={onCancel}
          disabled={busy || checkingFiles}
        >
          กลับรายการคำสั่ง
        </button>
      </div>
      <form onSubmit={save} className="space-y-6">
        <fieldset
          disabled={busy || checkingFiles || optionsLoading}
          className="space-y-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ['orderNo', 'เลขที่คำสั่ง', 'text'],
                ['title', 'ชื่อเรื่อง', 'text'],
                ['startDate', 'วันที่เริ่มปฏิบัติงาน', 'date'],
                ['endDate', 'วันที่สิ้นสุด', 'date'],
              ] as const
            ).map(([key, label, type]) => (
              <label key={key} className="text-sm font-medium">
                {label}
                <input
                  required
                  type={type}
                  className="input-field mt-1"
                  value={form[key]}
                  onChange={(e) => patch(key, e.target.value)}
                />
              </label>
            ))}
          </div>
          <section className="space-y-3">
            <h3 className="font-semibold">
              โรงพยาบาลและเครื่องมือที่จะสอบเทียบ
            </h3>
            <p className="text-sm text-gray-500">
              เลือก รพ. แล้วเลือกเครื่องมือรายชิ้นจากทะเบียน
            </p>
            <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
              <div className="rounded-xl border p-3 space-y-2">
                <input
                  aria-label="ค้นหาโรงพยาบาล"
                  placeholder="ค้นหาโรงพยาบาล"
                  className="input-field"
                  value={hospitalQuery}
                  onChange={(e) => setHospitalQuery(e.target.value)}
                />
                <div className="max-h-80 overflow-auto space-y-1">
                  {availableHospitals
                    .filter((h) =>
                      h.toLowerCase().includes(hospitalQuery.toLowerCase())
                    )
                    .map((h) => {
                      const selected = form.hospitals.find(
                        (x) => x.unitName === h
                      )
                      return (
                        <div
                          key={h}
                          className={`flex items-start gap-2 rounded-lg p-2 ${active === h ? 'bg-military-100' : ''}`}
                        >
                          <input
                            aria-label={`เลือก ${h}`}
                            type="checkbox"
                            checked={!!selected}
                            onChange={() => toggleHospital(h)}
                            className="mt-1"
                          />
                          <button
                            type="button"
                            className="text-left text-sm break-words"
                            onClick={() => {
                              if (!selected) toggleHospital(h)
                              else setActive(h)
                            }}
                          >
                            {h}
                            {selected && (
                              <span className="block text-xs text-gray-500">
                                {selected.deviceIds.length} เครื่องมือ
                              </span>
                            )}
                          </button>
                        </div>
                      )
                    })}
                </div>
              </div>
              <div className="rounded-xl border p-3 space-y-3 min-w-0">
                {active ? (
                  <>
                    <h4 className="font-medium text-sm break-words">
                      {active}
                    </h4>
                    <input
                      aria-label="ค้นหาเครื่องมือในคำสั่ง"
                      className="input-field"
                      placeholder="ค้นหาชื่อ / AmedNo / รุ่น / Serial"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {deviceErrors[active] ? (
                      <p role="alert" className="text-red-600">
                        {deviceErrors[active]}{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setDevices((p) => ({ ...p }))
                            setDeviceErrors((p) => ({ ...p, [active]: '' }))
                          }}
                        >
                          ลองใหม่
                        </button>
                      </p>
                    ) : !devices[active] ? (
                      <p className="text-sm text-gray-500">
                        กำลังโหลดเครื่องมือ…
                      </p>
                    ) : null}
                    <div className="max-h-72 overflow-auto space-y-2">
                      {visible.map((d) => (
                        <label
                          key={d._id}
                          className="flex gap-3 rounded-lg border p-3 text-sm cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={
                              !!form.hospitals
                                .find((h) => h.unitName === active)
                                ?.deviceIds.includes(d._id)
                            }
                            onChange={() => toggleDevice(d._id)}
                          />
                          <span className="min-w-0 break-words">
                            <span className="block font-medium">
                              {d.deviceName || 'ไม่ระบุชื่อเครื่องมือ'}
                            </span>
                            <span className="text-gray-500">
                              AmedNo {d.amedNo} · {d.model || 'ไม่ระบุรุ่น'} ·
                              S/N {d.serialNo || '-'}
                            </span>
                          </span>
                        </label>
                      ))}
                      {devices[active] && !visible.length && (
                        <p className="text-sm text-gray-500">ไม่พบเครื่องมือ</p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="py-12 text-center text-sm text-gray-500">
                    เลือกโรงพยาบาลเพื่อเพิ่มเครื่องมือ
                  </p>
                )}
              </div>
            </div>
          </section>
          <section className="space-y-3">
            <h3 className="font-semibold">
              ทีมผู้ปฏิบัติงาน{' '}
              <span className="text-sm font-normal text-gray-500">
                เลือกแล้ว {form.memberIds.length} คน
              </span>
            </h3>
            <input
              className="input-field"
              placeholder="ค้นหาชื่อ / username"
              aria-label="ค้นหาทีมผู้ปฏิบัติงาน"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
            />
            <div className="grid gap-2 sm:grid-cols-2 max-h-64 overflow-auto">
              {availableUsers
                .filter((u) =>
                  `${u.name} ${u.username}`
                    .toLowerCase()
                    .includes(userQuery.toLowerCase())
                )
                .map((u) => (
                  <label
                    key={u._id}
                    className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={form.memberIds.includes(u._id)}
                      disabled={!u.isActive && !form.memberIds.includes(u._id)}
                      onChange={() =>
                        patch(
                          'memberIds',
                          form.memberIds.includes(u._id)
                            ? form.memberIds.filter((id) => id !== u._id)
                            : [...form.memberIds, u._id]
                        )
                      }
                    />
                    <span>
                      {u.name}{' '}
                      <span className="text-gray-500">({u.username})</span>
                      {!u.isActive && (
                        <span className="block text-amber-700">
                          บัญชีไม่ได้ใช้งาน
                        </span>
                      )}
                    </span>
                  </label>
                ))}
            </div>
          </section>
          <label className="block text-sm font-medium">
            หมายเหตุ
            <textarea
              className="input-field mt-1"
              rows={3}
              value={form.notes}
              onChange={(e) => patch('notes', e.target.value)}
            />
          </label>
        </fieldset>
        <section className="space-y-3">
          <h3 className="font-semibold text-military-900">
            เอกสารคำสั่ง PDF{' '}
            <span className="text-sm font-normal text-gray-500">
              (ไม่บังคับ)
            </span>
          </h3>
          <label className="block rounded-lg border border-dashed border-military-300 p-4 text-sm">
            แนบ PDF ได้หลายไฟล์ · ไม่เกิน 8 MB ต่อไฟล์ ·
            ไฟล์จะถูกอัปโหลดเมื่อกดบันทึกคำสั่ง
            <input
              aria-label="เลือก PDF คำสั่ง (ไม่บังคับ)"
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="mt-2 block w-full"
              disabled={busy || checkingFiles}
              onChange={(e) => {
                selectFiles(Array.from(e.target.files || []))
                e.target.value = ''
              }}
            />
          </label>
          {checkingFiles && (
            <p className="text-sm text-gray-500" role="status">
              กำลังตรวจไฟล์…
            </p>
          )}
          {pendingFiles.map((file, index) => (
            <div
              key={`${file.name}:${file.lastModified}:${index}`}
              className="flex items-center justify-between gap-3 rounded-lg bg-military-50 p-3 text-sm"
            >
              <span className="break-all">
                {file.name} <span className="text-gray-500">· รอบันทึก</span>
              </span>
              <button
                type="button"
                disabled={busy || checkingFiles}
                className="shrink-0 text-red-600"
                onClick={() =>
                  setPendingFiles((files) =>
                    files.filter((_, i) => i !== index)
                  )
                }
              >
                นำออก
              </button>
            </div>
          ))}
          {saved && (
            <WorkOrderDocuments
              key={`${saved._id}:${documentVersion}`}
              orderId={saved._id}
              editable
              allowUpload={false}
              title="ไฟล์ที่บันทึกแล้ว"
              disabled={busy || checkingFiles}
            />
          )}
        </section>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="btn-primary"
            disabled={busy || checkingFiles || optionsLoading}
          >
            {busy ? 'กำลังบันทึก…' : 'บันทึกคำสั่ง'}
          </button>
          <p className="text-sm text-gray-500">
            {form.hospitals.length} รพ. ·{' '}
            {form.hospitals.reduce((n, h) => n + h.deviceIds.length, 0)}{' '}
            เครื่องมือ · {form.memberIds.length} คน
          </p>
        </div>
      </form>
    </div>
  )
}
