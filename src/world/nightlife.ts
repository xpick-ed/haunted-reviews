import type { GameState } from '../store'
import type { Hotspot } from './hotspots'
import type { DrinkingResult, MahjongResult } from '../ui/minigames/types'
import { adultOn } from '../settings'
import { DIALOGUES, type Dialogue } from './dialogues'
import { NPC_SPOTS } from './scenes'
import { VILLAGE } from './sceneVillage'
import { HILL, HILL_GHOSTS, hillGate } from './sceneHill'

// 大人的夜生活（DESIGN §29，成人內容）：老街那卡西、跟阿義划酒拳、跟鬼鄰居打麻將、阿嬌和玉姨的葷笑話。
// 這個檔案不能在最上面 import store／audio（用 s.* 或 import('../store')）。
// 全部只在設定裡打開成人內容（adultOn）時出現；台詞在 src/data/nightlife.lines.json。
// 不碰喝酒開車的美化：阿義的故事講的是後悔，阿嬤的回答很溫柔但不含糊。

/** 畫面與熱點共用的位置（src/scene/Nakashi.tsx、src/scene/NightlifeProps.tsx） */
export const NIGHTLIFE = {
  /** 老街：冰果室亭仔腳前面的鬼那卡西（電子琴＋吉他），面向街道 */
  band: {
    organ: { x: 0.85, z: -1.75, heading: 0.2 },
    guitar: { x: 1.95, z: -1.9, heading: -0.25 },
    x: 1.4,
    z: -1.8,
  },
  /** 那卡西的音樂：多近開始聽得到（公尺） */
  bandHear: 11,
  /** 山上中層：麻將桌（阿嬤的位子在南邊，面對鏡頭的那一側空著） */
  table: { x: 4.3, z: 0.9, y: HILL.t1 },
}

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------

type Patchable = { flags: Record<string, boolean>; meta: { merit: number } }
function patch(fn: (x: Patchable) => object) {
  void import('../store').then(({ useStore }) => useStore.setState((x) => fn(x as unknown as Patchable) as never))
}
const setFlag = (f: string) => patch((x) => ({ flags: { ...x.flags, [f]: true } }))
const addMerit = (n: number) => n > 0 && patch((x) => ({ meta: { ...x.meta, merit: x.meta.merit + n } }))
function withState(fn: (s: GameState) => void) {
  void import('../store').then(({ useStore }) => fn(useStore.getState()))
}
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
const night = (s: { phase: string }) => s.phase === 'night'

// ---------------------------------------------------------------------------
// 對話（登記進 DIALOGUES）
// ---------------------------------------------------------------------------

const lines = (ids: string[], first?: string, last?: string): Dialogue['steps'] =>
  ids.map((line, i) => ({
    line,
    ...(i === 0 && first ? { set: first } : {}),
    ...(i === ids.length - 1 && i > 0 && last ? { set: last } : {}),
  }))

/** 笑話：阿嬌 6 則、玉姨 6 則（每則幾句，最後通常是阿嬤的反應） */
const JOKES: Record<'ajiao' | 'yuyi', string[][]> = {
  ajiao: [
    ['nl.aj.j1.1', 'nl.aj.j1.2', 'nl.aj.j1.gm'],
    ['nl.aj.j2.1', 'nl.aj.j2.2', 'nl.aj.j2.gm'],
    ['nl.aj.j3.1', 'nl.aj.j3.2', 'nl.aj.j3.gm'],
    ['nl.aj.j4.1', 'nl.aj.j4.gm1', 'nl.aj.j4.gm2'],
    ['nl.aj.j5.1', 'nl.aj.j5.gm', 'nl.aj.j5.2'],
    ['nl.aj.j6.1', 'nl.aj.j6.2', 'nl.aj.j6.gm'],
  ],
  yuyi: [
    ['nl.yy.j1.1', 'nl.yy.j1.gm', 'nl.yy.j1.2'],
    ['nl.yy.j2.1', 'nl.yy.j2.2', 'nl.yy.j2.gm'],
    ['nl.yy.j3.1', 'nl.yy.j3.2', 'nl.yy.j3.gm'],
    ['nl.yy.j4.1', 'nl.yy.j4.2', 'nl.yy.j4.gm', 'nl.yy.j4.3'],
    ['nl.yy.j5.1', 'nl.yy.j5.gm', 'nl.yy.j5.2'],
    ['nl.yy.j6.1', 'nl.yy.j6.2', 'nl.yy.j6.gm'],
  ],
}

const jokeId = (who: 'ajiao' | 'yuyi', i: number) => `nl_${who}_j${i + 1}`
const heardFlag = (who: 'ajiao' | 'yuyi', i: number) => `nl_heard_${who}_j${i + 1}`

Object.assign(DIALOGUES, {
  // 那卡西：點一首（三首自己編的老歌，選一首）
  nl_nakashi: {
    steps: [
      { line: 'nl.nk.invite', set: 'nakashi_song_today' },
      {
        line: 'nl.nk.ask',
        choices: [
          { line: 'nl.nk.pick.a', goto: 'a' },
          { line: 'nl.nk.pick.b', goto: 'b' },
          { line: 'nl.nk.pick.c', goto: 'c' },
        ],
      },
      { label: 'a', line: 'nl.nk.pick.a' },
      { line: 'nl.nk.a.1' },
      { line: 'nl.nk.a.2' },
      { line: 'nl.nk.a.gm', goto: 'end' },
      { label: 'b', line: 'nl.nk.pick.b' },
      { line: 'nl.nk.b.1' },
      { line: 'nl.nk.b.2' },
      { line: 'nl.nk.b.gm' },
      { line: 'nl.nk.b.nk', goto: 'end' },
      { label: 'c', line: 'nl.nk.pick.c' },
      { line: 'nl.nk.c.1' },
      { line: 'nl.nk.c.2' },
      { line: 'nl.nk.c.gm', goto: 'end' },
      { label: 'end', line: 'nl.nk.thanks' },
    ],
  },
  // 阿義第一次找阿嬤划拳：講規則
  nl_ayi_first: {
    steps: lines(['nl.ayi.first.1', 'nl.ayi.first.2', 'nl.ayi.first.3'], undefined, 'nl_ayi_drink_met'),
  },
  // 阿義喝到第三杯：他是怎麼走的（只講一次）
  nl_ayi_confess: {
    steps: lines(
      ['nl.ayi.cf.1', 'nl.ayi.cf.2', 'nl.ayi.cf.3', 'nl.ayi.cf.4', 'nl.ayi.cf.5', 'nl.ayi.cf.6', 'nl.ayi.cf.7', 'nl.ayi.cf.8', 'nl.ayi.cf.9', 'nl.ayi.cf.10'],
      'ayi_confessed',
    ),
  },
  ...Object.fromEntries(
    (['ajiao', 'yuyi'] as const).flatMap((who) =>
      JOKES[who].map((ids, i) => [
        jokeId(who, i),
        {
          steps: lines(ids, `${who}_joke_today`, heardFlag(who, i)),
        } satisfies Dialogue,
      ]),
    ),
  ),
} satisfies Record<string, Dialogue>)

/** 還沒聽過的笑話優先；全部聽過就隨便挑一則 */
function nextJoke(s: GameState, who: 'ajiao' | 'yuyi') {
  const all = JOKES[who].map((_, i) => i)
  const fresh = all.filter((i) => !s.flags[heardFlag(who, i)])
  return jokeId(who, pick(fresh.length ? fresh : all))
}

// ---------------------------------------------------------------------------
// 熱點
// ---------------------------------------------------------------------------

const yuyi = HILL_GHOSTS.find((g) => g.id === 'yuyi')!
const B = NIGHTLIFE.band
const T = NIGHTLIFE.table

export const NIGHTLIFE_HOTSPOTS: Hotspot[] = [
  {
    // 老街的鬼那卡西：晚上才出來，一晚點一首（功德 +1）
    id: 'nl_nakashi',
    scene: 'oldstreet',
    x: B.x,
    z: B.z + 1.05,
    r: 1.5,
    icon: { x: B.organ.x, z: B.organ.z },
    iconY: 2.55,
    label: (s) => {
      if (!adultOn() || !night(s)) return null
      return s.flags.nakashi_song_today ? '那卡西（今晚點過了）' : '點一首（那卡西）'
    },
    run: (s) => {
      if (s.flags.nakashi_song_today) {
        s.bark('nl.nk.again')
        return
      }
      s.startDialogue('nl_nakashi', () => addMerit(1))
    },
  },
  {
    // 廟口跟阿義划酒拳：晚上，一晚一次（功德 +1）；阿義第一次喝到三杯會講他是怎麼走的
    id: 'nl_ayi_drink',
    scene: 'temple',
    x: NPC_SPOTS.ayi.x - 0.9,
    z: NPC_SPOTS.ayi.z + 1.25,
    r: 1.3,
    icon: { x: NPC_SPOTS.ayi.x - 0.45, z: NPC_SPOTS.ayi.z },
    iconY: 2.75,
    label: (s) => {
      if (!adultOn() || !night(s)) return null
      return s.flags.ayi_drink_today ? '阿義（今晚划過拳了）' : '跟阿義划酒拳'
    },
    run: (s) => {
      if (s.flags.ayi_drink_today) {
        s.bark('nl.ayi.done')
        return
      }
      const play = () =>
        s.startMinigame('drinking', {}, (r) => {
          const res = r as DrinkingResult | null
          if (!res) return
          setFlag('ayi_drink_today')
          addMerit(1)
          window.setTimeout(
            () =>
              withState((st) => {
                if (res.cups >= 3 && !st.flags.ayi_confessed) st.startDialogue('nl_ayi_confess')
                else st.bark(res.wins >= 4 ? 'nl.ayi.lose' : 'nl.ayi.win')
              }),
            500,
          )
        })
      if (!s.flags.nl_ayi_drink_met) {
        s.startDialogue('nl_ayi_first', play)
        return
      }
      s.bark('nl.ayi.invite')
      window.setTimeout(play, 900)
    },
  },
  {
    // 山上的麻將桌：陰陽眼、晚上，一晚一圈（功德 0–3，胡得越快越多）
    id: 'nl_mahjong',
    scene: 'hill',
    x: T.x,
    z: T.z + 1.15,
    r: 1.35,
    icon: { x: T.x, z: T.z },
    iconY: T.y + 1.6,
    label: (s) => {
      if (!adultOn() || !night(s) || !hillGate.ghostsVisible(s)) return null
      return s.flags.hill_mahjong_today ? '麻將桌（今晚打過了）' : '跟鄰居打一圈'
    },
    run: (s) => {
      if (s.flags.hill_mahjong_today) {
        s.bark('nl.mj.done')
        return
      }
      s.bark('nl.mj.invite')
      window.setTimeout(
        () =>
          s.startMinigame('mahjong', {}, (r) => {
            const res = r as MahjongResult | null
            if (!res) return
            setFlag('hill_mahjong_today')
            addMerit(res.merit)
            window.setTimeout(
              () => withState((st) => st.bark(res.won ? 'nl.mj.win' : res.merit === 0 && Math.random() < 0.5 ? 'nl.mj.draw' : 'nl.mj.lose')),
              500,
            )
          }),
        900,
      )
    },
  },
  {
    // 柑仔店的阿嬌：傍晚講一則大人版的八卦（一天一則）
    id: 'nl_ajiao_joke',
    scene: 'village',
    x: VILLAGE.ajiao.x - 1.5,
    z: VILLAGE.counter.z + 0.8,
    r: 1.2,
    icon: { x: VILLAGE.ajiao.x - 0.55, z: VILLAGE.ajiao.z },
    iconY: 2.65,
    label: (s) => {
      if (!adultOn() || s.phase !== 'dusk') return null
      return s.flags.ajiao_joke_today ? '阿嬌的八卦（今天講完了）' : '聽八卦（大人版）'
    },
    run: (s) => {
      if (s.flags.ajiao_joke_today) {
        s.bark('nl.aj.done')
        return
      }
      s.startDialogue(nextJoke(s, 'ajiao'))
    },
  },
  {
    // 山上的玉姨（陰陽眼）：媒人婆的葷笑話，一天一則
    id: 'nl_yuyi_joke',
    scene: 'hill',
    x: yuyi.x - 1.35,
    z: yuyi.z + 0.45,
    r: 1.2,
    icon: { x: yuyi.x - 0.3, z: yuyi.z },
    iconY: T.y + 2.0,
    label: (s) => {
      if (!adultOn() || !hillGate.ghostsVisible(s)) return null
      return s.flags.yuyi_joke_today ? '玉姨的八卦（今天講完了）' : '聽八卦（大人版）'
    },
    run: (s) => {
      if (s.flags.yuyi_joke_today) {
        s.bark('nl.yy.done')
        return
      }
      s.startDialogue(nextJoke(s, 'yuyi'))
    },
  },
]
