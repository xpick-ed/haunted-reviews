import { create } from 'zustand'
import { audio } from './audio'
import { BED } from './scene/layout'

export type GuestState = 'awake' | 'asleep' | 'scared'
export type Phase = 'dusk' | 'night' | 'dawn'
export type ActionKind = 'temp' | 'tuck'
export type Speaker = '阿嬤' | '小美' | '小翰' | ''
export type Quality = 'high' | 'low'

export interface Subtitle {
  speaker: Speaker
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

// 場景座標見 scene/layout.ts
export const GRANDMA_HOME: [number, number, number] = [-2.5, 0, 2.5]
export const GRANDMA_BEDSIDE: [number, number, number] = [BED.x - 1.1, 0, BED.z + 0.4]

const HOURS_PER_SEC = 1 / 22.5 // 深夜 180 秒走完 8 小時（DESIGN §2.2）
const COMFORT_NEED = 60 // 一般情侶（DESIGN §5）
const FEAR_MAX = 10

export const ACTIONS: Record<ActionKind, { name: string; yin: number; comfort: number; fear: number; line: string; hint: string }> = {
  temp: { name: '調溫', yin: 5, comfort: 10, fear: 0, line: '阿嬤幫你調涼一點喔。', hint: '永遠安全' },
  tuck: { name: '蓋被子', yin: 10, comfort: 20, fear: 8, line: '來，阿嬤幫你蓋被。', hint: '客人醒著會嚇到' },
}

interface State {
  started: boolean
  phase: Phase
  time: number
  running: boolean
  speed: number
  isNight: boolean
  yin: number
  guest: Guest
  grandmaTarget: [number, number, number] | null
  busy: boolean
  focusRoom: boolean
  horror: number
  warm: number
  flicker: number
  tuckAt: number
  subtitle: Subtitle | null
  voice: boolean
  quality: Quality
  result: Result | null
  nightCount: number

  openDoor: () => void
  startNight: () => void
  tick: (dt: number) => void
  act: (kind: ActionKind) => void
  setFocus: (v: boolean) => void
  toggleSpeed: () => void
  toggleVoice: () => void
  setQuality: (q: Quality) => void
  resetNight: () => void
  say: (speaker: Speaker, text: string) => void
}

let subId = 0
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const freshGuest = (): Guest => ({ name: '小美', state: 'awake', comfort: 50, fear: 5, sleepDepth: 0 })

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
  if (stars === 3) {
    return { stars, scared, review: '還可以，房間有點舊，但睡得意外地好。', reply: '謝謝！' }
  }
  return { stars, scared, review: '有點冷，也沒什麼特別的。', reply: '下次會幫您把房間弄暖一點。' }
}

export const useStore = create<State>()((set, get) => ({
  started: false,
  phase: 'dusk',
  time: 18.6,
  running: false,
  speed: 1,
  isNight: false,
  yin: 100,
  guest: freshGuest(),
  grandmaTarget: null,
  busy: false,
  focusRoom: false,
  horror: 0,
  warm: 0,
  flicker: 0,
  tuckAt: 0,
  subtitle: null,
  voice: true,
  quality: new URLSearchParams(location.search).get('q') === 'low' ? 'low' : 'high',
  result: null,
  nightCount: 1,

  say: (speaker, text) => {
    set({ subtitle: { speaker, text, id: ++subId } })
    if (speaker && get().voice) audio.speak(text, speaker)
  },

  openDoor: () => {
    if (get().started) return
    audio.init()
    audio.doorCreak()
    audio.setNight(false)
    set({ started: true })
    window.setTimeout(() => get().say('小翰', '阿嬤，我們開張了。'), 1400)
  },

  startNight: () => {
    const s = get()
    if (s.phase !== 'dusk') return
    set({ phase: 'night', time: 22, running: true, focusRoom: false, isNight: true })
    audio.setNight(true)
    s.say('小翰', '今晚有客人喔，阿嬤，妳不要嚇到人家。')
    window.setTimeout(() => get().say('小美', '哇，這裡好有氣氛喔……'), 3400)
  },

  tick: (dt) => {
    const s = get()
    const fx: Partial<State> = {}
    if (s.horror > 0) fx.horror = Math.max(0, s.horror - dt / 0.9)
    if (s.warm > 0) fx.warm = Math.max(0, s.warm - dt / 1.6)
    if (s.flicker > 0) fx.flicker = Math.max(0, s.flicker - dt / 0.9)
    if (Object.keys(fx).length) set(fx)
    if (!s.running) return

    const time = s.time + dt * s.speed * HOURS_PER_SEC
    const patch: Partial<State> = { time }
    const night = time > 20 && time < 29.5
    if (night !== s.isNight) {
      patch.isNight = night
      audio.setNight(night)
    }
    if (time >= 24 && s.guest.state === 'awake' && !s.busy) {
      patch.guest = { ...s.guest, state: 'asleep' }
      set(patch)
      get().say('', '小美睡著了。')
      return
    }
    if (time >= 30) {
      set({
        ...patch,
        time: 30,
        running: false,
        phase: 'dawn',
        focusRoom: false,
        grandmaTarget: null,
        result: judge(s.guest),
      })
      audio.dawn()
      return
    }
    set(patch)
  },

  act: (kind) => {
    const s = get()
    if (s.busy || s.phase !== 'night' || s.result) return
    const def = ACTIONS[kind]
    if (s.yin < def.yin) {
      s.say('', '陰氣不夠了。')
      return
    }
    set({ busy: true, focusRoom: true, grandmaTarget: GRANDMA_BEDSIDE, yin: s.yin - def.yin })
    audio.whoosh()

    window.setTimeout(() => {
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
        st.say('小美', '啊啊啊——！！！')
        window.setTimeout(() => get().say('阿嬤', '免驚，是阿嬤啦。'), 1100)
        window.setTimeout(() => {
          set((x) => ({
            guest: { ...x.guest, state: x.guest.state === 'scared' ? 'awake' : x.guest.state },
            busy: false,
            grandmaTarget: null,
          }))
        }, 3400)
      } else {
        const fear = kind === 'tuck' ? def.fear : 0
        set({
          guest: {
            ...g,
            comfort: g.comfort + def.comfort,
            fear: g.fear + fear,
            sleepDepth: g.sleepDepth + (kind === 'tuck' ? 1 : 0),
          },
          warm: 1,
          tuckAt: kind === 'tuck' ? now : st.tuckAt,
        })
        audio.chime()
        st.say('阿嬤', def.line)
        window.setTimeout(() => set({ busy: false, grandmaTarget: null }), 1900)
      }
    }, 1400)
  },

  setFocus: (v) => set({ focusRoom: v }),
  toggleSpeed: () => set((s) => ({ speed: s.speed === 1 ? 4 : 1 })),
  toggleVoice: () =>
    set((s) => {
      const voice = !s.voice
      if (!voice) audio.stopSpeech()
      return { voice }
    }),
  setQuality: (q) => set({ quality: q }),
  resetNight: () => {
    audio.setNight(false)
    set((s) => ({
      phase: 'dusk',
      time: 18.6,
      running: false,
      isNight: false,
      guest: freshGuest(),
      result: null,
      yin: Math.min(100, s.yin + 30),
      subtitle: null,
      focusRoom: false,
      grandmaTarget: null,
      busy: false,
      speed: 1,
      nightCount: s.nightCount + 1,
    }))
  },
}))

// 開發時把 store 掛到 window，方便在 console 或自動化測試裡直接操作
if (import.meta.env.DEV) {
  ;(window as unknown as { __store: typeof useStore }).__store = useStore
}
