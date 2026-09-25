import { useEffect, useState } from 'react'
import { useStore } from '../store'

// 開場的木門：手機瀏覽器要點過一次才能出聲（DESIGN §15.4）。
export function Intro() {
  const started = useStore((s) => s.started)
  const openDoor = useStore((s) => s.openDoor)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (!started) return
    const t = window.setTimeout(() => setGone(true), 1700)
    return () => window.clearTimeout(t)
  }, [started])

  if (gone) return null
  return (
    <div className={`intro ${started ? 'open' : ''}`} onClick={openDoor}>
      <div className="door">
        <div className="door-panel left" />
        <div className="door-panel right" />
      </div>
      <div className="intro-text">
        <h1>靈異好評</h1>
        <p>阿嬤只是想招待客人</p>
        <span className="tap">點一下開門</span>
      </div>
    </div>
  )
}
