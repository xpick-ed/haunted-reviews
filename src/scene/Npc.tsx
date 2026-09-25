import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { canvasTexture, svgTexture } from './kit'
import { NPC_GHOST, NPC_HEIGHT, NPC_POSES, NPC_SIZE, npcSvg, type NpcId, type NpcPose } from '../art/npcs'

// 配角：SVG 立繪貼在只繞 Y 軸轉的看板上（保持直立）。
// 活人受場景燈光影響、腳下有圓形軟影子；鬼（阿義）不受光、半透明、飄著、有青色光暈。

// 貼圖依（角色, 姿勢）快取在模組層級，換姿勢不會重畫
const texCache = new Map<string, THREE.CanvasTexture>()
function npcTexture(id: NpcId, pose: NpcPose): THREE.CanvasTexture {
  const key = `${id}:${pose}`
  let t = texCache.get(key)
  if (!t) {
    t = svgTexture(npcSvg(id, pose), NPC_SIZE.w, NPC_SIZE.h, 3)
    texCache.set(key, t)
  }
  return t
}

let blobTex: THREE.CanvasTexture | null = null
function blobTexture() {
  return (blobTex ??= canvasTexture(128, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(0,0,0,0.55)')
    g.addColorStop(0.55, 'rgba(0,0,0,0.25)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.save()
    ctx.scale(1, h / w)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, w)
    ctx.restore()
  }))
}

let haloTex: THREE.CanvasTexture | null = null
function haloTexture() {
  return (haloTex ??= canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(143,244,255,1)')
    g.addColorStop(0.35, 'rgba(143,244,255,0.4)')
    g.addColorStop(1, 'rgba(143,244,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }))
}

/** 用 id 算一個固定的相位，讓每個人呼吸的節奏錯開 */
function phaseOf(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return (h % 1000) / 100
}

export interface NpcProps {
  id: NpcId
  pose?: NpcPose
  /** 腳底的位置 */
  position: [number, number, number]
  /** 1 = 原圖方向，-1 = 左右翻面（會用轉身的動畫過去） */
  facing?: 1 | -1
  moving?: boolean
  /** 世界高度（公尺），預設看角色 */
  height?: number
}

export function Npc({ id, pose = 'idle', position, facing = 1, moving = false, height }: NpcProps) {
  const h = height ?? NPC_HEIGHT[id]
  const w = (h * NPC_SIZE.w) / NPC_SIZE.h
  const ghost = NPC_GHOST[id]
  const p = NPC_POSES[id].includes(pose) ? pose : NPC_POSES[id][0]
  const tex = npcTexture(id, p)
  const body = useRef<THREE.Mesh>(null)
  const halo = useRef<THREE.Sprite>(null)
  const phase = useMemo(() => phaseOf(id), [id])
  // props 放進 ref，useFrame 裡讀最新的值
  const live = useRef({ facing, moving })
  live.current.facing = facing
  live.current.moving = moving

  useFrame(({ clock }, rawDt) => {
    const m = body.current
    if (!m) return
    const dt = Math.min(rawDt, 0.1)
    const t = clock.elapsedTime + phase
    const { facing: f, moving: mv } = live.current

    // 轉身：scale.x 從一邊翻到另一邊，中間會變薄
    m.scale.x += (f - m.scale.x) * (1 - Math.pow(0.0005, dt))

    let sy = 1 + Math.sin(t * 2.1) * 0.012 // 呼吸
    let lift = 0
    if (mv) {
      const step = Math.abs(Math.sin(t * 9))
      lift = step * 0.05
      sy *= 1 - (1 - step) * 0.035 // 落地時壓扁一點
      m.rotation.z = Math.sin(t * 9) * 0.03
    } else {
      m.rotation.z *= 1 - Math.min(1, dt * 8)
    }
    if (ghost) lift += 0.15 + Math.sin(t * 2.2) * 0.06
    m.scale.y = sy
    // 壓扁時腳要黏在地上：中心跟著縮放往下
    m.position.y = (h / 2) * sy + lift
    if (halo.current) halo.current.position.y = h * 0.55 + lift
  })

  return (
    <group position={position}>
      {!ghost && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0]} renderOrder={1}>
          <planeGeometry args={[w * 1.05, w * 0.55]} />
          <meshBasicMaterial map={blobTexture()} transparent depthWrite={false} />
        </mesh>
      )}
      {ghost && (
        <sprite ref={halo} scale={[h * 1.5, h * 1.5, 1]} position={[0, h * 0.55, -0.02]} renderOrder={1}>
          <spriteMaterial map={haloTexture()} transparent opacity={0.28} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
      )}
      <Billboard lockX lockZ>
        <mesh ref={body} position={[0, h / 2, 0]} renderOrder={ghost ? 2 : 0}>
          <planeGeometry args={[w, h]} />
          {ghost ? (
            <meshBasicMaterial map={tex} transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
          ) : (
            <meshStandardMaterial
              map={tex}
              transparent
              alphaTest={0.4}
              roughness={0.9}
              emissive="#3a3a3a"
              emissiveMap={tex}
              side={THREE.DoubleSide}
            />
          )}
        </mesh>
      </Billboard>
    </group>
  )
}
