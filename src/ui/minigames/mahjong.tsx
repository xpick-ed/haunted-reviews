import { useEffect, useReducer, useRef } from 'react'
import { nightSfx } from './nightlife.sound'
import {
  MAX_TURNS,
  deal,
  drawTile,
  isWin,
  isolatedTiles,
  meritForTurn,
  rankOf,
  sortTiles,
  suitOf,
  tenpaiDiscards,
  tileName,
  waitsOf,
  NUMERALS,
  type Tile,
} from './mahjong.logic'
import type { MahjongResult, MinigameProps } from './types'
import './mahjong.css'

// 跟鬼鄰居打麻將（DESIGN §29）：山上中層的麻將桌，火伯、玉姨、桂嬸三缺一。
// 簡化版：只有萬筒條，13 張，每巡摸一打一，最多十巡；4 組＋1 對就胡（自摸，或胡鬼打出來的牌）。
// 鬼也會在某一巡自摸（開局時隨機決定）。胡得越快功德越多（1–3）。
// 點一張牌選起來，再點一次打出去。聽牌的時候會提示在等哪幾張；會讓你聽牌的牌會發光。
// 鍵盤：←→ 選牌、Enter／E 打出（或胡）、Esc 不玩了。

interface Ghost {
  id: string
  name: string
  icon: string
  color: string
  discard: string[]
  win: string
  start?: string
}

const GHOSTS: Ghost[] = [
  {
    id: 'huobo',
    name: '火伯',
    icon: '火',
    color: '#8a9ab8',
    start: '年輕人，打牌要有耐心。我在這裡等了六十年。',
    discard: ['這張給妳，不要客氣。', '我年輕時候打牌，都是妳阿公在放槍給我。', '嗯……我聽了喔。騙妳的。', '部隊裡學的，打牌要穩。'],
    win: '自摸！老兵不死，只是手氣比較好。',
  },
  {
    id: 'yuyi',
    name: '玉姨',
    icon: '玉',
    color: '#c79ab8',
    start: '阿春，打牌跟嫁尪一樣：摸到好的，就要趕快留下來。',
    discard: [
      '我做媒人的，看牌也很準——這張妳不要。',
      '哎呀，這張是好牌，可惜不是我的。',
      '阿春，妳手氣跟妳煎的菜脯蛋一樣，有時候焦。',
      '不要看我，我臉上沒有牌。',
    ],
    win: '胡啦！媒人婆牽線，一牽就中。',
  },
  {
    id: 'guishen',
    name: '桂嬸',
    icon: '桂',
    color: '#a8c090',
    start: '三缺一三十年，終於湊齊了！',
    discard: ['別看我這樣，我年輕時也是自摸高手——摸牌啦！妳們在笑什麼？', '我走的那天手上是清一色，還沒胡就走了……', '快快快，天要亮了！', '這張燙手，送妳。'],
    win: '胡了！三十年了，終於胡了！',
  },
]

type Phase = 'intro' | 'mine' | 'ghost' | 'claim' | 'end'
type EndKind = 'tsumo' | 'ron' | 'ghost' | 'draw'

interface Game {
  phase: Phase
  hand: Tile[]
  drawn: Tile | null
  wall: Tile[]
  turn: number
  ghostIdx: number
  ponds: Tile[][]
  myPond: Tile[]
  /** 最近一個鬼講的話（對話框的尖角指向講話的那個鬼） */
  chat: { who: number; text: string } | null
  claim: { tile: Tile; from: number } | null
  sel: number | null
  /** 哪一巡、哪個鬼會自摸（開局決定；> MAX_TURNS 就是鬼都胡不了） */
  ghostWin: { turn: number; who: number }
  end: { kind: EndKind; from?: number; merit: number } | null
  msg: string
}

const ASSIST = 0.25
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

export default function Mahjong({ done }: MinigameProps<unknown, MahjongResult | null>) {
  const g = useRef<Game>(null as unknown as Game)
  if (!g.current) {
    const d = deal()
    g.current = {
      phase: 'intro',
      hand: d.hand,
      drawn: null,
      wall: d.wall,
      turn: 0,
      ghostIdx: 0,
      ponds: [[], [], []],
      myPond: [],
      chat: { who: 2, text: GHOSTS[2].start! },
      claim: null,
      sel: null,
      ghostWin: {
        turn: 3 + Math.floor(Math.random() * 10),
        who: Math.floor(Math.random() * 3),
      },
      end: null,
      msg: '',
    }
  }
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

  const finish = (res: MahjongResult | null) => {
    if (finished.current) return
    finished.current = true
    done(res)
  }
  const result = (): MahjongResult => {
    const e = g.current.end
    return {
      won: !!e && (e.kind === 'tsumo' || e.kind === 'ron'),
      merit: e?.merit ?? 0,
    }
  }

  const endGame = (kind: EndKind, from?: number) => {
    const s = g.current
    const won = kind === 'tsumo' || kind === 'ron'
    s.end = { kind, from, merit: won ? meritForTurn(s.turn) : 0 }
    s.phase = 'end'
    s.sel = null
    if (won) {
      nightSfx.win()
      const ronLines = ['唉唷，是我放的槍……', '我放的？……算了，給妳，好姊妹。', '我三十年沒放槍，今天破功了！']
      const tsumoLines = ['阿春好手氣！', '哎呀，被阿春胡走了。', '再來一圈啦！']
      const who = kind === 'ron' && from !== undefined ? from : Math.floor(Math.random() * 3)
      s.chat = { who, text: (kind === 'ron' ? ronLines : tsumoLines)[who] }
    } else if (kind === 'ghost') {
      nightSfx.lose()
      s.chat = { who: from ?? 0, text: GHOSTS[from ?? 0].win }
    } else {
      s.chat = { who: 0, text: '流局。大家都沒輸，最好。' }
    }
    render()
  }

  /** 新的一巡：阿嬤摸牌 */
  const startTurn = () => {
    const s = g.current
    s.turn++
    if (s.turn > MAX_TURNS || s.wall.length < 4) {
      s.turn = Math.min(s.turn, MAX_TURNS)
      endGame('draw')
      return
    }
    s.drawn = drawTile(s.hand, s.wall, ASSIST)
    s.phase = 'mine'
    s.sel = null
    s.msg = `摸到 ${tileName(s.drawn)}`
    nightSfx.clack(0.7)
    render()
  }

  const begin = () => {
    nightSfx.shuffle()
    g.current.chat = { who: 1, text: GHOSTS[1].start! }
    later(700, startTurn)
    // 摸牌前先鎖住（沒有鬼在動）
    g.current.phase = 'ghost'
    g.current.ghostIdx = -1
    render()
  }

  const fourteen = () => {
    const s = g.current
    return s.drawn === null ? s.hand : [...s.hand, s.drawn]
  }

  const discardAt = (i: number) => {
    const s = g.current
    if (s.phase !== 'mine') return
    const all = fourteen()
    const t = all[i]
    all.splice(i, 1)
    s.hand = sortTiles(all)
    s.drawn = null
    s.myPond.push(t)
    s.sel = null
    s.msg = `阿嬤打了 ${tileName(t)}`
    nightSfx.clack()
    s.phase = 'ghost'
    s.ghostIdx = 0
    render()
    later(750, ghostStep)
  }

  const tapTile = (i: number) => {
    const s = g.current
    if (s.phase !== 'mine') return
    if (s.sel === i) discardAt(i)
    else {
      s.sel = i
      nightSfx.clack(0.25)
      render()
    }
  }

  /** 一個鬼摸一張、打一張（或自摸） */
  const ghostStep = () => {
    const s = g.current
    if (s.phase !== 'ghost') return
    const i = s.ghostIdx
    if (s.turn === s.ghostWin.turn && i === s.ghostWin.who) {
      s.msg = `${GHOSTS[i].name}自摸！`
      endGame('ghost', i)
      return
    }
    const t = s.wall.pop()!
    s.ponds[i].push(t)
    if (Math.random() < 0.4) s.chat = { who: i, text: pick(GHOSTS[i].discard) }
    s.msg = `${GHOSTS[i].name}打了 ${tileName(t)}`
    nightSfx.clack(0.8)
    if (isWin([...s.hand, t])) {
      s.claim = { tile: t, from: i }
      s.phase = 'claim'
      render()
      return
    }
    render()
    nextGhost()
  }

  const nextGhost = () => {
    const s = g.current
    s.ghostIdx++
    if (s.ghostIdx >= 3) later(650, startTurn)
    else later(650, ghostStep)
  }

  const ron = () => {
    const s = g.current
    if (s.phase !== 'claim' || !s.claim) return
    s.hand = sortTiles([...s.hand, s.claim.tile])
    s.ponds[s.claim.from].pop()
    s.msg = `胡！${GHOSTS[s.claim.from].name}放槍。`
    endGame('ron', s.claim.from)
  }
  const pass = () => {
    const s = g.current
    if (s.phase !== 'claim') return
    s.claim = null
    s.phase = 'ghost'
    render()
    nextGhost()
  }
  const tsumo = () => {
    const s = g.current
    if (s.phase !== 'mine' || s.drawn === null) return
    s.hand = sortTiles([...s.hand, s.drawn])
    s.drawn = null
    s.msg = '自摸！'
    endGame('tsumo')
  }

  // 鍵盤
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = g.current
      const k = e.key
      if (k === 'Escape') {
        e.preventDefault()
        finish(s.phase === 'end' ? result() : null)
        return
      }
      const enter = k === 'Enter' || k === 'e' || k === 'E' || k === ' '
      if (s.phase === 'intro' && enter) {
        e.preventDefault()
        begin()
      } else if (s.phase === 'end' && enter) {
        e.preventDefault()
        finish(result())
      } else if (s.phase === 'claim') {
        if (enter) {
          e.preventDefault()
          ron()
        } else if (k === 'Backspace' || k === 'p' || k === 'P') {
          e.preventDefault()
          pass()
        }
      } else if (s.phase === 'mine') {
        const n = fourteen().length
        if (k === 'ArrowLeft' || k === 'ArrowRight') {
          e.preventDefault()
          s.sel = s.sel === null ? n - 1 : (s.sel + (k === 'ArrowRight' ? 1 : n - 1)) % n
          render()
        } else if (enter) {
          e.preventDefault()
          if (s.drawn !== null && isWin(fourteen())) tsumo()
          else if (s.sel !== null) discardAt(s.sel)
          else {
            s.sel = n - 1
            render()
          }
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const s = g.current
  const tiles = fourteen()
  const canTsumo = s.phase === 'mine' && s.drawn !== null && isWin(tiles)
  // 提示：13 張聽牌 → 等哪幾張；14 張 → 打哪幾張會聽牌（沒有的話：孤張）
  const waits = s.phase !== 'mine' && s.phase !== 'end' && s.phase !== 'intro' ? waitsOf(s.hand) : []
  const glow = s.phase === 'mine' && !canTsumo ? tenpaiDiscards(tiles) : []
  const lonely = s.phase === 'mine' && !canTsumo && !glow.length ? isolatedTiles(tiles) : []
  let hint = ''
  if (canTsumo) hint = '胡了！按「自摸」'
  else if (s.phase === 'mine') hint = glow.length ? '打發光的牌就聽牌了' : lonely.length ? '孤零零的牌（沒有搭子）可以先打' : '點一張牌，再點一次打出去'
  else if (waits.length) hint = `聽牌！等：${waits.map(tileName).join('、')}`

  return (
    <div className="mj-panel">
      <div className="mj-head">
        <span className="mj-title">三缺一</span>
        <span className="mj-turn">
          第 <b>{Math.max(1, s.turn)}</b> / {MAX_TURNS} 巡
        </span>
        <button className="mj-x" onClick={() => finish(s.phase === 'end' ? result() : null)} aria-label="不玩了">
          ✕
        </button>
      </div>

      <div className="mj-ghosts">
        {GHOSTS.map((gh, i) => (
          <div
            key={gh.id}
            className={`mj-ghost ${s.phase === 'ghost' && s.ghostIdx === i ? 'acting' : ''} ${s.end?.kind === 'ghost' && s.end.from === i ? 'winner' : ''}`}
          >
            <div className="mj-avatar" style={{ background: gh.color }}>
              {gh.icon}
            </div>
            <div className="mj-name">{gh.name}</div>
            <div className="mj-pond">
              {s.ponds[i].slice(-6).map((t, k) => (
                <TileFace key={k} t={t} mini />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mj-chat">
        {s.chat && (
          <div className="mj-bubble" key={s.chat.text} style={{ ['--at' as string]: `${(s.chat.who * 2 + 1) * (100 / 6)}%` }}>
            <b>{GHOSTS[s.chat.who].name}：</b>
            {s.chat.text}
          </div>
        )}
      </div>

      <div className="mj-center">
        <div className="mj-msg">{s.msg || ' '}</div>
        {s.phase === 'claim' && s.claim && (
          <div className="mj-claim">
            <TileFace t={s.claim.tile} />
            <button className="btn primary mj-hu" onClick={ron}>
              胡！
            </button>
            <button className="btn" onClick={pass}>
              過
            </button>
          </div>
        )}
        {canTsumo && (
          <div className="mj-claim">
            <button className="btn primary mj-hu" onClick={tsumo}>
              自摸！
            </button>
          </div>
        )}
      </div>

      {s.phase === 'intro' ? (
        <div className="mj-intro">
          <p>
            只有<strong>萬、筒、條</strong>。每巡摸一張、打一張，湊成
            <strong>四組＋一對</strong>就胡。
            <br />
            一組是三張連號（三四五萬）或三張一樣。鬼打出來你要的牌，也可以胡。
          </p>
          <p className="mj-small">最多十巡。鬼鄰居也在等自摸——越快胡，功德越多。</p>
          <button className="btn primary" onClick={begin}>
            開打
          </button>
        </div>
      ) : (
        <>
          <div className={`mj-hint ${waits.length || canTsumo ? 'ready' : ''}`}>{hint || ' '}</div>
          <div className="mj-hand">
            {tiles.map((t, i) => {
              const isDrawn = s.drawn !== null && i === tiles.length - 1
              return (
                <button
                  key={`${i}-${t}`}
                  className={`mj-slot ${isDrawn ? 'drawn' : ''} ${s.sel === i ? 'sel' : ''} ${glow.includes(t) ? 'glow' : ''} ${lonely.includes(t) ? 'lonely' : ''}`}
                  onClick={() => tapTile(i)}
                  disabled={s.phase !== 'mine'}
                  aria-label={tileName(t)}
                >
                  <TileFace t={t} />
                </button>
              )
            })}
          </div>
          <div className="mj-mypond">
            <span>打過：</span>
            {s.myPond.slice(-10).map((t, k) => (
              <TileFace key={k} t={t} mini />
            ))}
          </div>
        </>
      )}

      {s.phase === 'end' && s.end && (
        <div className="mj-end">
          <div className="mj-result">
            {s.end.kind === 'tsumo' ? '自摸！' : s.end.kind === 'ron' ? '胡了！' : s.end.kind === 'ghost' ? `${GHOSTS[s.end.from ?? 0].name}胡了` : '流局'}
          </div>
          <div className="mj-small">{s.end.merit > 0 ? `第 ${s.turn} 巡胡牌，功德 +${s.end.merit}` : '這圈沒胡，下次再來。'}</div>
          <button className="btn primary" onClick={() => finish(result())}>
            收牌
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 牌面（SVG）：萬是數字＋紅色的萬；筒是圓圈；條是竹子
// ---------------------------------------------------------------------------

const DOTS: [number, number][][] = [
  [[20, 27]],
  [
    [20, 15],
    [20, 39],
  ],
  [
    [10, 12],
    [20, 27],
    [30, 42],
  ],
  [
    [12, 15],
    [28, 15],
    [12, 39],
    [28, 39],
  ],
  [
    [11, 13],
    [29, 13],
    [20, 27],
    [11, 41],
    [29, 41],
  ],
  [
    [13, 11],
    [27, 11],
    [13, 27],
    [27, 27],
    [13, 43],
    [27, 43],
  ],
  [
    [9, 8],
    [20, 13],
    [31, 18],
    [13, 32],
    [27, 32],
    [13, 45],
    [27, 45],
  ],
  [
    [13, 8],
    [27, 8],
    [13, 20],
    [27, 20],
    [13, 33],
    [27, 33],
    [13, 45],
    [27, 45],
  ],
  [
    [10, 12],
    [20, 12],
    [30, 12],
    [10, 27],
    [20, 27],
    [30, 27],
    [10, 42],
    [20, 42],
    [30, 42],
  ],
]
const DOT_R = [11, 7.5, 6.5, 6.5, 6, 6, 5, 5, 5.5]
const DOT_COLORS = ['#2a5aa8', '#1e7a4a', '#c0392b']

/** 條子：[x, y, 紅的?]，一支竹子高 14 */
const STICKS: [number, number, boolean?][][] = [
  [[20, 27]],
  [
    [20, 16],
    [20, 38],
  ],
  [
    [20, 16],
    [12, 38],
    [28, 38],
  ],
  [
    [13, 16],
    [27, 16],
    [13, 38],
    [27, 38],
  ],
  [
    [12, 16],
    [28, 16],
    [20, 27, true],
    [12, 38],
    [28, 38],
  ],
  [
    [10, 16],
    [20, 16],
    [30, 16],
    [10, 38],
    [20, 38],
    [30, 38],
  ],
  [
    [20, 10, true],
    [10, 27],
    [20, 27],
    [30, 27],
    [10, 43],
    [20, 43],
    [30, 43],
  ],
  [
    [8, 16],
    [16, 16],
    [24, 16],
    [32, 16],
    [8, 38],
    [16, 38],
    [24, 38],
    [32, 38],
  ],
  [
    [10, 11],
    [20, 11, true],
    [30, 11],
    [10, 27],
    [20, 27, true],
    [30, 27],
    [10, 43],
    [20, 43, true],
    [30, 43],
  ],
]

function TileFace({ t, mini = false }: { t: Tile; mini?: boolean }) {
  const suit = suitOf(t)
  const r = rankOf(t)
  return (
    <span className={`mj-tile ${mini ? 'mini' : ''}`}>
      <svg viewBox="0 0 40 54" aria-hidden>
        {suit === 0 && (
          <>
            <text x="20" y="22" textAnchor="middle" fontSize="17" fontWeight="700" fill="#1d2a4a" fontFamily="'LXGW WenKai TC','Noto Serif TC',serif">
              {NUMERALS[r - 1]}
            </text>
            <text x="20" y="45" textAnchor="middle" fontSize="19" fontWeight="700" fill="#c0392b" fontFamily="'LXGW WenKai TC','Noto Serif TC',serif">
              萬
            </text>
          </>
        )}
        {suit === 1 &&
          DOTS[r - 1].map(([x, y], i) => {
            const rr = DOT_R[r - 1]
            const c = r === 1 ? '#c0392b' : DOT_COLORS[(i + r) % 3]
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={rr} fill={c} />
                <circle cx={x} cy={y} r={rr * 0.62} fill="#fbf6ea" />
                <circle cx={x} cy={y} r={rr * 0.3} fill={c} />
              </g>
            )
          })}
        {suit === 2 &&
          (r === 1 ? (
            // 一條：一支大竹子（真的牌是一隻鳥）
            <g>
              <rect x="15" y="6" width="10" height="42" rx="5" fill="#1e7a4a" />
              <rect x="15" y="18" width="10" height="3" fill="#c0392b" />
              <rect x="15" y="33" width="10" height="3" fill="#c0392b" />
            </g>
          ) : (
            STICKS[r - 1].map(([x, y, red], i) => (
              <g key={i}>
                <rect x={x - 2.8} y={y - 7} width="5.6" height="14" rx="2.8" fill={red ? '#c0392b' : '#1e7a4a'} />
                <rect x={x - 2.8} y={y - 0.8} width="5.6" height="1.6" fill="#fbf6ea" opacity="0.8" />
              </g>
            ))
          ))}
      </svg>
    </span>
  )
}
