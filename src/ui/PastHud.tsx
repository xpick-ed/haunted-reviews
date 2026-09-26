import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { EPISODES, usePast, type EpisodeId } from '../world/past'
import { MEMORIES } from '../world/memories'
import './PastHud.css'

// 回到 1958 的 HUD（DESIGN §27.1）：老照片的顏色（泛黃、顆粒、暗角、微微閃）、
// 開場標題卡「一九五八・嫁過來那天」、目前的目標、結尾卡（回到現在）。

/** 底片顆粒：一張小小的雜訊圖，整個畫面重複貼、一直跳位置 */
let GRAIN: string | null = null
function grainUrl() {
  if (GRAIN) return GRAIN
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(128, 128)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 40
  }
  ctx.putImageData(img, 0, 0)
  GRAIN = c.toDataURL()
  return GRAIN
}

/** 結尾卡幾秒後自己回到現在 */
const AUTO_BACK_MS = 12000

export function PastHud() {
  const past = useStore((s) => s.past)
  const scene = useStore((s) => s.scene)
  const exitPast = useStore((s) => s.exitPast)
  const st = usePast()
  const [titleOn, setTitleOn] = useState(true)
  const grain = useMemo(() => grainUrl(), [])
  const ep = past?.episode as EpisodeId | undefined

  // 標題卡：進來後 3 秒淡掉
  useEffect(() => {
    if (!ep) return
    setTitleOn(true)
    const t = window.setTimeout(() => setTitleOn(false), 3000)
    return () => window.clearTimeout(t)
  }, [ep, st.startedAt])

  // 結尾卡：一段時間沒按就自己回去
  useEffect(() => {
    if (!st.ending) return
    const t = window.setTimeout(() => useStore.getState().exitPast(true), AUTO_BACK_MS)
    return () => window.clearTimeout(t)
  }, [st.ending])

  if (!past || scene !== 'past' || !ep || !EPISODES[ep]) return null
  const def = EPISODES[ep]
  const mem = MEMORIES.find((m) => m.id === def.memory)
  const objective = def.steps[st.step]?.replace('{n}', String(st.count))

  return (
    <>
      <div className="past-sepia" />
      <div className="past-vignette" />
      <div className="past-grain" style={{ backgroundImage: `url(${grain})` }} />
      {titleOn && (
        <div className="past-title">
          <div className="past-year">{def.yearText}</div>
          <div className="past-name">{def.title}</div>
        </div>
      )}
      {!titleOn && !st.ending && objective && (
        <div className="past-objective" key={`${st.step}-${st.count}`}>
          <span className="past-tag">回憶</span>
          {objective}
        </div>
      )}
      {!st.ending && (
        <button className="chip past-leave" onClick={() => exitPast(false)}>
          離開回憶
        </button>
      )}
      {st.ending && (
        <div className="past-end-backdrop">
          <div className="past-end">
            <div className="past-end-photo">
              <span className="past-end-icon">{mem?.icon ?? '📷'}</span>
              <span className="past-end-year">{mem?.year}</span>
            </div>
            <h2>
              {def.yearText}・{def.title}
            </h2>
            <p>{def.outro}</p>
            <span className="muted">這一頁回憶，相簿裡多了一段。</span>
            <button className="btn primary" onClick={() => exitPast(true)}>
              回到現在
            </button>
          </div>
        </div>
      )}
    </>
  )
}
