'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

interface Props {
  onSave: (dataUrl: string) => void
  onClear?: () => void
  width?: number
  height?: number
  penColor?: string
  penWidth?: number
}

export default function SignaturePad({
  onSave,
  onClear,
  width = 400,
  height = 200,
  penColor = '#000',
  penWidth = 2,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasContent, setHasContent] = useState(false)

  const getPos = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      if ('touches' in e) {
        const touch = e.touches[0]
        return {
          x: (touch.clientX - rect.left) * scaleX,
          y: (touch.clientY - rect.top) * scaleY,
        }
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      }
    },
    []
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [width, height])

  const startDraw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault()
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      const pos = getPos(e)
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
      ctx.strokeStyle = penColor
      ctx.lineWidth = penWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      setDrawing(true)
    },
    [getPos, penColor, penWidth]
  )

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!drawing) return
      e.preventDefault()
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      const pos = getPos(e)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      setHasContent(true)
    },
    [drawing, getPos]
  )

  const endDraw = useCallback(() => {
    setDrawing(false)
  }, [])

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasContent(false)
    onClear?.()
  }, [onClear])

  const save = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !hasContent) return
    onSave(canvas.toDataURL('image/png'))
  }, [hasContent, onSave])

  return (
    <div className="space-y-2">
      <div
        className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white"
        style={{ width: '100%', maxWidth: width }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ width: '100%', height: 'auto', touchAction: 'none', cursor: 'crosshair' }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={clear}
          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
        >
          ล้าง
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!hasContent}
          className="px-3 py-1 text-sm bg-military-600 text-white rounded hover:bg-military-700 disabled:opacity-50"
        >
          บันทึกลายเซ็น
        </button>
      </div>
    </div>
  )
}
