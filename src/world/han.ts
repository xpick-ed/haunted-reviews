import type { GameState, useStore } from '../store'
import type { Hotspot } from './hotspots'
import type { Meta } from './night/director'
import { DIALOGUES, type Dialogue } from './dialogues'
import { HAN_DESK, MAIN, MAIN_PORCH, SINK, TEA } from '../scene/layout'
import { seeded } from './rng'
import { HAN_KNOWS } from './story'
import { bowlBeat, hanAtHome, kneelBeat } from './storyBeats'

// 跟小翰的陰陽溝通（DESIGN §31.2）：阿嬤用鬼的方式偷偷幫他，他慢慢感覺到「阿嬤還在」（meta.hanSense 0..100）。
//   深夜：在起霧的鏡子上寫字（三選一）、把帳本翻到算錯的那頁、托夢教他煎菜脯蛋（bonds.ts 的托夢）
//   傍晚：他跪在神明廳擲筊（第 3、9、11 晚），阿嬤讓筊落成聖筊或笑筊；他難過的時候打開收音機放阿嬤最愛的歌
//   隔天傍晚他會提起昨晚的事（duskReactions，HanLayer 播）；過了 20／40／60 各說一次心裡話；到 80 多擺一副碗筷（storyBeats.bowlBeat）
// 做過的事記在 meta.hanSigns（「kind@第幾晚」是一晚一次的紀錄；沒有 @ 的是第一次才有的）；
// 隔天要說的話記在旗標 hsp_*（不是 _today，才留得到隔天；傍晚也不會被算成做家事）。
// 這個檔案會被 Node 測試載入，不能在最上面 import store／audio（用 s.* 或動態 import）。

export type MirrorMsg = 'eat' | 'rest' | 'here'
export const MIRROR_MSGS: MirrorMsg[] = ['eat', 'rest', 'here']
/** 鏡子上寫的字（HanLayer 畫在霧上） */
export const MIRROR_TEXT: Record<MirrorMsg, string> = { eat: '吃飯', rest: '別太累', here: '阿嬤在' }
/** 小翰洗好澡、鏡子還霧霧的時間（深夜 22:00–00:00） */
export const MIRROR_WINDOW = { from: 22, to: 24 }
/** 每件事加多少「感覺」 */
export const SENSE = { mirror: 2, mirrorNew: 2, ledger: 3, kneel: { 3: 5, 9: 6, 11: 10 } as Record<number, number>, kneelLaugh: 1, dream: 2, omelette: 8, radio: 5, bowl: 5 }
/** 隔天傍晚他說起來的時候，心加多少 */
export const HEART = { mirror: 2, ledger: 1, omelette: 4, radio: 5, bowl: 6 }
export const YIN = { mirror: 4, ledger: 3 }
/** 過了這些門檻，傍晚各說一次心裡話 */
export const TIERS = [20, 40, 60]
/** 小翰的心低於這個：他很累，收音機可以開 */
export const RADIO_HEART = 45

export const MIRROR_SPOT = { x: SINK.x - 0.7, z: SINK.z }
/** 帳本放在小翰書桌靠牆那一端（筆電的北邊） */
export const LEDGER = { x: HAN_DESK.x, z: HAN_DESK.z - 0.4 }
/** 小翰房門口的矮凳、上面一台老收音機 */
export const RADIO = { x: 3.25, z: MAIN_PORCH.z1 - 0.3 }
/** 擲筊：小翰跪在神桌前 */
export const KNEEL = { x: 0.45, z: MAIN.z0 + 2.15 }
/** 多擺一副碗筷：他坐在茶桌東邊的竹椅 */
export const BOWL_SEAT = { x: TEA.x + 0.75, z: TEA.z + 0.2, heading: -0.8 }

const clamp = (v: number) => Math.max(0, Math.min(100, v))

type SenseMeta = Pick<Meta, 'hanSense' | 'hanSigns'>

/** 加「感覺」＋記一筆（sign 已經記過就不再記） */
export function addSense<T extends SenseMeta>(meta: T, n: number, sign?: string): T {
  const hanSigns = sign && !meta.hanSigns.includes(sign) ? [...meta.hanSigns, sign] : meta.hanSigns
  return { ...meta, hanSense: clamp(meta.hanSense + n), hanSigns }
}

/** 這一晚（這一天）做過這件事了沒 */
export const doneOn = (meta: SenseMeta, kind: string, night: number) => meta.hanSigns.some((x) => x === `${kind}@${night}` || x.startsWith(`${kind}@${night}=`))

/** 今晚在鏡子上寫了什麼（還沒寫＝null） */
export function mirrorTonight(meta: SenseMeta & { night: number }): MirrorMsg | null {
  const hit = meta.hanSigns.find((x) => x.startsWith(`mirror@${meta.night}=`))
  return hit ? (hit.split('=')[1] as MirrorMsg) : null
}

/** 鏡子上寫一次字：一晚一次；寫一種沒寫過的字多加一點 */
export function writeMirror<T extends SenseMeta & { night: number }>(meta: T, msg: MirrorMsg): T {
  const fresh = !meta.hanSigns.includes(`mirror_${msg}`)
  const m = addSense(meta, SENSE.mirror + (fresh ? SENSE.mirrorNew : 0), `mirror@${meta.night}=${msg}`)
  return addSense(m, 0, `mirror_${msg}`)
}

export const mirrorOpen = (s: Pick<GameState, 'phase' | 'time' | 'meta'>) =>
  s.phase === 'night' && s.time >= MIRROR_WINDOW.from && s.time < MIRROR_WINDOW.to && !doneOn(s.meta, 'mirror', s.meta.night)

/** 這一晚帳本有沒有算錯（哪一種錯）：第 2 晚起一半的晚上；第 3 晚一定有（讓人先遇到一次） */
export function ledgerMistake(night: number): 0 | 1 | 2 | null {
  if (night < 2) return null
  const r = seeded(night * 53 + 7)
  r()
  const has = night === 3 || r() < 0.5
  return has ? (Math.floor(r() * 3) as 0 | 1 | 2) : null
}

/** 找回來的錢 */
export const ledgerMoney = (night: number) => 300 + Math.floor(seeded(night * 97 + 1)() * 6) * 100

export const ledgerOpen = (s: Pick<GameState, 'phase' | 'meta'>) => s.phase === 'night' && ledgerMistake(s.meta.night) !== null && !doneOn(s.meta, 'ledger', s.meta.night)

/** 收音機：傍晚他在埕裡、心很累（≤ 45）、今天還沒開過 */
export const radioOpen = (s: Pick<GameState, 'phase' | 'meta' | 'flags'>) => hanAtHome(s) && s.meta.heart <= RADIO_HEART && !doneOn(s.meta, 'radio', s.meta.night)

/** 托夢要演哪一場：感覺到一點了（≥ 10）、第 3 晚起，第一次先教他煎菜脯蛋；其他照原本的五場輪流 */
export function hanDreamPick(meta: SenseMeta & { night: number }): string | null {
  return meta.night >= 3 && meta.hanSense >= 10 && !meta.hanSigns.includes('omelette_dream') ? 'hs_dream_omelette' : null
}

/** 托夢完（bonds.ts 呼叫）：每場夢都讓他多感覺到一點；教煎蛋的那場，隔天傍晚他會真的去煎 */
export function afterDream(meta: Meta, flags: Record<string, boolean>, dream: string): { meta: Meta; flags: Record<string, boolean> } {
  let m = addSense(meta, SENSE.dream, `dream@${meta.night}`)
  let f = flags
  if (dream === 'hs_dream_omelette') {
    m = addSense(m, 0, 'omelette_dream')
    f = { ...f, hsp_omelette: true }
  }
  return { meta: m, flags: f }
}

// ---------------------------------------------------------------------------
// 隔天傍晚：小翰說起昨晚的事（HanLayer 在傍晚開始、他在家的時候呼叫一次）
// ---------------------------------------------------------------------------

export interface DuskReaction {
  /** 依序播的台詞 */
  lines: string[]
  meta: Meta
  flags: Record<string, boolean>
  /** 台詞播完以後的提示（小翰的心 +2……） */
  notes: string[]
  /** 灶腳冒煙（他在煎菜脯蛋） */
  smoke: boolean
}

export function duskReactions(s: { meta: Meta; flags: Record<string, boolean> }): DuskReaction | null {
  let meta = s.meta
  const flags = { ...s.flags }
  const lines: string[] = []
  let heart = 0
  let money = 0
  let smoke = false
  for (const msg of MIRROR_MSGS) {
    if (!flags[`hsp_mirror_${msg}`]) continue
    delete flags[`hsp_mirror_${msg}`]
    lines.push(`hs.re.mirror.${msg}`, `hs.re.mirror.${msg}2`)
    heart += HEART.mirror
  }
  for (const k of Object.keys(flags)) {
    const m = /^hsp_ledger_(\d+)$/.exec(k)
    if (!m || !flags[k]) continue
    delete flags[k]
    const n = Number(m[1])
    lines.push('hs.re.ledger.1', `hs.re.ledger.v${ledgerMistake(n) ?? 0}`, 'hs.re.ledger.2')
    heart += HEART.ledger
    money += ledgerMoney(n)
  }
  if (flags.hsp_omelette) {
    delete flags.hsp_omelette
    lines.push('hs.re.om.1', 'hs.re.om.2', 'hs.re.om.3')
    meta = addSense(meta, SENSE.omelette, 'omelette')
    heart += HEART.omelette
    smoke = true
  }
  // 過了門檻：一天說一段
  const tier = TIERS.find((t) => meta.hanSense >= t && !meta.hanSigns.includes(`tier${t}`))
  if (tier) {
    lines.push(`hs.tier${tier}.1`, `hs.tier${tier}.2`)
    meta = addSense(meta, 0, `tier${tier}`)
  }
  if (!lines.length) return null
  meta = { ...meta, heart: Math.min(100, meta.heart + heart), money: meta.money + money }
  const notes = [heart && `小翰的心 +${heart}`, money && `帳本找回 $${money}`].filter(Boolean) as string[]
  return { lines, meta, flags, notes, smoke }
}

// ---------------------------------------------------------------------------
// 對話
// ---------------------------------------------------------------------------

const HAN_DIALOGUES: Record<string, Dialogue> = {
  // 鏡子：三選一（選項的旗標是 _today：只有今晚畫字用）
  hs_mirror: {
    steps: [
      {
        line: 'hs.mirror.q',
        choices: MIRROR_MSGS.map((m) => ({ line: `hs.mirror.${m}`, goto: m })),
      },
      ...MIRROR_MSGS.flatMap((m, i) => [
        { label: m, line: `hs.mirror.${m}`, set: `hs_mirror_${m}_today` },
        i < MIRROR_MSGS.length - 1 ? { line: `hs.mirror.${m}2`, goto: 'end' } : { line: `hs.mirror.${m}2` },
      ]),
      { label: 'end', line: 'hs.mirror.done' },
    ],
  },
  // 教他煎菜脯蛋（托夢；夢裡他看得到阿嬤）
  hs_dream_omelette: {
    steps: Array.from({ length: 9 }, (_, i) => ({ line: `hs.dream.om.${i + 1}`, ...(i === 8 ? { set: 'handream_warm_today' } : {}) })),
  },
  // 多擺一副碗筷（他看不到阿嬤）
  hs_bowl: {
    unseen: true,
    steps: [
      { line: 'hs.bowl.1' },
      { line: 'hs.bowl.2' },
      { line: 'hs.bowl.3' },
      {
        line: 'hs.bowl.4',
        choices: [
          { line: 'hs.bowl.a', goto: 'a' },
          { line: 'hs.bowl.b', goto: 'b' },
        ],
      },
      { label: 'a', line: 'hs.bowl.a', set: 'hs_bowl_a' },
      { line: 'hs.bowl.a2' },
      { line: 'hs.bowl.a3', goto: 'end' },
      { label: 'b', line: 'hs.bowl.b', set: 'hs_bowl_b' },
      { line: 'hs.bowl.b2' },
      { label: 'end', line: 'hs.bowl.5' },
      { line: 'hs.bowl.6' },
    ],
  },
}
// 擲筊：第 3、9、11 晚各一場（選項旗標 hs_jb_<晚>_a／_b 是永久的，不是 _today：傍晚設 _today 會被算成做家事）
for (const n of [3, 9, 11]) {
  const p = `hs.jb${n}`
  const tail = n === 11 ? [{ line: `${p}.a3`, goto: 'end' }] : []
  HAN_DIALOGUES[`hs_jb_${n}`] = {
    unseen: true,
    steps: [
      { line: `${p}.1` },
      { line: `${p}.2` },
      {
        line: `${p}.q`,
        choices: [
          { line: `${p}.a`, goto: 'a' },
          { line: `${p}.b`, goto: 'b' },
        ],
      },
      { label: 'a', line: `${p}.a`, set: `hs_jb_${n}_a` },
      tail.length ? { line: `${p}.a2` } : { line: `${p}.a2`, goto: 'end' },
      ...tail,
      { label: 'b', line: `${p}.b`, set: `hs_jb_${n}_b` },
      { line: `${p}.b2` },
      { label: 'end', line: `${p}.end` },
    ],
  }
}
Object.assign(DIALOGUES, HAN_DIALOGUES)

/** 擲筊的結果：心、感覺 */
export function kneelResult(night: number, choice: 'a' | 'b'): { heart: number; sense: number } {
  const base = SENSE.kneel[night] ?? 6
  if (night === 3) return choice === 'a' ? { heart: 5, sense: base } : { heart: 3, sense: base + SENSE.kneelLaugh }
  if (night === 9) return choice === 'a' ? { heart: 6, sense: base } : { heart: 2, sense: base + 3 }
  return { heart: 4, sense: base }
}

// ---------------------------------------------------------------------------
// 熱點
// ---------------------------------------------------------------------------

type Api = typeof useStore
const withStore = (fn: (api: Api) => void) => void import('../store').then(({ useStore }) => fn(useStore))

/** 依序講幾句（等語音講完再講下一句；前一串還沒講完就排在後面）；回傳全部講完要多久（毫秒） */
export async function speakSeq(api: Api, ids: string[], first = 0) {
  const [{ voice }, { line }] = await Promise.all([import('../audio/voice'), import('./lines')])
  const now = performance.now()
  let t = Math.max(first, hanFx.busyUntil - now)
  for (const id of ids) {
    window.setTimeout(() => api.getState().bark(id), t)
    t += Math.max(2200, (voice.duration(id) || line(id).text.length * 0.2) * 1000 + 600)
  }
  hanFx.busyUntil = now + t
  return t
}

/** 畫面那邊的狀態：收音機開了（HanLayer 看到就放歌、飄音符）、今天灶腳冒煙、今天的反應講過了 */
export const hanFx = { radioAt: 0, smokeNight: -1, reactedNight: -1, busyUntil: 0 }

export const HAN_HOTSPOTS: Hotspot[] = [
  {
    // 深夜：浴廁洗手台的鏡子（小翰剛洗好澡）
    id: 'han_mirror',
    scene: 'home',
    x: MIRROR_SPOT.x,
    z: MIRROR_SPOT.z,
    r: 0.9,
    icon: { x: SINK.x + 0.2, z: SINK.z },
    iconY: 2.3,
    label: (s) => (mirrorOpen(s) ? `在起霧的鏡子上寫字（陰氣 ${YIN.mirror}）` : null),
    cost: () => YIN.mirror,
    run: (s) => {
      if (s.yin < YIN.mirror) {
        s.bark('hs.mirror.noyin')
        return
      }
      withStore((api) =>
        api.getState().startDialogue('hs_mirror', () => {
          const x = api.getState()
          const msg = MIRROR_MSGS.find((m) => x.flags[`hs_mirror_${m}_today`])
          if (!msg || doneOn(x.meta, 'mirror', x.meta.night)) return
          api.setState({ yin: x.yin - YIN.mirror, meta: writeMirror(x.meta, msg), flags: { ...x.flags, [`hsp_mirror_${msg}`]: true } })
        }),
      )
    },
  },
  {
    // 深夜：小翰書桌上的帳本（他睡了）
    id: 'han_ledger',
    scene: 'home',
    x: HAN_DESK.x - 0.95,
    z: HAN_DESK.z - 0.2,
    r: 0.9,
    icon: { x: LEDGER.x, z: LEDGER.z },
    iconY: 1.5,
    label: (s) => (ledgerOpen(s) ? `把帳本翻到算錯的那頁（陰氣 ${YIN.ledger}）` : null),
    cost: () => YIN.ledger,
    run: (s) => {
      if (s.yin < YIN.ledger) {
        s.bark('hs.ledger.noyin')
        return
      }
      const n = s.meta.night
      const v = ledgerMistake(n)
      if (v === null || doneOn(s.meta, 'ledger', n)) return
      withStore((api) => {
        const x = api.getState()
        api.setState({ yin: x.yin - YIN.ledger, meta: addSense(x.meta, SENSE.ledger, `ledger@${n}`), flags: { ...x.flags, [`hsp_ledger_${n}`]: true } })
        x.bark(`hs.ledger.flip.${v}`)
      })
    },
  },
  {
    // 傍晚：小翰跪在神明廳擲筊（他看不到阿嬤；讓筊落下來）
    id: 'han_kneel',
    scene: 'home',
    x: KNEEL.x + 0.9,
    z: KNEEL.z + 0.7,
    r: 1.1,
    icon: { x: KNEEL.x, z: KNEEL.z },
    iconY: 1.9,
    label: (s) => (kneelBeat(s) ? '（小翰在擲筊）讓筊落下來' : null),
    run: (s) => {
      const n = s.meta.night
      withStore((api) =>
        api.getState().startDialogue(`hs_jb_${n}`, () => {
          const x = api.getState()
          const choice = x.flags[`hs_jb_${n}_a`] ? 'a' : x.flags[`hs_jb_${n}_b`] ? 'b' : null
          if (!choice || x.flags[`hs_jb_${n}`]) return
          const r = kneelResult(n, choice)
          api.setState({ meta: { ...addSense(x.meta, r.sense, `jb@${n}`), heart: Math.min(100, x.meta.heart + r.heart) }, flags: { ...x.flags, [`hs_jb_${n}`]: true } })
          x.say(`小翰的心 +${r.heart}`)
        }),
      )
    },
  },
  {
    // 傍晚：他很累的時候，小翰房門口的收音機
    id: 'han_radio',
    scene: 'home',
    x: RADIO.x,
    z: RADIO.z + 0.75,
    r: 0.85,
    icon: { x: RADIO.x, z: RADIO.z },
    iconY: 1.3,
    label: (s) => (radioOpen(s) ? '轉開收音機（阿嬤最愛的那首歌）' : null),
    run: (s) => {
      const n = s.meta.night
      if (doneOn(s.meta, 'radio', n)) return
      withStore((api) => {
        const x = api.getState()
        api.setState({ meta: { ...addSense(x.meta, SENSE.radio, `radio@${n}`), heart: Math.min(100, x.meta.heart + HEART.radio) } })
        hanFx.radioAt = performance.now()
        x.bark('hs.radio.gm')
        void speakSeq(api, ['hs.radio.1', 'hs.radio.2', 'hs.radio.3'], 3800).then((t) => window.setTimeout(() => api.getState().say(`小翰的心 +${HEART.radio}`), t))
      })
    },
  },
  {
    // 傍晚：他在茶桌多擺一副碗筷（坐到他對面）
    id: 'han_bowl',
    scene: 'home',
    x: TEA.x + 0.1,
    z: TEA.z + 0.95,
    r: 0.85,
    icon: { x: BOWL_SEAT.x, z: BOWL_SEAT.z },
    iconY: 1.6,
    label: (s) => (bowlBeat(s) ? '坐到小翰對面' : null),
    run: () =>
      withStore((api) =>
        api.getState().startDialogue('hs_bowl', () => {
          const x = api.getState()
          if (x.flags.hs_bowl) return
          api.setState({ meta: { ...addSense(x.meta, SENSE.bowl, 'bowl'), heart: Math.min(100, x.meta.heart + HEART.bowl) }, flags: { ...x.flags, hs_bowl: true } })
          x.say(`小翰的心 +${HEART.bowl}`)
        }),
      ),
  },
]

/** 到了「阿嬤，是妳嗎？」的程度（storyBeats、結局都用這個數字） */
export { HAN_KNOWS }
