import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useStore } from '../store'
import { MergeStatic } from './MergeStatic'
import { lanternAt } from './daylight'
import { BRUSH_FONT, TILE, WBox, canvasTexture, useMats, type MatName, type TexMat } from './kit'
import {
  FLOOR_Y,
  GUEST_DOOR_Z,
  GUEST_WINDOW_IN_Z,
  GUEST_WINDOW_OUT_Z,
  MAIN,
  MAIN_PORCH,
  WING_L,
  WING_PORCH,
  WING_R,
  HALL_PART_X,
  MAIN_RIDGE_Z,
  MAIN_WALL_TOP,
  ROOF_SLOPE,
  SIDE_DOOR_W,
  SIDE_DOOR_Z,
  WING_BACK_DOOR_Z,
  WING_WALL_TOP,
} from './layout'
import { player } from '../world/player'
import { night } from '../world/night/director'
import { sfx } from '../audio/sfx'
import { floralFabricTexture } from '../art/fabric'

// 三合院本體：台基、牆、窗、門、屋頂、步口廊、燈籠、春聯。
// 右護龍（客房）的屋頂與外牆包在 <Fader> 裡，聚焦房間時會淡出。

const SLOPE = ROOF_SLOPE // 屋頂坡度（高／水平）
const ROOF_T = 0.14 // 屋頂板厚
const SKIRT_H = 0.72 // 石砌牆裙高度

export function House() {
  return (
    <group>
      <Platforms />
      <MainHall />
      <Wing side={1} />
      <Wing side={-1} />
      <HouseLights />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 台基
// ---------------------------------------------------------------------------

function Platform({ x0, x1, z0, z1 }: { x0: number; x1: number; z0: number; z1: number }) {
  const w = x1 - x0
  const d = z1 - z0
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  return (
    <group>
      <WBox mat="stone" size={[w, FLOOR_Y - 0.03, d]} position={[cx, (FLOOR_Y - 0.03) / 2, cz]} />
      {/* 表面鋪紅地磚，四周留一圈石緣 */}
      <WBox mat="tile" size={[w - 0.24, 0.04, d - 0.24]} position={[cx, FLOOR_Y - 0.02, cz]} castShadow={false} />
    </group>
  )
}

function Platforms() {
  return (
    <group>
      <Platform x0={MAIN.x0 - 0.45} x1={MAIN.x1 + 0.45} z0={MAIN.z0 - 0.45} z1={MAIN.z1} />
      {/* 步口廊與兩側過水 */}
      <Platform x0={WING_L.x0 - 0.45} x1={WING_R.x1 + 0.45} z0={MAIN.z1} z1={MAIN_PORCH.z1 + 0.15} />
      <Platform x0={WING_R.x0 - WING_PORCH - 0.2} x1={WING_R.x1 + 0.45} z0={MAIN_PORCH.z1 + 0.15} z1={WING_R.z1 + 0.45} />
      <Platform x0={WING_L.x0 - 0.45} x1={WING_L.x1 + WING_PORCH + 0.2} z0={MAIN_PORCH.z1 + 0.15} z1={WING_L.z1 + 0.45} />
      {/* 正身前的台階 */}
      {[0, 1].map((i) => (
        <WBox key={i} mat="stone" size={[2.4 - i * 0.3, (FLOOR_Y * (2 - i)) / 3, 0.34]} position={[0, (FLOOR_Y * (2 - i)) / 6, MAIN_PORCH.z1 + 0.32 + (1 - i) * 0.3]} />
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 牆
// ---------------------------------------------------------------------------

export interface Opening {
  /** 開口中心（沿牆方向的世界座標） */
  c: number
  w: number
  /** 開口下緣／上緣，從地板（FLOOR_Y）起算 */
  y0: number
  y1: number
}

function wallPieces(from: number, to: number, height: number, openings: Opening[]) {
  const ops = [...openings].sort((a, b) => a.c - b.c)
  const out: { c: number; w: number; y: number; h: number }[] = []
  let cur = from
  for (const o of ops) {
    const a = o.c - o.w / 2
    const b = o.c + o.w / 2
    if (a > cur + 0.001) out.push({ c: (cur + a) / 2, w: a - cur, y: height / 2, h: height })
    if (o.y0 > 0.001) out.push({ c: o.c, w: o.w, y: o.y0 / 2, h: o.y0 })
    if (o.y1 < height - 0.001) out.push({ c: o.c, w: o.w, y: (o.y1 + height) / 2, h: height - o.y1 })
    cur = b
  }
  if (to > cur + 0.001) out.push({ c: (cur + to) / 2, w: to - cur, y: height / 2, h: height })
  return out
}

const NO_OPENINGS: Opening[] = []

/** 一面直牆。axis：牆沿哪個軸延伸；at：另一個水平座標；高度從 base（預設 FLOOR_Y）起算。 */
export function Wall({
  axis,
  from,
  to,
  at,
  top,
  base = FLOOR_Y,
  thick = 0.3,
  openings = NO_OPENINGS,
  mat = 'brick',
  skirt = true,
  skirtH = SKIRT_H,
}: {
  axis: 'x' | 'z'
  from: number
  to: number
  at: number
  top: number
  base?: number
  thick?: number
  openings?: Opening[]
  mat?: MatName
  skirt?: boolean
  skirtH?: number
}) {
  const height = top - base
  const pieces = useMemo(() => wallPieces(from, to, height, openings), [from, to, height, openings])
  const skirtPieces = useMemo(
    () => (skirt ? wallPieces(from, to, skirtH, openings.filter((o) => o.y0 < skirtH)) : []),
    [skirt, skirtH, from, to, openings],
  )
  const place = (c: number, y: number): [number, number, number] => (axis === 'x' ? [c, base + y, at] : [at, base + y, c])
  const dims = (w: number, h: number, t: number): [number, number, number] => (axis === 'x' ? [w, h, t] : [t, h, w])
  return (
    <group>
      {pieces.map((p, i) => (
        <WBox key={i} mat={mat} size={dims(p.w, p.h, thick)} position={place(p.c, p.y)} />
      ))}
      {skirtPieces.map((p, i) => (
        <WBox key={`s${i}`} mat="stone" size={dims(p.w, p.h, thick + 0.06)} position={place(p.c, p.y)} />
      ))}
    </group>
  )
}

interface Hole {
  /** 圓形：中心 (cu, cy) 半徑 r；矩形：u0..u1 × y0..y1（世界座標） */
  cu?: number
  cy?: number
  r?: number
  u0?: number
  u1?: number
  y0?: number
  y1?: number
}

/**
 * 山牆：多邊形擠出。plane 'xy' 是沿 x 的牆（固定 z = at），'zy' 是沿 z 的牆（固定 x = at）。
 * pts 是 [u, y] 世界座標，u 是沿牆方向的座標。
 */
const NO_HOLES: Hole[] = []

function GableWall({
  plane,
  at,
  pts,
  holes = NO_HOLES,
  thick = 0.3,
  mat = 'brick',
}: {
  plane: 'xy' | 'zy'
  at: number
  pts: [number, number][]
  holes?: Hole[]
  thick?: number
  mat?: TexMat
}) {
  const mats = useMats()
  const geo = useMemo(() => {
    const flip = plane === 'zy' ? -1 : 1
    const shape = new THREE.Shape(pts.map(([u, y]) => new THREE.Vector2(u * flip, y)))
    for (const h of holes) {
      const path = new THREE.Path()
      if (h.r !== undefined) {
        path.absarc(h.cu! * flip, h.cy!, h.r, 0, Math.PI * 2, true)
      } else {
        const a = h.u0! * flip
        const b = h.u1! * flip
        path.moveTo(Math.min(a, b), h.y0!)
        path.lineTo(Math.min(a, b), h.y1!)
        path.lineTo(Math.max(a, b), h.y1!)
        path.lineTo(Math.max(a, b), h.y0!)
        path.closePath()
      }
      shape.holes.push(path)
    }
    const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 28 })
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / TILE[mat], uv.getY(i) / TILE[mat])
    return g
  }, [plane, pts, holes, thick, mat])
  if (plane === 'xy') return <mesh geometry={geo} material={mats[mat]} position={[0, 0, at - thick / 2]} castShadow receiveShadow />
  return <mesh geometry={geo} material={mats[mat]} position={[at - thick / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />
}

// ---------------------------------------------------------------------------
// 窗：竹節窗（綠釉直欞）與圓窗
// ---------------------------------------------------------------------------

type Glow = 'warm' | 'fire' | 'dim' | null

const glowMats = {
  warm: new THREE.MeshBasicMaterial({ color: '#ffc47a', toneMapped: false, side: THREE.DoubleSide }),
  fire: new THREE.MeshBasicMaterial({ color: '#ff8a3a', toneMapped: false, side: THREE.DoubleSide }),
  dim: new THREE.MeshBasicMaterial({ color: '#1a2233', side: THREE.DoubleSide }),
}

/** 竹節窗。facing：窗面朝向的軸（'z' = 開在沿 x 的牆上）；inward：室內在哪一側（+1/-1）。 */
export function BambooWindow({
  facing,
  center,
  w,
  h,
  inward,
  glow = null,
}: {
  facing: 'x' | 'z'
  center: [number, number, number]
  w: number
  h: number
  inward: 1 | -1
  glow?: Glow
}) {
  const mats = useMats()
  const along = (u: number, y: number, n = 0): [number, number, number] =>
    facing === 'z' ? [center[0] + u, center[1] + y, center[2] + n] : [center[0] + n, center[1] + y, center[2] + u]
  const box = (a: number, b: number, c: number): [number, number, number] => (facing === 'z' ? [a, b, c] : [c, b, a])
  const barsGeo = useMemo(() => {
    const bars = Math.max(3, Math.round(w / 0.17))
    const step = w / (bars + 1)
    const parts: THREE.BufferGeometry[] = []
    for (let i = 0; i < bars; i++) {
      const u = -w / 2 + step * (i + 1)
      const off = facing === 'z' ? [u, 0, 0] : [0, 0, u]
      parts.push(new THREE.CylinderGeometry(0.034, 0.034, h, 10).translate(off[0], off[1], off[2]))
      for (const j of [-0.22, 0.22]) parts.push(new THREE.CylinderGeometry(0.046, 0.046, 0.05, 10).translate(off[0], j * h, off[2]))
    }
    return mergeGeometries(parts)
  }, [w, h, facing])
  return (
    <group>
      {/* 石窗框：上楣、下檻、兩側 */}
      <WBox mat="stone" size={box(w + 0.3, 0.14, 0.4)} position={along(0, h / 2 + 0.07)} />
      <WBox mat="stone" size={box(w + 0.36, 0.12, 0.44)} position={along(0, -h / 2 - 0.06)} />
      {[-1, 1].map((s) => (
        <WBox key={s} mat="stone" size={box(0.12, h, 0.36)} position={along(s * (w / 2 + 0.06), 0)} />
      ))}
      <mesh geometry={barsGeo} material={mats.glaze} position={center} castShadow />
      {glow && (
        <mesh position={along(0, 0, inward * 0.32)} rotation={facing === 'z' ? [0, 0, 0] : [0, Math.PI / 2, 0]} material={glowMats[glow]}>
          <planeGeometry args={[w + 0.2, h + 0.2]} />
        </mesh>
      )}
    </group>
  )
}

function RoundWindow({ center, r, glow = null, inward }: { center: [number, number, number]; r: number; glow?: Glow; inward: 1 | -1 }) {
  const mats = useMats()
  const bars = 5
  return (
    <group position={center}>
      <mesh material={mats.stone} castShadow>
        <torusGeometry args={[r + 0.05, 0.07, 10, 40]} />
      </mesh>
      {Array.from({ length: bars }, (_, i) => {
        const x = -r + ((i + 1) * 2 * r) / (bars + 1)
        const hh = 2 * Math.sqrt(Math.max(0, r * r - x * x))
        return (
          <mesh key={i} material={mats.glaze} position={[x, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, hh, 8]} />
          </mesh>
        )
      })}
      {glow && (
        <mesh position={[0, 0, inward * 0.3]} material={glowMats[glow]}>
          <circleGeometry args={[r + 0.05, 32]} />
        </mesh>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 門、春聯、匾額
// ---------------------------------------------------------------------------

const COUPLET_FONT = [{ spec: `700 80px ${BRUSH_FONT}`, text: '天增歲月人增壽春滿乾坤福滿門西河衍派春福' }]

export function coupletTexture(text: string) {
  return canvasTexture(
    96,
    96 * text.length,
    (ctx, w, h) => {
      ctx.fillStyle = '#c7342b'
      ctx.fillRect(0, 0, w, h)
      // 紅紙上的金箔點
      for (let i = 0; i < 120; i++) {
        ctx.fillStyle = `rgba(255, 210, 120, ${0.15 + Math.random() * 0.35})`
        ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5)
      }
      ctx.fillStyle = '#1b1210'
      ctx.font = `700 76px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ;[...text].forEach((ch, i) => ctx.fillText(ch, w / 2, 48 + i * 96))
    },
    COUPLET_FONT,
  )
}

export function plaqueTexture(text: string) {
  return canvasTexture(
    512,
    128,
    (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#3a1d14')
      g.addColorStop(1, '#241009')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#d9a64a'
      ctx.lineWidth = 6
      ctx.strokeRect(8, 8, w - 16, h - 16)
      ctx.fillStyle = '#e8b85a'
      ctx.font = `700 84px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, w / 2, h / 2 + 4)
    },
    COUPLET_FONT,
  )
}

/** 斗方：菱形的紅紙，貼在門上 */
function doufangTexture(ch: string) {
  return canvasTexture(
    128,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#c7342b'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#e0b050'
      ctx.lineWidth = 4
      ctx.strokeRect(6, 6, w - 12, h - 12)
      ctx.save()
      ctx.translate(w / 2, h / 2)
      ctx.rotate(-Math.PI / 4)
      ctx.fillStyle = '#1b1210'
      ctx.font = `700 76px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(ch, 0, 4)
      ctx.restore()
    },
    COUPLET_FONT,
  )
}

/** 雙開木門。facing 'z'：門在沿 x 的牆上。open：往室內打開的角度。 */
function DoubleDoor({
  facing,
  center,
  w,
  h,
  inward,
  open = 0,
  auto = false,
  doufang,
}: {
  facing: 'x' | 'z'
  center: [number, number, number]
  w: number
  h: number
  inward: 1 | -1
  open?: number
  /** 阿嬤靠近就自己打開（鬼開門） */
  auto?: boolean
  doufang?: string
}) {
  const mats = useMats()
  const fang = useMemo(() => (doufang ? doufangTexture(doufang) : null), [doufang])
  const leaves = useRef<(THREE.Group | null)[]>([])
  const angle = useRef(open)
  const isOpen = useRef(false)
  useFrame((_, dt) => {
    if (!auto) return
    let d = Math.hypot(player.x - center[0], player.z - center[2])
    // 深夜起來走動的客人、巡夜的廟公也會開門
    const sim = night.sim
    if (sim) {
      for (const g of sim.guests) if (g.mode !== 'bed') d = Math.min(d, Math.hypot(g.x - center[0], g.z - center[2]))
      if (sim.miaogong?.active) d = Math.min(d, Math.hypot(sim.miaogong.x - center[0], sim.miaogong.z - center[2]))
    }
    const want = d < 1.45
    if (want !== isOpen.current) {
      isOpen.current = want
      sfx.play(want ? 'door_open' : 'door_close', { volume: 0.55 })
    }
    const target = want ? 1.35 : 0
    angle.current += (target - angle.current) * (1 - Math.exp(-(want ? 7 : 4) * Math.min(dt, 0.1)))
    leaves.current.forEach((g, i) => {
      if (g) g.rotation.y = -(i === 0 ? -1 : 1) * angle.current
    })
  })
  const leafW = w / 2
  const t = 0.07
  // 在「門面座標」裡建（門面在 XY 平面、室內在 -Z），再轉到世界
  const rotY = facing === 'z' ? (inward === -1 ? 0 : Math.PI) : inward === -1 ? Math.PI / 2 : -Math.PI / 2
  return (
    <group position={center} rotation={[0, rotY, 0]} userData={auto ? { noMerge: true } : undefined}>
      {[-1, 1].map((s, i) => (
        <group
          key={s}
          ref={(el) => {
            leaves.current[i] = el
          }}
          position={[s * (w / 2), 0, -0.02]}
          rotation={[0, -s * open, 0]}
        >
          <WBox mat="wood" size={[leafW, h, t]} position={[-s * (leafW / 2), 0, 0]} />
          {/* 門板上的橫帶與門環 */}
          {[-0.3, 0.3].map((y) => (
            <WBox key={y} mat="darkWood" size={[leafW - 0.06, 0.06, 0.02]} position={[-s * (leafW / 2), y * h, t / 2 + 0.01]} castShadow={false} />
          ))}
          <mesh material={mats.gold} position={[-s * (leafW - 0.12), 0.02, t / 2 + 0.03]}>
            <torusGeometry args={[0.055, 0.012, 8, 20]} />
          </mesh>
          {fang && (auto || open === 0) && (
            <mesh position={[-s * (leafW / 2), 0.35, t / 2 + 0.012]} rotation={[0, 0, Math.PI / 4]}>
              <planeGeometry args={[0.26, 0.26]} />
              <meshStandardMaterial map={fang} roughness={0.85} />
            </mesh>
          )}
        </group>
      ))}
      {/* 門檻 */}
      <WBox mat="stone" size={[w + 0.1, 0.1, 0.34]} position={[0, -h / 2 + 0.05, 0]} />
    </group>
  )
}

function Couplets({ z, doorW, doorTop }: { z: number; doorW: number; doorTop: number }) {
  const left = useMemo(() => coupletTexture('天增歲月人增壽'), [])
  const right = useMemo(() => coupletTexture('春滿乾坤福滿門'), [])
  const plaque = useMemo(() => plaqueTexture('西河衍派'), [])
  const h = 1.6
  return (
    <group>
      {/* 傳統上右聯（面對門的右手邊）是上聯 */}
      {[
        [doorW / 2 + 0.19, left],
        [-(doorW / 2 + 0.19), right],
      ].map(([x, tex], i) => (
        <mesh key={i} position={[x as number, doorTop - h / 2 - 0.05, z]}>
          <planeGeometry args={[0.23, h]} />
          <meshStandardMaterial map={tex as THREE.Texture} roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, doorTop + 0.3, z + 0.03]} castShadow>
        <boxGeometry args={[1.7, 0.42, 0.06]} />
        <meshStandardMaterial attach="material-0" color="#241009" />
        <meshStandardMaterial attach="material-1" color="#241009" />
        <meshStandardMaterial attach="material-2" color="#241009" />
        <meshStandardMaterial attach="material-3" color="#241009" />
        <meshStandardMaterial attach="material-4" map={plaque} roughness={0.5} metalness={0.1} />
        <meshStandardMaterial attach="material-5" color="#241009" />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 燈籠
// ---------------------------------------------------------------------------

const LANTERN_PROFILE = [
  [0.0, -0.28],
  [0.11, -0.27],
  [0.19, -0.21],
  [0.235, -0.1],
  [0.245, 0],
  [0.235, 0.1],
  [0.19, 0.21],
  [0.11, 0.27],
  [0.0, 0.28],
].map(([x, y]) => new THREE.Vector2(x, y))

function lanternTexture() {
  return canvasTexture(
    512,
    256,
    (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#9c1d17')
      g.addColorStop(0.5, '#e0412f')
      g.addColorStop(1, '#9c1d17')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(90, 10, 5, 0.45)'
      ctx.lineWidth = 3
      for (let x = 0; x < w; x += 32) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      ctx.fillStyle = '#ffd36b'
      ctx.font = `700 120px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const u of [0.25, 0.75]) {
        ctx.save()
        ctx.translate(u * w, h / 2 + 6)
        ctx.scale(0.72, 1)
        ctx.fillText('福', 0, 0)
        ctx.restore()
      }
    },
    [{ spec: `700 120px ${BRUSH_FONT}`, text: '福' }],
  )
}

const lanternMat = new THREE.MeshStandardMaterial({ roughness: 0.7, emissive: '#ffffff', emissiveIntensity: 1 })

export function Lantern({ position, drop = 0.35, scale = 1 }: { position: [number, number, number]; drop?: number; scale?: number }) {
  const mats = useMats()
  const geo = useMemo(() => new THREE.LatheGeometry(LANTERN_PROFILE, 28), [])
  useEffect(() => {
    if (!lanternMat.map) {
      const t = lanternTexture()
      lanternMat.map = t
      lanternMat.emissiveMap = t
      lanternMat.needsUpdate = true
    }
  }, [])
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, drop / 2 + 0.3, 0]} material={mats.black}>
        <cylinderGeometry args={[0.008, 0.008, drop, 4]} />
      </mesh>
      <mesh geometry={geo} material={lanternMat} castShadow />
      {[0.29, -0.29].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={mats.gold}>
          <cylinderGeometry args={[0.1, 0.1, 0.05, 16]} />
        </mesh>
      ))}
      <mesh position={[0, -0.36, 0]} material={mats.gold}>
        <cylinderGeometry args={[0.012, 0.012, 0.1, 6]} />
      </mesh>
      <mesh position={[0, -0.52, 0]} material={mats.redPaper}>
        <coneGeometry args={[0.05, 0.24, 10, 1, true]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 屋頂
// ---------------------------------------------------------------------------

const eaveTileGeo = new THREE.CylinderGeometry(0.078, 0.078, 0.2, 10)
const eaveTileMat = new THREE.MeshStandardMaterial({ color: '#8f4a31', roughness: 0.75 })

/**
 * 雙坡屋頂。axis：屋脊方向。ridge：屋脊在垂直軸上的座標。edges：兩側屋簷的座標。
 * from／to：沿屋脊方向的範圍（含出挑）。
 */
export function GableRoof({
  axis,
  ridge,
  ridgeY,
  from,
  to,
  edges,
  style,
}: {
  axis: 'x' | 'z'
  ridge: number
  ridgeY: number
  from: number
  to: number
  edges: [number, number]
  style: 'swallow' | 'horseback'
}) {
  const mats = useMats()
  const L = to - from
  const mid = (from + to) / 2
  const a = Math.atan(SLOPE)
  const ca = Math.cos(a)
  const sa = Math.sin(a)

  const slopes = useMemo(
    () =>
      edges.map((e) => {
        const dir = Math.sign(e - ridge)
        const run = Math.abs(e - ridge)
        const eaveY = ridgeY - run * SLOPE
        // 從屋脊略過一點（0.09）到屋簷
        const p0 = { u: ridge - dir * 0.09 * ca, y: ridgeY + 0.09 * sa }
        const p1 = { u: e, y: eaveY }
        const n = { u: dir * sa, y: ca }
        const d = { u: dir * ca, y: -sa }
        const len = Math.hypot(p1.u - p0.u, p1.y - p0.y)
        const cu = (p0.u + p1.u) / 2 + (n.u * ROOF_T) / 2
        const cy = (p0.y + p1.y) / 2 + (n.y * ROOF_T) / 2
        return { dir, len, cu, cy, p1, n, d }
      }),
    [edges, ridge, ridgeY, ca, sa],
  )

  const tiles = useMemo(() => {
    const out: THREE.Matrix4[] = []
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    for (const s of slopes) {
      const dv = axis === 'x' ? new THREE.Vector3(0, s.d.y, s.d.u) : new THREE.Vector3(s.d.u, s.d.y, 0)
      q.setFromUnitVectors(up, dv.normalize())
      const count = Math.floor((L - 0.2) / 0.215)
      for (let i = 0; i <= count; i++) {
        const along = from + 0.1 + i * 0.215
        const u = s.p1.u + s.n.u * (ROOF_T + 0.04) - s.d.u * 0.08
        const y = s.p1.y + s.n.y * (ROOF_T + 0.04) - s.d.y * 0.08
        const p = axis === 'x' ? new THREE.Vector3(along, y, u) : new THREE.Vector3(u, y, along)
        out.push(new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)))
      }
    }
    return out
  }, [slopes, axis, from, L])

  const tileMesh = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = tileMesh.current
    if (!m) return
    tiles.forEach((mat, i) => m.setMatrixAt(i, mat))
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [tiles])

  const ridgeGeo = useMemo(() => {
    const half = L / 2
    if (style === 'swallow') {
      const pts = [
        [-half - 0.6, 0.95],
        [-half - 0.2, 0.46],
        [-half + 0.35, 0.16],
        [-half + 1.1, 0.03],
        [-half + 2.6, 0],
        [0, 0],
        [half - 2.6, 0],
        [half - 1.1, 0.03],
        [half - 0.35, 0.16],
        [half + 0.2, 0.46],
        [half + 0.6, 0.95],
      ]
      const mk = (off: number, dy: number, r: number) =>
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y + dy, off))), 96, r, 10, false)
      const forks = [-1, 1].flatMap((s) =>
        [-1, 1].map(
          (zs) =>
            new THREE.TubeGeometry(
              new THREE.CatmullRomCurve3([
                new THREE.Vector3(s * (half + 0.1), 0.36, 0),
                new THREE.Vector3(s * (half + 0.55), 0.8, zs * 0.08),
                new THREE.Vector3(s * (half + 0.95), 1.22, zs * 0.2),
              ]),
              16,
              0.045,
              8,
              false,
            ),
        ),
      )
      return { main: mk(0, 0, 0.17), trims: [mk(0.17, -0.09, 0.045), mk(-0.17, -0.09, 0.045)], forks }
    }
    const pts = [
      [-half + 0.1, 0.12],
      [-half + 0.5, 0.02],
      [0, 0],
      [half - 0.5, 0.02],
      [half - 0.1, 0.12],
    ]
    const mk = (off: number, dy: number, r: number) =>
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y + dy, off))), 48, r, 10, false)
    return { main: mk(0, 0, 0.15), trims: [mk(0.15, -0.08, 0.04), mk(-0.15, -0.08, 0.04)], forks: [] }
  }, [L, style])

  const ridgePos: [number, number, number] = axis === 'x' ? [mid, ridgeY + ROOF_T + 0.06, ridge] : [ridge, ridgeY + ROOF_T + 0.06, mid]
  const ridgeRot: [number, number, number] = axis === 'x' ? [0, 0, 0] : [0, Math.PI / 2, 0]

  return (
    <group>
      {slopes.map((s, i) => {
        const pos: [number, number, number] = axis === 'x' ? [mid, s.cy, s.cu] : [s.cu, s.cy, mid]
        const rot: [number, number, number] = axis === 'x' ? [s.dir * a, 0, 0] : [0, 0, -s.dir * a]
        const size: [number, number, number] = axis === 'x' ? [L, ROOF_T, s.len] : [s.len, ROOF_T, L]
        const fascia = { u: s.p1.u - s.n.u * 0.05, y: s.p1.y - s.n.y * 0.05 }
        return (
          <group key={i}>
            <WBox mat="roof" size={size} position={pos} rotation={rot} />
            {/* 屋簷封板 */}
            <WBox
              mat="darkWood"
              size={axis === 'x' ? [L, 0.16, 0.06] : [0.06, 0.16, L]}
              position={axis === 'x' ? [mid, fascia.y, fascia.u] : [fascia.u, fascia.y, mid]}
              rotation={rot}
            />
            {/* 兩端的規帶（山牆邊的壓邊瓦） */}
            {[from + 0.13, to - 0.13].map((along) => (
              <WBox
                key={along}
                mat="ridge"
                size={axis === 'x' ? [0.26, 0.1, s.len] : [s.len, 0.1, 0.26]}
                position={
                  axis === 'x'
                    ? [along, s.cy + s.n.y * (ROOF_T / 2 + 0.05), s.cu + s.n.u * (ROOF_T / 2 + 0.05)]
                    : [s.cu + s.n.u * (ROOF_T / 2 + 0.05), s.cy + s.n.y * (ROOF_T / 2 + 0.05), along]
                }
                rotation={rot}
              />
            ))}
          </group>
        )
      })}
      {/* 瓦當：屋簷一整排筒瓦的頭 */}
      <instancedMesh ref={tileMesh} args={[eaveTileGeo, eaveTileMat, tiles.length]} castShadow />
      {/* 屋脊 */}
      <group position={ridgePos} rotation={ridgeRot}>
        <mesh geometry={ridgeGeo.main} material={mats.ridge} castShadow />
        {ridgeGeo.trims.map((g, i) => (
          <mesh key={i} geometry={g} material={mats.trim} />
        ))}
        {ridgeGeo.forks.map((g, i) => (
          <mesh key={`f${i}`} geometry={g} material={mats.ridge} castShadow />
        ))}
        {style === 'swallow' && (
          <group position={[0, 0.2, 0]}>
            <mesh material={mats.glaze} position={[0, 0.12, 0]}>
              <sphereGeometry args={[0.16, 16, 12]} />
            </mesh>
            <mesh material={mats.gold} position={[0, 0.34, 0]}>
              <sphereGeometry args={[0.09, 12, 10]} />
            </mesh>
            <mesh material={mats.ridge}>
              <cylinderGeometry args={[0.16, 0.22, 0.12, 12]} />
            </mesh>
          </group>
        )}
        {style === 'horseback' &&
          [-1, 1].map((s) => (
            <mesh key={s} position={[s * (L / 2 - 0.1), 0.06, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.trim}>
              <cylinderGeometry args={[0.24, 0.24, 0.2, 20]} />
            </mesh>
          ))}
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 正身
// ---------------------------------------------------------------------------

const MAIN_FRONT_OPENINGS: Opening[] = [
  { c: 0, w: 1.7, y0: 0, y1: 2.45 },
  { c: -4.4, w: 1.3, y0: 0.95, y1: 2.2 },
  { c: 4.4, w: 1.3, y0: 0.95, y1: 2.2 },
]

function MainHall() {
  const mats = useMats()
  const gablePts = useMemo<[number, number][]>(
    () => [
      [MAIN.z0, FLOOR_Y],
      [MAIN.z1, FLOOR_Y],
      [MAIN.z1, MAIN_WALL_TOP],
      [MAIN_RIDGE_Z, MAIN.ridgeY],
      [MAIN.z0, MAIN_WALL_TOP],
    ],
    [],
  )
  const partOpenings = useMemo<Opening[]>(() => [{ c: SIDE_DOOR_Z, w: SIDE_DOOR_W, y0: 0, y1: 2.2 }], [])
  const doorTop = FLOOR_Y + 2.45
  const colTop = MAIN.ridgeY - (MAIN_PORCH.columnZ - MAIN_RIDGE_Z) * SLOPE - 0.2
  const Gable = ({ x }: { x: number }) => (
    <group>
      <GableWall plane="zy" at={x} pts={gablePts} />
      <WBox mat="stone" size={[0.36, SKIRT_H, MAIN.z1 - MAIN.z0]} position={[x, FLOOR_Y + SKIRT_H / 2, MAIN_RIDGE_Z]} />
      {/* 鳥踏：山牆上的一道橫線腳 */}
      <WBox mat="trim" size={[0.42, 0.08, MAIN.z1 - MAIN.z0 + 0.1]} position={[x, MAIN_WALL_TOP - 0.05, MAIN_RIDGE_Z]} />
    </group>
  )
  return (
    <group>
      {/* 遠側：後牆、西山牆（不會擋鏡頭） */}
      <Wall axis="x" from={MAIN.x0} to={MAIN.x1} at={MAIN.z0} top={MAIN_WALL_TOP} />
      <Gable x={MAIN.x0} />
      <WBox mat="plaster" size={[4.06, MAIN_WALL_TOP - FLOOR_Y, 0.04]} position={[0, (MAIN_WALL_TOP + FLOOR_Y) / 2, MAIN.z0 + 0.17]} castShadow={false} />

      {/* 近側：前牆、東山牆、隔間、屋頂。阿嬤進屋或被擋住時淡出 */}
      <Fader id="main">
        <MergeStatic>
          <Wall axis="x" from={MAIN.x0} to={MAIN.x1} at={MAIN.z1} top={MAIN_WALL_TOP} openings={MAIN_FRONT_OPENINGS} />
          <Gable x={MAIN.x1} />
          {[-HALL_PART_X, HALL_PART_X].map((x) => (
            <Wall key={x} axis="z" from={MAIN.z0 + 0.15} to={MAIN.z1 - 0.15} at={x} top={MAIN_WALL_TOP} thick={0.14} mat="plaster" openings={partOpenings} skirt={false} />
          ))}
          <BambooWindow facing="z" center={[-4.4, FLOOR_Y + 1.575, MAIN.z1]} w={1.3} h={1.25} inward={-1} glow="dim" />
          <BambooWindow facing="z" center={[4.4, FLOOR_Y + 1.575, MAIN.z1]} w={1.3} h={1.25} inward={-1} glow="warm" />
          <DoubleDoor facing="z" center={[0, FLOOR_Y + 1.225, MAIN.z1 - 0.1]} w={1.7} h={2.45} inward={-1} open={1.25} />
          <Couplets z={MAIN.z1 + 0.16} doorW={1.7} doorTop={doorTop} />
          {[-HALL_PART_X, HALL_PART_X].map((x) => (
            <DoorCurtain key={x} x={x} z={SIDE_DOOR_Z} />
          ))}
          <GableRoof
            axis="x"
            ridge={MAIN_RIDGE_Z}
            ridgeY={MAIN.ridgeY}
            from={MAIN.x0 - 0.65}
            to={MAIN.x1 + 0.65}
            edges={[MAIN.z0 - 0.5, MAIN_PORCH.z1]}
            style="swallow"
          />
        {/* 步口廊：柱子、樑 */}
        {MAIN_PORCH.columnsX.map((x) => (
          <group key={x} position={[x, 0, MAIN_PORCH.columnZ]}>
            <mesh material={mats.stone} position={[0, FLOOR_Y + 0.11, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.2, 0.22, 0.22, 8]} />
            </mesh>
            <mesh material={mats.redPaint} position={[0, (FLOOR_Y + 0.22 + colTop) / 2, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.13, 0.14, colTop - FLOOR_Y - 0.22, 16]} />
            </mesh>
            <WBox mat="darkWood" size={[0.3, 0.12, 0.3]} position={[0, colTop, 0]} />
            {/* 穿樑：柱頭拉回正身牆 */}
            <WBox mat="darkWood" size={[0.14, 0.18, MAIN.z1 - MAIN_PORCH.columnZ]} position={[0, colTop + 0.06, (MAIN.z1 + MAIN_PORCH.columnZ) / 2 - 0.15]} />
          </group>
        ))}
        <WBox mat="darkWood" size={[MAIN.x1 - MAIN.x0 + 0.4, 0.2, 0.2]} position={[0, colTop + 0.12, MAIN_PORCH.columnZ]} />
        <Lantern position={[-1.25, colTop - 0.55, MAIN_PORCH.columnZ + 0.02]} drop={0.3} />
        <Lantern position={[1.25, colTop - 0.55, MAIN_PORCH.columnZ + 0.02]} drop={0.3} />
        </MergeStatic>
      </Fader>

    </group>
  )
}

/** 門簾：神明廳通往兩側房間的門口，掛半截花布 */
function DoorCurtain({ x, z }: { x: number; z: number }) {
  const mat = useMemo(() => {
    const t = floralFabricTexture().clone()
    t.repeat.set(1.4, 1.2)
    t.needsUpdate = true
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, side: THREE.DoubleSide })
  }, [])
  const h = 1.0
  return (
    <group position={[x, FLOOR_Y + 2.2 - h / 2, z]} rotation={[0, Math.PI / 2, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * SIDE_DOOR_W) / 4, 0, 0]} material={mat}>
          <planeGeometry args={[SIDE_DOOR_W / 2 - 0.02, h]} />
        </mesh>
      ))}
      <mesh position={[0, h / 2 + 0.02, 0]} rotation={[0, 0, Math.PI / 2]} material={undefined}>
        <cylinderGeometry args={[0.015, 0.015, SIDE_DOOR_W + 0.1, 6]} />
        <meshStandardMaterial color="#3d271a" />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 護龍
// ---------------------------------------------------------------------------

function Wing({ side }: { side: 1 | -1 }) {
  const W = side === 1 ? WING_R : WING_L
  const inner = side === 1 ? W.x0 : W.x1 // 朝埕的牆
  const outer = side === 1 ? W.x1 : W.x0
  const ridgeX = (W.x0 + W.x1) / 2
  const inIn = side // 內牆：室內在 +side 那一側（x 方向）
  const inOut = (-side) as 1 | -1 // 外牆：室內在 -side 那一側
  const gablePts = useMemo<[number, number][]>(
    () => [
      [W.x0, FLOOR_Y],
      [W.x1, FLOOR_Y],
      [W.x1, WING_WALL_TOP],
      [ridgeX, W.ridgeY],
      [W.x0, WING_WALL_TOP],
    ],
    [W, ridgeX],
  )
  const roundHole = useMemo<Hole[]>(() => [{ cu: ridgeX, cy: FLOOR_Y + 1.75, r: 0.46 }], [ridgeX])
  const innerOpenings = useMemo<Opening[]>(
    () => [
      { c: WING_BACK_DOOR_Z, w: 1.0, y0: 0, y1: 2.2 },
      { c: GUEST_DOOR_Z, w: 1.0, y0: 0, y1: 2.2 },
      { c: GUEST_WINDOW_IN_Z, w: 1.1, y0: 0.95, y1: 2.05 },
    ],
    [],
  )
  const outerOpenings = useMemo<Opening[]>(
    () => [
      { c: WING_BACK_DOOR_Z, w: 1.0, y0: 1.0, y1: 2.0 },
      { c: GUEST_WINDOW_OUT_Z, w: 1.0, y0: 1.0, y1: 2.0 },
    ],
    [],
  )
  const postX = inner - side * (WING_PORCH - 0.12)
  const postTop = W.ridgeY - Math.abs(postX - ridgeX) * SLOPE - 0.2
  const isGuest = side === 1
  const id = isGuest ? 'wingR' : 'wingL'

  // 鏡頭在 +x、+z 那側：右護龍擋鏡頭的是外牆，左護龍擋鏡頭的是內牆（朝埕那面）
  const innerWall = (
    <group>
      <Wall axis="z" from={W.z0} to={W.z1} at={inner} top={WING_WALL_TOP} openings={innerOpenings} />
      <DoubleDoor facing="x" center={[inner, FLOOR_Y + 1.1, WING_BACK_DOOR_Z]} w={1.0} h={2.2} inward={inIn} auto />
      <DoubleDoor facing="x" center={[inner, FLOOR_Y + 1.1, GUEST_DOOR_Z]} w={1.0} h={2.2} inward={inIn} doufang="春" auto />
      <BambooWindow facing="x" center={[inner, FLOOR_Y + 1.5, GUEST_WINDOW_IN_Z]} w={1.1} h={1.1} inward={inIn} glow={isGuest ? null : 'fire'} />
    </group>
  )
  const outerWall = (
    <group>
      <Wall axis="z" from={W.z0} to={W.z1} at={outer} top={WING_WALL_TOP} openings={outerOpenings} />
      <BambooWindow facing="x" center={[outer, FLOOR_Y + 1.5, WING_BACK_DOOR_Z]} w={1.0} h={1.0} inward={inOut} glow={isGuest ? 'dim' : null} />
      <BambooWindow facing="x" center={[outer, FLOOR_Y + 1.5, GUEST_WINDOW_OUT_Z]} w={1.0} h={1.0} inward={inOut} glow={null} />
    </group>
  )

  return (
    <group>
      {/* 遠側 */}
      {isGuest ? innerWall : outerWall}
      <GableWall plane="xy" at={W.z0} pts={gablePts} />
      <WBox mat="stone" size={[W.x1 - W.x0, SKIRT_H, 0.36]} position={[ridgeX, FLOOR_Y + SKIRT_H / 2, W.z0]} />

      {/* 近側：擋鏡頭的牆、前山牆、隔間、屋頂 */}
      <Fader id={id}>
        <MergeStatic>
          {isGuest ? outerWall : innerWall}
          <GableWall plane="xy" at={W.z1} pts={gablePts} holes={roundHole} />
          <WBox mat="stone" size={[W.x1 - W.x0, SKIRT_H, 0.36]} position={[ridgeX, FLOOR_Y + SKIRT_H / 2, W.z1]} />
          <WBox mat="trim" size={[W.x1 - W.x0 + 0.1, 0.08, 0.42]} position={[ridgeX, WING_WALL_TOP - 0.05, W.z1]} />
          <RoundWindow center={[ridgeX, FLOOR_Y + 1.75, W.z1]} r={0.46} inward={-1} glow={null} />
          <WBox mat="plaster" size={[W.x1 - W.x0 - 0.3, WING_WALL_TOP - FLOOR_Y, 0.14]} position={[ridgeX, (WING_WALL_TOP + FLOOR_Y) / 2, W.split]} />
          {isGuest && <GuestRoomLining />}
          <GableRoof
            axis="z"
            ridge={ridgeX}
            ridgeY={W.ridgeY}
            from={W.z0 - 0.15}
            to={W.z1 + 0.5}
            edges={side === 1 ? [inner - WING_PORCH, outer + 0.45] : [outer - 0.45, inner + WING_PORCH]}
            style="horseback"
          />
          {!isGuest && <Chimney x={outer - side * 0.75} z={4.4} />}
        </MergeStatic>
      </Fader>

      {/* 走廊柱與樑 */}
      {[-1.5, 0.95, 3.45, 5.75].map((z) => (
        <group key={z}>
          <WBox mat="stone" size={[0.28, 0.16, 0.28]} position={[postX, FLOOR_Y + 0.08, z]} />
          <WBox mat="darkWood" size={[0.17, postTop - FLOOR_Y - 0.16, 0.17]} position={[postX, (postTop + FLOOR_Y + 0.16) / 2, z]} />
        </group>
      ))}
      <WBox mat="darkWood" size={[0.16, 0.2, W.z1 - W.z0 + 0.3]} position={[postX, postTop + 0.1, (W.z0 + W.z1) / 2]} />
      <Lantern position={[postX + side * 0.15, postTop - 0.5, GUEST_DOOR_Z]} drop={0.25} scale={0.85} />
    </group>
  )
}

/** 客房內牆的白灰泥，跟著外牆一起淡出 */
function GuestRoomLining() {
  const W = WING_R
  const top = WING_WALL_TOP
  const outerOps = useMemo<Opening[]>(() => [{ c: GUEST_WINDOW_OUT_Z, w: 1.0, y0: 1.0, y1: 2.0 }], [])
  const innerOps = useMemo<Opening[]>(
    () => [
      { c: GUEST_DOOR_Z, w: 1.0, y0: 0, y1: 2.2 },
      { c: GUEST_WINDOW_IN_Z, w: 1.1, y0: 0.95, y1: 2.05 },
    ],
    [],
  )
  const frontPts = useMemo<[number, number][]>(
    () => [
      [W.x0 + 0.15, FLOOR_Y],
      [W.x1 - 0.15, FLOOR_Y],
      [W.x1 - 0.15, top],
      [W.x0 + 0.15, top],
    ],
    [W, top],
  )
  const hole = useMemo<Hole[]>(() => [{ cu: (W.x0 + W.x1) / 2, cy: FLOOR_Y + 1.75, r: 0.46 }], [W])
  return (
    <group>
      <Wall axis="z" from={W.split} to={W.z1 - 0.15} at={W.x1 - 0.165} top={top} thick={0.03} mat="plaster" openings={outerOps} skirt={false} />
      <Wall axis="z" from={W.split} to={W.z1 - 0.15} at={W.x0 + 0.165} top={top} thick={0.03} mat="plaster" openings={innerOps} skirt={false} />
      <GableWall plane="xy" at={W.z1 - 0.165} pts={frontPts} holes={hole} thick={0.03} mat="plaster" />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 灶腳煙囪與炊煙
// ---------------------------------------------------------------------------

const smokeTex = canvasTexture(128, 128, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2)
  g.addColorStop(0, 'rgba(220,220,230,0.55)')
  g.addColorStop(0.6, 'rgba(200,200,215,0.18)')
  g.addColorStop(1, 'rgba(200,200,215,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
})

function Chimney({ x, z }: { x: number; z: number }) {
  const puffs = useRef<THREE.Sprite[]>([])
  const baseY = WING_L.ridgeY + 0.9
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    puffs.current.forEach((p, i) => {
      if (!p) return
      const k = (t * 0.18 + i / 8) % 1
      p.position.set(x + Math.sin(k * 4 + i) * 0.15 + k * 0.8, baseY + 0.3 + k * 2.6, z - k * 0.4)
      const s = 0.4 + k * 1.3
      p.scale.set(s, s, 1)
      ;(p.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.35
    })
  })
  return (
    <group>
      <WBox mat="brick" size={[0.55, 1.6, 0.55]} position={[x, WING_L.ridgeY + 0.05, z]} />
      <WBox mat="stone" size={[0.7, 0.12, 0.7]} position={[x, WING_L.ridgeY + 0.9, z]} />
      {Array.from({ length: 8 }, (_, i) => (
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

// ---------------------------------------------------------------------------
// 淡出（聚焦客房時，看穿屋頂與外牆）
// ---------------------------------------------------------------------------

/** 阿嬤在這棟建築裡、或建築擋住鏡頭時，子物件淡出（見 world/World.tsx 的遮擋判定） */
function Fader({ id, children }: { id: string; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const clones = useRef(new Map<THREE.Material, THREE.Material>())
  const seen = useRef(new WeakSet<THREE.Object3D>())
  const opacity = useRef(1)
  const scanFrames = useRef(0)
  useFrame(() => {
    const g = group.current
    if (!g) return
    // MergeStatic 合併完（幾幀之內）就不會再有新網格，之後不用每幀走整棵樹
    if (scanFrames.current++ < 240) g.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || seen.current.has(m)) return
      seen.current.add(m)
      const swap = (mat: THREE.Material) => {
        let c = clones.current.get(mat)
        if (!c) {
          c = mat.clone()
          clones.current.set(mat, c)
        }
        return c
      }
      m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material)
    })
    for (const [orig, c] of clones.current) {
      const a = orig as THREE.MeshStandardMaterial
      const b = c as THREE.MeshStandardMaterial
      if (a.color && b.color) b.color.copy(a.color)
      if (a.emissive && b.emissive) {
        b.emissive.copy(a.emissive)
        b.emissiveIntensity = a.emissiveIntensity
      }
      if (a.map !== b.map || a.emissiveMap !== b.emissiveMap) {
        b.map = a.map
        b.emissiveMap = a.emissiveMap
        b.needsUpdate = true
      }
    }
    const target = useStore.getState().faded.split(',').includes(id) ? 0 : 1
    const prev = opacity.current
    opacity.current += (target - opacity.current) * 0.15
    if (Math.abs(opacity.current - target) < 0.01) opacity.current = target
    if (Math.abs(opacity.current - prev) < 1e-4 && opacity.current === target && g.visible === (target > 0)) return
    const o = opacity.current
    g.visible = o > 0.01
    for (const c of clones.current.values()) {
      const wasT = c.transparent
      c.opacity = o
      c.transparent = o < 0.995
      c.depthWrite = o > 0.5
      if (wasT !== c.transparent) c.needsUpdate = true
    }
    // 淡到幾乎看不見時不再擋月光，房間裡才看得清楚
    g.traverse((obj) => {
      obj.castShadow = o > 0.5 && (obj as THREE.Mesh).isMesh
    })
  })
  return (
    <group ref={group} userData={{ noMerge: true }}>
      {children}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 燈光：燈籠、窗光、神明廳
// ---------------------------------------------------------------------------

function HouseLights() {
  const porch = useRef<THREE.PointLight>(null)
  const wings = useRef<THREE.PointLight[]>([])
  const quality = useStore((s) => s.quality)
  const warmC = useMemo(() => new THREE.Color('#ffc47a'), [])
  const fireC = useMemo(() => new THREE.Color('#ff8a3a'), [])
  useFrame(({ clock }) => {
    const l = lanternAt(useStore.getState().time)
    const t = clock.elapsedTime
    lanternMat.emissiveIntensity = 0.25 + 1.5 * l
    if (porch.current) porch.current.intensity = 5.5 * l
    for (const w of wings.current) if (w) w.intensity = 2.4 * l
    glowMats.warm.color.copy(warmC).multiplyScalar(0.15 + 1.35 * l)
    const flick = 0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07
    glowMats.fire.color.copy(fireC).multiplyScalar((0.2 + 1.4 * l) * flick)
  })
  const colTop = MAIN.ridgeY - (MAIN_PORCH.columnZ - MAIN_RIDGE_Z) * SLOPE - 0.2
  return (
    <group>
      <pointLight ref={porch} position={[0, colTop - 0.6, MAIN_PORCH.columnZ + 0.4]} color="#ffb35c" intensity={5} distance={11} decay={2} />
      {quality === 'high' &&
        ([1, -1] as const).map((side, i) => {
          const W = side === 1 ? WING_R : WING_L
          const x = (side === 1 ? W.x0 : W.x1) - side * (WING_PORCH - 0.3)
          return (
            <pointLight
              key={side}
              ref={(el) => {
                if (el) wings.current[i] = el
              }}
              position={[x, FLOOR_Y + 2.0, GUEST_DOOR_Z]}
              color="#ffb35c"
              intensity={2.4}
              distance={6}
              decay={2}
            />
          )
        })}
      {/* 神明廳的紅燈 */}
      <pointLight position={[0, FLOOR_Y + 2.2, MAIN_RIDGE_Z - 0.6]} color="#ff4a32" intensity={2.2} distance={6} decay={2} />
    </group>
  )
}
