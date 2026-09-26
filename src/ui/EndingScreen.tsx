import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { audio } from '../audio'
import { voice } from '../audio/voice'
import { line, nameOf } from '../world/lines'
import { ENDING_NAME, hanEpilogue, type EndingId } from '../world/story'
import { StoryArt, type ArtId } from '../scene/StoryArt'
import './EndingScreen.css'

// 結局（DESIGN §28.4）：一張一張的插畫卡片，每張一兩句有聲音的台詞（點一下／E 下一張），
// 最後是製作名單，然後「繼續經營（無盡模式）」或「重新開始」。

interface Card {
  art: ArtId
  /** 台詞 id（src/data/story2.lines.json），依序播 */
  lines: string[]
  /** 旁白（沒有聲音，寫在台詞上面） */
  note?: string
  /** 最後一張：客人的五星評論 */
  review?: boolean
}

/** 小翰決定留下來（末班車、一起回家、守著老家共用） */
const KEEP: Card[] = [
  { art: 'tear', note: '月底的早上，小翰把陳董的名片撕成四片。', lines: ['story.end.keep.1', 'story.end.keep.2'] },
  { art: 'dawnhouse', note: '他把「阿春民宿」的招牌擦得亮亮的。', lines: ['story.end.keep.3', 'story.end.keep.4'] },
]

const TRAIN_NIGHT: Card[] = [
  { art: 'nighttrain', note: '那天半夜，末班車的汽笛從甘蔗田的那頭傳過來。', lines: ['story.end.train.1'] },
  { art: 'lastwalk', note: '她最後一次走過每個房間。客人睡得很熟，阿咪在竹椅上打呼。', lines: ['story.end.train.2'] },
  { art: 'hansleep', lines: ['story.end.train.3', 'story.end.train.4'] },
]

const ENDINGS: Record<EndingId, Card[]> = {
  train: [
    ...KEEP,
    ...TRAIN_NIGHT,
    { art: 'window', note: '月台上，鬼車掌站得筆挺。', lines: ['story.end.train.5', 'story.end.train.6'] },
    { art: 'canetrain', note: '火車開過甘蔗田，窗外的燈一盞一盞往後退。', lines: ['story.end.train.7'] },
    { art: 'dawnlights', note: '天亮了，阿春民宿的燈還亮著。', lines: ['story.end.review'], review: true },
  ],
  together: [
    ...KEEP,
    ...TRAIN_NIGHT,
    { art: 'window2', note: '靠窗的位子旁邊，坐著一個穿白汗衫的少年。', lines: ['story.end.tog.1', 'story.end.tog.2'] },
    { art: 'window2', lines: ['story.end.tog.3'] },
    { art: 'shoe', note: '他小心地捧出一隻白色的膠鞋。一九五七年，流走的那一隻。', lines: ['story.end.tog.4', 'story.end.tog.5'] },
    { art: 'canetrain2', note: '兩個人並排坐著，看甘蔗田一直往後退。', lines: ['story.end.tog.6', 'story.end.tog.7'] },
    { art: 'dawnlights', note: '天亮了，阿春民宿的燈還亮著。', lines: ['story.end.review'], review: true },
  ],
  stay: [
    ...KEEP,
    { art: 'nighttrain', note: '半夜，末班車停在月台，車門開著等她。', lines: ['story.end.stay.1'] },
    { art: 'stayplatform', lines: ['story.end.stay.2', 'story.end.stay.3'] },
    { art: 'lastwalk', note: '她回到家，把客人踢掉的被子拉好。', lines: ['story.end.stay.4'] },
    { art: 'dawnlights', note: '後來，阿春民宿的評論裡，常常有人這樣寫：', lines: ['story.end.stay.5'], review: true },
  ],
  sold: [
    { art: 'contract', note: '第三個月的月底，小翰在契約上簽了名。', lines: ['story.end.sold.1', 'story.end.sold.2'] },
    { art: 'bulldozer', note: '傍晚，怪手已經開進埕裡，等著天亮動工。', lines: ['story.end.sold.3'] },
    { art: 'emptyroom', note: '最後一晚，她一個人走過每個空房間。', lines: ['story.end.sold.4'] },
    { art: 'heightmarks', note: '正身的柱子上，還留著鉛筆畫的線。', lines: ['story.end.sold.5'] },
    { art: 'nighttrain', note: '天快亮的時候，末班車來了。', lines: ['story.end.sold.6', 'story.end.sold.7'] },
    { art: 'taipei', note: '台北，小翰租的小房間。書桌上放著一張照片。', lines: ['story.end.sold.8'] },
  ],
}

const CREDITS: { h: string; items: string[] }[] = [
  { h: '《靈異好評》', items: ['一個鬼阿嬤偷偷顧民宿的故事'] },
  { h: '素材', items: ['材質貼圖：Poly Haven（CC0）', '音效：Kenney（CC0）', '角色語音：Microsoft Edge TTS 生成', '字型：Noto Sans TC、Noto Serif TC、LXGW WenKai TC（Google Fonts）'] },
  { h: '技術', items: ['three.js', 'react-three-fiber', 'zustand', 'Vite'] },
  { h: '', items: ['謝謝你陪阿春嬤走這一段。'] },
]

export function EndingScreen() {
  const ending = useStore((s) => s.ending)
  if (!ending) return null
  return <EndingPlayer key={ending} id={ending} />
}

/** 小翰感覺到阿嬤在了（hanSense ≥ 80）：多一張卡片，插在 before 那張插畫前面（DESIGN §31.2） */
function withEpilogue(id: EndingId, hanSense: number): Card[] {
  const base = ENDINGS[id]
  const ep = hanEpilogue(id, hanSense)
  if (!ep) return base
  const card: Card = { art: ep.art as ArtId, note: ep.note, lines: ep.lines }
  const at = base.findIndex((c) => c.art === ep.before)
  return at < 0 ? [...base, card] : [...base.slice(0, at), card, ...base.slice(at)]
}

function EndingPlayer({ id }: { id: EndingId }) {
  // 結局開始時的值就好（播的途中不會變）
  const cards = useMemo(() => withEpilogue(id, useStore.getState().meta.hanSense), [id])
  const finish = useStore((s) => s.finishEnding)
  // -1：標題卡；0..n-1：插畫卡片；n：製作名單
  const [i, setI] = useState(-1)
  const [shown, setShown] = useState(0)
  const lockUntil = useRef(0)

  // 音樂：慢慢的和弦（自己合成）
  useEffect(() => startPad(), [])

  // 每張卡片：依序播台詞，一句講完再出下一句
  useEffect(() => {
    lockUntil.current = performance.now() + 700
    setShown(0)
    const card = cards[i]
    if (!card) return
    let alive = true
    const timers: number[] = []
    let t = 400
    card.lines.forEach((lid, k) => {
      timers.push(
        window.setTimeout(() => {
          if (!alive) return
          setShown(k + 1)
          if (useStore.getState().voice) voice.play(lid)
        }, t),
      )
      t += Math.max(1600, (voice.duration(lid) || line(lid).text.length * 0.2) * 1000 + 500)
    })
    return () => {
      alive = false
      timers.forEach((x) => window.clearTimeout(x))
      voice.stop()
    }
  }, [i, cards])

  const next = useCallback(() => {
    if (performance.now() < lockUntil.current) return
    setI((x) => Math.min(cards.length, x + 1))
  }, [cards.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'e' || k === ' ' || k === 'enter' || k === 'arrowright') {
        e.preventDefault()
        e.stopPropagation()
        next()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [next])

  if (i >= cards.length) {
    return (
      <div className="ending-root credits">
        <div className="credits-roll">
          <div className="credits-title">結局・{ENDING_NAME[id]}</div>
          {CREDITS.map((c, k) => (
            <section key={k}>
              {c.h && <h3>{c.h}</h3>}
              {c.items.map((it) => (
                <p key={it}>{it}</p>
              ))}
            </section>
          ))}
        </div>
        <div className="ending-buttons">
          {id !== 'sold' && (
            <button className={`btn ${id === 'stay' ? 'primary' : ''}`} onClick={() => finish('continue')}>
              繼續經營（無盡模式）
            </button>
          )}
          <button className={`btn ${id === 'stay' ? '' : 'primary'}`} onClick={() => finish('restart')}>
            重新開始
          </button>
        </div>
      </div>
    )
  }

  if (i < 0) {
    return (
      <div className="ending-root" onClick={next}>
        <div className="ending-title" key="title">
          <span className="ending-kicker">結局</span>
          <h1>{ENDING_NAME[id]}</h1>
          <span className="ending-tap">點一下繼續</span>
        </div>
      </div>
    )
  }

  const card = cards[i]
  return (
    <div className="ending-root" onClick={next}>
      <div className="ending-card" key={i}>
        <div className="ending-art">
          <StoryArt id={card.art} />
          {card.review && shown > 0 && (
            <div className="ending-review">
              <div className="ending-review-stars">★★★★★</div>
              <p>{line(card.lines[0]).text}</p>
              <span>— 住過阿春民宿的客人</span>
            </div>
          )}
        </div>
        <div className="ending-caption">
          {card.note && <p className="ending-note">{card.note}</p>}
          {!card.review &&
            card.lines.slice(0, shown).map((lid) => {
              const l = line(lid)
              return (
                <p key={lid} className={`ending-line who-${l.who}`}>
                  <b>{nameOf(l.who)}</b>
                  <span>{l.text}</span>
                </p>
              )
            })}
        </div>
        <div className="ending-footer">
          <span>
            {i + 1} / {cards.length}
          </span>
          <button
            className="chip"
            onClick={(e) => {
              e.stopPropagation()
              setI(cards.length)
            }}
          >
            跳過
          </button>
        </div>
      </div>
    </div>
  )
}

/** 結局的背景音樂：幾個慢慢換的五聲音階和弦，淡入淡出（回傳停止函式） */
function startPad(): () => void {
  const ctx = audio.ctx
  if (!ctx) return () => {}
  const out = ctx.createGain()
  out.gain.value = 0
  out.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 3)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1400
  out.connect(lp).connect(audio.bus.music)
  // C、Am、F、G 的五聲音階版本（沒有半音，聽起來比較像老歌）
  const chords = [
    [261.6, 329.6, 392.0, 523.3],
    [220.0, 261.6, 329.6, 440.0],
    [174.6, 261.6, 349.2, 440.0],
    [196.0, 293.7, 392.0, 587.3],
  ]
  let k = 0
  let stopped = false
  const play = () => {
    if (stopped) return
    const t = ctx.currentTime
    for (const f of chords[k % chords.length]) {
      for (const [type, det, vol] of [
        ['sine', 0, 0.22],
        ['triangle', 4, 0.08],
      ] as const) {
        const o = ctx.createOscillator()
        o.type = type
        o.frequency.value = f
        o.detune.value = det
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(vol, t + 1.6)
        g.gain.linearRampToValueAtTime(vol * 0.7, t + 4.5)
        g.gain.linearRampToValueAtTime(0, t + 6.4)
        o.connect(g).connect(out)
        o.start(t)
        o.stop(t + 6.6)
      }
    }
    // 一個高音的小旋律（每兩個和弦一次）
    if (k % 2 === 0) {
      const notes = [784, 659.3, 587.3, 523.3]
      notes.forEach((f, n) => {
        const o = ctx.createOscillator()
        o.type = 'sine'
        o.frequency.value = f
        const g = ctx.createGain()
        const s = t + 1 + n * 0.9
        g.gain.setValueAtTime(0, s)
        g.gain.linearRampToValueAtTime(0.05, s + 0.08)
        g.gain.exponentialRampToValueAtTime(0.0001, s + 1.4)
        o.connect(g).connect(out)
        o.start(s)
        o.stop(s + 1.5)
      })
    }
    k++
  }
  play()
  const timer = window.setInterval(play, 5600)
  return () => {
    stopped = true
    window.clearInterval(timer)
    const t = ctx.currentTime
    out.gain.cancelScheduledValues(t)
    out.gain.setValueAtTime(out.gain.value, t)
    out.gain.linearRampToValueAtTime(0, t + 1.2)
    window.setTimeout(() => out.disconnect(), 1500)
  }
}

// 開發時：window.__ending('train') 直接看結局
if (import.meta.env.DEV) {
  ;(window as unknown as { __ending: (id: EndingId) => void }).__ending = (id) => useStore.setState({ ending: id } as never)
}
