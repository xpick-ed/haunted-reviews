import { useEffect, useReducer, useRef } from 'react'
import { portraitDataUrl } from '../../art/portraits'
import { nightSfx } from './nightlife.sound'
import type { DrinkingResult, MinigameProps } from './types'
import './drinking.css'

// 划酒拳（DESIGN §29）：跟土地公廟的阿義，台灣式的划拳。
// 兩邊同時出 0–5 根手指，同時喊「兩個人加起來」的數；喊中的贏，輸的喝（阿嬤喝茶）。
// 要跟著拍子出拳：「來喔～、划～、出！」出的那拍還沒喊就算慢了、罰一杯。先贏四拳的贏（七戰四勝）。
// 阿義喝越多越晃、講話越含糊，還會喊出不可能的數。鍵盤：0–5 出幾根、←→ 也可以；↑↓ 選要喊的、Enter／E 出拳，Esc 不玩了。

const CALLS = ['寶一對', '一定發', '兩隻好', '三星照', '四季發財', '五魁首', '六六順', '七巧', '八仙過海', '九長久', '十全美']
const WIN_AT = 4
const CHANT = ['來喔～', '划～', '出！']

type Phase = 'intro' | 'chant' | 'reveal' | 'end'
interface Throw {
  f: number
  c: number
}
type Outcome = 'me' | 'ayi' | 'again' | 'late'

interface Game {
  phase: Phase
  beat: number
  fingers: number
  /** 選單游標（鍵盤）：要喊「自己的手指 + k」 */
  cursor: number
  mine: Throw | null
  ayi: Throw
  oops: boolean
  outcome: Outcome | null
  me: number
  them: number
  cups: number
  tea: number
  /** 阿嬤出過的手指（阿義會猜） */
  hist: number[]
  bubble: string
  msg: string
}

const rint = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1))

/** 喝越多講話越含糊 */
function slur(text: string, cups: number) {
  if (cups < 2) return text
  const chars = [...text]
  if (cups >= 4 && chars.length > 1) chars.splice(1, 0, `、${chars[0]}`)
  let out = chars.join('')
  if (cups >= 2) out = out.replace(/([。！？]|$)/, cups >= 5 ? '～～嗝$1' : '～嗝$1')
  return out
}

/** 阿義要出什麼：清醒的時候會猜阿嬤；醉了愛出五根，偶爾喊出根本不可能的數 */
function ayiThrow(cups: number, hist: number[]): { t: Throw; oops: boolean } {
  const f = cups >= 3 && Math.random() < 0.45 ? 5 : rint(0, 5)
  const guess = hist.length && Math.random() < 0.5 ? hist[hist.length - 1] : rint(0, 5)
  const oops = cups >= 2 && Math.random() < 0.1 + 0.05 * Math.min(cups, 6)
  if (oops) return { t: { f, c: f > 0 ? rint(0, f - 1) : rint(6, 10) }, oops }
  return { t: { f, c: f + guess }, oops }
}

const beatMs = (cups: number) => 1050 + 80 * Math.min(cups, 5)

export default function Drinking({ done }: MinigameProps<unknown, DrinkingResult | null>) {
  const g = useRef<Game>({
    phase: 'intro',
    beat: -1,
    fingers: 2,
    cursor: 0,
    mine: null,
    ayi: { f: 0, c: 0 },
    oops: false,
    outcome: null,
    me: 0,
    them: 0,
    cups: 0,
    tea: 0,
    hist: [],
    bubble: '阿春姐！來，划兩拳！嗝。',
    msg: '',
  })
  const [, render] = useReducer((x: number) => x + 1, 0)
  const timers = useRef<number[]>([])
  const finished = useRef(false)
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))
  useEffect(
    () => () => {
      for (const t of timers.current) window.clearTimeout(t)
    },
    [],
  )

  const finish = (res: DrinkingResult | null) => {
    if (finished.current) return
    finished.current = true
    done(res)
  }

  const startRound = () => {
    const s = g.current
    const a = ayiThrow(s.cups, s.hist)
    Object.assign(s, {
      phase: 'chant',
      beat: 0,
      mine: null,
      ayi: a.t,
      oops: a.oops,
      outcome: null,
      msg: '',
      bubble: slur(CHANT[0], s.cups),
    })
    nightSfx.beat()
    render()
    const b = beatMs(s.cups)
    later(b, () => {
      s.beat = 1
      s.bubble = slur(CHANT[1], s.cups)
      nightSfx.beat()
      render()
    })
    later(b * 2, () => {
      s.beat = 2
      s.bubble = CHANT[2]
      nightSfx.beat(true)
      render()
    })
    // 「出！」之後留一點點寬限
    later(b * 2 + 220, resolve)
  }

  const resolve = () => {
    const s = g.current
    if (s.phase !== 'chant') return
    nightSfx.slap()
    const a = s.ayi
    let outcome: Outcome
    if (!s.mine) outcome = 'late'
    else {
      const total = s.mine.f + a.f
      const meHit = s.mine.c === total
      const ayHit = !s.oops && a.c === total
      // 阿義喊了不可能的數：直接算他輸（自罰）
      outcome = s.oops || (meHit && !ayHit) ? 'me' : ayHit && !meHit ? 'ayi' : 'again'
      s.hist.push(s.mine.f)
    }
    s.outcome = outcome
    s.phase = 'reveal'
    const call = CALLS[a.c] ?? `${a.c}`
    s.bubble = slur(`${call}！`, s.cups)
    if (outcome === 'me') {
      s.me++
      s.cups++
      s.msg = s.oops ? `阿義喊「${call}」……他自己就出了 ${a.f} 根，根本不可能嘛！自罰一杯。` : '喊中了！阿義喝一杯。'
      later(500, () => {
        nightSfx.gulp()
        s.bubble = slur(s.oops ? '咦？我、我數錯了……我喝。' : pickOne(['嗝……我喝！', '好啦好啦，我喝。', '妳這個阿嬤，手很賊喔！']), s.cups)
        render()
      })
    } else if (outcome === 'ayi' || outcome === 'late') {
      s.them++
      s.tea++
      s.msg = outcome === 'late' ? '慢了一拍！阿嬤罰茶一杯。' : '被阿義喊中了！阿嬤喝一杯茶。'
      later(500, () => {
        nightSfx.clink()
        // 喝茫了：贏了也要喝一杯慶祝
        if (s.cups >= 3 && Math.random() < 0.4) {
          s.cups++
          s.bubble = slur('贏了也要喝一杯慶祝！', s.cups)
          s.msg += ' 阿義也跟著乾了一杯……'
        } else s.bubble = slur(outcome === 'late' ? '哈哈！阿春姐，要跟上拍子啦！' : '哈！妳臉上都寫著啦！', s.cups)
        render()
      })
    } else {
      s.msg = '都沒喊中——再來！'
    }
    render()
    const over = s.me >= WIN_AT || s.them >= WIN_AT
    later(outcome === 'again' ? 1100 : 1900, () => {
      if (over) {
        s.phase = 'end'
        s.bubble = slur(s.me >= WIN_AT ? '嗝……輸了輸了，今晚妳最大。' : '哈哈！阿春姐，下次再來報仇！', s.cups)
        if (s.me >= WIN_AT) nightSfx.win()
        else nightSfx.lose()
        render()
      } else startRound()
    })
  }

  const throwCall = (k: number) => {
    const s = g.current
    if (s.phase !== 'chant' || s.mine) return
    const c = s.fingers + k
    if (c > 10) return
    s.mine = { f: s.fingers, c }
    s.cursor = k
    nightSfx.beat()
    render()
  }

  const setFingers = (n: number) => {
    const s = g.current
    if (s.phase === 'end' || (s.phase === 'chant' && s.mine)) return
    s.fingers = Math.max(0, Math.min(5, n))
    render()
  }

  const begin = () => {
    nightSfx.clink()
    startRound()
  }

  // 鍵盤
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = g.current
      const k = e.key
      if (k === 'Escape') {
        e.preventDefault()
        finish(s.phase === 'end' ? { wins: s.me, cups: s.cups } : null)
        return
      }
      if (k === 'Enter' || k === 'e' || k === 'E' || k === ' ') {
        e.preventDefault()
        if (s.phase === 'intro') begin()
        else if (s.phase === 'end') finish({ wins: s.me, cups: s.cups })
        else throwCall(s.cursor)
        return
      }
      if (/^[0-5]$/.test(k)) {
        e.preventDefault()
        setFingers(+k)
      } else if (k === 'ArrowLeft' || k === 'ArrowRight') {
        e.preventDefault()
        setFingers(s.fingers + (k === 'ArrowRight' ? 1 : -1))
      } else if (k === 'ArrowUp' || k === 'ArrowDown') {
        e.preventDefault()
        s.cursor = (s.cursor + (k === 'ArrowDown' ? 1 : 5)) % 6
        render()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const s = g.current
  const shown = s.phase === 'reveal' || s.phase === 'end'
  const tipsy = Math.min(s.cups, 6)
  return (
    <div className={`dk-panel tipsy-${tipsy}`}>
      <div className="dk-head">
        <span className="dk-title">划酒拳</span>
        <span className="dk-score">
          阿嬤 <b>{s.me}</b> : <b>{s.them}</b> 阿義
        </span>
        <button className="dk-x" onClick={() => finish(s.phase === 'end' ? { wins: s.me, cups: s.cups } : null)} aria-label="不玩了">
          ✕
        </button>
      </div>

      <div className="dk-ayi">
        <div
          className="dk-face"
          style={{
            ['--sway' as string]: `${tipsy * 2.2}deg`,
            ['--flush' as string]: `${Math.min(1, s.cups / 5)}`,
          }}
        >
          <img src={portraitDataUrl('ayi')} alt="阿義" draggable={false} />
          <i className="dk-flush" />
        </div>
        <div className="dk-bubble" key={s.bubble}>
          {s.bubble}
        </div>
      </div>

      <div className="dk-table">
        <div className="dk-side top">
          <Hand n={shown ? s.ayi.f : 0} flip shaking={s.phase === 'chant'} skin="#f1bf9c" />
          {shown && <span className={`dk-call ${s.outcome === 'ayi' ? 'hit' : ''}`}>{CALLS[s.ayi.c] ?? s.ayi.c}</span>}
        </div>
        <div className="dk-beats">
          {CHANT.map((w, i) => (
            <span key={i} className={`dk-beat ${s.phase === 'chant' && s.beat >= i ? 'on' : ''} ${i === 2 ? 'go' : ''}`}>
              {w}
            </span>
          ))}
        </div>
        <div className="dk-side bottom">
          <Hand n={shown ? (s.mine?.f ?? s.fingers) : s.mine ? s.mine.f : 0} shaking={s.phase === 'chant' && !s.mine} skin="#f3cfae" />
          {(shown || s.mine) && <span className={`dk-call mine ${s.outcome === 'me' ? 'hit' : ''}`}>{s.mine ? CALLS[s.mine.c] : '（慢了）'}</span>}
        </div>
      </div>

      <div className="dk-cups">
        <span>
          阿義喝了{' '}
          {Array.from({ length: s.cups }, (_, i) => (
            <i key={i} className="dk-cup" />
          ))}
          {s.cups === 0 && '0 杯'}
        </span>
        <span>
          阿嬤的茶 {'🍵'.repeat(s.tea)}
          {s.tea === 0 && '0 杯'}
        </span>
      </div>

      {s.phase === 'intro' && (
        <div className="dk-intro">
          <p>
            兩個人<strong>同時</strong>出 0–5 根手指，同時喊「兩個人加起來」是多少。
            <br />
            喊中的贏，沒喊中的喝。跟著拍子：<strong>來喔～、划～、出！</strong>
            「出！」之前一定要喊。
          </p>
          <p className="dk-small">先選好要出幾根，出拳的時候再點要喊的數。先贏四拳的贏。</p>
          <button className="btn primary" onClick={begin}>
            來！
          </button>
        </div>
      )}

      {(s.phase === 'chant' || s.phase === 'reveal') && (
        <>
          <div className="dk-label">出幾根？</div>
          <div className="dk-fingers">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                className={`dk-f ${s.fingers === n ? 'sel' : ''}`}
                onClick={() => setFingers(n)}
                disabled={s.phase === 'chant' && !!s.mine}
                aria-label={`出 ${n} 根`}
              >
                <Hand n={n} skin="#f3cfae" mini />
                <span>{n}</span>
              </button>
            ))}
          </div>
          <div className="dk-label">喊！（兩個人加起來）</div>
          <div className="dk-calls">
            {[0, 1, 2, 3, 4, 5].map((k) => {
              const c = s.fingers + k
              return (
                <button
                  key={k}
                  className={`dk-c ${s.mine?.c === c ? 'sel' : ''} ${s.cursor === k ? 'cur' : ''}`}
                  onClick={() => throwCall(k)}
                  disabled={s.phase !== 'chant' || !!s.mine}
                >
                  <b>{CALLS[c]}</b>
                  <small>{c}</small>
                </button>
              )
            })}
          </div>
        </>
      )}

      {s.phase === 'end' && (
        <div className="dk-end">
          <div className="dk-result">{s.me >= WIN_AT ? '阿嬤贏了！' : '阿義贏了！'}</div>
          <div className="dk-small">
            阿義喝了 {s.cups} 杯，阿嬤喝了 {s.tea} 杯茶。
          </div>
          <button className="btn primary" onClick={() => finish({ wins: s.me, cups: s.cups })}>
            收杯
          </button>
        </div>
      )}

      <div className="dk-msg">{s.msg || (s.phase === 'chant' ? (s.mine ? '出拳了！' : '跟著拍子，「出！」之前喊！') : '')}</div>
      <div className="dk-foot">喝酒不騎車，騎車不喝酒。</div>
    </div>
  )
}

function pickOne<T>(xs: T[]) {
  return xs[Math.floor(Math.random() * xs.length)]
}

/** 手：n 根手指伸出來（0 是拳頭）；flip 是對面阿義的手（倒過來） */
function Hand({ n, flip = false, shaking = false, skin, mini = false }: { n: number; flip?: boolean; shaking?: boolean; skin: string; mini?: boolean }) {
  // 伸出來的順序：食指、中指、無名指、小指，第五根是大拇指
  const up = [n >= 1, n >= 2, n >= 3, n >= 4]
  const thumb = n >= 5
  const xs = [15, 23.5, 32, 40.5]
  return (
    <svg className={`dk-hand ${flip ? 'flip' : ''} ${shaking ? 'shake' : ''} ${mini ? 'mini' : ''}`} viewBox="0 0 60 72" aria-hidden>
      <g fill={skin} stroke="#5a3a28" strokeWidth="2" strokeLinejoin="round">
        {xs.map((x, i) =>
          up[i] ? (
            <rect key={i} x={x - 3.8} y={i === 1 ? 4 : i === 3 ? 12 : 7} width="7.6" height="34" rx="3.8" />
          ) : (
            <rect key={i} x={x - 3.8} y="26" width="7.6" height="14" rx="3.8" />
          ),
        )}
        <rect x="9" y="30" width="40" height="34" rx="11" />
        {thumb ? <rect x="-3" y="30" width="7.6" height="24" rx="3.8" transform="rotate(-38 4 52)" /> : <rect x="12" y="38" width="22" height="8" rx="4" />}
      </g>
    </svg>
  )
}
