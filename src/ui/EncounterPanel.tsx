import { useEffect, useSyncExternalStore } from 'react'
import { useStore } from '../store'
import { nameOf } from '../world/lines'
import { voice } from '../audio/voice'
import { doneEncounters, encounterState, encounterTiming, pickWhisper, subscribeEncounter } from '../world/night/encounters'
import './EncounterPanel.css'

// 客人之間的故事（DESIGN §27.2）：兩位客人半夜聊天時，阿嬤在旁邊「耳語」推他們一把。
// 聊天中：下方一條小提示（走近 5 公尺才能耳語）；到了分岔點：耳語選項（1／2／3），8 秒內沒選就照預設的走。

// 台詞的長度用語音檔的秒數（有的話），講完才接下一句
encounterTiming.voiceDur = (id) => voice.duration(id)

export function EncounterPanel() {
  useSyncExternalStore(subscribeEncounter, () => encounterState.version)
  const v = encounterState.view
  const scene = useStore((s) => s.scene)
  const phase = useStore((s) => s.phase)
  const blocked = useStore((s) => !!s.dialogue || !!s.minigame || !!s.summary || !!s.month || !!s.panel || s.intro)
  const flags = useStore((s) => s.flags)

  // 存檔裡演過的故事（旗標 enc_<id>_done）同步進邏輯那邊，之後的晚上就不會再演
  useEffect(() => {
    for (const k of Object.keys(flags)) {
      const m = /^enc_(.+)_done$/.exec(k)
      if (m && flags[k]) doneEncounters.add(m[1])
    }
  }, [flags])

  const choosing = !!v && v.phase === 'choice' && !!v.choice
  // 數字鍵 1／2／3 選耳語
  useEffect(() => {
    if (!choosing) return
    const onKey = (e: KeyboardEvent) => {
      const i = ['1', '2', '3'].indexOf(e.key)
      if (i < 0) return
      e.preventDefault()
      pickWhisper(i)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choosing])

  if (!v || v.phase === 'done' || scene !== 'home' || phase !== 'night' || blocked) return null
  const who = `${nameOf(v.a)}和${nameOf(v.b)}`

  if (!choosing) {
    return (
      <div className={`enc-pill ${v.inRange ? 'near' : ''}`}>
        <span className="enc-bubble">💬</span>
        <span>
          {who}在{v.place}
          {v.phase === 'walk' ? '碰面了' : '聊天'}
        </span>
        <span className="enc-hint">{v.inRange ? '阿嬤在旁邊聽……' : '走近一點就能耳語'}</span>
      </div>
    )
  }

  const c = v.choice!
  return (
    <div className="enc-panel" onPointerDown={(e) => e.stopPropagation()}>
      <div className="enc-head">
        <span className="enc-tag">耳語</span>
        <span className="enc-title">阿嬤在旁邊聽……</span>
        <span className="enc-story">
          {who}・{v.title}
        </span>
      </div>
      {v.last && (
        <div className="enc-last">
          <b>{nameOf(v.last.who)}</b>
          <span>{v.last.text}</span>
        </div>
      )}
      <div className="enc-options">
        {c.options.map((o, i) => (
          <button key={i} className="enc-option" onClick={() => pickWhisper(i)}>
            <span className="enc-key">{i + 1}</span>
            <span className="enc-text">（耳語）{o}</span>
          </button>
        ))}
      </div>
      <div className="enc-timer">
        <i style={{ width: `${(c.remaining / c.total) * 100}%` }} />
      </div>
      <div className="enc-foot">不選的話，就讓他們自己聊下去</div>
    </div>
  )
}
