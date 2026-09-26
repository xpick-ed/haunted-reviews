import type { GameState } from '../store'
import type { Hotspot } from './hotspots'
import { DIALOGUES, type Dialogue, type Step } from './dialogues'
import { GM_BED, MAIN, SEWING, TEA } from '../scene/layout'
import { INHERITANCE_NIGHT, ZHIWEI_SPOT, familyState, type AuntChoice, type FuboTalk, type ZhiweiAct } from './night/family'

// 大人的心事的互動點（DESIGN §29）：分遺產（第 10 晚傍晚偷聽、晚上托夢給姑姑）、跟福伯說說話、陪志偉。
// 這個檔案不能在最上面 import store／audio（用 s.* 或 import('../store')）。
// 對話在這裡登記進 DIALOGUES（台詞在 src/data/family.lines.json）；選了哪個選項用 _today 旗標帶回來。

const store = () => import('../store').then((m) => m.useStore)

// ---------------------------------------------------------------------------
// 分遺產（第 10 晚）
// ---------------------------------------------------------------------------

type StoryState = Pick<GameState, 'meta' | 'phase'>
const ended = (s: StoryState) => s.meta.story.some((x) => x.startsWith('ended_'))

/** 第 10 晚傍晚：叔叔、姑姑在神明廳跟小翰吵賣地（偷聽完就不再出現） */
export const inheritanceBeat = (s: StoryState) => s.meta.night === INHERITANCE_NIGHT && s.phase === 'dusk' && !s.meta.story.includes('inheritance') && !ended(s)
/** 第 10 晚姑姑住下來（傍晚吵完以後、晚上睡阿嬤的床） */
export const auntStaysOver = (s: StoryState) => s.meta.night === INHERITANCE_NIGHT && !ended(s)

/** 神明廳裡三個人站的位置（面對面吵）；阿嬤在門口偷聽；吵完姑姑去阿嬤房間看裁縫車 */
export const INHERIT_SPOT = {
  uncle: { x: -1.2, z: -6.3 },
  aunt: { x: 1.25, z: -6.1 },
  han: { x: 0.1, z: -4.75 },
  listen: { x: 0, z: MAIN.z1 + 0.55 },
  sewing: { x: SEWING.x + 0.15, z: SEWING.z + 0.72 },
  /** 阿嬤的床邊（托夢的地方） */
  bedside: { x: GM_BED.x + GM_BED.w / 2 + 0.45, z: GM_BED.z + 0.2 },
}

// ---------------------------------------------------------------------------
// 對話
// ---------------------------------------------------------------------------

const seq = (...lines: string[]): Step[] => lines.map((line) => ({ line }))

/** 陪志偉的一件事：先是他對這件事的反應，再是他心裡的話（第幾件事，話就慢慢變了） */
const STAGE: Record<number, string[]> = {
  1: ['zw.s1.1', 'zw.s1.gm'],
  2: ['zw.s2.1', 'zw.s2.2', 'zw.s2.gm'],
  3: ['zw.s3.1', 'zw.s3.gm'],
}
const ACTS: ZhiweiAct[] = ['tea', 'meal', 'hum']

const FAMILY_DIALOGUES: Record<string, Dialogue> = {
  // 傍晚在神明廳門口偷聽（他們看不到阿嬤）
  inherit_dusk: {
    unseen: true,
    steps: seq('inh.1', 'inh.2', 'inh.3', 'inh.4', 'inh.5', 'inh.6', 'inh.7', 'inh.8', 'inh.9', 'inh.gm.1', 'inh.gm.2', 'inh.gm.3'),
  },
  // 托夢給姑姑（夢裡看得到阿嬤）
  inherit_dream: {
    steps: [
      { line: 'inh.d.1' },
      { line: 'inh.d.2' },
      {
        line: 'inh.d.3',
        choices: [
          { line: 'inh.q.sewing', goto: 'sewing' },
          { line: 'inh.q.scold', goto: 'scold' },
        ],
      },
      { label: 'sewing', line: 'inh.q.sewing' },
      ...seq('inh.sew.1', 'inh.sew.2', 'inh.sew.3'),
      { line: 'inh.sew.4', set: 'inherit_sewing_today', goto: 'end' },
      { label: 'scold', line: 'inh.q.scold' },
      ...seq('inh.scold.1', 'inh.scold.2', 'inh.scold.3', 'inh.scold.4'),
      { line: 'inh.scold.5', set: 'inherit_scold_today' },
      { label: 'end', line: 'inh.d.end', set: 'inheritance_calm' },
      { line: 'inh.d.gm' },
    ],
  },
  // 福伯把阿嬤認成過世的太太（他看得到阿嬤）
  fubo_ayu: {
    steps: [
      { line: 'fam.fubo.t.1' },
      {
        line: 'fam.fubo.t.gm',
        choices: [
          { line: 'fam.fubo.q.play', goto: 'play' },
          { line: 'fam.fubo.q.truth', goto: 'truth' },
          { line: 'fam.fubo.q.old', goto: 'old' },
        ],
      },
      { label: 'play', line: 'fam.fubo.q.play' },
      ...seq('fam.fubo.play.1', 'fam.fubo.play.2'),
      { line: 'fam.fubo.play.gm', set: 'fubo_talk_play_today', goto: 'end' },
      { label: 'truth', line: 'fam.fubo.q.truth' },
      ...seq('fam.fubo.truth.1', 'fam.fubo.truth.2', 'fam.fubo.truth.3'),
      { line: 'fam.fubo.truth.gm', set: 'fubo_talk_truth_today', goto: 'end' },
      { label: 'old', line: 'fam.fubo.q.old' },
      ...seq('fam.fubo.old.1', 'fam.fubo.old.2'),
      { line: 'fam.fubo.old.gm', set: 'fubo_talk_old_today' },
      { label: 'end', line: 'fam.fubo.t.end' },
    ],
  },
  // 志偉看不到、也聽不到阿嬤
  zhiwei_phone_early: { unseen: true, steps: seq('zw.phone.early', 'zw.phone.early.gm') },
  zhiwei_send: {
    unseen: true,
    steps: seq('zw.send.1', 'zw.send.2', 'zw.send.3', 'zw.send.gm', 'zw.send.4', 'zw.send.5', 'zw.send.6', 'zw.send.7', 'zw.send.8', 'zw.send.9', 'zw.send.gm2', 'zw.send.10'),
  },
}
for (const a of ACTS) for (const k of [1, 2, 3]) FAMILY_DIALOGUES[`zhiwei_${a}_${k}`] = { unseen: true, steps: seq(`zw.${a}.react`, ...STAGE[k]) }
Object.assign(DIALOGUES, FAMILY_DIALOGUES)
export { FAMILY_DIALOGUES }

// ---------------------------------------------------------------------------
// 互動點
// ---------------------------------------------------------------------------

const fam = () => familyState.current
const night = (s: GameState) => s.phase === 'night'
/** 陰氣夠不夠；夠就扣掉 */
function pay(s: GameState, cost: number) {
  if (s.yin < cost) {
    s.say('陰氣不夠了……')
    return false
  }
  if (cost > 0) s.spendYin(cost)
  return true
}
const flagged = async (...keys: string[]) => {
  const f = (await store()).getState().flags
  return keys.find((k) => f[k])
}

/** 志偉坐的茶桌（熱點在桌子旁邊，範圍大一點：倒茶、宵夜、哼歌、推手機都在這裡） */
const TABLE = { x: TEA.x + 0.35, z: TEA.z + 0.25 }
const weiSits = () => fam()?.wei === 'sit'

function actSpot(a: ZhiweiAct, label: string, cost: number, extra: (s: GameState) => boolean = () => true): Hotspot {
  return {
    id: `family.zhiwei.${a}`,
    scene: 'home',
    ...TABLE,
    r: 1.9,
    icon: { x: ZHIWEI_SPOT[0], z: ZHIWEI_SPOT[1] },
    iconY: 2.1,
    label: (s) => (night(s) && fam()?.canAct(a) && extra(s) ? label : null),
    cost: () => cost,
    run: (s) => {
      const f = fam()
      if (!f?.canAct(a) || !pay(s, cost)) return
      if (a === 'meal') void store().then((useStore) => useStore.setState({ carrying: false, dish: null }))
      const k = f.act(a)
      if (k) s.startDialogue(`zhiwei_${a}_${k}`)
    },
  }
}

export const ADULT_STORY_HOTSPOTS: Hotspot[] = [
  // ---------- 分遺產 ----------
  {
    id: 'family.inherit.listen',
    scene: 'home',
    ...INHERIT_SPOT.listen,
    r: 1.8,
    icon: INHERIT_SPOT.uncle,
    iconY: 2.4,
    label: (s) => (inheritanceBeat(s) ? '站在神明廳門口偷聽' : null),
    run: (s) =>
      s.startDialogue('inherit_dusk', () => {
        void store().then((useStore) => {
          const m = useStore.getState().meta
          if (!m.story.includes('inheritance')) useStore.setState({ meta: { ...m, story: [...m.story, 'inheritance'] } })
        })
      }),
  },
  {
    id: 'family.aunt.dream',
    scene: 'home',
    ...INHERIT_SPOT.bedside,
    r: 1.4,
    icon: { x: GM_BED.x, z: GM_BED.z - 0.6 },
    iconY: 1.7,
    label: (s) => (night(s) && auntStaysOver(s) && !s.flags.inheritance_calm ? '坐在姑姑床邊（托夢）' : null),
    cost: () => 10,
    run: (s) => {
      if (!pay(s, 10)) return
      s.startDialogue('inherit_dream', () => {
        void flagged('inherit_scold_today', 'inherit_sewing_today').then((k) => {
          const choice: AuntChoice = k === 'inherit_scold_today' ? 'scold' : 'sewing'
          fam()?.calmAunt(choice)
        })
      })
    },
  },

  // ---------- 福伯 ----------
  {
    id: 'family.fubo.talk',
    scene: 'home',
    get x() {
      return fam()?.pos('fubo')?.[0] ?? 1e4
    },
    get z() {
      return fam()?.pos('fubo')?.[1] ?? 1e4
    },
    r: 1.6,
    iconY: 2.0,
    label: (s) => (night(s) && fam()?.canTalkFubo() ? '跟福伯說說話' : null),
    run: (s) =>
      s.startDialogue('fubo_ayu', () => {
        void flagged('fubo_talk_truth_today', 'fubo_talk_old_today').then((k) => {
          const choice: FuboTalk = k === 'fubo_talk_truth_today' ? 'truth' : k === 'fubo_talk_old_today' ? 'old' : 'play'
          fam()?.talkFubo(choice)
        })
      }),
  },

  // ---------- 志偉（只有成人內容開著時才會來） ----------
  actSpot('tea', '幫他倒一杯熱茶', 3),
  actSpot('meal', '把宵夜放在他面前', 0, (s) => s.carrying),
  actSpot('hum', '在他旁邊輕輕哼搖籃曲', 6),
  {
    id: 'family.zhiwei.phone',
    scene: 'home',
    ...TABLE,
    r: 1.9,
    icon: { x: ZHIWEI_SPOT[0], z: ZHIWEI_SPOT[1] },
    iconY: 2.1,
    label: (s) => (night(s) && weiSits() ? '把他的手機輕輕推到他手邊' : null),
    cost: () => 2,
    run: (s) => {
      const f = fam()
      if (!f || f.wei !== 'sit' || !pay(s, 2)) return
      if (!f.phoneReady) {
        s.startDialogue('zhiwei_phone_early')
        return
      }
      s.startDialogue('zhiwei_send', () => familyState.current?.sendMessage())
    },
  },
]
