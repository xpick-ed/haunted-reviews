import { useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { WBox, canvasTexture, seeded, useMats, windify } from './kit'
import { FENCE, FLOOR_Y, MAIN_PORCH, WING_L, WING_PORCH, WING_R, YARD } from './layout'
import { BambooWindow, Wall } from './House'

// 埕與院子裡的生活感：圍牆、門柱、盆栽、水缸、竹椅茶桌、曬衣竿、菜籃車、門外的機車。

const YARD_Y = 0.1

export function Yard() {
  return (
    <group>
      <Courtyard />
      <Fence />
      <TeaCorner position={[-3.6, YARD_Y, -0.9]} />
      <Pots />
      <WaterJar position={[-5.35, YARD_Y, 6.55]} />
      <Laundry />
      <Bicycle position={[4.4, YARD_Y, 7.18]} />
      <Scooter position={[2.9, 0.03, 9.1]} rotation={-0.35} />
      <Broom position={[WING_R.x0 - WING_PORCH + 0.25, FLOOR_Y, -1.75]} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 埕、圍牆、門柱
// ---------------------------------------------------------------------------

function Courtyard() {
  const x0 = WING_L.x1 + WING_PORCH + 0.2
  const x1 = WING_R.x0 - WING_PORCH - 0.2
  const front = WING_R.z1 + 0.45
  return (
    <group>
      <WBox mat="yard" size={[x1 - x0, YARD_Y, FENCE.z - YARD.z0]} position={[(x0 + x1) / 2, YARD_Y / 2, (YARD.z0 + FENCE.z) / 2]} castShadow={false} />
      {/* 護龍前、圍牆內的兩個角落 */}
      {[-1, 1].map((s) => (
        <WBox
          key={s}
          mat="yard"
          size={[WING_R.x1 + 0.45 - x1, YARD_Y, FENCE.z - front]}
          position={[s * ((WING_R.x1 + 0.45 + x1) / 2), YARD_Y / 2, (front + FENCE.z) / 2]}
          castShadow={false}
        />
      ))}
      {/* 排水溝 */}
      {[-1, 1].map((s) => (
        <mesh key={`d${s}`} position={[s * (x1 - 0.12), YARD_Y + 0.002, (MAIN_PORCH.z1 + WING_R.z1) / 2 + 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.16, WING_R.z1 - MAIN_PORCH.z1 + 0.4]} />
          <meshStandardMaterial color="#2a2a26" roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function Fence() {
  const mats = useMats()
  const top = FENCE.height
  const len = WING_R.x1 + 0.45 - (FENCE.gateHalf + 0.3)
  const globe = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffe2b0', toneMapped: false }), [])
  return (
    <group>
      {[-1, 1].map((s) => {
        const a = s * (FENCE.gateHalf + 0.3)
        const b = s * (WING_R.x1 + 0.45)
        const from = Math.min(a, b)
        const to = Math.max(a, b)
        const mid = (from + to) / 2
        const holes = [mid - len * 0.22, mid + len * 0.22]
        return (
          <group key={s}>
            <Wall
              axis="x"
              from={from}
              to={to}
              at={FENCE.z}
              base={0}
              top={top}
              thick={0.24}
              skirtH={0.4}
              openings={holes.map((c) => ({ c, w: 0.8, y0: 0.5, y1: 1.0 }))}
            />
            {holes.map((c) => (
              <BambooWindow key={c} facing="z" center={[c, 0.75, FENCE.z]} w={0.8} h={0.5} inward={-1} />
            ))}
            {/* 牆頂的瓦 */}
            <WBox mat="roof" size={[to - from + 0.1, 0.08, 0.46]} position={[mid, top + 0.04, FENCE.z]} />
            <WBox mat="ridge" size={[to - from + 0.1, 0.09, 0.14]} position={[mid, top + 0.12, FENCE.z]} />
          </group>
        )
      })}
      {/* 門柱與柱頭燈 */}
      {[-1, 1].map((s) => (
        <group key={`p${s}`} position={[s * (FENCE.gateHalf + 0.15), 0, FENCE.z]}>
          <WBox mat="brick" size={[0.5, 1.9, 0.5]} position={[0, 0.95, 0]} />
          <WBox mat="stone" size={[0.56, 0.4, 0.56]} position={[0, 0.2, 0]} />
          <WBox mat="stone" size={[0.62, 0.1, 0.62]} position={[0, 1.95, 0]} />
          <mesh position={[0, 2.12, 0]} material={mats.black}>
            <cylinderGeometry args={[0.07, 0.1, 0.12, 12]} />
          </mesh>
          <mesh position={[0, 2.3, 0]} material={globe}>
            <sphereGeometry args={[0.15, 20, 14]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 竹椅、茶桌
// ---------------------------------------------------------------------------

function BambooChair({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const mats = useMats()
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    const rod = (len: number, r = 0.02) => new THREE.CylinderGeometry(r, r, len, 7)
    // 四腳
    for (const [x, z, h] of [
      [-0.2, -0.2, 0.85],
      [0.2, -0.2, 0.85],
      [-0.2, 0.2, 0.4],
      [0.2, 0.2, 0.4],
    ])
      parts.push(rod(h, 0.024).translate(x, h / 2, z))
    // 座面竹片
    for (let i = 0; i < 7; i++) parts.push(rod(0.44, 0.018).rotateX(Math.PI / 2).translate(-0.18 + i * 0.06, 0.4, 0))
    // 橫撐
    for (const y of [0.15, 0.4]) {
      parts.push(rod(0.42, 0.015).rotateZ(Math.PI / 2).translate(0, y, -0.2))
      parts.push(rod(0.42, 0.015).rotateZ(Math.PI / 2).translate(0, y, 0.2))
    }
    // 椅背
    for (const y of [0.62, 0.8]) parts.push(rod(0.42, 0.016).rotateZ(Math.PI / 2).translate(0, y, -0.2))
    for (let i = 0; i < 5; i++) parts.push(rod(0.4, 0.012).translate(-0.14 + i * 0.07, 0.62, -0.2))
    return mergeAll(parts)
  }, [])
  return <mesh geometry={geo} material={mats.bamboo} position={position} rotation={[0, rotation, 0]} castShadow receiveShadow />
}

function TeaCorner({ position }: { position: [number, number, number] }) {
  const mats = useMats()
  const teapot = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          [0, 0],
          [0.06, 0],
          [0.085, 0.04],
          [0.085, 0.08],
          [0.06, 0.11],
          [0.03, 0.12],
          [0.035, 0.135],
          [0, 0.14],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        20,
      ),
    [],
  )
  return (
    <group position={position}>
      <BambooChair position={[-0.75, 0, 0.1]} rotation={0.9} />
      <BambooChair position={[0.75, 0, 0.2]} rotation={-0.8} />
      {/* 矮圓桌 */}
      <mesh position={[0, 0.42, 0]} material={mats.bamboo} castShadow receiveShadow>
        <cylinderGeometry args={[0.36, 0.36, 0.04, 28]} />
      </mesh>
      <mesh position={[0, 0.2, 0]} material={mats.bamboo} castShadow>
        <cylinderGeometry args={[0.05, 0.14, 0.4, 10]} />
      </mesh>
      <mesh geometry={teapot} material={mats.ceramic} position={[0.05, 0.44, 0]} castShadow />
      <mesh material={mats.ceramic} position={[0.14, 0.52, 0]} rotation={[0, 0, -0.8]}>
        <cylinderGeometry args={[0.01, 0.015, 0.1, 6]} />
      </mesh>
      {[
        [-0.15, 0.1],
        [-0.12, -0.14],
        [0.18, -0.12],
      ].map(([x, z], i) => (
        <mesh key={i} material={mats.trim} position={[x, 0.465, z]} castShadow>
          <cylinderGeometry args={[0.03, 0.022, 0.045, 12]} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 盆栽
// ---------------------------------------------------------------------------

const POT_PROFILE = [
  [0, 0],
  [0.8, 0],
  [0.84, 0.08],
  [1.0, 0.82],
  [1.08, 0.86],
  [1.08, 1.0],
  [0.94, 1.0],
  [0.9, 0.9],
  [0, 0.9],
].map(([x, y]) => new THREE.Vector2(x, y))
const potGeo = new THREE.LatheGeometry(POT_PROFILE, 22)

const soilMat = new THREE.MeshStandardMaterial({ color: '#3a2a1e', roughness: 1 })
const leafMats = ['#3f6f39', '#56823e', '#2f5a34', '#6b8f3a'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, flatShading: true }))
const flowerMats = ['#ff7aa0', '#ffd24a', '#ffffff', '#e0405a'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }))

function Plant({ kind, seed }: { kind: number; seed: number }) {
  const r = seeded(seed)
  if (kind === 0) {
    // 灌木型：幾顆低面數球
    return (
      <group>
        {Array.from({ length: 5 }, (_, i) => (
          <mesh key={i} material={leafMats[i % 3]} position={[(r() - 0.5) * 0.5, 0.95 + r() * 0.45, (r() - 0.5) * 0.5]} castShadow>
            <icosahedronGeometry args={[0.28 + r() * 0.12, 0]} />
          </mesh>
        ))}
      </group>
    )
  }
  if (kind === 1) {
    // 虎尾蘭：直立的長葉
    return (
      <group>
        {Array.from({ length: 7 }, (_, i) => (
          <mesh
            key={i}
            material={leafMats[3 - (i % 2)]}
            position={[(r() - 0.5) * 0.4, 1.3 + r() * 0.2, (r() - 0.5) * 0.4]}
            rotation={[(r() - 0.5) * 0.3, r() * 3, (r() - 0.5) * 0.3]}
            scale={[1, 1 + r() * 0.5, 0.35]}
            castShadow
          >
            <coneGeometry args={[0.12, 1.0, 4]} />
          </mesh>
        ))}
      </group>
    )
  }
  // 開花的：綠球加花點
  return (
    <group>
      <mesh material={leafMats[1]} position={[0, 1.05, 0]} castShadow>
        <icosahedronGeometry args={[0.45, 1]} />
      </mesh>
      {Array.from({ length: 14 }, (_, i) => {
        const a = r() * Math.PI * 2
        const b = r() * Math.PI * 0.5
        return (
          <mesh key={i} material={flowerMats[seed % flowerMats.length]} position={[Math.cos(a) * Math.cos(b) * 0.45, 1.05 + Math.sin(b) * 0.45, Math.sin(a) * Math.cos(b) * 0.45]}>
            <sphereGeometry args={[0.06, 8, 6]} />
          </mesh>
        )
      })}
    </group>
  )
}

function Pots() {
  const mats = useMats()
  const pots = useMemo(() => {
    const r = seeded(21)
    const xs = [-4.4, -3.75, -3.1, -2.45, 2.55, 3.2]
    return xs.map((x, i) => ({ x: x + (r() - 0.5) * 0.12, z: FENCE.z - 0.42 - r() * 0.1, s: 0.24 + r() * 0.12, kind: i % 3, seed: 30 + i }))
  }, [])
  return (
    <group>
      {pots.map((p, i) => (
        <group key={i} position={[p.x, YARD_Y, p.z]} scale={p.s}>
          <mesh geometry={potGeo} material={mats.terracotta} castShadow receiveShadow />
          <mesh position={[0, 0.88, 0]} rotation={[-Math.PI / 2, 0, 0]} material={soilMat}>
            <circleGeometry args={[0.93, 20]} />
          </mesh>
          <Plant kind={p.kind} seed={p.seed} />
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 水缸
// ---------------------------------------------------------------------------

function WaterJar({ position }: { position: [number, number, number] }) {
  const mats = useMats()
  const geo = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          [0, 0],
          [0.26, 0],
          [0.36, 0.12],
          [0.42, 0.38],
          [0.4, 0.58],
          [0.34, 0.68],
          [0.36, 0.72],
          [0.32, 0.72],
          [0.3, 0.66],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        28,
      ),
    [],
  )
  const water = useMemo(() => new THREE.MeshStandardMaterial({ color: '#15222a', roughness: 0.05, metalness: 0.2 }), [])
  return (
    <group position={position}>
      <mesh geometry={geo} material={mats.ceramic} castShadow receiveShadow />
      <mesh position={[0, 0.62, 0]} rotation={[-Math.PI / 2, 0, 0]} material={water}>
        <circleGeometry args={[0.31, 28]} />
      </mesh>
      {/* 水瓢 */}
      <mesh position={[0.12, 0.66, 0.05]} rotation={[0.2, 0, 0.3]} material={mats.bamboo}>
        <sphereGeometry args={[0.09, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
      </mesh>
      <mesh position={[0.3, 0.74, 0.05]} rotation={[0, 0, -1.1]} material={mats.bamboo}>
        <cylinderGeometry args={[0.012, 0.012, 0.36, 6]} />
      </mesh>
      {/* 旁邊的小板凳 */}
      <group position={[0.7, 0, -0.2]} rotation={[0, 0.4, 0]}>
        <WBox mat="wood" size={[0.42, 0.05, 0.22]} position={[0, 0.3, 0]} />
        {[-0.15, 0.15].map((x) => (
          <WBox key={x} mat="wood" size={[0.04, 0.28, 0.2]} position={[x, 0.14, 0]} />
        ))}
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 曬衣竿（衣服會隨風擺）
// ---------------------------------------------------------------------------

function garmentTexture(kind: 'shirt' | 'towel' | 'pants', color: string, pattern?: 'stripe' | 'floral') {
  return canvasTexture(128, 160, (ctx, w, h) => {
    ctx.beginPath()
    if (kind === 'shirt') {
      ctx.moveTo(w * 0.32, 0)
      ctx.lineTo(w * 0.68, 0)
      ctx.lineTo(w, h * 0.12)
      ctx.lineTo(w * 0.9, h * 0.34)
      ctx.lineTo(w * 0.78, h * 0.28)
      ctx.lineTo(w * 0.78, h)
      ctx.lineTo(w * 0.22, h)
      ctx.lineTo(w * 0.22, h * 0.28)
      ctx.lineTo(w * 0.1, h * 0.34)
      ctx.lineTo(0, h * 0.12)
    } else if (kind === 'pants') {
      ctx.moveTo(w * 0.12, 0)
      ctx.lineTo(w * 0.88, 0)
      ctx.lineTo(w * 0.95, h)
      ctx.lineTo(w * 0.56, h)
      ctx.lineTo(w * 0.5, h * 0.35)
      ctx.lineTo(w * 0.44, h)
      ctx.lineTo(w * 0.05, h)
    } else {
      ctx.rect(w * 0.1, 0, w * 0.8, h * 0.9)
    }
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    ctx.save()
    ctx.clip()
    if (pattern === 'stripe') {
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      for (let y = 8; y < h; y += 18) ctx.fillRect(0, y, w, 7)
    }
    if (pattern === 'floral') {
      const r = seeded(3)
      for (let i = 0; i < 26; i++) {
        const x = r() * w
        const y = r() * h
        ctx.fillStyle = ['#ffd1dc', '#fff4b0', '#ffffff'][i % 3]
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2
          ctx.beginPath()
          ctx.arc(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3.2, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = '#e8a33a'
        ctx.beginPath()
        ctx.arc(x, y, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    // 衣架夾子的陰影
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    ctx.fillRect(0, 0, w, 6)
    ctx.restore()
  })
}

function Laundry() {
  const mats = useMats()
  const x0 = -4.9
  const x1 = -1.9
  const z = 3.9
  const poleY = 2.0
  const items = useMemo(() => {
    const defs: { x: number; w: number; h: number; tex: THREE.Texture }[] = [
      { x: -4.45, w: 0.62, h: 0.78, tex: garmentTexture('shirt', '#f4f1ea') },
      { x: -3.7, w: 0.55, h: 0.9, tex: garmentTexture('pants', '#7a3fa0', 'floral') },
      { x: -3.0, w: 0.62, h: 0.78, tex: garmentTexture('shirt', '#3f6fae', 'stripe') },
      { x: -2.35, w: 0.42, h: 0.62, tex: garmentTexture('towel', '#f29bb5') },
    ]
    return defs.map((d) => {
      const geo = new THREE.PlaneGeometry(d.w, d.h, 6, 8).translate(0, -d.h / 2, 0)
      const mat = windify(new THREE.MeshStandardMaterial({ map: d.tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95 }), 0.28, -1)
      return { ...d, geo, mat }
    })
  }, [])
  return (
    <group>
      {/* X 形竹架 */}
      {[x0, x1].map((x) => (
        <group key={x} position={[x, YARD_Y, z]}>
          {[-1, 1].map((s) => (
            <mesh key={s} material={mats.bamboo} position={[0, poleY / 2, 0]} rotation={[s * 0.32, 0, 0]} castShadow>
              <cylinderGeometry args={[0.025, 0.03, poleY * 1.1, 7]} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh material={mats.bamboo} position={[(x0 + x1) / 2, YARD_Y + poleY, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, x1 - x0 + 0.6, 8]} />
      </mesh>
      <group userData={{ noMerge: true }}>
        {items.map((it, i) => (
          <mesh key={i} geometry={it.geo} material={it.mat} position={[it.x, YARD_Y + poleY - 0.02, z]} rotation={[0, 0.15, 0]} castShadow />
        ))}
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 菜籃車、機車、掃把
// ---------------------------------------------------------------------------

const tireMat = new THREE.MeshStandardMaterial({ color: '#1b1b1d', roughness: 0.8 })
const bikeMat = new THREE.MeshStandardMaterial({ color: '#2f7f94', roughness: 0.35, metalness: 0.4 })
const chromeMat = new THREE.MeshStandardMaterial({ color: '#c9ccd2', roughness: 0.2, metalness: 0.9 })
const scooterMat = new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: 0.3, metalness: 0.1 })
const seatMat = new THREE.MeshStandardMaterial({ color: '#3a2a24', roughness: 0.6 })
const lampMat = new THREE.MeshBasicMaterial({ color: '#fff6e0', toneMapped: false })

function tube(a: THREE.Vector3, b: THREE.Vector3, r: number) {
  const len = a.distanceTo(b)
  const g = new THREE.CylinderGeometry(r, r, len, 8)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  g.applyQuaternion(q)
  const mid = a.clone().add(b).multiplyScalar(0.5)
  g.translate(mid.x, mid.y, mid.z)
  return g
}

function Wheel({ position, r = 0.33 }: { position: [number, number, number]; r?: number }) {
  const spokes = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      parts.push(tube(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92, 0), 0.004))
    }
    return mergeAll(parts)
  }, [r])
  return (
    <group position={position}>
      <mesh material={tireMat} castShadow>
        <torusGeometry args={[r, 0.028, 8, 36]} />
      </mesh>
      <mesh material={chromeMat}>
        <torusGeometry args={[r * 0.93, 0.008, 6, 36]} />
      </mesh>
      <mesh geometry={spokes} material={chromeMat} />
    </group>
  )
}

function Bicycle({ position }: { position: [number, number, number] }) {
  const V = (x: number, y: number) => new THREE.Vector3(x, y, 0)
  const frame = useMemo(() => {
    const rearHub = V(-0.5, 0.33)
    const frontHub = V(0.52, 0.33)
    const crank = V(-0.05, 0.3)
    const seat = V(-0.18, 0.82)
    const head = V(0.38, 0.88)
    return mergeAll([
      tube(rearHub, crank, 0.016),
      tube(rearHub, seat, 0.016),
      tube(crank, seat, 0.02),
      tube(crank, head.clone().add(V(-0.02, -0.12)), 0.02), // 菜籃車是低跨的斜管
      tube(head, frontHub, 0.018),
      tube(seat, V(-0.2, 0.92), 0.014),
      tube(head, V(0.34, 1.02), 0.014),
    ])
  }, [])
  const mats = useMats()
  return (
    <group position={position} rotation={[0.1, Math.PI, 0]}>
      <Wheel position={[-0.5, 0.33, 0]} />
      <Wheel position={[0.52, 0.33, 0]} />
      <mesh geometry={frame} material={bikeMat} castShadow />
      <mesh material={seatMat} position={[-0.2, 0.95, 0]} castShadow>
        <boxGeometry args={[0.24, 0.06, 0.13]} />
      </mesh>
      <mesh material={chromeMat} position={[0.33, 1.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.5, 6]} />
      </mesh>
      {/* 菜籃 */}
      <mesh material={mats.bamboo} position={[0.56, 0.95, 0]} castShadow>
        <boxGeometry args={[0.3, 0.2, 0.34]} />
      </mesh>
    </group>
  )
}

function Scooter({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0.06]}>
      <Wheel position={[-0.55, 0.22, 0]} r={0.2} />
      <Wheel position={[0.6, 0.22, 0]} r={0.2} />
      {/* 車身、踏板、前擋、坐墊、龍頭 */}
      <RoundedBox args={[0.7, 0.36, 0.38]} radius={0.12} smoothness={3} position={[-0.32, 0.5, 0]} material={scooterMat} castShadow />
      <RoundedBox args={[0.55, 0.08, 0.32]} radius={0.03} smoothness={2} position={[0.15, 0.3, 0]} material={seatMat} castShadow />
      <RoundedBox args={[0.16, 0.66, 0.36]} radius={0.06} smoothness={3} position={[0.5, 0.62, 0]} rotation={[0, 0, -0.25]} material={scooterMat} castShadow />
      <RoundedBox args={[0.62, 0.1, 0.3]} radius={0.05} smoothness={3} position={[-0.3, 0.74, 0]} material={seatMat} castShadow />
      <mesh material={chromeMat} position={[0.55, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.58, 6]} />
      </mesh>
      <mesh material={lampMat} position={[0.63, 0.92, 0]}>
        <sphereGeometry args={[0.055, 12, 10]} />
      </mesh>
      {/* 安全帽掛在龍頭上 */}
      <mesh position={[0.55, 1.02, 0.25]} castShadow>
        <sphereGeometry args={[0.13, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.8]} />
        <meshStandardMaterial color="#e84a3a" roughness={0.3} />
      </mesh>
    </group>
  )
}

function Broom({ position }: { position: [number, number, number] }) {
  const mats = useMats()
  return (
    <group position={position} rotation={[0, 0.3, 0.22]}>
      <mesh material={mats.bamboo} position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 1.2, 6]} />
      </mesh>
      <mesh material={mats.bamboo} position={[0, 0.2, 0]} castShadow>
        <coneGeometry args={[0.2, 0.45, 12, 1, true]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------

function mergeAll(parts: THREE.BufferGeometry[]) {
  const nonIndexed = parts.map((p) => (p.index ? p.toNonIndexed() : p))
  const out = mergeGeometriesSafe(nonIndexed)
  parts.forEach((p) => p.dispose())
  return out
}

function mergeGeometriesSafe(parts: THREE.BufferGeometry[]) {
  return mergeGeometries(parts) ?? new THREE.BufferGeometry()
}
