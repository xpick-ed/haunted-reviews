import { box, rect, type Circle, type Rect } from './collision'
import type { Hotspot } from './hotspots'
import { festivalOf } from './night/plan'
import type { RhythmResult, ZongziResult } from '../ui/minigames/types'

// 廟埕野台戲（DESIGN §26.1）：土地公廟埕西側的歌仔戲台，面向東（廟埕、鏡頭這邊）。
// 平常只有竹架子和摺起來的帆布；節日（土地公生、中元普渡）從傍晚到深夜開演。
// 碰撞是永久的（併進土地公廟的場景）：戲台、後面戲班的貨車、樓梯和戲箱、觀眾的長板凳、廟埕的石拜桌。
// 畫面在 src/scene/Stage.tsx（掛在 Temple.tsx 裡）。
// 注意：這個檔案會被 Node 測試載入，不能 import store／audio（改狀態用動態 import）。
//
//          z 負（北，廟後）
//   貨車  ┃ 戲台（後場在北邊）┃ 喇叭      長板凳 ×3      阿義的石椅   廟
//   帳篷  ┃   布景  ← 演員 →  ┃          （面向戲台）                 天公爐
//         ┗ 樓梯、戲箱、班主 ┛                          石拜桌（中元擺供品、包粽子）
//   ════════════════════ 路 ════════════════════
//          z 正（南，鏡頭這邊）

export const STAGE = {
  /** 戲台台面（高 1.1 公尺），前緣在 x1，面向 +x */
  deck: { x0: -13.4, x1: -9.4, z0: -1.4, z1: 3.0, y: 1.1 },
  /** 後場（鑼鼓）在台上北邊的角落 */
  band: { x: -12.2, z: -0.75 },
  /** 戲台後面：戲班的貨車、帳篷（擋住，不讓阿嬤跑到布景後面被擋住） */
  back: { x0: -17, x1: -13.4, z0: -1.8, z1: 3.0 },
  /** 台的南邊：上台的樓梯、戲箱，班主站在戲箱旁邊 */
  trunks: { x0: -13.4, x1: -9.2, z0: 3.0, z1: 3.65 },
  banzhu: { x: -9.38, z: 3.3 },
  /** 喇叭（地上，台前北角） */
  speaker: { x: -8.95, z: -1.05 },
  /** 觀眾的長板凳：沿 z 擺，面向戲台 */
  benchXs: [-8.4, -7.2, -6.0],
  bench: { z0: 0.2, z1: 2.8, w: 0.36, seatY: 0.44 },
  /** 老竹凳（阿嬤年輕時跟阿公一起看戲坐的；回憶碎片的位置） */
  oldStool: { x: -6.55, z: 3.3 },
  /** 廟埕的石拜桌（天公爐南邊，面向廟）：中元普渡擺滿供品、西端包粽子 */
  altar: { x: 0, z: 3.58, w: 3.2, d: 0.6, h: 0.78 },
  /** 燈篙（中元普渡豎起來的竹竿燈）：金爐和紅磚矮牆中間 */
  pole: { x: 4.3, z: -0.55 },
}

const S = STAGE

export const STAGE_RECTS: Rect[] = [
  rect(S.deck.x0, S.deck.z0, S.deck.x1, S.deck.z1),
  rect(S.back.x0, S.back.z0, S.back.x1, S.back.z1),
  rect(S.trunks.x0, S.trunks.z0, S.trunks.x1, S.trunks.z1),
  ...S.benchXs.map((x) => rect(x - S.bench.w / 2, S.bench.z0, x + S.bench.w / 2, S.bench.z1)),
  box(S.altar.x, S.altar.z, S.altar.w, S.altar.d),
]

export const STAGE_CIRCLES: Circle[] = [
  { x: S.speaker.x, z: S.speaker.z, r: 0.42 },
  { x: S.oldStool.x, z: S.oldStool.z, r: 0.22 },
  { x: S.pole.x, z: S.pole.z, r: 0.14 },
]

// ---------------------------------------------------------------------------
// 今天演不演
// ---------------------------------------------------------------------------

export type StageMode = 'bare' | 'tudigong' | 'zhongyuan'

/** 土地公生、中元普渡：從傍晚演到深夜；其他日子（和清晨）只有空戲台 */
export function stageMode(night: number, phase: string): StageMode {
  if (phase === 'dawn') return 'bare'
  const f = festivalOf(night)
  return f === 'tudigong' || f === 'zhongyuan' ? f : 'bare'
}

/**
 * 畫面要知道的即時事件（掌聲、演員謝幕、後場的鼓自己打起來）。
 * 熱點在小遊戲結束時寫，Stage.tsx 每幀讀。
 */
export const stageFx = {
  /** 最近一次掌聲的時間（performance.now 毫秒） */
  cheerAt: -1e9,
  /** 阿嬤打得多好 0..1（掌聲多大、演員多開心） */
  accuracy: 0,
}

// ---------------------------------------------------------------------------
// 熱點
// ---------------------------------------------------------------------------

// 規則檔不能直接 import store（store → hotspots → scenes → 這裡，會循環），要改狀態時再動態載入
const withStore = (fn: (st: typeof import('../store').useStore) => void) => {
  void import('../store').then((m) => fn(m.useStore))
}

const setFlag = (flag: string) =>
  withStore((st) => {
    const s = st.getState()
    st.setState({ flags: { ...s.flags, [flag]: true } })
  })

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

/** 打得越準功德越多：30% 以上 1、60% 以上 2、85% 以上 3 */
export const rhythmMerit = (acc: number) => (acc >= 0.85 ? 3 : acc >= 0.6 ? 2 : acc >= 0.3 ? 1 : 0)

export const STAGE_HOTSPOTS: Hotspot[] = [
  {
    // 節日：班主（第一次先講話，之後直接上後場打鑼鼓）
    id: 'stage_banzhu',
    scene: 'temple',
    x: -8.85,
    z: 3.7,
    r: 1.6,
    icon: { x: S.banzhu.x, z: S.banzhu.z },
    iconY: 2.35,
    label: (s) => {
      if (stageMode(s.meta.night, s.phase) === 'bare') return null
      if (s.flags.stage_rhythm_today) return '班主（今晚幫過了）'
      return s.flags.banzhu_met ? '上後場幫忙打鑼鼓' : '跟班主說話'
    },
    run: (s) => {
      if (s.flags.stage_rhythm_today) {
        s.bark(pick(['banzhu.thanks.1', 'banzhu.thanks.2']))
        return
      }
      const play = () => {
        setFlag('stage_rhythm_today')
        // 看過（幫過）野台戲：墓仔埔的火伯想聽戲（sceneHill.ts 的支線用）
        setFlag('stage_seen')
        s.startMinigame('rhythm', {}, (r) => {
          const acc = (r as RhythmResult | null)?.accuracy ?? 0
          const merit = rhythmMerit(acc)
          withStore((st) => {
            const x = st.getState()
            if (merit > 0) st.setState({ meta: { ...x.meta, merit: x.meta.merit + merit } })
            x.bark(acc >= 0.6 ? 'banzhu.win' : acc >= 0.3 ? 'banzhu.ok' : 'banzhu.lose')
          })
          stageFx.cheerAt = performance.now()
          stageFx.accuracy = acc
        })
      }
      if (!s.flags.banzhu_met) s.startDialogue('banzhu_1', play)
      else {
        s.bark(pick(['banzhu.hello.1', 'banzhu.hello.2']))
        play()
      }
    },
  },
  {
    // 中元普渡：石拜桌西端，阿桑們在包粽子，阿嬤也來包幾顆（一天一次）
    id: 'stage_zongzi',
    scene: 'temple',
    x: S.altar.x - S.altar.w / 2 - 0.55,
    z: S.altar.z,
    r: 1.2,
    icon: { x: S.altar.x - S.altar.w / 2 + 0.35, z: S.altar.z },
    iconY: 1.45,
    label: (s) => {
      if (stageMode(s.meta.night, s.phase) !== 'zhongyuan') return null
      return s.flags.stage_zongzi_today ? '包粽子（今天包過了）' : '一起包粽子'
    },
    run: (s) => {
      if (s.flags.stage_zongzi_today) {
        s.bark('stage.zongzi.done')
        return
      }
      setFlag('stage_zongzi_today')
      s.bark('stage.zongzi.start')
      s.startMinigame('zongzi', {}, (r) => {
        const res = (r as ZongziResult | null) ?? { count: 0, quality: 0 }
        withStore((st) => {
          const x = st.getState()
          if (res.count > 0) {
            const pantry = { ...x.meta.pantry, zongzi: (x.meta.pantry.zongzi ?? 0) + res.count }
            st.setState({ meta: { ...x.meta, pantry } })
          }
          x.bark(res.count === 0 ? 'stage.zongzi.none' : res.quality >= 0.7 ? 'stage.zongzi.good' : 'stage.zongzi.ok')
        })
      })
    },
  },
  {
    // 節日：坐在板凳後面看戲
    id: 'stage_watch',
    scene: 'temple',
    x: -5.2,
    z: 2.2,
    r: 1.1,
    icon: { x: -7.2, z: 1.5 },
    iconY: 1.7,
    label: (s) => (stageMode(s.meta.night, s.phase) === 'bare' ? null : '看戲'),
    run: (s) => (setFlag('stage_seen'), s.bark(pick(['stage.watch.1', 'stage.watch.2', 'stage.watch.3', 'stage.watch.4', s.isNight ? 'stage.watch.ghost' : 'stage.watch.5']))),
  },
  {
    // 中元普渡：石拜桌上滿滿的供品
    id: 'stage_offering',
    scene: 'temple',
    x: S.altar.x + S.altar.w / 2 + 0.55,
    z: S.altar.z,
    r: 1.1,
    icon: { x: S.altar.x + 0.8, z: S.altar.z },
    iconY: 1.6,
    label: (s) => (stageMode(s.meta.night, s.phase) === 'zhongyuan' ? '看普渡的供品' : null),
    run: (s) => s.bark(pick(['stage.offering.1', 'stage.offering.2', 'stage.offering.3'])),
  },
  {
    // 平常：空戲台
    id: 'stage_bare',
    scene: 'temple',
    x: -8.7,
    z: 1.0,
    r: 1.3,
    icon: { x: -10.2, z: 0.8 },
    iconY: 2.0,
    label: (s) => (stageMode(s.meta.night, s.phase) === 'bare' ? '看看空戲台' : null),
    run: (s) => s.bark(pick(['stage.bare.1', 'stage.bare.2', 'stage.bare.3'])),
  },
]
