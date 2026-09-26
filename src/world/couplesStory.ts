import type { Hotspot } from './hotspots'
import { GUEST_ROOMS, WING_L, WING_R } from '../scene/layout'
import { PHONE, coupleIn, couplesState } from './night/couples'
import type { RoomId } from './night/types'

// 情侶客人的互動點（DESIGN §29，成人內容）：房門口掛「請勿打擾」（傍晚、深夜都可以）、
// 外遇那晚床頭櫃上一直震的手機「讓它沒電」。玩法在 night/couples.ts、畫面在 scene/CouplesLayer.tsx。
// 這個檔案不能在最上面 import store／audio（用 s.* 或 import('../store')）。

/** 房門那道牆的 x（右護龍朝埕那面、左護龍朝埕那面） */
const DOOR_WALL_X: Record<RoomId, number> = { r1: WING_R.x0, r2: WING_L.x1 }

function signSpot(room: RoomId): Hotspot {
  const [x, z] = GUEST_ROOMS[room].doorOut
  return {
    id: `couple.sign.${room}`,
    scene: 'home',
    x,
    z,
    r: 1.1,
    icon: { x: DOOR_WALL_X[room], z },
    iconY: 1.9,
    label: (s) => {
      if (s.phase !== 'dusk' && s.phase !== 'night') return null
      if (!coupleIn(s.plan, room) || couplesState.signs[room] === s.meta.night) return null
      return '在房門口掛「請勿打擾」'
    },
    run: (s) => {
      couplesState.signs[room] = s.meta.night
      s.bark('couple.gm.sign')
      void import('../audio/sfx').then(({ sfx }) => sfx.play('cloth', { volume: 0.6 }))
    },
  }
}

function phoneSpot(room: RoomId): Hotspot {
  const [x, z] = GUEST_ROOMS[room].nightstand
  const ringing = () => {
    const st = couplesState.current?.couple(room)?.phone?.state
    return st === 'buzz' || st === 'ring'
  }
  return {
    id: `couple.phone.${room}`,
    scene: 'home',
    x,
    z,
    r: 1.35,
    iconY: 1.0,
    label: (s) => (s.phase === 'night' && ringing() ? `讓手機沒電（陰氣 ${PHONE.cost}）` : null),
    cost: () => PHONE.cost,
    run: (s) => {
      const c = couplesState.current?.couple(room)
      if (!c || !ringing()) return
      if (s.yin < PHONE.cost) {
        s.bark('couple.gm.phone.noyin')
        return
      }
      if (c.silence('drain')) void import('../store').then(({ useStore }) => useStore.setState((x) => ({ yin: Math.max(0, x.yin - PHONE.cost) })))
    },
  }
}

export const COUPLE_HOTSPOTS: Hotspot[] = [signSpot('r1'), signSpot('r2'), phoneSpot('r1'), phoneSpot('r2')]
