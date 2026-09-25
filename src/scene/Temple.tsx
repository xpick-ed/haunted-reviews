import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { TEMPLE } from '../world/scenes'
import { lanternAt } from './daylight'
import { TILE, WBox, canvasTexture, planeGeo, useMats } from './kit'
import { GableRoof, Lantern, Wall, plaqueTexture } from './House'
import { MergeStatic } from './MergeStatic'
import { Tree } from './Tree'
import { ChibiNpc } from '../chars/Chibi'
import { buildGrass } from './Landscape'
import { seeded } from './kit'
import type { Quality } from '../store'

// 土地公廟（福德祠）：村子裡的小廟。上香回陰氣，醉鬼阿飄阿義在榕樹下的石椅。
// 不畫神像：神龕的紅布簾是拉上的（DESIGN §1.2）。

const SLOPE = 0.52
const RIDGE_Z = (TEMPLE.hall.z0 + TEMPLE.hall.z1) / 2
const WALL_TOP = TEMPLE.ridgeY - (TEMPLE.hall.z1 - RIDGE_Z) * SLOPE
const Y0 = TEMPLE.baseY

export function TempleScene() {
  const isNight = useStore((s) => s.isNight)
  const quality = useStore((s) => s.quality)
  return (
    <group>
      <Grounds />
      <Greenery quality={quality} />
      <MergeStatic>
        <Shrine />
        <Burner />
        <Furnace />
        <Bench />
      </MergeStatic>
      <Smoke x={TEMPLE.burner.x} z={TEMPLE.burner.z} y={1.35} />
      <TempleLights />
      <Tree position={[TEMPLE.banyan.x, 0, TEMPLE.banyan.z]} scale={0.95} />
      <Tree position={[8.5, 0, -6.5]} scale={0.6} />
      <ChibiNpc id="ayi" pose="drink" position={[TEMPLE.bench.x + 0.2, 0.2, TEMPLE.bench.z + 0.55]} heading={0.9} seesGhosts outline={quality === 'high'} />
      <group visible={isNight}>
        <Sparkles count={40} scale={[20, 1.6, 10]} position={[0, 0.9, 2]} size={3.5} speed={0.3} color="#e8ff8a" opacity={0.9} noise={1.4} />
      </group>
    </group>
  )
}

function Grounds() {
  const mats = useMats()
  const roadMat = useMemo(() => {
    const m = mats.yard.clone()
    m.color.setRGB(0.62, 0.62, 0.64)
    return m
  }, [mats])
  const stoneTiles = useMemo(() => {
    const m = mats.stone.clone()
    m.color.setRGB(0.85, 0.83, 0.8)
    return m
  }, [mats])
  return (
    <group>
      <mesh geometry={planeGeo(200, 200, TILE.grass)} material={mats.grass} rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow />
      <mesh geometry={planeGeo(120, TEMPLE.roadWidth, TILE.yard)} material={roadMat} rotation-x={-Math.PI / 2} position={[0, 0.02, TEMPLE.roadZ]} receiveShadow />
      {/* 廟埕：石板鋪面 */}
      <mesh geometry={planeGeo(9, 5.2, TILE.stone)} material={stoneTiles} rotation-x={-Math.PI / 2} position={[0, 0.015, 2.35]} receiveShadow />
    </group>
  )
}

function Shrine() {
  const mats = useMats()
  const plaque = useMemo(() => plaqueTexture('福德祠'), [])
  const curtain = useMemo(
    () =>
      canvasTexture(128, 128, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, w, 0)
        for (let i = 0; i <= 8; i++) g.addColorStop(i / 8, i % 2 ? '#a3201b' : '#c8342b')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = '#e0b050'
        ctx.fillRect(0, 0, w, 10)
      }),
    [],
  )
  const h = TEMPLE.hall
  const gable = useMemo(
    () =>
      [
        [h.z0, Y0],
        [h.z1, Y0],
        [h.z1, WALL_TOP],
        [RIDGE_Z, TEMPLE.ridgeY],
        [h.z0, WALL_TOP],
      ] as [number, number][],
    [h],
  )
  const tableTop = Y0 + 1.0
  return (
    <group>
      {/* 台基與台階 */}
      <WBox mat="stone" size={[TEMPLE.base.x1 - TEMPLE.base.x0, Y0, TEMPLE.base.z1 - TEMPLE.base.z0]} position={[0, Y0 / 2, (TEMPLE.base.z0 + TEMPLE.base.z1) / 2]} />
      <WBox mat="stone" size={[2.2, Y0 / 2, 0.36]} position={[0, Y0 / 4, TEMPLE.base.z1 + 0.18]} />
      {/* 三面牆（正面敞開） */}
      <Wall axis="x" from={h.x0} to={h.x1} at={h.z0} base={Y0} top={WALL_TOP} skirtH={0.6} />
      {[h.x0, h.x1].map((x) => (
        <group key={x}>
          <Wall axis="z" from={h.z0} to={h.z1} at={x} base={Y0} top={WALL_TOP} skirtH={0.6} />
          <GableSide x={x} pts={gable} />
        </group>
      ))}
      {/* 正面兩根紅柱、橫樑、匾額 */}
      {[-1.4, 1.4].map((x) => (
        <mesh key={x} material={mats.redPaint} position={[x, (Y0 + WALL_TOP) / 2, h.z1 + 0.2]} castShadow>
          <cylinderGeometry args={[0.13, 0.14, WALL_TOP - Y0, 14]} />
        </mesh>
      ))}
      <WBox mat="darkWood" size={[h.x1 - h.x0 + 0.3, 0.22, 0.24]} position={[0, WALL_TOP - 0.05, h.z1 + 0.2]} />
      <mesh position={[0, WALL_TOP - 0.42, h.z1 + 0.34]}>
        <planeGeometry args={[1.3, 0.34]} />
        <meshStandardMaterial map={plaque} roughness={0.5} />
      </mesh>
      {/* 神龕：紅布簾拉上 */}
      <WBox mat="redPaint" size={[1.6, 1.2, 0.5]} position={[0, tableTop + 0.62, h.z0 + 0.35]} />
      <mesh position={[0, tableTop + 0.6, h.z0 + 0.61]}>
        <planeGeometry args={[1.3, 0.95]} />
        <meshStandardMaterial map={curtain} roughness={0.9} />
      </mesh>
      <WBox mat="gold" size={[1.7, 0.08, 0.56]} position={[0, tableTop + 1.24, h.z0 + 0.35]} castShadow={false} />
      {/* 供桌 */}
      <WBox mat="redPaint" size={[2.4, 0.08, 0.7]} position={[0, tableTop, h.z0 + 0.55]} />
      {[-1.1, 1.1].map((x) => (
        <WBox key={x} mat="redPaint" size={[0.1, tableTop - Y0, 0.62]} position={[x, (tableTop + Y0) / 2, h.z0 + 0.55]} />
      ))}
      <GableRoof axis="x" ridge={RIDGE_Z} ridgeY={TEMPLE.ridgeY} from={h.x0 - 0.6} to={h.x1 + 0.6} edges={[h.z0 - 0.5, h.z1 + 0.8]} style="swallow" />
    </group>
  )
}

function GableSide({ x, pts }: { x: number; pts: [number, number][] }) {
  const mats = useMats()
  const geo = useMemo(() => {
    const shape = new THREE.Shape(pts.map(([u, y]) => new THREE.Vector2(-u, y)))
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false })
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / TILE.brick, uv.getY(i) / TILE.brick)
    return g
  }, [pts])
  return <mesh geometry={geo} material={mats.brick} position={[x - 0.15, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />
}

/** 天公爐：銅爐在石座上 */
function Burner() {
  const bronze = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a6a3a', roughness: 0.35, metalness: 0.85 }), [])
  const geo = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          [0, 0],
          [0.38, 0],
          [0.5, 0.08],
          [0.58, 0.28],
          [0.56, 0.44],
          [0.62, 0.5],
          [0.5, 0.52],
          [0, 0.5],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        32,
      ),
    [],
  )
  const b = TEMPLE.burner
  return (
    <group position={[b.x, 0, b.z]}>
      <WBox mat="stone" size={[1.1, 0.7, 1.1]} position={[0, 0.35, 0]} />
      <mesh geometry={geo} material={bronze} position={[0, 0.7, 0]} castShadow receiveShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} material={bronze} position={[s * 0.62, 1.12, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.1, 0.025, 8, 16]} />
        </mesh>
      ))}
    </group>
  )
}

/** 金爐：燒金紙的小磚塔 */
function Furnace() {
  const f = TEMPLE.furnace
  return (
    <group position={[f.x, 0, f.z]}>
      <WBox mat="brick" size={[1.0, 1.5, 1.0]} position={[0, 0.75, 0]} />
      <WBox mat="stone" size={[1.15, 0.12, 1.15]} position={[0, 1.56, 0]} />
      <WBox mat="brick" size={[0.5, 0.7, 0.5]} position={[0, 1.95, 0]} />
      <WBox mat="roof" size={[0.8, 0.1, 0.8]} position={[0, 2.35, 0]} />
    </group>
  )
}

function Bench() {
  const b = TEMPLE.bench
  return (
    <group position={[b.x, 0, b.z]}>
      <WBox mat="stone" size={[1.6, 0.1, 0.42]} position={[0, 0.45, 0]} />
      {[-0.6, 0.6].map((x) => (
        <WBox key={x} mat="stone" size={[0.14, 0.4, 0.36]} position={[x, 0.2, 0]} />
      ))}
    </group>
  )
}

const smokeTex = canvasTexture(128, 128, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2)
  g.addColorStop(0, 'rgba(230,230,235,0.5)')
  g.addColorStop(1, 'rgba(230,230,235,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
})

/** 香爐上的香煙 */
function Smoke({ x, z, y }: { x: number; z: number; y: number }) {
  const puffs = useRef<THREE.Sprite[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    puffs.current.forEach((p, i) => {
      if (!p) return
      const k = (t * 0.12 + i / 7) % 1
      p.position.set(x + Math.sin(k * 5 + i) * 0.12, y + k * 2.4, z + Math.cos(k * 3 + i) * 0.08)
      const sc = 0.25 + k * 0.9
      p.scale.set(sc, sc, 1)
      ;(p.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.3
    })
  })
  return (
    <group>
      {Array.from({ length: 7 }, (_, i) => (
        <sprite
          key={i}
          ref={(el) => {
            if (el) puffs.current[i] = el
          }}
        >
          <spriteMaterial map={smokeTex} transparent depthWrite={false} opacity={0} />
        </sprite>
      ))}
    </group>
  )
}

function TempleLights() {
  const porch = useRef<THREE.PointLight>(null)
  const fire = useRef<THREE.PointLight>(null)
  const inside = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    const l = lanternAt(useStore.getState().time)
    const t = clock.elapsedTime
    if (porch.current) porch.current.intensity = 5 * l
    if (inside.current) inside.current.intensity = 2.2 + Math.sin(t * 1.4) * 0.2
    if (fire.current) fire.current.intensity = (1.2 + 2.4 * l) * (0.85 + Math.sin(t * 11) * 0.1 + Math.sin(t * 6.3) * 0.08)
  })
  const h = TEMPLE.hall
  return (
    <group>
      {[-1.4, 0, 1.4].map((x) => (
        <Lantern key={x} position={[x, WALL_TOP - 0.85, h.z1 + 0.42]} drop={0.25} scale={0.8} />
      ))}
      <pointLight ref={porch} position={[0, WALL_TOP - 0.9, h.z1 + 1.0]} color="#ffb35c" intensity={5} distance={10} decay={2} />
      <pointLight ref={inside} position={[0, Y0 + 2.0, h.z0 + 1.2]} color="#ff4a32" intensity={2.2} distance={5} decay={2} />
      <pointLight ref={fire} position={[TEMPLE.furnace.x, 1.0, TEMPLE.furnace.z + 0.7]} color="#ff7a2a" intensity={2} distance={5} decay={2} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 廟旁的草、野花、灌木、矮牆、對面的水田
// ---------------------------------------------------------------------------

const PADDY = { x0: -30, x1: 30, z0: TEMPLE.roadZ + TEMPLE.roadWidth / 2 + 1.2, z1: 30 }

function templeGround(x: number, z: number): 'grass' | 'bank' | null {
  if (Math.abs(z - TEMPLE.roadZ) < TEMPLE.roadWidth / 2 + 0.3) return null // 路
  if (x > -4.8 && x < 4.8 && z > -0.5 && z < 5) return null // 廟埕
  if (x > TEMPLE.base.x0 - 0.4 && x < TEMPLE.base.x1 + 0.4 && z > TEMPLE.base.z0 - 0.4 && z < TEMPLE.base.z1 + 0.4) return null
  if (Math.hypot(x - TEMPLE.banyan.x, z - TEMPLE.banyan.z) < 1.4) return null
  if (x > PADDY.x0 && x < PADDY.x1 && z > PADDY.z0 && z < PADDY.z1) return null
  return 'grass'
}

function Greenery({ quality }: { quality: Quality }) {
  const mats = useMats()
  const grass = useMemo(() => buildGrass(quality, { ground: templeGround, rMin: 2, rSpan: 22, seed: 4242, scale: 0.7 }), [quality])
  const bushes = useMemo(() => {
    const r = seeded(77)
    return Array.from({ length: 14 }, (_, i) => ({
      x: -5.5 + i * 0.85 + (r() - 0.5) * 0.3,
      z: TEMPLE.base.z0 - 1.3 + (r() - 0.5) * 0.4,
      s: 0.55 + r() * 0.35,
      c: i % 3,
    }))
  }, [])
  const bushMats = useMemo(() => ['#2f5a35', '#3a6a3a', '#284d30'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true })), [])
  const water = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1a2630', roughness: 0.12, metalness: 0.35, envMapIntensity: 1.6 }), [])
  return (
    <group>
      <primitive object={grass.grass} />
      <primitive object={grass.flowers} />
      {/* 廟後的灌木籬 */}
      {bushes.map((b, i) => (
        <mesh key={i} position={[b.x, b.s * 0.6, b.z]} scale={[b.s * 1.3, b.s, b.s]} material={bushMats[b.c]} castShadow receiveShadow>
          <icosahedronGeometry args={[0.7, 1]} />
        </mesh>
      ))}
      {/* 廟兩側的紅磚矮牆 */}
      {[-1, 1].map((sx) => (
        <WBox key={sx} mat="brick" size={[0.25, 0.8, 3.2]} position={[sx * 4.7, 0.4, -1.8]} />
      ))}
      {/* 路對面的水田（跟家那邊同一片田） */}
      <mesh position={[(PADDY.x0 + PADDY.x1) / 2, 0.05, (PADDY.z0 + PADDY.z1) / 2]} rotation-x={-Math.PI / 2} material={water} receiveShadow>
        <planeGeometry args={[PADDY.x1 - PADDY.x0, PADDY.z1 - PADDY.z0]} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <WBox key={i} mat="mud" size={[PADDY.x1 - PADDY.x0, 0.25, 0.5]} position={[(PADDY.x0 + PADDY.x1) / 2, 0.12, PADDY.z0 + i * 8]} />
      ))}
      {[-18, -6, 6, 18].map((x) => (
        <WBox key={x} mat="mud" size={[0.5, 0.25, PADDY.z1 - PADDY.z0]} position={[x, 0.12, (PADDY.z0 + PADDY.z1) / 2]} />
      ))}
      <mesh material={mats.leaf} position={[7.5, 0.6, 1.5]} castShadow>
        <icosahedronGeometry args={[0.9, 1]} />
      </mesh>
    </group>
  )
}
