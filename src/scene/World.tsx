import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useStore, type Prompt } from '../store'
import { input } from '../world/input'
import { sfx } from '../audio/sfx'
import { player, stepPlayer } from '../world/player'
import { SCENES, npcColliders, type SceneId } from '../world/scenes'
import type { Circle, Colliders } from '../world/collision'
import { nearestHotspot } from '../world/hotspots'
import { inRect, segmentHitsBox } from '../world/collision'
import { night, nightOptions, type DecorPlacement, type PromptOpt } from '../world/night/director'
import { decorCircles, useDecor } from '../world/decor'

// 每幀的遊戲邏輯（放在 Canvas 裡，才拿得到鏡頭位置）：
// 輸入 → 移動與碰撞 → 深夜模擬 → 在哪個房間 → 哪些建築要淡出 → 附近能做的事 → 出口。

/** 場景的固定碰撞 + 站在那裡的 NPC（阿嬤不能跟人重疊）。依場景與時段快取。 */
const colliderCache = new Map<string, Colliders>()
function collidersFor(scene: SceneId, phase: string): Colliders {
  // 夢境的碰撞每場夢都不一樣（src/world/dream.ts 會換掉 DREAM_SCENE.colliders），不快取
  // 夢境、1958、漲退潮的海邊：碰撞會變（各自的模組直接換掉 SceneDef.colliders），不快取
  if (scene === 'dream' || scene === 'past' || scene === 'harbor') return SCENES[scene].colliders
  // 家裡：擺設換了就重算（快取的 key 帶擺設的版本）
  const decor = useStore.getState().meta.decor
  const key = scene === 'home' ? `${scene}|${phase}|${decorKey(decor)}` : `${scene}|${phase}`
  let c = colliderCache.get(key)
  if (!c) {
    const base = SCENES[scene].colliders
    c = { rects: base.rects, circles: [...base.circles, ...npcColliders(scene, phase), ...(scene === 'home' ? decorCircles(decor) : [])], bounds: base.bounds }
    colliderCache.set(key, c)
  }
  return c
}

let wasDashing = false

function decorKey(decor: DecorPlacement[]) {
  return decor.map((d) => `${d.item}@${d.x.toFixed(2)},${d.z.toFixed(2)}`).join(';')
}

/** 深夜：走動中的客人、廟公也不能重疊（每幀位置會變，不快取） */
const moving: Colliders = { rects: [], circles: [], bounds: { x0: -1e3, z0: -1e3, x1: 1e3, z1: 1e3 } }
function withGuests(base: Colliders): Colliders {
  const sim = night.sim
  if (!sim) return base
  const circles: Circle[] = []
  for (const g of sim.guests) if (g.mode !== 'bed') circles.push({ x: g.x, z: g.z, r: 0.3 })
  if (sim.miaogong?.active) circles.push({ x: sim.miaogong.x, z: sim.miaogong.z, r: 0.32 })
  if (!circles.length) return base
  moving.rects = base.rects
  moving.circles = base.circles.concat(circles)
  moving.bounds = base.bounds
  return moving
}

export function WorldController() {
  const { camera } = useThree()
  useEffect(() => {
    input.attach()
    const offA = input.onAction(() => useStore.getState().interact())
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'q' || k === 'tab') {
        e.preventDefault()
        useStore.getState().cycleOption()
      }
      // V：陰陽眼、T：念力
      const st = useStore.getState()
      if (k === 'v' && st.started && !st.dialogue && !st.minigame) st.toggleVision()
      if (k === 't' && st.started && !st.dialogue && !st.minigame && st.phase === 'night' && st.scene === 'home') st.toggleTK()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      offA()
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  useFrame((_, rawDt) => {
    const s = useStore.getState()
    const dt = Math.min(rawDt, 0.1) * s.timeScale
    const scene = SCENES[s.scene]
    const frozen = !s.started || !!s.dialogue || s.transitioning || !!s.summary || !!s.month || s.intro || !!s.panel || s.busy || !!s.minigame || !!s.hidden
    const move = input.read()
    // 躲著的時候一推搖桿就出來
    if (s.hidden && !s.dialogue && !s.minigame && Math.hypot(move.x, move.y) > 0.5) s.exitHide()
    // 壁虎沿著牆和天花板爬：不受牆和家具擋
    const colliders =
      s.possess === 'gecko'
        ? { rects: [], circles: [], bounds: SCENES.home.colliders.bounds }
        : s.scene === 'home' && s.phase === 'night'
          ? withGuests(collidersFor(s.scene, s.phase))
          : collidersFor(s.scene, s.phase)
    stepPlayer(dt, move, colliders, frozen)
    if (player.dashing) s.spendYin(dt * 1)
    // 陰陽眼每秒扣一點陰氣；扣完就閉上
    if (s.vision && s.started && !s.dialogue && !s.minigame && !s.panel) {
      s.spendYin(dt * 0.6)
      if (useStore.getState().yin <= 0) s.toggleVision()
    }
    // 開始快飄：輕輕的一陣風聲
    if (player.dashing && !wasDashing) sfx.play('whoosh', { volume: 0.22 })
    wasDashing = player.dashing
    if (!s.dialogue && !s.transitioning) s.nightStep(dt)

    // 在哪個房間、哪棟建築
    const room = scene.rooms.find((r) => inRect(r.area, player.x, player.z))?.id ?? null
    const building = scene.buildings.find((b) => inRect(b.inside, player.x, player.z))?.id ?? null

    // 淡出：阿嬤在裡面，或建築擋在鏡頭和阿嬤中間
    const y = scene.floorAt(player.x, player.z) + 1.0
    const from: [number, number, number] = [player.x, y, player.z]
    const to: [number, number, number] = [camera.position.x, camera.position.y, camera.position.z]
    const faded = scene.buildings
      .filter((b) => b.id === building || segmentHitsBox(from, to, b.min, b.max))
      .map((b) => b.id)
      .join(',')

    // 附近能做的事：深夜動作（客人需要的排前面）＋ 固定的互動點
    let prompt: Prompt | null = null
    // 長按中：動作鈕要留著（放開才知道）；躲著、附身時只有特別的選項
    // 裝修民宿的目錄或擺放模式開著：動作鈕讓給擺放（不然點「放下」會順便觸發旁邊的互動點）
    const decorUI = useDecor.getState()
    const promptOpen = !s.started || !!s.dialogue || s.transitioning || !!s.summary || !!s.month || s.intro || !!s.panel || !!s.minigame || decorUI.open || decorUI.placing ? false : !s.busy || !!s.hold
    if (promptOpen && s.hidden) {
      prompt = { opts: [{ key: 'unhide', label: '出來', cost: 0, needed: false, spot: s.hidden, special: 'unhide' }], i: 0, key: 'unhide' }
    } else if (promptOpen && s.possess) {
      const body = s.possess
      const act: PromptOpt =
        body === 'dog'
          ? { key: 'woof', label: '汪！（嚇人、引開廟公）', cost: 0, needed: false, spot: body, special: 'woof' }
          : body === 'gecko'
            ? { key: 'chirp', label: '嘖嘖叫（讓人抬頭）', cost: 0, needed: false, spot: body, special: 'chirp' }
            : { key: 'meow', label: '喵一聲（引開注意）', cost: 0, needed: false, spot: body, special: 'meow' }
      const name = { cat: '阿咪', dog: '小黑', gecko: '壁虎' }[body]
      const opts: PromptOpt[] = [act, { key: 'unpossess', label: `離開${name}`, cost: 0, needed: false, spot: body, special: 'unpossess' }]
      prompt = { opts, i: s.prompt?.key === body ? s.prompt.i : 0, key: body }
    } else if (promptOpen) {
      const opts: PromptOpt[] = []
      if (s.phase === 'night' && s.scene === 'home' && night.sim) {
        for (const o of nightOptions({ sim: night.sim, objects: s.objects, skills: s.meta.skills, carrying: s.carrying, hour: s.time, pantry: s.meta.pantry }, player.x, player.z)) {
          opts.push({ key: `${o.spot}:${o.action}`, label: o.label, cost: o.cost, needed: o.needed, spot: o.spot, option: o })
        }
      }
      const near = nearestHotspot(s, player.x, player.z)
      if (near) opts.push({ key: `h:${near.h.id}:${near.label}`, label: near.label, cost: near.cost, needed: false, spot: near.h.id, hotspot: near.h.id })
      if (opts.length) {
        const key = opts.map((o) => `${o.key}:${o.needed ? 1 : 0}`).join('|')
        const prev = s.prompt
        // 選項組合沒變就保留玩家切換到的那一個
        const i = prev && prev.key === key ? prev.i : 0
        prompt = { opts, i, key }
      }
    }
    s.setWorld({ room, building, faded, prompt })

    // 出口
    if (!frozen) {
      for (const e of scene.exits) {
        if (e.when && !e.when(s)) continue
        if (inRect(e.area, player.x, player.z)) {
          s.goto(e.to, e.spawn)
          break
        }
      }
    }
  }, -3)
  return null
}
