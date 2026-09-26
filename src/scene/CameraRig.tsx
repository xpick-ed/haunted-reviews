import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { player, VIEW } from '../world/player'
import { followTarget, type FollowState } from '../world/motion'
import { SCENES } from '../world/scenes'

// 斜俯視跟隨鏡頭（DESIGN §21）：跟著阿嬤，往移動方向前看一點；
// 進屋拉近，出屋拉遠；換場景直接跳過去；嚇到時會抖。

const OUTDOOR = 19
const INDOOR = 12.5
const LOOK_AHEAD = 0.3
/** 開發用：?zoom=0.4 把鏡頭拉近看角色 */
const ZOOM = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('zoom')) || 1 : 1

export function CameraRig() {
  const { camera, size } = useThree()
  const follow = useRef<FollowState>({ x: player.x, y: 1, z: player.z, vx: 0, vz: 0 })
  const target = useMemo(() => new THREE.Vector3(), [])
  const dist = useRef(OUTDOOR)
  const lastScene = useRef<string | null>(null)
  const tmp = useMemo(() => ({ pos: new THREE.Vector3() }), [])

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

    const portrait = size.width < size.height
    const base = s.building ? INDOOR : OUTDOOR
    const wantDist = base * (portrait ? 1.35 : 1) * ZOOM

    // 換場景（或剛開始）直接跳到位，不要從上一個場景滑過來
    const snap = lastScene.current !== s.scene
    lastScene.current = s.scene
    followTarget(follow.current, player.x, y, player.z, player.vx, player.vz, dt, LOOK_AHEAD, snap)
    target.set(follow.current.x, follow.current.y, follow.current.z)
    // 進出屋子的拉近拉遠：約 0.75 秒到位（原本 2.2 要一秒多，走進小店時外殼都淡完了鏡頭還在慢慢推）
    const kd = snap ? 1 : 1 - Math.exp(-3.0 * dt)
    dist.current += (wantDist - dist.current) * kd

    tmp.pos.set(VIEW.x, VIEW.y, VIEW.z).multiplyScalar(dist.current).add(target)
    camera.position.copy(tmp.pos)
    if (s.horror > 0) {
      const a = 0.22 * s.horror
      camera.position.x += (Math.random() - 0.5) * a
      camera.position.y += (Math.random() - 0.5) * a
    }
    camera.lookAt(target)
  }, -1)
  return null
}
