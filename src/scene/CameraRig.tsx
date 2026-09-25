import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { player, VIEW } from '../world/player'
import { SCENES } from '../world/scenes'

// 斜俯視跟隨鏡頭（DESIGN §21）：跟著阿嬤，往移動方向前看一點；
// 進屋拉近，出屋拉遠；換場景直接跳過去；嚇到時會抖。

const OUTDOOR = 19
const INDOOR = 12.5
const LOOK_AHEAD = 0.45
/** 開發用：?zoom=0.4 把鏡頭拉近看角色 */
const ZOOM = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('zoom')) || 1 : 1

export function CameraRig() {
  const { camera, size } = useThree()
  const target = useRef(new THREE.Vector3(player.x, 1, player.z))
  const dist = useRef(OUTDOOR)
  const lastScene = useRef<string | null>(null)
  const tmp = useMemo(() => ({ want: new THREE.Vector3(), pos: new THREE.Vector3() }), [])

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    cam.fov = size.width < size.height ? 50 : 36
    cam.clearViewOffset()
    cam.updateProjectionMatrix()
  }, [camera, size])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const s = useStore.getState()
    const scene = SCENES[s.scene]
    const y = scene.floorAt(player.x, player.z) + 0.9
    tmp.want.set(player.x + player.vx * LOOK_AHEAD, y, player.z + player.vz * LOOK_AHEAD)

    const portrait = size.width < size.height
    const base = s.building ? INDOOR : OUTDOOR
    const wantDist = base * (portrait ? 1.35 : 1) * ZOOM

    // 換場景（或剛開始）直接跳到位，不要從上一個場景滑過來
    const snap = lastScene.current !== s.scene
    lastScene.current = s.scene
    const k = snap ? 1 : 1 - Math.exp(-4 * dt)
    const kd = snap ? 1 : 1 - Math.exp(-2.2 * dt)
    target.current.lerp(tmp.want, k)
    dist.current += (wantDist - dist.current) * kd

    tmp.pos.set(VIEW.x, VIEW.y, VIEW.z).multiplyScalar(dist.current).add(target.current)
    camera.position.copy(tmp.pos)
    if (s.horror > 0) {
      const a = 0.22 * s.horror
      camera.position.x += (Math.random() - 0.5) * a
      camera.position.y += (Math.random() - 0.5) * a
    }
    camera.lookAt(target.current)
  })
  return null
}
