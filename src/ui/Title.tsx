import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { readSave } from '../world/save'

// 標題畫面：木門。按「開始」或「繼續」時門打開，同時啟動音訊（手機瀏覽器要點一下才能出聲）。

export function Title() {
  const started = useStore((s) => s.started)
  const [gone, setGone] = useState(false)
  const save = readSave()

  useEffect(() => {
    if (!started) return
    const t = window.setTimeout(() => setGone(true), 1700)
    return () => window.clearTimeout(t)
  }, [started])

  if (gone) return null
  return (
    <div className={`intro ${started ? 'open' : ''}`}>
      <div className="door">
        <div className="door-panel left" />
        <div className="door-panel right" />
      </div>
      <div className="intro-text">
        <h1>靈異好評</h1>
        <p>阿嬤只是想招待客人</p>
        <div className="title-buttons">
          {save && (
            <button className="tap" onClick={() => useStore.getState().continueGame()}>
              繼續 · 第 {save.nightCount} 晚
            </button>
          )}
          <button className={save ? 'tap secondary' : 'tap'} onClick={() => useStore.getState().newGame()}>
            {save ? '重新開始' : '開門'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** 轉場黑幕：換場景、天黑、打盹 */
export function Blackout() {
  const on = useStore((s) => s.blackout)
  const scene = useStore((s) => s.scene)
  const phase = useStore((s) => s.phase)
  const [label, setLabel] = useState<string | null>(null)
  const [prev, setPrev] = useState(scene)
  useEffect(() => {
    if (scene !== prev) {
      setPrev(scene)
      setLabel(scene === 'temple' ? '土地公廟' : '阿春民宿')
      const t = window.setTimeout(() => setLabel(null), 2200)
      return () => window.clearTimeout(t)
    }
  }, [scene, prev])
  useEffect(() => {
    if (phase === 'night') {
      setLabel('深夜 22:00')
      const t = window.setTimeout(() => setLabel(null), 2400)
      return () => window.clearTimeout(t)
    }
  }, [phase])
  return (
    <>
      <div className={`blackout ${on ? 'on' : ''}`} />
      {label && (
        <div className="scene-card" key={label}>
          {label}
        </div>
      )}
    </>
  )
}
