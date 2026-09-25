import { GUEST_ROOMS, ROCKER, SINK, STOVE } from '../../scene/layout'
import type { GuestRT, NightSim } from './sim'
import type { ActionId, NeedKind, ObjectState, RoomId } from './types'

// 阿嬤能做的動作（DESIGN §6）與深夜的互動點。
// 互動點靠近時，所有範圍內的動作排成一個清單：客人需要的排前面，動作鍵顯示第一個，可以切換。

export interface ActionDef {
  id: ActionId
  name: string
  yin: number
  /** 聲音大小 0..1 */
  noise: number
  type: 'kind' | 'scare' | 'social' | 'misc'
  /** 做的時候阿嬤停住多久（秒） */
  busy: number
  satisfies?: NeedKind
  comfort?: number
  fear?: number
  /** 需要先學會的技能 */
  skill?: string
}

export const ACTION_DEFS: Record<ActionId, ActionDef> = {
  tuck: { id: 'tuck', name: '蓋被子', yin: 10, noise: 0.08, type: 'kind', busy: 1.1, satisfies: 'cold', comfort: 16 },
  temp: { id: 'temp', name: '調電扇', yin: 4, noise: 0.05, type: 'kind', busy: 0.8, satisfies: 'hot', comfort: 10 },
  water: { id: 'water', name: '倒一杯水', yin: 5, noise: 0.12, type: 'kind', busy: 1.0, satisfies: 'thirsty', comfort: 10 },
  coil: { id: 'coil', name: '點蚊香', yin: 5, noise: 0.06, type: 'kind', busy: 1.0, satisfies: 'mosquito', comfort: 12 },
  nightlight: { id: 'nightlight', name: '開小夜燈', yin: 4, noise: 0.04, type: 'kind', busy: 0.7, satisfies: 'dark', comfort: 10 },
  window: { id: 'window', name: '關窗', yin: 4, noise: 0.15, type: 'kind', busy: 0.9, satisfies: 'cold', comfort: 8 },
  cook: { id: 'cook', name: '煮宵夜', yin: 12, noise: 0.25, type: 'kind', busy: 2.4, skill: 'cook' },
  deliver: { id: 'deliver', name: '放下宵夜', yin: 0, noise: 0.1, type: 'kind', busy: 0.9, satisfies: 'hungry', comfort: 25 },
  pat: { id: 'pat', name: '輕拍哄睡', yin: 8, noise: 0.05, type: 'kind', busy: 1.6, satisfies: 'insomnia', comfort: 12, skill: 'pat' },
  lullaby: { id: 'lullaby', name: '哼搖籃曲', yin: 10, noise: 0.12, type: 'kind', busy: 2.2, satisfies: 'insomnia', comfort: 10, skill: 'lullaby' },
  flicker: { id: 'flicker', name: '讓燈閃一閃', yin: 5, noise: 0.25, type: 'scare', busy: 0.8, fear: 12, skill: 'flicker' },
  knock: { id: 'knock', name: '敲門', yin: 3, noise: 0.6, type: 'scare', busy: 0.7, fear: 8, skill: 'knock' },
  rocker: { id: 'rocker', name: '讓搖椅搖', yin: 8, noise: 0.35, type: 'scare', busy: 0.8, fear: 15, skill: 'rocker' },
  mirror: { id: 'mirror', name: '鏡中人', yin: 14, noise: 0.1, type: 'scare', busy: 1.0, fear: 30, skill: 'mirror' },
  play: { id: 'play', name: '陪小宇玩', yin: 0, noise: 0.1, type: 'social', busy: 0.5, satisfies: 'play', comfort: 25 },
  chat: { id: 'chat', name: '跟老朋友聊天', yin: 0, noise: 0.05, type: 'social', busy: 0.5, satisfies: 'chat', comfort: 25 },
  calm: { id: 'calm', name: '摸摸小黑', yin: 0, noise: 0, type: 'misc', busy: 1.0 },
}

export interface Option {
  action: ActionId
  /** 在哪一間客房做（客房的動作才有） */
  room?: RoomId
  label: string
  cost: number
  /** 有客人正需要這個 */
  needed: boolean
  /** 互動點 id（畫面上的光點用） */
  spot: string
  /** 動作發生的位置 */
  x: number
  z: number
  /** 嚇人的動作發生在哪一區（YouTuber 拍攝區） */
  area?: string
}

export interface Spot {
  id: string
  x: number
  z: number
  r: number
  /** 光點位置 */
  icon: [number, number, number]
}

export interface NightCtx {
  sim: NightSim
  objects: Record<string, ObjectState>
  skills: string[]
  carrying: boolean
  hour: number
  yinCost: (a: ActionId) => number
}

const has = (ctx: NightCtx, skill?: string) => !skill || ctx.skills.includes(skill)
const on = (ctx: NightCtx, id: string) => !!ctx.objects[id]?.on
const needs = (gs: GuestRT[], kind: NeedKind) => gs.some((g) => g.needs.some((n) => n.kind === kind))

/** 深夜所有互動點（依今晚住了誰） */
export function nightSpots(ctx: NightCtx): (Spot & { options: () => Option[] })[] {
  const out: (Spot & { options: () => Option[] })[] = []
  const opt = (a: ActionId, spot: Spot, extra: Partial<Option> = {}): Option => ({
    action: a,
    label: ACTION_DEFS[a].name,
    cost: ctx.yinCost(a),
    needed: false,
    spot: spot.id,
    x: spot.icon[0],
    z: spot.icon[2],
    ...extra,
  })
  for (const room of ['r1', 'r2'] as RoomId[]) {
    const gs = ctx.sim.guests.filter((g) => g.room === room)
    if (!gs.length) continue
    const R = GUEST_ROOMS[room]
    const inBed = gs.filter((g) => g.mode === 'bed')

    const bed: Spot = { id: `${room}.bed`, x: R.bedside[0], z: R.bedside[1], r: 1.05, icon: [R.bed.x, 1.2, R.bed.z + 0.6] }
    out.push({
      ...bed,
      options: () => {
        const o: Option[] = []
        if (inBed.length) o.push(opt('tuck', bed, { room, needed: needs(inBed, 'cold') }))
        if (inBed.length && has(ctx, 'pat')) o.push(opt('pat', bed, { room, needed: needs(inBed, 'insomnia') }))
        const kid = gs.find((g) => g.def.type === 'child' && g.awake && g.needs.some((n) => n.kind === 'play'))
        if (kid) o.push(opt('play', bed, { room, needed: true }))
        const elders = gs.filter((g) => g.def.type === 'elder' && g.awake && g.needs.some((n) => n.kind === 'chat'))
        if (elders.length) o.push(opt('chat', bed, { room, needed: true }))
        return o
      },
    })
    const stand: Spot = { id: `${room}.stand`, x: R.nightstand[0], z: R.nightstand[1], r: 1.5, icon: [R.nightstand[0], 1.3, R.nightstand[1]] }
    out.push({
      ...stand,
      options: () => {
        const o: Option[] = []
        if (ctx.carrying) o.push(opt('deliver', stand, { room, needed: needs(gs, 'hungry') }))
        if (!on(ctx, `${room}.cup`)) o.push(opt('water', stand, { room, needed: needs(gs, 'thirsty') }))
        if (!on(ctx, `${room}.lamp`)) o.push(opt('nightlight', stand, { room, needed: needs(gs, 'dark') }))
        return o
      },
    })
    const fan: Spot = { id: `${room}.fan`, x: R.fan[0], z: R.fan[1], r: 0.95, icon: [R.fan[0], 1.5, R.fan[1]] }
    out.push({ ...fan, options: () => [opt('temp', fan, { room, needed: needs(gs, 'hot'), label: on(ctx, `${room}.fan`) ? '關電扇' : '開電扇' })] })
    const coil: Spot = { id: `${room}.coil`, x: R.coil[0], z: R.coil[1], r: 1.4, icon: [R.coil[0], 0.9, R.coil[1]] }
    out.push({ ...coil, options: () => (on(ctx, `${room}.coil`) ? [] : [opt('coil', coil, { room, needed: needs(gs, 'mosquito') })]) })
    if (R.window) {
      const win: Spot = { id: `${room}.window`, x: 9.2, z: 4.6, r: 1.3, icon: [R.window[0], 1.9, R.window[1]] }
      out.push({ ...win, options: () => (on(ctx, `${room}.window`) ? [] : [opt('window', win, { room, needed: needs(gs, 'cold') })]) })
    }
    // 房門外：敲門、讓燈閃、哼搖籃曲（不用進房間）
    const door: Spot = { id: `${room}.door`, x: R.doorOut[0], z: R.doorOut[1], r: 0.95, icon: [R.doorOut[0], 2.3, R.doorOut[1]] }
    out.push({
      ...door,
      options: () => {
        const o: Option[] = []
        if (has(ctx, 'lullaby')) o.push(opt('lullaby', door, { room, needed: needs(gs, 'insomnia') }))
        if (has(ctx, 'flicker')) o.push(opt('flicker', door, { room, area: room, needed: needs(gs, 'scare') }))
        if (has(ctx, 'knock')) o.push(opt('knock', door, { room, area: room, needed: needs(gs, 'scare') }))
        return o
      },
    })
  }
  const anyGuests = ctx.sim.guests
  const stove: Spot = { id: 'kitchen.stove', x: STOVE.x + 1.05, z: STOVE.z, r: 1.1, icon: [STOVE.x, 1.4, STOVE.z] }
  out.push({ ...stove, options: () => (has(ctx, 'cook') && !ctx.carrying ? [opt('cook', stove, { needed: needs(anyGuests, 'hungry') })] : []) })
  const rocker: Spot = { id: 'gm.rocker', x: ROCKER.x + 0.6, z: ROCKER.z + 0.7, r: 1.1, icon: [ROCKER.x, 1.4, ROCKER.z] }
  out.push({ ...rocker, options: () => (has(ctx, 'rocker') ? [opt('rocker', rocker, { area: 'gm', needed: needs(anyGuests, 'scare') })] : []) })
  const mirror: Spot = { id: 'bath.mirror', x: SINK.x - 0.7, z: SINK.z - 0.2, r: 1.0, icon: [SINK.x, 2.2, SINK.z] }
  out.push({ ...mirror, options: () => (has(ctx, 'mirror') ? [opt('mirror', mirror, { area: 'bath', needed: needs(anyGuests, 'scare') })] : []) })
  const dog = ctx.sim.dog
  if (dog && dog.barking && !dog.calm) {
    const d: Spot = { id: 'dog', x: dog.x, z: dog.z - 0.6, r: 1.3, icon: [dog.x, 1.0, dog.z] }
    out.push({ ...d, options: () => [opt('calm', d, { needed: true })] })
  }
  return out
}
