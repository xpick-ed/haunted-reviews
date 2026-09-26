import type { GameState } from '../store'
import type { Hotspot } from './hotspots'
import { festivalOf } from './night/plan'
import { FENCE } from '../scene/layout'
import { STORY } from './story'
import { inheritanceBeat } from './adultStory'

// 主線劇情的互動點（DESIGN §28.3）：第 6 晚傍晚在大門口偷聽陳董跟小翰說話……
// 這個檔案不能在最上面 import store（用 s.* 或 import('../store')）。

/** 第 6 晚傍晚：陳董在大門外找小翰（看完就不再出現） */
export const chendongBeat = (s: Pick<GameState, 'meta' | 'phase'>) =>
  s.meta.night === STORY.chendong.night && s.phase === 'dusk' && !s.meta.story.includes('chendong')

/** 陳董、小翰站的位置（大門外的小路上）；阿嬤躲在門內的門柱邊 */
export const CHENDONG_SPOT = {
  chendong: { x: 0.95, z: FENCE.z + 1.35 },
  han: { x: -0.55, z: FENCE.z + 1.2 },
  /** 黑頭車停在路邊 */
  car: { x: 6.8, z: FENCE.z + 3.5 },
  /** 偷聽的地方：門柱內側 */
  listen: { x: -FENCE.gateHalf - 0.35, z: FENCE.z - 0.75 },
}

export const STORY_HOTSPOTS: Hotspot[] = [
  {
    id: 'story_chendong',
    scene: 'home',
    x: CHENDONG_SPOT.listen.x,
    z: CHENDONG_SPOT.listen.z,
    r: 1.6,
    icon: { x: CHENDONG_SPOT.chendong.x, z: CHENDONG_SPOT.chendong.z },
    iconY: 2.4,
    label: (s) => (chendongBeat(s) ? '躲在門邊偷聽' : null),
    run: (s) =>
      s.startDialogue('story_chendong', () => {
        void import('../store').then(({ useStore }) => {
          const m = useStore.getState().meta
          if (!m.story.includes('chendong')) useStore.setState({ meta: { ...m, story: [...m.story, 'chendong'] } })
        })
      }),
  },
]

/** 小翰傍晚在埕裡掃地嗎（清明去山上掃墓、陳董來的那天在大門口就不在） */
export const hanAtHome = (s: Pick<GameState, 'meta' | 'phase'>) => s.phase === 'dusk' && festivalOf(s.meta.night) !== 'qingming' && !chendongBeat(s) && !inheritanceBeat(s)
