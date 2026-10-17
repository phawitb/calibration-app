'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type AutosaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: Date }
  | { kind: 'error'; message: string }

export const AUTOSAVE_DELAY_MS = 20_000

/**
 * บันทึกฉบับร่างอัตโนมัติหลังหยุดแก้ไข 20 วินาที
 * - ไม่ทำงานตอน mount และไม่ทำงานจนกว่าผู้ใช้จะแก้ไขเอง (markDirty จาก onChangeCapture ของฟอร์ม)
 * - ข้ามรอบเมื่อมีการบันทึกด้วยมือค้างอยู่ (saving)
 * - ผู้เรียกต้องเรียก markSaved() หลังบันทึกด้วยมือสำเร็จ เพื่อไม่ให้บันทึกซ้ำ
 */
export function useDraftAutosave({
  enabled,
  data,
  saving,
  save,
  delayMs = AUTOSAVE_DELAY_MS,
}: {
  enabled: boolean
  data: unknown
  /** มีการบันทึก (ด้วยมือหรืออัตโนมัติ) ค้างอยู่ */
  saving: boolean
  /** บันทึกฉบับร่าง — คืน true เมื่อสำเร็จ */
  save: () => Promise<boolean>
  delayMs?: number
}) {
  const [status, setStatus] = useState<AutosaveStatus>({ kind: 'idle' })
  const dirtyRef = useRef(false)
  const lastSavedRef = useRef<string | null>(null)
  const acceptNextRef = useRef(false)
  const savingRef = useRef(saving)
  savingRef.current = saving
  const saveRef = useRef(save)
  saveRef.current = save

  const markDirty = useCallback(() => {
    dirtyRef.current = true
  }, [])
  /** เรียกหลังบันทึกด้วยมือสำเร็จ (ก่อน setData จากผลตอบกลับ) */
  const markSaved = useCallback(() => {
    acceptNextRef.current = true
    lastSavedRef.current = null
  }, [])

  useEffect(() => {
    const serialized = JSON.stringify(data)
    if (lastSavedRef.current == null || acceptNextRef.current) {
      // mount ครั้งแรก หรือข้อมูลที่เพิ่งบันทึกด้วยมือ
      acceptNextRef.current = false
      lastSavedRef.current = serialized
      return
    }
    if (!enabled || !dirtyRef.current || serialized === lastSavedRef.current) return
    const timer = setTimeout(async () => {
      if (savingRef.current) return
      setStatus({ kind: 'saving' })
      try {
        const ok = await saveRef.current()
        if (ok) {
          lastSavedRef.current = serialized
          setStatus({ kind: 'saved', at: new Date() })
        } else {
          setStatus({ kind: 'error', message: 'บันทึกอัตโนมัติไม่สำเร็จ' })
        }
      } catch (error) {
        setStatus({ kind: 'error', message: (error as Error)?.message || 'บันทึกอัตโนมัติไม่สำเร็จ' })
      }
    }, delayMs)
    return () => clearTimeout(timer)
  }, [data, enabled, delayMs])

  return { status, markDirty, markSaved }
}

export function describeAutosave(status: AutosaveStatus): string {
  switch (status.kind) {
    case 'saving':
      return 'กำลังบันทึกอัตโนมัติ…'
    case 'saved':
      return `บันทึกอัตโนมัติเมื่อ ${status.at.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`
    case 'error':
      return status.message
    default:
      return ''
  }
}

