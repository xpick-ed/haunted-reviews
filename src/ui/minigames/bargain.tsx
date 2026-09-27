import { useEffect, useReducer, useRef } from 'react'
import { BARGAIN, TACTICS, dealHand, playTactic, settle, startBargain, talkOf, type BargainParams, type BargainResult, type BargainState, type Reaction, type Tactic, type Timing } from './bargain.logic'
import type { MinigameProps } from './types'
import './bargain.css'

// 殺價（DESIGN §32.1）：黃昏市場跟攤販你來我往。每回合從三張牌挑一招，再抓「語氣」：
// 指針左右跑，停在綠色裡講出去才有力（金色最好）。每個攤販有一招最吃、一招最討厭；同一招連用效果減半；
// 耐心（三顆心）用完她就翻臉不賣。隨時可以按「成交」。最多四回合。
// 鍵盤：1–3 挑牌、空白鍵／Enter／E 講出去、D 成交、Esc 不殺了。

export type { BargainParams, BargainResult } from './bargain.logic'

type Phase = 'pick' | 'tone' | 'react' | 'end'

/** 指針來回一趟的時間（秒）；綠色、金色的寬度（0–1） */
const PERIOD = 1.5
const GOOD_W = 0.26
const PERFECT_W = 0.09

interface Game {
  phase: Phase
  st: BargainState
  hand: Tactic[]
  pick: Tactic | null
  /** 語氣的綠色區中心 */
  zone: number
  t0: number
  bubble: string
  mine: string
  reaction: Reaction | null
  lastCut: number
  lastTiming: Timing | null
}

const REACT_FACE: Record<Reaction, string> = { love: '😊', ok: '🙂', meh: '😐', hate: '😠', repeat: '🙄', angry: '😡' }
const TIMING_TEXT = ['語氣不對……', '講得不錯！', '講得剛剛好！']

/** 指針現在的位置（0–1，來回跑） */
function needleAt(t0: number, now: number) {
  const p = (((now - t0) / 1000 / PERIOD) % 1 + 1) % 1
  return p < 0.5 ? p * 2 : 2 - p * 2
}

export default function Bargain({ params, done }: MinigameProps<BargainParams, BargainResult>) {
  const p = params
  const talk = talkOf(p.vendor)
  const rnd = Math.random
  const g = useRef<Game>({
    phase: 'pick',
    st: startBargain(p),
    hand: dealHand(p, rnd),
    pick: null,
    zone: 0.5,
    t0: 0,
    bubble: talk.opener,
    mine: '',
    reaction: null,
    lastCut: 0,
    lastTiming: null,
  })
  const [, render] = useReducer((n: number) => n + 1, 0)
  const finished = useRef(false)
  const needleEl = useRef<HTMLDivElement>(null)
  const timer = useRef<number | null>(null)

  const finish = (r: BargainResult | null) => {
    if (finished.current) return
    finished.current = true
    if (timer.current) window.clearTimeout(timer.current)
    done(r as BargainResult)
  }

  const end = () => {
    const s = g.current
    s.phase = 'end'
    s.bubble = s.st.angry ? talk.angry : talk.deal
    render()
  }

  const choose = (t: Tactic) => {
    const s = g.current
    if (s.phase !== 'pick') return
    s.pick = t
    s.phase = 'tone'
    s.zone = 0.22 + Math.random() * 0.56
    s.t0 = performance.now()
    s.mine = TACTICS[t].say[Math.floor(Math.random() * TACTICS[t].say.length)]
    render()
  }

  const speak = () => {
    const s = g.current
    if (s.phase !== 'tone' || !s.pick) return
    // 用按下去那一刻的真正位置算（不是上一幀畫出來的）
    const x = needleAt(s.t0, performance.now())
    const d = Math.abs(x - s.zone)
    const timing: Timing = d <= PERFECT_W / 2 ? 2 : d <= GOOD_W / 2 ? 1 : 0
    const r = playTactic(p, s.st, s.pick, timing, rnd)
    s.st = r.next
    s.reaction = r.reaction
    s.lastCut = r.cut
    s.lastTiming = timing
    s.bubble = talk[r.reaction]
    s.phase = 'react'
    render()
    timer.current = window.setTimeout(() => {
      const x2 = g.current
      if (x2.st.angry || x2.st.round >= BARGAIN.rounds) {
        end()
        return
      }
      x2.phase = 'pick'
      x2.pick = null
      x2.hand = dealHand(p, rnd)
      render()
    }, 1500)
  }

  const deal = () => {
    const s = g.current
    if (s.phase === 'end' || s.phase === 'react') return
    end()
  }

  // 指針動畫（不經過 React：直接改 style）
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const s = g.current
      if (needleEl.current && s.phase === 'tone') needleEl.current.style.left = `${needleAt(s.t0, performance.now()) * 100}%`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // 鍵盤
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = g.current
      const k = e.key
      if (k === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        finish(s.phase === 'end' ? settle(p, s.st) : null)
        return
      }
      if (s.phase === 'pick' && ['1', '2', '3'].includes(k)) {
        e.preventDefault()
        e.stopPropagation()
        choose(s.hand[Number(k) - 1])
      } else if (s.phase === 'tone' && (k === ' ' || k === 'Enter' || k === 'e' || k === 'E')) {
        e.preventDefault()
        e.stopPropagation()
        speak()
      } else if ((k === 'd' || k === 'D') && s.phase === 'pick') {
        e.preventDefault()
        e.stopPropagation()
        deal()
      } else if (s.phase === 'end' && (k === ' ' || k === 'Enter' || k === 'e' || k === 'E')) {
        e.preventDefault()
        e.stopPropagation()
        finish(settle(p, s.st))
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), [])

  const s = g.current
  const saved = p.base - s.st.price
  const face = s.reaction ? REACT_FACE[s.reaction] : '🙂'
  return (
    <div className="bg-panel">
      <div className="bg-head">
        <span className="bg-title">殺價</span>
        <span className="bg-item">
          {p.itemName}・原價 ${p.base}
        </span>
        <button className="bg-x" onClick={() => finish(s.phase === 'end' ? settle(p, s.st) : null)} aria-label="不殺了">
          ✕
        </button>
      </div>

      <div className="bg-vendor">
        <div className={`bg-face ${s.reaction ?? ''}`}>
          <span className="bg-initial">{p.name.replace(/^阿/, '')[0]}</span>
          <span className="bg-mood">{face}</span>
        </div>
        <div className="bg-bubble" key={s.bubble}>
          <b>{p.name}</b>
          {s.bubble}
        </div>
      </div>

      <div className="bg-status">
        <div className="bg-price">
          <span className="bg-now">${s.st.price}</span>
          {saved > 0 && <span className="bg-saved">省 ${saved}</span>}
        </div>
        <div className="bg-meters">
          <span className="bg-hearts" aria-label={`耐心 ${s.st.patience}`}>
            耐心 {Array.from({ length: BARGAIN.patience }, (_, i) => (i < s.st.patience ? '❤️' : '🖤')).join('')}
          </span>
          <span className="bg-rounds">
            {Array.from({ length: BARGAIN.rounds }, (_, i) => (
              <i key={i} className={i < s.st.round ? 'used' : ''} />
            ))}
          </span>
        </div>
      </div>

      {s.phase === 'pick' && (
        <>
          <div className="bg-label">要怎麼講？</div>
          <div className="bg-cards">
            {s.hand.map((t, i) => (
              <button key={t} className={`bg-card ${s.st.last === t ? 'used' : ''}`} onClick={() => choose(t)}>
                <span className="bg-icon">{TACTICS[t].icon}</span>
                <b>{TACTICS[t].name}</b>
                <small>{s.st.last === t ? '剛剛用過' : `${i + 1}`}</small>
              </button>
            ))}
          </div>
        </>
      )}

      {(s.phase === 'tone' || s.phase === 'react') && (
        <>
          <div className="bg-mine">
            <b>阿嬤</b>「{s.mine}」
          </div>
          <div className="bg-tone">
            <div className="bg-zone" style={{ left: `${(s.zone - GOOD_W / 2) * 100}%`, width: `${GOOD_W * 100}%` }} />
            <div className="bg-zone perfect" style={{ left: `${(s.zone - PERFECT_W / 2) * 100}%`, width: `${PERFECT_W * 100}%` }} />
            <div ref={needleEl} className="bg-needle" style={s.phase === 'react' ? { visibility: 'hidden' } : undefined} />
          </div>
          {s.phase === 'tone' ? (
            <button className="btn primary big bg-speak" onClick={speak}>
              講出去！
            </button>
          ) : (
            <div className={`bg-result t${s.lastTiming ?? 0}`}>
              {TIMING_TEXT[s.lastTiming ?? 0]}
              {s.lastCut > 0 ? `　便宜 $${s.lastCut}` : s.reaction === 'hate' ? '　她不高興了……' : ''}
            </div>
          )}
        </>
      )}

      {s.phase === 'end' && (
        <div className="bg-end">
          <div className="bg-final">{s.st.angry ? '沒買成……' : `成交！$${s.st.price}`}</div>
          <div className="bg-small">{s.st.angry ? '被趕走了。等一下再去跟她買原價的吧。' : saved > 0 ? `比原價便宜 $${saved}。` : '原價買。'}</div>
          <button className="btn primary" onClick={() => finish(settle(p, s.st))}>
            好
          </button>
        </div>
      )}

      {s.phase === 'pick' && (
        <div className="bg-foot">
          <button className="btn" onClick={deal}>
            成交（${s.st.price}）
          </button>
          <span className="bg-hint">每個攤販有最吃的一招，也有最討厭的。</span>
        </div>
      )}
    </div>
  )
}
