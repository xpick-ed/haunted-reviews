import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useStore } from '../store'
import { input } from '../world/input'
import { player, stepPlayer } from '../world/player'
import { SCENES, npcColliders, type SceneId } from '../world/scenes'
import type { Colliders } from '../world/collision'
import { nearestHotspot } from '../world/hotspots'
import { inRect, segmentHitsBox } from '../world/collision'

// 每幀的遊戲邏輯（放在 Canvas 裡，才拿得到鏡頭位置）：
// 輸入 → 移動與碰撞 → 在哪個房間 → 哪些建築要淡出 → 附近的熱點 → 出口。

/** 場景的固定碰撞 + 站在那裡的 NPC（阿嬤不能跟人重疊）。依場景與時段快取。 */
const colliderCache = new Map<string, Colliders>()
function collidersFor(scene: SceneId, phase: string): Colliders {
  const key = `${scene}|${phase}`
  let c = colliderCache.get(key)
  if (!c) {
    const base = SCENES[scene].colliders
    c = { rects: base.rects, circles: [...base.circles, ...npcColliders(scene, phase)], bounds: base.bounds }
    colliderCache.set(key, c)
  }
  return c
}

export function WorldController() {
  const { camera } = useThree()
  useEffect(() => {
    input.attach()
    return input.onAction(() => useStore.getState().interact())
  }, [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const s = useStore.getState()
    const scene = SCENES[s.scene]
    const frozen = !s.started || !!s.dialogue || s.transitioning || !!s.result || s.busy
    const move = input.read()
    stepPlayer(dt, move, collidersFor(s.scene, s.phase), frozen)
    if (player.dashing) s.spendYin(dt * 1)

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

    const near = frozen ? null : nearestHotspot(s, player.x, player.z)
    s.setWorld({ room, building, faded, prompt: near ? { id: near.h.id, label: near.label, cost: near.cost } : null })

    // 出口
    if (!frozen) {
      for (const e of scene.exits) {
        if (inRect(e.area, player.x, player.z)) {
          s.goto(e.to, e.spawn)
          break
        }
      }
    }
  }, -3)
  return null
}
