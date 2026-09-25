import { useEffect, useRef, useState } from 'react'
import { input } from '../world/input'

// 浮動搖桿（DESIGN §21）：手指按在畫面左半邊哪裡，搖桿就出現在哪裡。只給觸控用。

const R = 56

export function Joystick() {
  const [base, setBase] = useState<{ x: number; y: number } | null>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const pointer = useRef<number | null>(null)

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || pointer.current !== null) return
      if (e.clientX > window.innerWidth * 0.55) return
      const t = e.target as HTMLElement
      if (t.closest('button, .dialogue-wrap, .result-backdrop')) return
      pointer.current = e.pointerId
      setBase({ x: e.clientX, y: e.clientY })
      setKnob({ x: 0, y: 0 })
    }
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointer.current) return
      setBase((b) => {
        if (!b) return b
        let dx = e.clientX - b.x
        let dy = e.clientY - b.y
        const len = Math.hypot(dx, dy)
        if (len > R) {
          dx = (dx / len) * R
          dy = (dy / len) * R
        }
        setKnob({ x: dx, y: dy })
        input.joy.x = dx / R
        input.joy.y = -dy / R
        return b
      })
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointer.current) return
      pointer.current = null
      setBase(null)
      input.joy.x = 0
      input.joy.y = 0
    }
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      input.joy.x = 0
      input.joy.y = 0
    }
  }, [])

  if (!base) return null
  return (
    <div className="joystick" style={{ left: base.x - R, top: base.y - R, width: R * 2, height: R * 2 }}>
      <div className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  )
}
