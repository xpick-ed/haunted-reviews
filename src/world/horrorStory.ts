import type { GameState } from '../store'
import type { Hotspot } from './hotspots'
import { DIALOGUES, type Dialogue } from './dialogues'
import { adultOn } from '../settings'
import { CLUE_IDS, CLUES, ENVELOPE, GhostWedding, HAUNT, HauntedRoom, PIN_SPOTS, horrorState, horrorTonight, type ClueId, type PinSpot } from './night/horror'

// 大人的恐怖的互動點（冥婚的紅包、鬼新娘、玉簪；凶宅的地縛靈、三個線索）（DESIGN §29，成人內容）。
// 這個檔案不能在最上面 import store／audio（用 s.* 或 import('../store')）。
// 對話在這裡登記進 DIALOGUES（台詞在 src/data/horror.lines.json）；選了哪個選項用 _today 旗標帶回來。

// ---------------------------------------------------------------------------
// 對話
// ---------------------------------------------------------------------------

const brideFirst = (spot: PinSpot): Dialogue => ({
  steps: [
    { line: 'hor.bride.1' },
    { line: 'hor.gm.b1' },
    { line: 'hor.bride.2' },
    {
      line: 'hor.bride.3',
      choices: [
        { line: 'hor.gm.b.ask', goto: 'ask' },
        { line: 'hor.gm.b.scold', goto: 'scold' },
      ],
    },
    { label: 'ask', line: 'hor.gm.b.ask' },
    { line: 'hor.bride.4' },
    { line: 'hor.bride.5' },
    { line: `hor.bride.6.${spot}` },
    { line: 'hor.gm.b2' },
    // 跳到不存在的標籤 = 對話結束
    { line: 'hor.bride.7', set: 'hor_bride_wish_today', goto: 'end' },
    { label: 'scold', line: 'hor.gm.b.scold' },
    { line: 'hor.bride.scold', set: 'hor_bride_scold_today' },
  ],
})

const HORROR_DIALOGUES: Record<string, Dialogue> = {
  hor_envelope: { steps: [{ line: 'hor.gm.envelope' }, { line: 'hor.gm.envelope.2' }] },
  hor_bride_1_jar: brideFirst('jar'),
  hor_bride_1_altar: brideFirst('altar'),
  hor_bride_wait_jar: { steps: [{ line: 'hor.bride.wait.jar' }] },
  hor_bride_wait_altar: { steps: [{ line: 'hor.bride.wait.altar' }] },
  hor_bride_give: { steps: [{ line: 'hor.gm.b3' }, { line: 'hor.bride.8' }, { line: 'hor.bride.9' }, { line: 'hor.gm.b4' }] },

  hor_haunt_1: { steps: [{ line: 'hor.ghost.1' }, { line: 'hor.ghost.2' }, { line: 'hor.gm.h1' }, { line: 'hor.ghost.3' }, { line: 'hor.gm.h2' }] },
  hor_haunt_again: { steps: [{ line: 'hor.ghost.2' }] },
  hor_clue_diary: { steps: [{ line: 'hor.clue.diary.1' }, { line: 'hor.clue.diary.2' }] },
  hor_clue_tape: { steps: [{ line: 'hor.clue.tape.1' }, { line: 'hor.clue.tape.2' }] },
  hor_clue_id: { steps: [{ line: 'hor.clue.id.1' }, { line: 'hor.clue.id.2' }] },
  hor_haunt_2: {
    steps: [
      { line: 'hor.gm.h3' },
      { line: 'hor.ghost.4' },
      { line: 'hor.gm.h4' },
      { line: 'hor.ghost.5' },
      {
        line: 'hor.ghost.6',
        choices: [
          { line: 'hor.gm.h.gentle', goto: 'gentle' },
          { line: 'hor.gm.h.harsh', goto: 'harsh' },
        ],
      },
      { label: 'gentle', line: 'hor.gm.h.gentle' },
      { line: 'hor.gm.h5' },
      { line: 'hor.ghost.7' },
      { line: 'hor.gm.h6' },
      { line: 'hor.ghost.8', set: 'hor_haunt_free_today' },
      { line: 'hor.gm.h7', goto: 'end' },
      { label: 'harsh', line: 'hor.gm.h.harsh' },
      { line: 'hor.ghost.harsh', set: 'hor_haunt_harsh_today' },
    ],
  },
}
Object.assign(DIALOGUES, HORROR_DIALOGUES)

/** 對話結束後讀最新的旗標（s 是開始對話那一刻的快照） */
const freshFlags = () => import('../store').then(({ useStore }) => useStore.getState().flags)

// ---------------------------------------------------------------------------
// 互動點
// ---------------------------------------------------------------------------

const wedding = () => {
  const c = horrorState.current
  return c instanceof GhostWedding && c.active ? c : null
}
const haunt = () => {
  const c = horrorState.current
  return c instanceof HauntedRoom && c.active ? c : null
}
/** 晚上、成人內容開著、陰陽眼開著 */
const seeing = (s: GameState) => s.phase === 'night' && s.vision && adultOn()
const FAR = 1e4

function clueSpot(id: ClueId): Hotspot {
  const c = CLUES[id]
  return {
    id: `horror.clue.${id}`,
    scene: 'home',
    x: c.x,
    z: c.z,
    r: 1.25,
    icon: { x: c.glow.x, z: c.glow.z },
    iconY: c.glow.y + 0.35,
    label: (s) => {
      const h = haunt()
      return seeing(s) && h && !h.found.has(id) ? c.label : null
    },
    run: (s) => {
      const h = haunt()
      if (!h || h.found.has(id)) return
      s.startDialogue(c.dialogue, () => {
        // 三個都找到了：阿嬤想起她是誰
        if (h.find(id) && h.ready) s.bark('hor.clue.done')
      })
    },
  }
}

export const HORROR_HOTSPOTS: Hotspot[] = [
  // ---------- 冥婚 ----------
  {
    id: 'horror.envelope',
    scene: 'home',
    x: ENVELOPE.x,
    z: ENVELOPE.z,
    r: 1.7,
    iconY: 0.45,
    label: (s) => (s.phase === 'dusk' && horrorTonight(s.meta)?.kind === 'wedding' ? '看看路邊的紅包' : null),
    run: (s) => s.startDialogue('hor_envelope'),
  },
  {
    id: 'horror.bride',
    scene: 'home',
    get x() {
      const w = wedding()
      return w && w.phase !== 'leave' && w.phase !== 'gone' ? w.x : FAR
    },
    get z() {
      const w = wedding()
      return w && w.phase !== 'leave' && w.phase !== 'gone' ? w.z : FAR
    },
    r: 1.6,
    iconY: 2.1,
    label: (s) => {
      const w = wedding()
      if (!w || !seeing(s)) return null
      return w.pinFound ? '把玉簪還給鬼新娘' : '跟鬼新娘說話'
    },
    run: (s) => {
      const w = wedding()
      if (!w) return
      if (w.pinFound) {
        s.startDialogue('hor_bride_give', () => w.givePin())
        return
      }
      if (w.wish) {
        s.startDialogue(`hor_bride_wait_${w.pinSpot}`)
        return
      }
      s.startDialogue(`hor_bride_1_${w.pinSpot}`, () => {
        void freshFlags().then((f) => {
          if (f.hor_bride_wish_today) w.learnWish()
          else if (f.hor_bride_scold_today) w.scold()
        })
      })
    },
  },
  {
    id: 'horror.pin',
    scene: 'home',
    get x() {
      const w = wedding()
      return w ? PIN_SPOTS[w.pinSpot].x : FAR
    },
    get z() {
      const w = wedding()
      return w ? PIN_SPOTS[w.pinSpot].z : FAR
    },
    get icon() {
      const w = wedding()
      return w ? { x: PIN_SPOTS[w.pinSpot].glow.x, z: PIN_SPOTS[w.pinSpot].glow.z } : undefined
    },
    get iconY() {
      const w = wedding()
      return (w ? PIN_SPOTS[w.pinSpot].glow.y : 0) + 0.4
    },
    r: 1.3,
    label: (s) => {
      const w = wedding()
      return w && seeing(s) && w.wish && !w.pinFound ? '撿起發光的玉簪' : null
    },
    run: (s) => {
      const w = wedding()
      if (w?.takePin()) s.bark(`hor.gm.pin.${w.pinSpot}`)
    },
  },

  // ---------- 凶宅夜 ----------
  {
    id: 'horror.spirit',
    scene: 'home',
    x: HAUNT.spirit.x + 0.5,
    z: HAUNT.spirit.z - 0.3,
    r: 1.7,
    icon: { x: HAUNT.spirit.x, z: HAUNT.spirit.z },
    iconY: 2.0,
    label: (s) => (haunt() && seeing(s) ? '跟牆角的女孩說話' : null),
    run: (s) => {
      const h = haunt()
      if (!h) return
      if (h.ready) {
        s.startDialogue('hor_haunt_2', () => {
          void freshFlags().then((f) => {
            if (f.hor_haunt_free_today) h.free()
            else h.rebuff()
          })
        })
      } else if (!h.met) s.startDialogue('hor_haunt_1', () => h.meet())
      else s.startDialogue('hor_haunt_again')
    },
  },
  ...CLUE_IDS.map(clueSpot),
]
