import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useMats, WBox, canvasTexture, seeded } from './kit'
import { floralFabricTexture } from '../art/fabric'
import { GUEST_ROOMS } from './layout'
import type { RoomId } from '../world/night/types'
import { player } from '../world/player'

// 裝修民宿的家具擺飾模型（DESIGN §27.2）。原點在地上（牆上的東西原點在掛的位置、面向 +z）。
// night：晚上才有的動作（風鈴響、燈籠亮、人偶轉頭……）。

export interface ModelProps {
  night: boolean
  /** 蚊帳罩哪張床 */
  room?: RoomId | null
  /** 世界座標（人偶轉頭看阿嬤用） */
  at?: [number, number]
  rot?: number
}

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra })

// ---------------------------------------------------------------------------

export function Orchid() {
  const mats = useMats()
  const leaf = useMemo(() => std('#2f6b35', { roughness: 0.55 }), [])
  const petal = useMemo(() => std('#f4eaf6', { roughness: 0.5, emissive: '#402a44', emissiveIntensity: 0.15 }), [])
  const lip = useMemo(() => std('#c24a86', { roughness: 0.5 }), [])
  const flowers = useMemo(() => {
    const out: [number, number, number][] = []
    for (let i = 0; i < 6; i++) {
      const k = i / 5
      out.push([0.02 + Math.sin(k * 2.4) * 0.22, 0.5 + Math.sin(k * Math.PI) * 0.18 - k * 0.05, 0.05 + k * 0.08])
    }
    return out
  }, [])
  return (
    <group>
      <mesh material={mats.terracotta} position={[0, 0.11, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.1, 0.22, 14]} />
      </mesh>
      <mesh material={mats.mud} position={[0, 0.215, 0]}>
        <cylinderGeometry args={[0.125, 0.125, 0.02, 14]} />
      </mesh>
      {[0, 1.3, 2.6, 3.9, 5.2].map((a, i) => (
        <mesh key={i} material={leaf} position={[Math.sin(a) * 0.1, 0.26, Math.cos(a) * 0.1]} rotation={[Math.cos(a) * 0.9, a, Math.sin(a) * 0.3]} scale={[0.05, 0.02, 0.2]} castShadow>
          <sphereGeometry args={[1, 8, 6]} />
        </mesh>
      ))}
      {/* 彎彎的花梗 */}
      <mesh material={leaf} position={[0.1, 0.42, 0.06]} rotation={[0.2, 0, -0.5]}>
        <cylinderGeometry args={[0.006, 0.008, 0.42, 5]} />
      </mesh>
      {flowers.map((p, i) => (
        <group key={i} position={p}>
          <mesh material={petal} scale={[0.05, 0.05, 0.015]}>
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
          <mesh material={lip} position={[0, -0.01, 0.012]} scale={0.015}>
            <sphereGeometry args={[1, 6, 5]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function MoneyTree() {
  const mats = useMats()
  const leaf = useMemo(() => std('#3f8a3a', { roughness: 0.6, flatShading: true }), [])
  const trunk = useMemo(() => std('#8a6a44'), [])
  const clusters = useMemo(() => {
    const r = seeded(77)
    return Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2
      return { p: [Math.sin(a) * 0.22, 0.95 + r() * 0.25, Math.cos(a) * 0.22] as [number, number, number], s: 0.16 + r() * 0.08 }
    })
  }, [])
  return (
    <group>
      <mesh material={mats.ceramic} position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.15, 0.32, 16]} />
      </mesh>
      {[0, 2.1, 4.2].map((a, i) => (
        <mesh key={i} material={trunk} position={[Math.sin(a) * 0.02, 0.62, Math.cos(a) * 0.02]} rotation={[Math.cos(a) * 0.12, a, Math.sin(a) * 0.12]} castShadow>
          <cylinderGeometry args={[0.018, 0.028, 0.7, 6]} />
        </mesh>
      ))}
      {clusters.map((c, i) => (
        <mesh key={i} material={leaf} position={c.p} scale={c.s} castShadow>
          <icosahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
      <mesh material={leaf} position={[0, 1.2, 0]} scale={0.2} castShadow>
        <icosahedronGeometry args={[1, 0]} />
      </mesh>
    </group>
  )
}

/** 風鈴：竹竿架子上掛一個玻璃風鈴。晚上會自己晃 */
export function WindChime({ night }: ModelProps) {
  const mats = useMats()
  const swing = useRef<THREE.Group>(null)
  const strip = useRef<THREE.Mesh>(null)
  const glass = useMemo(() => std('#bfe6f2', { transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.1 }), [])
  const paper = useMemo(() => std('#e8d27a', { side: THREE.DoubleSide }), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const k = night ? 1 : 0.35
    if (swing.current) swing.current.rotation.z = Math.sin(t * 2.2) * 0.12 * k + Math.sin(t * 5.3) * 0.04 * k
    if (strip.current) strip.current.rotation.x = Math.sin(t * 3.1) * 0.35 * k
  })
  return (
    <group>
      <mesh material={mats.bamboo} position={[0, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.025, 2.0, 6]} />
      </mesh>
      <mesh material={mats.stone} position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.12, 0.14, 0.06, 10]} />
      </mesh>
      <mesh material={mats.bamboo} position={[0.18, 1.98, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.015, 0.015, 0.38, 6]} />
      </mesh>
      <group ref={swing} position={[0.34, 1.98, 0]}>
        <mesh position={[0, -0.08, 0]} material={mats.black}>
          <cylinderGeometry args={[0.002, 0.002, 0.16, 3]} />
        </mesh>
        <mesh position={[0, -0.2, 0]} material={glass} castShadow>
          <sphereGeometry args={[0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh ref={strip} position={[0, -0.36, 0]} material={paper}>
          <planeGeometry args={[0.05, 0.22]} />
        </mesh>
      </group>
    </group>
  )
}

const clockFace = () =>
  canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f3ead2'
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#3b2a1a'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fillStyle = '#3b2a1a'
    ctx.font = '700 16px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2
      ctx.fillText(String(i), w / 2 + Math.sin(a) * 46, h / 2 - Math.cos(a) * 46)
    }
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(w / 2, h / 2)
    ctx.lineTo(w / 2 + 22, h / 2 - 20)
    ctx.moveTo(w / 2, h / 2)
    ctx.lineTo(w / 2 - 6, h / 2 - 34)
    ctx.stroke()
  })

/** 老掛鐘：木殼、鐘面、會擺的鐘擺 */
export function WallClock() {
  const face = useMemo(clockFace, [])
  const pend = useRef<THREE.Group>(null)
  const brass = useMemo(() => std('#c9a24a', { metalness: 0.7, roughness: 0.35 }), [])
  useFrame(({ clock }) => {
    if (pend.current) pend.current.rotation.z = Math.sin(clock.elapsedTime * Math.PI) * 0.22
  })
  return (
    <group>
      <WBox mat="darkWood" size={[0.34, 0.62, 0.1]} position={[0, -0.12, 0.05]} />
      <mesh position={[0, 0.06, 0.102]}>
        <circleGeometry args={[0.12, 24]} />
        <meshStandardMaterial map={face} roughness={0.6} />
      </mesh>
      {/* 鐘擺的玻璃窗 */}
      <mesh position={[0, -0.25, 0.101]}>
        <planeGeometry args={[0.2, 0.26]} />
        <meshStandardMaterial color="#20160f" roughness={0.3} />
      </mesh>
      <group ref={pend} position={[0, -0.13, 0.108]}>
        <mesh position={[0, -0.1, 0]} material={brass}>
          <boxGeometry args={[0.008, 0.2, 0.004]} />
        </mesh>
        <mesh position={[0, -0.2, 0]} material={brass}>
          <cylinderGeometry args={[0.035, 0.035, 0.01, 14]} />
        </mesh>
      </group>
      <WBox mat="darkWood" size={[0.4, 0.06, 0.12]} position={[0, 0.22, 0.05]} />
    </group>
  )
}

/** 蚊帳：罩在客房的床上（位置用那張床的尺寸，不用擺放的位置） */
export function MosquitoNet({ room }: ModelProps) {
  const mats = useMats()
  const net = useMemo(() => std('#eef0ea', { transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false, roughness: 1 }), [])
  if (!room) return null
  const b = GUEST_ROOMS[room].bed
  const h = 2.0
  const w = b.w + 0.2
  const l = b.l + 0.2
  return (
    <group>
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <mesh key={i} material={mats.bamboo} position={[(sx * w) / 2, h / 2, (sz * l) / 2]}>
          <cylinderGeometry args={[0.015, 0.015, h, 5]} />
        </mesh>
      ))}
      <mesh material={net} position={[0, h - 0.02, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[w, l]} />
      </mesh>
      {/* 四面垂下來的網，下面收在床墊邊 */}
      <mesh material={net} position={[0, h / 2 + 0.25, l / 2]}>
        <planeGeometry args={[w, h - 0.5]} />
      </mesh>
      <mesh material={net} position={[0, h / 2 + 0.25, -l / 2]}>
        <planeGeometry args={[w, h - 0.5]} />
      </mesh>
      <mesh material={net} position={[w / 2, h / 2 + 0.25, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[l, h - 0.5]} />
      </mesh>
      <mesh material={net} position={[-w / 2, h / 2 + 0.25, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[l, h - 0.5]} />
      </mesh>
    </group>
  )
}

/** 搖搖馬：晚上偶爾自己搖一下（有點毛） */
export function RockingHorse({ night }: ModelProps) {
  const mats = useMats()
  const body = useRef<THREE.Group>(null)
  const paint = useMemo(() => std('#e8d9b8'), [])
  const saddle = useMemo(() => std('#b83a30'), [])
  const rocker = useMemo(() => new THREE.TorusGeometry(0.42, 0.02, 5, 24, Math.PI * 0.55).rotateZ(Math.PI + Math.PI * 0.225), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const burst = night ? Math.max(0, Math.sin(t * 0.4)) ** 8 : 0
    if (body.current) body.current.rotation.x = Math.sin(t * 3) * 0.12 * burst
  })
  return (
    <group ref={body}>
      {[-0.13, 0.13].map((x) => (
        <mesh key={x} geometry={rocker} material={mats.wood} position={[x, 0.44, 0]} rotation-y={Math.PI / 2} castShadow />
      ))}
      {[
        [-0.1, -0.16],
        [0.1, -0.16],
        [-0.1, 0.16],
        [0.1, 0.16],
      ].map(([x, z], i) => (
        <mesh key={i} material={paint} position={[x, 0.2, z]} rotation={[z > 0 ? -0.2 : 0.2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.28, 6]} />
        </mesh>
      ))}
      <mesh material={paint} position={[0, 0.38, 0]} castShadow>
        <boxGeometry args={[0.2, 0.16, 0.46]} />
      </mesh>
      <mesh material={saddle} position={[0, 0.47, -0.02]}>
        <boxGeometry args={[0.22, 0.03, 0.18]} />
      </mesh>
      <mesh material={paint} position={[0, 0.55, 0.22]} rotation-x={-0.5} castShadow>
        <boxGeometry args={[0.12, 0.3, 0.12]} />
      </mesh>
      <mesh material={paint} position={[0, 0.68, 0.32]} castShadow>
        <boxGeometry args={[0.12, 0.12, 0.22]} />
      </mesh>
      <mesh material={mats.darkWood} position={[0, 0.66, 0.2]} rotation-x={-0.4}>
        <boxGeometry args={[0.04, 0.24, 0.1]} />
      </mesh>
      <mesh material={mats.darkWood} position={[0, 0.4, -0.27]} rotation-x={0.8}>
        <boxGeometry args={[0.04, 0.2, 0.06]} />
      </mesh>
    </group>
  )
}

/** 舊人偶：坐在地上，晚上阿嬤靠近時頭會慢慢轉過來 */
export function OldDoll({ night, at, rot = 0 }: ModelProps) {
  const head = useRef<THREE.Group>(null)
  const dress = useMemo(() => std('#8a2f3a'), [])
  const skin = useMemo(() => std('#efe0cc', { roughness: 0.45 }), [])
  const hair = useMemo(() => std('#141010', { roughness: 0.7 }), [])
  const eye = useMemo(() => new THREE.MeshBasicMaterial({ color: '#0a0a0a' }), [])
  const cheek = useMemo(() => new THREE.MeshBasicMaterial({ color: '#d86a6a' }), [])
  useFrame((_, dt) => {
    const h = head.current
    if (!h || !at) return
    let target = 0
    if (night && Math.hypot(player.x - at[0], player.z - at[1]) < 3.5) target = Math.atan2(player.x - at[0], player.z - at[1]) - rot
    // 最多轉 100°
    target = Math.max(-1.75, Math.min(1.75, Math.atan2(Math.sin(target), Math.cos(target))))
    h.rotation.y += (target - h.rotation.y) * Math.min(1, dt * 0.8)
  })
  return (
    <group>
      <mesh material={dress} position={[0, 0.1, 0]} castShadow>
        <coneGeometry args={[0.12, 0.22, 10]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={skin} position={[s * 0.05, 0.03, 0.1]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.02, 0.02, 0.12, 6]} />
        </mesh>
      ))}
      <group ref={head} position={[0, 0.27, 0]}>
        <mesh material={skin} castShadow>
          <sphereGeometry args={[0.075, 14, 10]} />
        </mesh>
        <mesh material={hair} position={[0, 0.02, -0.01]} scale={[1.05, 0.9, 1.05]}>
          <sphereGeometry args={[0.076, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        </mesh>
        <mesh material={hair} position={[0, 0.005, 0.055]} scale={[1, 0.3, 0.3]}>
          <boxGeometry args={[0.13, 0.05, 0.05]} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh material={eye} position={[s * 0.026, -0.005, 0.068]}>
              <sphereGeometry args={[0.011, 8, 6]} />
            </mesh>
            <mesh material={cheek} position={[s * 0.042, -0.03, 0.058]} scale={[1, 0.6, 0.3]}>
              <sphereGeometry args={[0.012, 6, 5]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

/** 竹躺椅 */
export function BambooChair() {
  const mats = useMats()
  const slats = useMemo(() => Array.from({ length: 7 }, (_, i) => i), [])
  return (
    <group>
      {[-0.24, 0.24].map((x) => (
        <group key={x}>
          {/* 側邊的長竹：前腳到椅背 */}
          <mesh material={mats.bamboo} position={[x, 0.28, 0.1]} rotation-x={-0.35} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 1.2, 6]} />
          </mesh>
          <mesh material={mats.bamboo} position={[x, 0.2, 0.42]}>
            <cylinderGeometry args={[0.022, 0.022, 0.4, 6]} />
          </mesh>
          <mesh material={mats.bamboo} position={[x, 0.2, -0.3]}>
            <cylinderGeometry args={[0.022, 0.022, 0.4, 6]} />
          </mesh>
        </group>
      ))}
      {slats.map((i) => {
        const k = i / (slats.length - 1)
        return (
          <mesh key={i} material={mats.bamboo} position={[0, 0.3 + k * 0.42, 0.4 - k * 0.72]} rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.018, 0.018, 0.5, 5]} />
          </mesh>
        )
      })}
    </group>
  )
}

/** 燈籠串：兩根竹竿中間吊一串紅燈籠，晚上亮 */
export function LanternString({ night }: ModelProps) {
  const mats = useMats()
  const lamp = useMemo(() => std('#c8281e', { roughness: 0.6, emissive: '#ff5a2a', emissiveIntensity: 0 }), [])
  const cap = useMemo(() => std('#2a1a10'), [])
  const span = 2.4
  const lamps = useMemo(() => Array.from({ length: 5 }, (_, i) => (i + 1) / 6), [])
  const rope = useMemo(() => {
    const pts = Array.from({ length: 16 }, (_, i) => {
      const k = i / 15
      return new THREE.Vector3((k - 0.5) * span, 2.1 - Math.sin(k * Math.PI) * 0.3, 0)
    })
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.006, 4, false)
  }, [])
  const group = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    lamp.emissiveIntensity = night ? 1.6 + Math.sin(clock.elapsedTime * 3) * 0.08 : 0
    const g = group.current
    if (g) g.children.forEach((c, i) => (c.rotation.z = Math.sin(clock.elapsedTime * 1.3 + i) * 0.06))
  })
  return (
    <group>
      {[-span / 2, span / 2].map((x) => (
        <mesh key={x} material={mats.bamboo} position={[x, 1.1, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.035, 2.2, 6]} />
        </mesh>
      ))}
      <mesh geometry={rope} material={mats.black} />
      <group ref={group}>
        {lamps.map((k, i) => {
          const x = (k - 0.5) * span
          const y = 2.1 - Math.sin(k * Math.PI) * 0.3 - 0.2
          return (
            <group key={i} position={[x, y, 0]}>
              <mesh material={lamp} scale={[1, 1.15, 1]} castShadow>
                <sphereGeometry args={[0.11, 12, 10]} />
              </mesh>
              <mesh material={cap} position={[0, 0.12, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 0.03, 8]} />
              </mesh>
              <mesh material={cap} position={[0, -0.12, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 0.03, 8]} />
              </mesh>
            </group>
          )
        })}
      </group>
    </group>
  )
}

/** 金魚缸：木架上的玻璃缸，三隻金魚繞著游 */
export function FishTank() {
  const glass = useMemo(() => std('#cfe9ef', { transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false }), [])
  const water = useMemo(() => std('#5aa6c4', { transparent: true, opacity: 0.35, roughness: 0.1, depthWrite: false }), [])
  const fish = useMemo(() => std('#f07a2a', { roughness: 0.4, emissive: '#5a1a00', emissiveIntensity: 0.3 }), [])
  const fishes = useRef<(THREE.Group | null)[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    fishes.current.forEach((f, i) => {
      if (!f) return
      const a = t * (0.6 + i * 0.17) + i * 2.1
      f.position.set(Math.sin(a) * 0.17, 0.72 + i * 0.05 + Math.sin(t * 1.3 + i) * 0.02, Math.cos(a) * 0.08)
      f.rotation.y = a + Math.PI / 2
    })
  })
  return (
    <group>
      <WBox mat="darkWood" size={[0.56, 0.52, 0.34]} position={[0, 0.26, 0]} />
      <mesh material={water} position={[0, 0.72, 0]}>
        <boxGeometry args={[0.5, 0.34, 0.28]} />
      </mesh>
      <mesh material={glass} position={[0, 0.74, 0]}>
        <boxGeometry args={[0.54, 0.4, 0.3]} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <group
          key={i}
          ref={(el) => {
            fishes.current[i] = el
          }}
        >
          <mesh material={fish} scale={[0.03, 0.025, 0.05]}>
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
          <mesh material={fish} position={[0, 0, -0.055]} rotation-x={Math.PI / 2} scale={[1, 1, 0.3]}>
            <coneGeometry args={[0.03, 0.04, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** 花布窗簾：客家花布，掛在牆上的一根竹竿上，微微擺 */
export function FloralCurtain() {
  const mats = useMats()
  const tex = useMemo(() => {
    const t = floralFabricTexture().clone()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(1.2, 1.4)
    t.needsUpdate = true
    return t
  }, [])
  const cloth = useRef<THREE.Mesh>(null)
  const geo = useMemo(() => new THREE.PlaneGeometry(1.0, 1.2, 12, 1), [])
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo])
  useFrame(({ clock }) => {
    const pos = geo.attributes.position as THREE.BufferAttribute
    const t = clock.elapsedTime
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3]
      // 布摺：沿著寬度起伏
      pos.setZ(i, Math.sin(x * 22) * 0.025 + Math.sin(x * 9 + t * 0.8) * 0.008)
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
  })
  return (
    <group>
      <mesh material={mats.bamboo} position={[0, 0.62, 0.04]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.015, 0.015, 1.15, 6]} />
      </mesh>
      <mesh ref={cloth} geometry={geo} position={[0, 0, 0.06]}>
        <meshStandardMaterial map={tex} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

const sepiaPhoto = (seed: number) =>
  canvasTexture(64, 80, (ctx, w, h) => {
    const r = seeded(seed)
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#d8c4a0')
    g.addColorStop(1, '#a88a60')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    // 一兩個人的剪影
    const n = 1 + Math.floor(r() * 2)
    ctx.fillStyle = 'rgba(60,40,24,0.75)'
    for (let i = 0; i < n; i++) {
      const cx = w * (n === 1 ? 0.5 : 0.32 + i * 0.36)
      ctx.beginPath()
      ctx.arc(cx, h * 0.42, 8 + r() * 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(cx, h * 0.82, 14, 16, 0, Math.PI, 0)
      ctx.fill()
    }
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = `rgba(40,25,10,${r() * 0.12})`
      ctx.fillRect(r() * w, r() * h, 1, 1)
    }
  })

/** 老照片牆：五個木框的黑白（泛黃）照片 */
export function PhotoWall() {
  const frames: { x: number; y: number; w: number; h: number; tilt: number }[] = [
    { x: -0.32, y: 0.12, w: 0.24, h: 0.3, tilt: 0.03 },
    { x: 0, y: 0.18, w: 0.28, h: 0.34, tilt: -0.02 },
    { x: 0.32, y: 0.1, w: 0.22, h: 0.28, tilt: 0.04 },
    { x: -0.16, y: -0.24, w: 0.2, h: 0.24, tilt: -0.05 },
    { x: 0.18, y: -0.22, w: 0.24, h: 0.2, tilt: 0.02 },
  ]
  const texs = useMemo(() => frames.map((_, i) => sepiaPhoto(900 + i * 13)), [])
  return (
    <group>
      {frames.map((f, i) => (
        <group key={i} position={[f.x, f.y, 0]} rotation-z={f.tilt}>
          <WBox mat="darkWood" size={[f.w + 0.04, f.h + 0.04, 0.025]} position={[0, 0, 0.012]} castShadow={false} />
          <mesh position={[0, 0, 0.026]}>
            <planeGeometry args={[f.w, f.h]} />
            <meshStandardMaterial map={texs[i]} roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** 埕角的雜物堆（「整理民宿」的熱點）：幾個木箱、一捆花布、一把掃帚 */
export function ClutterPile() {
  const mats = useMats()
  const cloth = useMemo(() => {
    const t = floralFabricTexture()
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 })
  }, [])
  return (
    <group>
      <WBox mat="wood" size={[0.6, 0.45, 0.5]} position={[0, 0.225, 0]} rotation-y={0.2} />
      <WBox mat="wood" size={[0.5, 0.36, 0.42]} position={[0.1, 0.63, 0.02]} rotation-y={-0.15} />
      <WBox mat="darkWood" size={[0.45, 0.3, 0.4]} position={[-0.6, 0.15, 0.25]} rotation-y={0.5} />
      <mesh material={cloth} position={[-0.55, 0.36, 0.22]} rotation={[0, 0.5, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 0.42, 12]} />
      </mesh>
      <mesh material={mats.bamboo} position={[0.42, 0.7, -0.2]} rotation={[0.1, 0, -0.18]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 1.4, 5]} />
      </mesh>
      <mesh material={mats.terracotta} position={[0.55, 0.12, 0.35]} castShadow>
        <cylinderGeometry args={[0.12, 0.09, 0.24, 10]} />
      </mesh>
    </group>
  )
}
