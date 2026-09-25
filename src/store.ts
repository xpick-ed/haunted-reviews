import { create } from 'zustand'
import { audio } from './audio'
import { voice } from './audio/voice'
import { sfx } from './audio/sfx'
import { DIALOGUES, indexOfLabel } from './world/dialogues'
import { HOTSPOTS } from './world/hotspots'
import { line } from './world/lines'
import { placePlayer, player } from './world/player'
import { readSave, writeSave } from './world/save'
import { SCENES, type SceneId } from './world/scenes'
import { TEA_SEAT } from './scene/layout'
import type { ObjectState, RoomId } from './world/night/types'

export type GuestState = 'awake' | 'asleep' | 'scared'
export type Phase = 'dusk' | 'night' | 'dawn'
export type ActionKind = 'temp' | 'tuck'
export type Quality = 'high' | 'low'

export interface Subtitle {
  who: string
  text: string
  id: number
}

export interface Guest {
  name: string
  state: GuestState
  comfort: number
  fear: number
  sleepDepth: number
}

export interface Result {
  stars: number
  review: string
  reply: string
  scared: boolean
}

export interface Prompt {
  id: string
  label: string
  cost: number
}

const HOURS_PER_SEC = 1 / 37.5 // 深夜 300 秒走完 8 小時（DESIGN §2.2）
const COMFORT_NEED = 60 // 一般情侶（DESIGN §5）
const FEAR_MAX = 10
const DUSK_TIME = 18.6

export const ACTIONS: Record<ActionKind, { name: string; yin: number; comfort: number; fear: number; line: string }> = {
  temp: { name: '調溫', yin: 5, comfort: 10, fear: 0, line: 'core.temp' },
  tuck: { name: '蓋被子', yin: 10, comfort: 20, fear: 8, line: 'core.tuck' },
}

export interface GameState {
  // 流程
  started: boolean
  scene: SceneId
  /** 轉場黑幕（換場景、打盹、天黑） */
  blackout: boolean
  transitioning: boolean
  phase: Phase
  time: number
  running: boolean
  isNight: boolean
  nightCount: number
  yin: number
  flags: Record<string, boolean>

  // 客人（DESIGN §4–6）
  guest: Guest
  busy: boolean
  horror: number
  warm: number
  flicker: number
  tuckAt: number

  // 阿嬤在哪（World 每幀算，只在改變時寫入）
  room: string | null
  building: string | null
  /** 被淡出的建築 id，逗號分隔 */
  faded: string
  prompt: Prompt | null

  // 對話與字幕
  dialogue: { id: string; i: number } | null
  typing: boolean
  skipTyping: number
  choiceIndex: number
  subtitle: Subtitle | null

  // 深夜的物件狀態（小夜燈、蚊香、水杯、窗、宵夜、搖椅、鏡子、灶），畫面依這個顯示
  objects: Record<string, ObjectState>
  /** 每間客房天花板燈的亮度 0..1（客人醒著亮、睡著暗、閃爍時跳動）。畫面每幀用 getState() 讀 */
  roomLit: Record<RoomId, number>

  // 其他
  /** 場景貼圖載完、shader 預先編譯完，才能按開始 */
  ready: boolean
  voice: boolean
  quality: Quality
  result: Result | null
  hasSave: boolean

  newGame: () => void
  continueGame: () => void
  tick: (dt: number) => void
  interact: () => void
  startDialogue: (id: string) => void
  advance: () => void
  choose: (k: number) => void
  goto: (to: SceneId, spawn: string) => void
  act: (kind: ActionKind) => void
  incense: (where: 'home' | 'temple') => void
  sit: () => void
  spendYin: (v: number) => void
  bark: (lineId: string) => void
  say: (text: string) => void
  setWorld: (patch: Partial<Pick<GameState, 'room' | 'building' | 'faded' | 'prompt'>>) => void
  toggleVoice: () => void
  setQuality: (q: Quality) => void
  resetNight: () => void
  save: () => void
}

let subId = 0
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const freshGuest = (): Guest => ({ name: '小美', state: 'awake', comfort: 50, fear: 5, sleepDepth: 0 })
const later = (ms: number, fn: () => void) => window.setTimeout(fn, ms)

/** 沒有語音檔時，至少讓三個主角用瀏覽器語音唸 */
const LEGACY_SPEAKER: Record<string, '阿嬤' | '小美' | '小翰'> = { grandma: '阿嬤', xiaomei: '小美', xiaohan: '小翰' }

function speakLine(id: string) {
  if (voice.has(id)) {
    voice.play(id)
    return
  }
  const l = line(id)
  const legacy = LEGACY_SPEAKER[l.who]
  if (legacy) audio.speak(l.text, legacy)
}

// DESIGN §4 的星數公式
function judge(g: Guest): Result {
  const comfortDiff = g.comfort - COMFORT_NEED
  const fearDiff = Math.max(0, g.fear - FEAR_MAX)
  const raw = 3 + clamp(comfortDiff / 15, -2, 1.5) - clamp(fearDiff / 12, 0, 3)
  const stars = clamp(Math.round(raw), 1, 5)
  const scared = g.fear > FEAR_MAX
  if (scared) {
    return {
      stars,
      scared,
      review: '房間很乾淨，但半夜有人幫我蓋被子。這間民宿好像只有一個員工，而且我沒看到她。',
      reply: '不好意思，我們會改進。',
    }
  }
  if (stars >= 4) {
    return {
      stars,
      scared,
      review: '睡到一半覺得被子被拉好了，超暖。老闆人很好，雖然一直沒看到人。',
      reply: '謝謝光臨，歡迎再來！',
    }
  }
  if (stars === 3) return { stars, scared, review: '還可以，房間有點舊，但睡得意外地好。', reply: '謝謝！' }
  return { stars, scared, review: '有點冷，也沒什麼特別的。', reply: '下次會幫您把房間弄暖一點。' }
}

/** 每天重設的旗標（名字以 _today 結尾） */
function clearDaily(flags: Record<string, boolean>) {
  const out: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(flags)) if (!k.endsWith('_today')) out[k] = v
  return out
}

export const useStore = create<GameState>()((set, get) => ({
  started: false,
  scene: 'home',
  blackout: false,
  transitioning: false,
  phase: 'dusk',
  time: DUSK_TIME,
  running: false,
  isNight: false,
  nightCount: 1,
  yin: 60,
  flags: {},

  guest: freshGuest(),
  busy: false,
  horror: 0,
  warm: 0,
  flicker: 0,
  tuckAt: 0,

  room: null,
  building: null,
  faded: '',
  prompt: null,

  dialogue: null,
  typing: false,
  skipTyping: 0,
  choiceIndex: 0,
  subtitle: null,

  objects: {},
  roomLit: { r1: 0, r2: 0 },
  ready: false,
  voice: true,
  quality: new URLSearchParams(location.search).get('q') === 'low' ? 'low' : 'high',
  result: null,
  hasSave: readSave() !== null,

  // ---------------------------------------------------------------------------
  // 開始
  // ---------------------------------------------------------------------------

  newGame: () => {
    audio.init()
    audio.doorCreak()
    audio.setNight(false)
    const [x, z] = SCENES.home.spawns.start
    placePlayer(x, z)
    set({
      started: true,
      scene: 'home',
      phase: 'dusk',
      time: DUSK_TIME,
      running: false,
      isNight: false,
      nightCount: 1,
      yin: 60,
      flags: {},
      guest: freshGuest(),
      result: null,
      dialogue: null,
    })
    later(1500, () => get().bark('core.open'))
    get().save()
  },

  continueGame: () => {
    const d = readSave()
    if (!d) return get().newGame()
    audio.init()
    audio.doorCreak()
    audio.setNight(false)
    placePlayer(d.x, d.z)
    set({
      started: true,
      scene: d.scene,
      phase: 'dusk',
      time: DUSK_TIME,
      running: false,
      isNight: false,
      nightCount: d.nightCount,
      yin: d.yin,
      flags: d.flags,
      guest: freshGuest(),
      result: null,
      dialogue: null,
    })
  },

  save: () => {
    const s = get()
    if (!s.started || s.phase !== 'dusk' || s.transitioning) return
    writeSave({ scene: s.scene, x: player.x, z: player.z, nightCount: s.nightCount, yin: s.yin, flags: s.flags })
    if (!s.hasSave) set({ hasSave: true })
  },

  // ---------------------------------------------------------------------------
  // 時間
  // ---------------------------------------------------------------------------

  tick: (dt) => {
    const s = get()
    const fx: Partial<GameState> = {}
    if (s.horror > 0) fx.horror = Math.max(0, s.horror - dt / 0.9)
    if (s.warm > 0) fx.warm = Math.max(0, s.warm - dt / 1.6)
    if (s.flicker > 0) fx.flicker = Math.max(0, s.flicker - dt / 0.9)
    if (Object.keys(fx).length) set(fx)
    if (!s.running || s.dialogue || s.transitioning) return

    const time = s.time + dt * HOURS_PER_SEC
    const patch: Partial<GameState> = { time }
    const night = time > 20 && time < 29.5
    if (night !== s.isNight) {
      patch.isNight = night
      audio.setNight(night)
    }
    if (time >= 24 && s.guest.state === 'awake' && !s.busy) {
      patch.guest = { ...s.guest, state: 'asleep' }
      set(patch)
      get().say('小美睡著了。')
      return
    }
    if (time >= 30) {
      set({ ...patch, time: 30, running: false, phase: 'dawn', result: judge(s.guest) })
      audio.dawn()
      return
    }
    set(patch)
  },

  // ---------------------------------------------------------------------------
  // 互動
  // ---------------------------------------------------------------------------

  interact: () => {
    const s = get()
    if (s.dialogue) {
      const step = DIALOGUES[s.dialogue.id].steps[s.dialogue.i]
      if (s.typing) set({ skipTyping: s.skipTyping + 1 })
      else if (step.choices) get().choose(s.choiceIndex)
      else get().advance()
      return
    }
    if (!s.started || s.transitioning || s.result || s.busy || !s.prompt) return
    const h = HOTSPOTS.find((x) => x.id === s.prompt!.id)
    if (h) h.run(get())
  },

  startDialogue: (id) => {
    const d = DIALOGUES[id]
    if (!d) return
    sfx.play('ui_confirm', { volume: 0.5 })
    set({ dialogue: { id, i: 0 }, choiceIndex: 0, typing: true })
    runStep(id, 0)
  },

  advance: () => {
    const s = get()
    if (!s.dialogue) return
    const d = DIALOGUES[s.dialogue.id]
    const step = d.steps[s.dialogue.i]
    if (step.choices) return
    const next = step.goto ? indexOfLabel(d, step.goto) : s.dialogue.i + 1
    sfx.play('dialogue_next', { volume: 0.5 })
    if (next >= d.steps.length) {
      voice.stop()
      set({ dialogue: null, typing: false })
      get().save()
      return
    }
    set({ dialogue: { id: s.dialogue.id, i: next }, typing: true, choiceIndex: 0 })
    runStep(s.dialogue.id, next)
  },

  choose: (k) => {
    const s = get()
    if (!s.dialogue) return
    const d = DIALOGUES[s.dialogue.id]
    const c = d.steps[s.dialogue.i].choices?.[k]
    if (!c) return
    sfx.play('ui_select', { volume: 0.6 })
    const next = indexOfLabel(d, c.goto)
    set({ dialogue: { id: s.dialogue.id, i: next }, typing: true, choiceIndex: 0 })
    runStep(s.dialogue.id, next)
  },

  goto: (to, spawn) => {
    const s = get()
    if (s.transitioning) return
    set({ transitioning: true, blackout: true, prompt: null })
    sfx.play('whoosh', { volume: 0.6 })
    later(450, () => {
      const [x, z] = SCENES[to].spawns[spawn] ?? [0, 0]
      placePlayer(x, z)
      set({ scene: to, room: null, building: null, faded: '' })
    })
    later(950, () => {
      set({ blackout: false, transitioning: false })
      get().save()
    })
  },

  act: (kind) => {
    const s = get()
    if (s.busy || s.phase !== 'night' || s.result) return
    const def = ACTIONS[kind]
    if (s.yin < def.yin) {
      get().bark('gm.tired')
      return
    }
    set({ busy: true, yin: s.yin - def.yin })
    audio.whoosh()
    if (kind === 'tuck') sfx.play('cloth', { volume: 0.8 })

    later(450, () => {
      const st = get()
      const g = st.guest
      const now = performance.now()
      if (kind === 'tuck' && g.state !== 'asleep') {
        // 搞砸：對醒著的客人蓋被子，驚嚇 ×3（DESIGN §6）
        set({
          guest: { ...g, state: 'scared', comfort: g.comfort - 10, fear: g.fear + def.fear * 3 },
          horror: 1,
          flicker: 1,
          tuckAt: now,
        })
        audio.scream()
        audio.heartbeat()
        audio.bassDrop()
        get().bark('core.scream')
        later(1100, () => get().bark('core.dontfear'))
        later(3000, () => {
          set((x) => ({
            guest: { ...x.guest, state: x.guest.state === 'scared' ? 'awake' : x.guest.state },
            busy: false,
          }))
        })
      } else {
        set({
          guest: {
            ...g,
            comfort: g.comfort + def.comfort,
            fear: g.fear + (kind === 'tuck' ? def.fear : 0),
            sleepDepth: g.sleepDepth + (kind === 'tuck' ? 1 : 0),
          },
          warm: 1,
          tuckAt: kind === 'tuck' ? now : st.tuckAt,
        })
        audio.chime()
        get().bark(def.line)
        later(1100, () => set({ busy: false }))
      }
    })
  },

  incense: (where) => {
    const s = get()
    const flag = where === 'home' ? 'incense_today' : 'temple_today'
    if (s.flags[flag]) {
      get().bark(where === 'home' ? 'gm.incense.done' : 'temple.incense.done')
      return
    }
    set({
      busy: true,
      flags: { ...s.flags, [flag]: true },
      yin: Math.min(100, s.yin + (where === 'home' ? 10 : 25)), // DESIGN §3.1
      warm: 1,
    })
    sfx.play('incense')
    if (where === 'temple') later(600, () => sfx.play('temple_bell'))
    get().bark(where === 'home' ? 'gm.incense' : 'temple.incense')
    later(1400, () => {
      set({ busy: false })
      get().save()
    })
  },

  sit: () => {
    const s = get()
    if (s.transitioning) return
    if (s.phase === 'dusk') {
      if (!s.flags.incense_today) {
        get().bark('gm.notyet')
        return
      }
      get().bark('gm.wait')
      set({ transitioning: true })
      later(900, () => set({ blackout: true }))
      later(1700, () => {
        placePlayer(TEA_SEAT.x + 0.9, TEA_SEAT.z + 0.4)
        set({ phase: 'night', time: 22, running: true, isNight: true })
        audio.setNight(true)
      })
      later(2500, () => {
        set({ blackout: false, transitioning: false })
        get().bark('core.night')
      })
      later(6200, () => get().bark('core.wow'))
      return
    }
    if (s.phase === 'night' && s.time < 29) {
      get().bark('gm.nap')
      set({ transitioning: true })
      later(700, () => set({ blackout: true }))
      later(1400, () => {
        const st = get()
        const time = Math.min(29.5, Math.floor(st.time) + 1)
        const patch: Partial<GameState> = { time }
        if (time >= 24 && st.guest.state === 'awake') patch.guest = { ...st.guest, state: 'asleep' }
        set(patch)
      })
      later(2100, () => set({ blackout: false, transitioning: false }))
    }
  },

  spendYin: (v) => set((s) => ({ yin: Math.max(0, s.yin - v) })),

  // ---------------------------------------------------------------------------
  // 字幕與語音
  // ---------------------------------------------------------------------------

  bark: (lineId) => {
    const l = line(lineId)
    set({ subtitle: { who: l.who, text: l.text, id: ++subId } })
    if (get().voice) speakLine(lineId)
  },

  say: (text) => set({ subtitle: { who: '', text, id: ++subId } }),

  setWorld: (patch) => {
    const s = get()
    for (const [k, v] of Object.entries(patch)) {
      const cur = s[k as keyof typeof patch]
      const same = k === 'prompt' ? JSON.stringify(cur) === JSON.stringify(v) : cur === v
      if (!same) {
        set(patch)
        return
      }
    }
  },

  toggleVoice: () =>
    set((s) => {
      const on = !s.voice
      if (!on) {
        audio.stopSpeech()
        voice.stop()
      }
      return { voice: on }
    }),

  setQuality: (q) => {
    const s = get()
    if (s.quality === q) return
    if (!s.started || s.transitioning) {
      set({ quality: q })
      return
    }
    set({ blackout: true, transitioning: true })
    later(450, () => set({ quality: q }))
    later(1100, () => set({ blackout: false, transitioning: false }))
  },

  resetNight: () => {
    audio.setNight(false)
    const [x, z] = SCENES.home.spawns.start
    placePlayer(x, z)
    set((s) => ({
      scene: 'home',
      phase: 'dusk',
      time: DUSK_TIME,
      running: false,
      isNight: false,
      guest: freshGuest(),
      result: null,
      yin: Math.min(100, s.yin + 30),
      flags: clearDaily(s.flags),
      subtitle: null,
      busy: false,
      nightCount: s.nightCount + 1,
    }))
    get().save()
  },
}))

/** 對話走到某一步：設旗標、播語音 */
function runStep(id: string, i: number) {
  const step = DIALOGUES[id].steps[i]
  if (!step) return
  const s = useStore.getState()
  if (step.set && !s.flags[step.set]) useStore.setState({ flags: { ...s.flags, [step.set]: true } })
  voice.stop()
  audio.stopSpeech()
  if (s.voice) speakLine(step.line)
}

// 開發時把 store 掛到 window，方便在 console 或自動化測試裡直接操作
if (import.meta.env.DEV) {
  ;(window as unknown as { __store: typeof useStore; __player: typeof player }).__store = useStore
  ;(window as unknown as { __player: typeof player }).__player = player
}
