import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { player } from '../world/player'
import { SCENES } from '../world/scenes'
import { FLOOR_Y } from './layout'
import { canvasTexture } from './kit'
import { Chibi, newDrive } from '../chars/Chibi'
import { SPECS } from '../chars/specs'
import { floatBob, type BobState } from '../world/motion'

// 阿嬤：3D Q 版角色（src/chars/）。她是鬼：半透明、發光、沒有影子。
// 深夜的客人、廟公、狗在 Guests.tsx。

// 貼圖只做一次（StrictMode 會掛載兩次，也不重做）
let TEX: ReturnType<typeof makeTextures> | null = null
function textures() {
  return (TEX ??= makeTextures())
}
function makeTextures() {
  const halo = canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(143,244,255,1)')
    g.addColorStop(0.35, 'rgba(143,244,255,0.42)')
    g.addColorStop(1, 'rgba(143,244,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
  return { halo }
}

// ---------------------------------------------------------------------------
// 阿嬤：半透明、發青白光、飄著、沒有影子
// ---------------------------------------------------------------------------

export function Grandma() {
  const tex = textures()
  const quality = useStore((s) => s.quality)
  const group = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const floorY = useRef(FLOOR_Y)
  const drive = useRef(newDrive({ pose: 'clasp', heading: 0.7 }))
  const bob = useRef<BobState>({ phase: 0, speed: 0 })
  const dish = useRef<THREE.Group>(null)

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const s = useStore.getState()
    const time = clock.elapsedTime
    // 地板高度平滑跟上（從埕飄上台基不會跳一下）
    const f = SCENES[s.scene].floorAt(player.x, player.z)
    floorY.current += (f - floorY.current) * (1 - Math.exp(-8 * dt))
    // 相位累加（舊寫法 sin(總時間×頻率) 在速度一變時相位會跳，角色會上下抖）
    const y = floatBob(bob.current, player.speed, dt)
    group.current?.position.set(player.x, floorY.current + 0.18 + y, player.z)

    const d = drive.current
    d.speed = bob.current.speed
    // 面向「想走的方向」，不用被牆擋過、會跳動的實際速度
    if (player.wantX || player.wantZ) d.heading = Math.atan2(player.wantX, player.wantZ)
    d.pose = s.busy ? 'reach' : 'clasp'
    d.expr = s.busy ? 'reach' : 'normal'
    if (light.current) light.current.intensity = 2.6 + Math.sin(time * 3.1) * 0.5 + s.warm * 3
    // 端著宵夜：捧在胸前
    if (dish.current) {
      dish.current.visible = s.carrying
      dish.current.rotation.y = d.heading
    }
  }, -2)

  return (
    <group ref={group}>
      <Chibi spec={SPECS.grandma} drive={drive} outline={quality === 'high'} />
      <sprite scale={[2.1, 2.1, 1]} position={[0, 0.55, 0]} renderOrder={1}>
        <spriteMaterial map={tex.halo} transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      {/* 照亮周圍的青白光：放在頭上後方，不要直接打在她臉上 */}
      <group ref={dish} visible={false}>
        <group position={[0, 0.78, 0.42]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.16, 0.11, 0.1, 18]} />
            <meshStandardMaterial color="#f4efe4" roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.045, 0]}>
            <cylinderGeometry args={[0.14, 0.14, 0.02, 18]} />
            <meshStandardMaterial color="#e8c77a" roughness={0.6} emissive="#5a3a10" emissiveIntensity={0.25} />
          </mesh>
          {[-0.05, 0.03, 0.08].map((x, i) => (
            <mesh key={i} position={[x, 0.12 + i * 0.06, 0.02]}>
              <sphereGeometry args={[0.035, 8, 6]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.25} depthWrite={false} />
            </mesh>
          ))}
        </group>
      </group>
      <pointLight ref={light} color="#8ff4ff" intensity={2.6} distance={4.5} decay={2} position={[0, 1.9, -0.35]} />
    </group>
  )
}
