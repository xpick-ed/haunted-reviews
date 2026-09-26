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
import type { GuestId, ObjectState, RoomId } from './world/night/types'
import type { MinigameId } from './ui/minigames/types'
import { START_META, createNightSlice, night, planFor, preloadNightVoices, yinMax, type NightSlice, type PromptOpt } from './world/night/director'
import { HAN_BARKS } from './data/barks'
import { MEMORIES, MEMORY_BONUS_AT } from './world/memories'
import { requestById, todayRequests } from './world/requests'
import { encounterState } from './world/night/encounters'
import { giftUI } from './world/bonds'

export type Phase = 'dusk' | 'night' | 'dawn'
export type Quality = 'high' | 'low'

export interface Subtitle {
  who: string
  text: string
  id: number
}

export interface Prompt {
  opts: PromptOpt[]
  i: number
  /** 選項組合的指紋（變了才更新） */
  key: string
}

const HOURS_PER_SEC = 1 / 37.5 // 深夜 300 秒走完 8 小時（DESIGN §2.2）
/** 傍晚從 17:30 走到 22:00（DESIGN §28.1）：純走路大約 6 分鐘，做事另外花時間 */
const DUSK_TIME = 17.5
const DUSK_END = 22
const DUSK_HOURS_PER_SEC = 1 / 80
/** 傍晚做事花的時間（分鐘） */
export const DUSK_COST = { travel: 15, minigame: 20, dialogue: 5, chore: 10 }

export interface GameState extends NightSlice {
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
  yin: number
  flags: Record<string, boolean>

  // 阿嬤
  busy: boolean
  horror: number
  warm: number

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
  /** 每間客房天花板燈的亮度 0..1。畫面每幀用 getState() 讀 */
  roomLit: Record<RoomId, number>

  // 小遊戲（覆蓋層）與夢境
  minigame: { id: MinigameId; params: unknown; key: number } | null
  /** 托夢中：哪位客人的夢、醒來要回到哪裡 */
  dream: { guest: GuestId; from: [number, number]; startedAt: number } | null
  /** 回到 1958：哪一關、結束後回到哪個場景的哪裡 */
  past: { episode: string; from: { scene: SceneId; x: number; z: number } } | null

  // 其他
  /** 場景貼圖載完、shader 預先編譯完，才能按開始 */
  ready: boolean
  voice: boolean
  quality: Quality
  hasSave: boolean

  newGame: () => void
  continueGame: () => void
  tick: (dt: number) => void
  interact: () => void
  cycleOption: () => void
  startDialogue: (id: string, onEnd?: () => void) => void
  advance: () => void
  choose: (k: number) => void
  goto: (to: SceneId, spawn: string) => void
  incense: (where: 'home' | 'temple') => void
  sit: () => void
  spendYin: (v: number) => void
  /** 傍晚做事花的時間（分鐘）：時間到 22:00 就天黑、客人到了 */
  spendTime: (minutes: number) => void
  bark: (lineId: string, quiet?: boolean) => void
  say: (text: string) => void
  setWorld: (patch: { room?: string | null; building?: string | null; faded?: string; prompt?: Prompt | null }) => void
  toggleVoice: () => void
  setQuality: (q: Quality) => void
  resetNight: () => void
  closeIntro: () => void
  openPanel: (p: 'skills' | 'shop' | 'relics' | 'album' | null) => void
  /** 開始小遊戲；玩完（或取消）會呼叫 onDone(result) */
  startMinigame: (id: MinigameId, params: unknown, onDone: (result: unknown) => void) => void
  finishMinigame: (result: unknown) => void
  /** 托夢：進入客人的夢（場景換成 dream） */
  enterDream: (guest: GuestId) => void
  /** 夢結束（成功或失敗），回到客人床邊 */
  endDream: (ok: boolean) => void
  /** 撿起一片回憶（src/world/memories.ts） */
  collectMemory: (id: string) => void
  /** 走進 1958 的某一關（場景換成 past；src/world/past.ts 依 episode 擺好場景） */
  enterPast: (episode: string) => void
  /** 1958 的關卡結束：完成的話記在 meta.pastDone，回到原來的地方 */
  exitPast: (done: boolean) => void
  /** 好感度 +pts（0–100；src/world/bonds.ts） */
  addBond: (npc: string, pts: number) => void
  save: () => void
}

let subId = 0
let minigameDone: ((result: unknown) => void) | null = null
/** 上一個小遊戲結束的時間：小遊戲後面跟著設的旗標不要再多扣一次時間 */
let lastMinigameEnd = 0
let minigameKey = 0
const later = (ms: number, fn: () => void) => window.setTimeout(fn, ms)
let dialogueEnd: (() => void) | null = null

/** 天黑了、客人到了：不管阿嬤在哪裡，都回到家裡的竹椅旁開始深夜 */
function beginNight() {
  const st = useStore.getState()
  if (st.phase !== 'dusk' || st.transitioning) return
  useStore.setState({ transitioning: true, prompt: null, panel: null })
  later(900, () => useStore.setState({ blackout: true }))
  later(1700, () => {
    placePlayer(TEA_SEAT.x + 0.9, TEA_SEAT.z + 0.4)
    useStore.setState({ scene: 'home', room: null, building: null, faded: '', phase: 'night', time: 22, running: true, isNight: true })
    audio.setNight(true)
    useStore.getState().nightBegin()
  })
  later(2500, () => {
    useStore.setState({ blackout: false, transitioning: false })
    if (useStore.getState().meta.night === 1) useStore.getState().bark('core.night')
  })
}

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

/** 每天重設的旗標（名字以 _today 結尾） */
function clearDaily(flags: Record<string, boolean>) {
  const out: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(flags)) if (!k.endsWith('_today')) out[k] = v
  return out
}

export const useStore = create<GameState>()((set, get) => ({
  ...createNightSlice(set as never, get as never),

  started: false,
  scene: 'home',
  blackout: false,
  transitioning: false,
  phase: 'dusk',
  time: DUSK_TIME,
  running: false,
  isNight: false,
  yin: 60,
  flags: {},

  busy: false,
  horror: 0,
  warm: 0,

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
  minigame: null,
  dream: null,
  past: null,
  ready: false,
  voice: true,
  quality: new URLSearchParams(location.search).get('q') === 'low' ? 'low' : 'high',
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
    night.sim = null
    set({
      started: true,
      scene: 'home',
      phase: 'dusk',
      time: DUSK_TIME,
      running: false,
      isNight: false,
      yin: 60,
      flags: {},
      meta: { ...START_META(), requests: todayRequests(1, planFor(START_META()), START_META()) },
      plan: planFor(START_META()),
      objects: {},
      summary: null,
      month: null,
      dialogue: null,
      intro: true,
      view: [],
    })
    // 第一晚傍晚會講的話
    void voice.preload(['core.open', 'core.night', 'gm.incense', 'gm.wait', ...DIALOGUES.han_dusk.steps.map((x) => x.line)])
    preloadNightVoices(get().plan, get().meta)
    get().save()
  },

  continueGame: () => {
    const d = readSave()
    if (!d) return get().newGame()
    audio.init()
    audio.doorCreak()
    audio.setNight(false)
    placePlayer(d.x, d.z)
    night.sim = null
    set({
      started: true,
      scene: d.scene,
      phase: 'dusk',
      time: DUSK_TIME,
      running: false,
      isNight: false,
      yin: d.yin,
      flags: d.flags,
      meta: { ...START_META(), ...(d.meta ?? {}), night: d.meta?.night ?? d.nightCount },
      plan: planFor({ ...START_META(), ...(d.meta ?? {}), night: d.meta?.night ?? d.nightCount }),
      objects: {},
      summary: null,
      month: null,
      dialogue: null,
      intro: true,
      view: [],
    })
    // 舊存檔沒有「今天的事」：補產生
    if (!get().meta.requests.length) set((x) => ({ meta: { ...x.meta, requests: todayRequests(x.meta.night, x.plan, x.meta) } }))
    preloadNightVoices(get().plan, get().meta)
  },

  save: () => {
    const s = get()
    if (!s.started || s.phase !== 'dusk' || s.transitioning) return
    writeSave({ scene: s.scene, x: player.x, z: player.z, nightCount: s.meta.night, yin: s.yin, flags: s.flags, meta: s.meta })
    if (!s.hasSave) set({ hasSave: true })
  },

  // ---------------------------------------------------------------------------
  // 時間
  // ---------------------------------------------------------------------------

  tick: (rawDt) => {
    const s = get()
    const dt = rawDt * s.timeScale
    const fx: Partial<GameState> = {}
    if (s.horror > 0) fx.horror = Math.max(0, s.horror - rawDt / 0.9)
    if (s.warm > 0) fx.warm = Math.max(0, s.warm - rawDt / 1.6)
    if (Object.keys(fx).length) set(fx)
    // 傍晚：時間也在走（看對話、開面板、玩小遊戲時停），天慢慢暗下來
    if (s.phase === 'dusk') {
      if (!s.started || s.dialogue || s.transitioning || s.intro || s.summary || s.month || s.minigame || s.scene === 'past' || s.scene === 'dream') return
      get().spendTime(rawDt * DUSK_HOURS_PER_SEC * 60)
      return
    }
    if (!s.running || s.dialogue || s.transitioning) return

    const time = s.time + dt * HOURS_PER_SEC
    const patch: Partial<GameState> = { time }
    const isNight = time > 20 && time < 29.5
    if (isNight !== s.isNight) {
      patch.isNight = isNight
      audio.setNight(isNight)
    }
    if (time >= 30) {
      set({ ...patch, time: 30, running: false, phase: 'dawn', carrying: false })
      audio.dawn()
      get().finishNight()
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
    if (!s.started || s.transitioning || s.summary || s.month || s.intro || s.panel || s.busy || s.hold || s.minigame || giftUI.npc !== null || !s.prompt) return
    const o = s.prompt.opts[s.prompt.i] ?? s.prompt.opts[0]
    if (!o) return
    if (o.special === 'unhide') s.exitHide()
    else if (o.special === 'unpossess') s.exitPossess()
    else if (o.special === 'meow') s.meow()
    else if (o.special === 'woof') s.woof()
    else if (o.special === 'chirp') s.chirp()
    else if (o.hotspot) {
      const h = HOTSPOTS.find((x) => x.id === o.hotspot)
      if (h) h.run(get())
    } else if (o.option) get().runOption(o.option)
  },

  cycleOption: () => {
    const p = get().prompt
    if (!p || p.opts.length < 2) return
    sfx.play('ui_select', { volume: 0.4 })
    set({ prompt: { ...p, i: (p.i + 1) % p.opts.length } })
  },

  startDialogue: (id, onEnd) => {
    const d = DIALOGUES[id]
    if (!d) return
    dialogueEnd = onEnd ?? null
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
      get().spendTime(DUSK_COST.dialogue)
      const end = dialogueEnd
      dialogueEnd = null
      end?.()
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
    // 傍晚走到別的地方要花時間
    if (s.phase === 'dusk') later(1000, () => get().spendTime(DUSK_COST.travel))
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

  incense: (where) => {
    const s = get()
    const flag = where === 'home' ? 'incense_today' : 'temple_today'
    if (s.flags[flag]) {
      get().bark(where === 'home' ? 'gm.incense.done' : 'temple.incense.done')
      return
    }
    // DESIGN §3.1：家裡 +10（神明廳修復後 +30）、土地公廟 +25
    const gain = where === 'home' ? (s.meta.upgrades.includes('shrine') ? 30 : 10) : 25
    set({
      busy: true,
      flags: { ...s.flags, [flag]: true },
      yin: Math.min(yinMax(s.meta), s.yin + gain),
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
      beginNight()
      return
    }
    if (s.phase === 'night' && s.time < 29) {
      // 客人正在聊天（客人之間的故事）：打盹會把故事快轉掉，先不要睡
      const enc = encounterState.view
      if (enc && enc.phase !== 'done') {
        get().say('客人正在聊天，阿嬤先別打盹，過去聽聽看。')
        return
      }
      get().bark('gm.nap')
      set({ transitioning: true })
      later(700, () => set({ blackout: true }))
      later(1400, () => {
        // 打盹：快轉一小時，模擬用大一點的步伐跑過去
        const st = get()
        const target = Math.min(29.5, Math.floor(st.time) + 1)
        const steps = Math.round(((target - st.time) / HOURS_PER_SEC) / 0.25)
        for (let i = 0; i < steps; i++) {
          set({ time: get().time + 0.25 * HOURS_PER_SEC })
          get().nightStep(0.25)
        }
        set({ time: target })
      })
      later(2100, () => set({ blackout: false, transitioning: false }))
    }
  },

  spendTime: (minutes) => {
    const s = get()
    if (s.phase !== 'dusk' || !s.started) return
    const time = Math.min(DUSK_END, s.time + minutes / 60)
    const patch: Partial<GameState> = { time }
    const isNight = time > 20
    if (isNight !== s.isNight) {
      patch.isNight = isNight
      audio.setNight(isNight)
    }
    set(patch)
    if (time >= 21.5 && !s.flags.dusk_warned_today) {
      set({ flags: { ...get().flags, dusk_warned_today: true } })
      get().say('天快黑了……客人再半個鐘頭就到，阿嬤該回家了。')
    }
    // 22:00 客人到了：不管在哪裡都回家
    if (time >= DUSK_END && !s.transitioning) beginNight()
  },

  spendYin: (v) => set((s) => ({ yin: Math.max(0, s.yin - v * (s.meta.skills.includes('swift') ? 0.5 : 1)) })),

  // ---------------------------------------------------------------------------
  // 字幕與語音
  // ---------------------------------------------------------------------------

  bark: (lineId, quiet = false) => {
    const l = line(lineId)
    set({ subtitle: { who: l.who, text: l.text, id: ++subId } })
    if (get().voice && !quiet) speakLine(lineId)
  },

  say: (text) => set({ subtitle: { who: '', text, id: ++subId } }),

  setWorld: (patch) => {
    const s = get()
    const out: Partial<GameState> = {}
    if (patch.room !== undefined && patch.room !== s.room) out.room = patch.room
    if (patch.building !== undefined && patch.building !== s.building) out.building = patch.building
    if (patch.faded !== undefined && patch.faded !== s.faded) out.faded = patch.faded
    if (patch.prompt !== undefined) {
      const k = patch.prompt?.key ?? ''
      if (k !== (s.prompt?.key ?? '')) out.prompt = patch.prompt
    }
    if (Object.keys(out).length) set(out)
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
    night.sim = null
    set((s) => ({
      scene: 'home',
      phase: 'dusk',
      time: DUSK_TIME,
      running: false,
      isNight: false,
      yin: Math.min(yinMax(s.meta), s.yin + 30),
      flags: clearDaily(s.flags),
      subtitle: null,
      busy: false,
      objects: {},
      carrying: false,
      view: [],
      intro: true,
      plan: planFor(s.meta),
      meta: { ...s.meta, jiaobei: 0, requests: todayRequests(s.meta.night, planFor(s.meta), s.meta) },
      hold: null,
      possess: null,
      hidden: null,
      dish: null,
      roomLit: { r1: 0, r2: 0 },
    }))
    preloadNightVoices(get().plan, get().meta)
    get().save()
  },

  closeIntro: () => {
    const s = get()
    if (!s.intro) return
    sfx.play('ui_confirm', { volume: 0.5 })
    set({ intro: false })
    if (s.meta.night === 1 && !s.flags.opened) {
      set({ flags: { ...get().flags, opened: true } })
      later(700, () => get().bark('core.open'))
    }
    // 第二晚：小翰把儲藏室整理成第二間客房
    if (s.plan.story === 'room2' && !s.flags.story_room2) {
      set({ flags: { ...get().flags, story_room2: true } })
      HAN_BARKS.room2.forEach((id, i) => later(900 + i * 3600, () => get().bark(id)))
    }
  },

  startMinigame: (id, params, onDone) => {
    minigameDone = onDone
    sfx.play('ui_confirm', { volume: 0.5 })
    set({ minigame: { id, params, key: ++minigameKey }, prompt: null })
  },

  finishMinigame: (result) => {
    const done = minigameDone
    minigameDone = null
    set({ minigame: null })
    get().spendTime(DUSK_COST.minigame)
    lastMinigameEnd = performance.now()
    done?.(result)
  },

  enterDream: (guest) => {
    const s = get()
    if (s.transitioning || s.dream) return
    const from: [number, number] = [player.x, player.z]
    set({ transitioning: true, blackout: true, prompt: null })
    audio.whoosh()
    later(600, () => {
      const [x, z] = SCENES.dream.spawns.start
      placePlayer(x, z)
      set({ scene: 'dream', room: null, building: null, faded: '', dream: { guest, from, startedAt: performance.now() } })
    })
    later(1300, () => set({ blackout: false, transitioning: false }))
  },

  endDream: (ok) => {
    const s = get()
    const d = s.dream
    if (!d || s.transitioning) return
    night.sim?.dreamResult(d.guest, ok)
    set({ transitioning: true, blackout: true })
    if (ok) audio.chime()
    later(600, () => {
      placePlayer(d.from[0], d.from[1])
      set({ scene: 'home', room: null, building: null, faded: '', dream: null })
    })
    later(1300, () => set({ blackout: false, transitioning: false }))
  },

  enterPast: (episode) => {
    const s = get()
    if (s.transitioning || s.past || s.dream) return
    const from = { scene: s.scene, x: player.x, z: player.z }
    set({ transitioning: true, blackout: true, prompt: null, panel: null })
    audio.whoosh()
    later(700, () => {
      const [x, z] = SCENES.past.spawns.start
      placePlayer(x, z)
      set({ scene: 'past', room: null, building: null, faded: '', past: { episode, from } })
    })
    later(1500, () => set({ blackout: false, transitioning: false }))
  },

  exitPast: (done) => {
    const s = get()
    const p = s.past
    if (!p || s.transitioning) return
    set({ transitioning: true, blackout: true })
    if (done) {
      audio.chime()
      if (!s.meta.pastDone.includes(p.episode)) set({ meta: { ...s.meta, pastDone: [...s.meta.pastDone, p.episode], merit: s.meta.merit + 2 } })
    }
    later(700, () => {
      placePlayer(p.from.x, p.from.z)
      set({ scene: p.from.scene, room: null, building: null, faded: '', past: null })
    })
    later(1500, () => set({ blackout: false, transitioning: false }))
  },

  addBond: (npc, pts) =>
    set((s) => ({ meta: { ...s.meta, bonds: { ...s.meta.bonds, [npc]: Math.max(0, Math.min(100, (s.meta.bonds[npc] ?? 0) + pts)) } } })),

  collectMemory: (id) => {
    const s = get()
    if (s.meta.memories.includes(id)) return
    const m = MEMORIES.find((x) => x.id === id)
    if (!m) return
    const memories = [...s.meta.memories, id]
    // 撿到一定數量多一個技能點；全部撿齊有最後一句話
    const bonus = memories.length === MEMORY_BONUS_AT ? 1 : 0
    set({ meta: { ...s.meta, memories, merit: s.meta.merit + 1, skillPts: s.meta.skillPts + bonus }, warm: 1 })
    audio.chime()
    get().bark(m.line)
    if (memories.length === MEMORIES.length) later(4500, () => get().bark('mem.all'))
    else if (bonus) later(3500, () => get().say('回憶找回一半了：技能點 +1'))
  },

  openPanel: (p) => {
    sfx.play('ui_select', { volume: 0.4 })
    set({ panel: p })
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

// 傍晚做了一件事（DESIGN §28.1）：新的「今天做過了」旗標、或家裡的東西變多（採收、買東西）→ 花 10 分鐘。
// 系統自己設的旗標（提醒、到訪紀錄）不算；剛玩完小遊戲的也不算（小遊戲已經算過）。
const FREE_FLAGS = /^(dusk_warned|.*_visit|handream.*|dijizhu_bless)_today$/
useStore.subscribe((s, prev) => {
  if (s.phase !== 'dusk' || !s.started || s.transitioning || performance.now() - lastMinigameEnd < 2500) return
  let chore = false
  if (s.flags !== prev.flags) {
    for (const k of Object.keys(s.flags)) if (s.flags[k] && !prev.flags[k] && k.endsWith('_today') && !FREE_FLAGS.test(k)) chore = true
  }
  if (!chore && s.meta.pantry !== prev.meta.pantry) {
    for (const k of Object.keys(s.meta.pantry) as (keyof typeof s.meta.pantry)[]) if ((s.meta.pantry[k] ?? 0) > (prev.meta.pantry[k] ?? 0)) chore = true
  }
  if (!chore) return
  // 同一個地方 20 秒內連續做的事（例如在柑仔店一次買好幾樣）只算一件
  const now = performance.now()
  if (lastChore.scene === s.scene && now - lastChore.t < 20000) return
  lastChore.t = now
  lastChore.scene = s.scene
  queueMicrotask(() => useStore.getState().spendTime(DUSK_COST.chore))
})
const lastChore = { t: -1e9, scene: '' }

// 今天的事（DESIGN §28.2）：做到了就打勾、給獎勵
useStore.subscribe((s) => {
  if (!s.started || !s.meta.requests.length) return
  const todo = s.meta.requests.filter((r) => !r.done && requestById(r.id)?.done(s))
  if (!todo.length) return
  queueMicrotask(() => {
    const st = useStore.getState()
    let meta = { ...st.meta, requests: st.meta.requests.map((r) => (todo.some((t) => t.id === r.id) ? { ...r, done: true } : r)) }
    for (const t of todo) {
      const def = requestById(t.id)!
      const w = def.reward
      meta = {
        ...meta,
        heart: Math.min(100, meta.heart + (w.heart ?? 0)),
        merit: meta.merit + (w.merit ?? 0),
        money: meta.money + (w.money ?? 0),
        bonds: w.bond ? { ...meta.bonds, [w.bond[0]]: Math.min(100, (meta.bonds[w.bond[0]] ?? 0) + w.bond[1]) } : meta.bonds,
      }
      const parts = [w.heart && `小翰的心 +${w.heart}`, w.merit && `功德 +${w.merit}`, w.money && `$${w.money}`, w.bond && `${def.who}的好感 ↑`].filter(Boolean)
      st.say(`✓ ${def.who}的事做好了（${parts.join('、')}）`)
    }
    useStore.setState({ meta })
    sfx.play('ui_confirm', { volume: 0.5 })
  })
})

// 開發時把 store 掛到 window，方便在 console 或自動化測試裡直接操作
if (import.meta.env.DEV) {
  ;(window as unknown as { __store: typeof useStore; __player: typeof player }).__store = useStore
  ;(window as unknown as { __player: typeof player }).__player = player
  ;(window as unknown as { __night: typeof night }).__night = night
}
