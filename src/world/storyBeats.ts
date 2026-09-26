import type { GameState } from '../store'
import type { Hotspot } from './hotspots'
import { festivalOf } from './night/plan'
import { FENCE } from '../scene/layout'
import { HAN_KNOWS, STORY } from './story'
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
export const hanAtHome = (s: Pick<GameState, 'meta' | 'phase' | 'flags'>) => s.phase === 'dusk' && festivalOf(s.meta.night) !== 'qingming' && !chendongBeat(s) && !inheritanceBeat(s) && !kneelBeat(s) && !bowlBeat(s)

// ---------------------------------------------------------------------------
// 小翰的陰陽溝通（DESIGN §31.2，src/world/han.ts）：傍晚他不在埕裡掃地的時候
// ---------------------------------------------------------------------------

type HanBeatState = Pick<GameState, 'meta' | 'phase' | 'flags'>
const ended = (s: HanBeatState) => s.meta.story.some((x) => x.startsWith('ended_'))
/** 這幾晚傍晚，小翰跪在神明廳擲筊（第 3 晚：做得起來嗎；第 9 晚：陳董來過、期限說了：要不要賣；第 11 晚：阿嬤妳在嗎） */
export const KNEEL_NIGHTS = [3, 9, 11]
/** 他不在家、或別的劇情在演的那天，這些都不出現 */
const busy = (s: HanBeatState) => festivalOf(s.meta.night) === 'qingming' || chendongBeat(s) || inheritanceBeat(s) || ended(s)

/** 傍晚小翰跪在神明廳擲筊（擲完就回去掃地） */
export const kneelBeat = (s: HanBeatState) => s.phase === 'dusk' && KNEEL_NIGHTS.includes(s.meta.night) && !s.flags[`hs_jb_${s.meta.night}`] && !busy(s)

/** 他感覺到阿嬤在了：傍晚在茶桌多擺一副碗筷，對著空椅子講話（看完就不再演） */
export const bowlBeat = (s: HanBeatState) => s.phase === 'dusk' && s.meta.hanSense >= HAN_KNOWS && !s.flags.hs_bowl && !kneelBeat(s) && !busy(s)
