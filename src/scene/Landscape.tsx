import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useStore } from '../store'
import { lanternAt, makeDaylight, sampleDaylight } from './daylight'
import { boxGeo, canvasTexture, planeGeo, seeded, TILE, useMats, windify } from './kit'
import { COMPOUND, FENCE, ROAD } from './layout'
import { BambooGrove, BananaTrees, MeshBuilder, taperTube } from './Plants'
import { Tree } from './Tree'

// 三合院外面的一切：草地、鄉間小路、水溝、水田（倒影）、秧苗、電線桿與路燈、
// 遠山、香蕉樹、竹叢、老榕樹、草、夜霧、螢火蟲。

type Quality = 'high' | 'low'

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

/** 路對面的水溝（兩道矮牆，中間有水） */
const DITCH = { z0: 13.45, z1: 14.05 }
/** 電線桿立在路與水溝之間 */
const POLE_Z = ROAD.z + ROAD.width / 2 + 0.25
/**
 * 電線從左邊（西）沿路過來，在大門左邊那根終端桿結束（有拉線）。
 * 鏡頭在 +x +z，右半邊的桿子會擋在鏡頭跟房子中間，所以不放。
 */
const POLE_XS = [-50.5, -34.5, -18.5, -2.5]
const LAMP_X = -2.5
const TRANSFORMER_X = -18.5
const POLE_H = 9.2
const ARM_Y = 8.45
/** 路燈亮度：燈頭離地約 7m，decay 2，這個值讓正下方大約 0.6 lux，看得出一圈光 */
const STREET_LAMP_INTENSITY = 16
const LAMP_POS = new THREE.Vector3(LAMP_X, 7.05, ROAD.z + 0.5)

/** 水田：每組用田埂的位置描述（xs、zs 是田埂中心線） */
interface PaddyGroup {
  xs: number[]
  zs: number[]
}
const PADDIES: PaddyGroup[] = [
  // 路對面
  { xs: [-48, -35, -22, -9, 4, 17, 30, 43, 56], zs: [14.4, 23.4, 32.4, 44] },
  // 左邊（榕樹再過去）
  { xs: [-62, -48, -34.5, -21], zs: [-44, -31, -18, -5, 8.8] },
  // 後面（竹叢再過去）
  { xs: [-20.5, -8, 5, 18, 31, 44, 62], zs: [-46, -32, -18] },
  // 右邊
  { xs: [24, 36.5, 49, 62], zs: [-17.5, -4.4, 8.8] },
]
const WATER_Y = 0.06
const BANK = { w: 0.5, h: 0.3, top: 0.25 }

const inRect = (x: number, z: number, g: PaddyGroup, m = 0) =>
  x > g.xs[0] - m && x < g.xs[g.xs.length - 1] + m && z > g.zs[0] - m && z < g.zs[g.zs.length - 1] + m

/** 某一點地上是什麼：草地、田埂上、或不能放東西 */
function groundAt(x: number, z: number): 'grass' | 'bank' | null {
  if (x > COMPOUND.x0 - 0.2 && x < COMPOUND.x1 + 0.2 && z > COMPOUND.z0 - 0.2 && z < COMPOUND.z1 + 0.2) return null
  if (z > ROAD.z - ROAD.width / 2 - 0.15 && z < DITCH.z1 + 0.15) return null
  if (Math.abs(x) < FENCE.gateHalf + 0.25 && z > FENCE.z - 0.1 && z < ROAD.z) return null
  for (const g of PADDIES) {
    if (!inRect(x, z, g, BANK.w / 2)) continue
    for (const bx of g.xs) if (Math.abs(x - bx) < BANK.w / 2 - 0.05) return 'bank'
    for (const bz of g.zs) if (Math.abs(z - bz) < BANK.w / 2 - 0.05) return 'bank'
    return null
  }
  return 'grass'
}

// ---------------------------------------------------------------------------
// 路、門前小路、水溝
// ---------------------------------------------------------------------------

function buildRoad() {
  const parts: THREE.BufferGeometry[] = []
  const add = (w: number, h: number, d: number, x: number, y: number, z: number) =>
    parts.push(boxGeo(w, h, d, TILE.yard).clone().translate(x, y, z))
  add(180, 0.06, ROAD.width, 0, 0, ROAD.z)
  const pathLen = ROAD.z - ROAD.width / 2 - FENCE.z
  add(FENCE.gateHalf * 2, 0.07, pathLen + 0.1, 0, 0, FENCE.z + pathLen / 2)
  add(180, 0.3, 0.1, 0, 0.12, DITCH.z0)
  add(180, 0.3, 0.1, 0, 0.12, DITCH.z1)
  return mergeGeometries(parts)
}

// ---------------------------------------------------------------------------
// 水田：田埂（泥土＋草皮頂）、水面、秧苗
// ---------------------------------------------------------------------------

function buildBanks() {
  const body: THREE.BufferGeometry[] = []
  const top: THREE.BufferGeometry[] = []
  for (const g of PADDIES) {
    const x0 = g.xs[0]
    const x1 = g.xs[g.xs.length - 1]
    const z0 = g.zs[0]
    const z1 = g.zs[g.zs.length - 1]
    // 直的田埂比橫的高一點點，交叉處才不會閃
    for (const x of g.xs) {
      const len = z1 - z0 + BANK.w
      body.push(boxGeo(BANK.w, BANK.h, len, TILE.mud).clone().translate(x, BANK.top - BANK.h / 2 + 0.005, (z0 + z1) / 2))
      top.push(planeGeo(BANK.w, len, TILE.grass).clone().rotateX(-Math.PI / 2).translate(x, BANK.top + 0.008, (z0 + z1) / 2))
    }
    for (const z of g.zs) {
      const len = x1 - x0 + BANK.w
      body.push(boxGeo(len, BANK.h, BANK.w, TILE.mud).clone().translate((x0 + x1) / 2, BANK.top - BANK.h / 2, z))
      top.push(planeGeo(len, BANK.w, TILE.grass).clone().rotateX(-Math.PI / 2).translate((x0 + x1) / 2, BANK.top + 0.003, z))
    }
  }
  return { body: mergeGeometries(body), top: mergeGeometries(top) }
}

/** 所有水面合成一片（XY 平面，mesh 轉 -90° 後 local y = -world z），反射只多算一次 */
function buildWater() {
  const parts = PADDIES.map((g) => {
    const x0 = g.xs[0]
    const x1 = g.xs[g.xs.length - 1]
    const z0 = g.zs[0]
    const z1 = g.zs[g.zs.length - 1]
    return new THREE.PlaneGeometry(x1 - x0, z1 - z0).translate((x0 + x1) / 2, -(z0 + z1) / 2, 0)
  })
  return mergeGeometries(parts)
}

/** 一根細長漸尖的葉片（草、秧苗共用），高度 h、底寬 w、往前彎 bend */
function addBlade(b: MeshBuilder, m: THREE.Matrix4, h: number, w: number, bend: number, base: THREE.Color, tip: THREE.Color) {
  const levels = [0, 0.35, 0.7, 1]
  const widths = [1, 0.78, 0.45, 0.06]
  const n = new THREE.Vector3(0, 1, 0)
  const p = new THREE.Vector3()
  const ids: number[] = []
  for (let i = 0; i < levels.length; i++) {
    const t = levels[i]
    const c = base.clone().lerp(tip, t)
    for (const s of [-1, 1]) {
      p.set((s * w * widths[i]) / 2, h * t, bend * t * t).applyMatrix4(m)
      ids.push(b.vert(p, n, (s + 1) / 2, t, c))
    }
  }
  for (let i = 0; i < levels.length - 1; i++) {
    const a = ids[i * 2]
    const bb = ids[i * 2 + 1]
    const c = ids[i * 2 + 3]
    const d = ids[i * 2 + 2]
    b.idx.push(a, bb, c, a, c, d)
  }
}

function seedlingGeometry() {
  const b = new MeshBuilder()
  const m = new THREE.Matrix4()
  const base = new THREE.Color('#2f5a22')
  const tip = new THREE.Color('#8fc052')
  for (let k = 0; k < 3; k++) {
    m.makeRotationY((k / 3) * Math.PI * 2).multiply(new THREE.Matrix4().makeRotationX(0.28))
    addBlade(b, m, 0.3, 0.028, 0.05, base, tip)
  }
  return b.build()
}

function grassGeometry() {
  const b = new MeshBuilder()
  addBlade(b, new THREE.Matrix4(), 1, 0.055, 0.18, new THREE.Color('#2b4721'), new THREE.Color('#a3bd66'))
  return b.build()
}

function makeInstanced(geo: THREE.BufferGeometry, mat: THREE.Material, matrices: THREE.Matrix4[], colors: THREE.Color[]) {
  const mesh = new THREE.InstancedMesh(geo, mat, matrices.length)
  matrices.forEach((m, i) => {
    mesh.setMatrixAt(i, m)
    mesh.setColorAt(i, colors[i])
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.computeBoundingSphere()
  return mesh
}

/** 二月是插秧季：大部分田插了秧，少數還是一片水（倒影最漂亮） */
function buildSeedlings(quality: Quality) {
  const r = seeded(4242)
  const budget = quality === 'high' ? 9000 : 3000
  const spacing = quality === 'high' ? 0.42 : 0.6
  const plots: { x0: number; x1: number; z0: number; z1: number; d: number }[] = []
  for (const g of PADDIES) {
    for (let i = 0; i < g.xs.length - 1; i++) {
      for (let j = 0; j < g.zs.length - 1; j++) {
        const x0 = g.xs[i] + 0.45
        const x1 = g.xs[i + 1] - 0.45
        const z0 = g.zs[j] + 0.45
        const z1 = g.zs[j + 1] - 0.45
        const open = r() < 0.3
        if (!open) plots.push({ x0, x1, z0, z1, d: Math.hypot((x0 + x1) / 2, (z0 + z1) / 2) })
      }
    }
  }
  plots.sort((a, b) => a.d - b.d)
  const matrices: THREE.Matrix4[] = []
  const colors: THREE.Color[] = []
  const q = new THREE.Quaternion()
  const s = new THREE.Vector3()
  const p = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  for (const pl of plots) {
    if (matrices.length >= budget) break
    // 秧苗一行行排整齊，行的方向跟田的長邊一樣
    for (let x = pl.x0; x <= pl.x1 && matrices.length < budget; x += spacing) {
      for (let z = pl.z0; z <= pl.z1 && matrices.length < budget; z += spacing) {
        p.set(x + (r() - 0.5) * 0.06, WATER_Y - 0.02, z + (r() - 0.5) * 0.06)
        q.setFromAxisAngle(up, r() * Math.PI * 2)
        const k = 0.8 + r() * 0.45
        s.set(k, k, k)
        matrices.push(new THREE.Matrix4().compose(p, q, s))
        colors.push(new THREE.Color().setHSL(0.25 + (r() - 0.5) * 0.03, 0.5, 0.45 + r() * 0.15))
      }
    }
  }
  const mat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }), 0.5)
  return makeInstanced(seedlingGeometry(), mat, matrices, colors)
}

// ---------------------------------------------------------------------------
// 草與野花
// ---------------------------------------------------------------------------

function buildGrass(quality: Quality) {
  const r = seeded(9001)
  const count = quality === 'high' ? 7000 : 2000
  const matrices: THREE.Matrix4[] = []
  const colors: THREE.Color[] = []
  const flowers: THREE.Matrix4[] = []
  const flowerCols: THREE.Color[] = []
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const FLOWER = ['#f3a3c1', '#f4f1e6', '#f2d06b', '#b89be0']
  const flowerCount = quality === 'high' ? 360 : 120
  let tries = 0
  while (matrices.length < count && tries < count * 12) {
    tries++
    // 越靠近三合院越密
    const a = r() * Math.PI * 2
    const rad = 10.5 + 30 * Math.pow(r(), 1.3)
    const x = Math.cos(a) * rad * 1.15
    const z = Math.sin(a) * rad * 0.95
    const g = groundAt(x, z)
    if (!g || (g === 'bank' && r() < 0.6)) continue
    const y = g === 'bank' ? BANK.top : 0
    const h = g === 'bank' ? 0.18 + r() * 0.2 : 0.22 + r() * 0.35
    q.setFromAxisAngle(up, r() * Math.PI * 2)
    matrices.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(0.8 + r() * 0.5, h, 1)))
    colors.push(new THREE.Color().setHSL(0.22 + (r() - 0.5) * 0.06, 0.35 + r() * 0.2, 0.42 + r() * 0.2))
    // 野花一叢一叢長
    if (flowers.length < flowerCount && g === 'grass' && r() < 0.03) {
      const col = new THREE.Color(FLOWER[Math.floor(r() * FLOWER.length)])
      const n = 6 + Math.floor(r() * 9)
      for (let i = 0; i < n && flowers.length < flowerCount; i++) {
        const fx = x + (r() - 0.5) * 1.2
        const fz = z + (r() - 0.5) * 1.2
        if (groundAt(fx, fz) !== 'grass') continue
        const k = 0.8 + r() * 0.5
        flowers.push(new THREE.Matrix4().compose(new THREE.Vector3(fx, 0.16 + r() * 0.16, fz), new THREE.Quaternion(), new THREE.Vector3(k, k, k)))
        flowerCols.push(col.clone().offsetHSL(0, 0, (r() - 0.5) * 0.1))
      }
    }
  }
  const grassMat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 }), 0.08)
  const grass = makeInstanced(grassGeometry(), grassMat, matrices, colors)
  grass.receiveShadow = true
  const flowerMat = new THREE.MeshStandardMaterial({ roughness: 0.7 })
  const flowerMesh = makeInstanced(new THREE.IcosahedronGeometry(0.045, 0), flowerMat, flowers, flowerCols)
  return { grass, flowers: flowerMesh }
}

// ---------------------------------------------------------------------------
// 電線桿、電線、變壓器、路燈
// ---------------------------------------------------------------------------

function catenary(a: THREE.Vector3, b: THREE.Vector3, sag: number, n = 14) {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    pts.push(a.clone().lerp(b, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0)))
  }
  return pts
}

function buildPoles() {
  const concrete = new MeshBuilder()
  const white = new MeshBuilder()
  const wires = new MeshBuilder()
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const one = new THREE.Vector3(1, 1, 1)
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  const poleCol = new THREE.Color('#9a968d')
  const steel = new THREE.Color('#5d6167')
  const wireCol = new THREE.Color('#17181b')
  const pole = new THREE.CylinderGeometry(0.11, 0.16, POLE_H, 9)
  const arm = new THREE.BoxGeometry(0.1, 0.1, 1.8)
  const brace = new THREE.BoxGeometry(0.05, 0.05, 0.9)
  const insulator = new THREE.CylinderGeometry(0.045, 0.06, 0.16, 7)
  const OFFS = [-0.7, 0, 0.7]

  for (const x of POLE_XS) {
    m.makeTranslation(x, POLE_H / 2 - 0.1, POLE_Z)
    concrete.add(pole, m, poleCol)
    m.makeTranslation(x, ARM_Y, POLE_Z)
    concrete.add(arm, m, steel)
    for (const s of [-1, 1]) {
      q.setFromEuler(new THREE.Euler(s * 0.75, 0, 0))
      m.compose(V(x, ARM_Y - 0.3, POLE_Z + s * 0.3), q, one)
      concrete.add(brace, m, steel)
    }
    for (const o of OFFS) {
      m.makeTranslation(x, ARM_Y + 0.13, POLE_Z + o)
      white.add(insulator, m, new THREE.Color('#e9e6dc'))
    }
    // 電信線的掛鉤
    m.makeTranslation(x, 7.0, POLE_Z - 0.16)
    white.add(insulator, m, new THREE.Color('#e9e6dc'))
  }
  // 變壓器（台電的灰色桶子）
  m.makeTranslation(TRANSFORMER_X + 0.38, 6.6, POLE_Z)
  concrete.add(new THREE.CylinderGeometry(0.3, 0.3, 0.85, 14), m, new THREE.Color('#8e949a'))
  m.makeTranslation(TRANSFORMER_X + 0.38, 7.06, POLE_Z)
  concrete.add(new THREE.CylinderGeometry(0.32, 0.3, 0.08, 14), m, steel)
  m.makeTranslation(TRANSFORMER_X + 0.18, 6.6, POLE_Z)
  concrete.add(new THREE.BoxGeometry(0.16, 0.5, 0.12), m, steel)

  // 電線：每兩根桿子之間三條高壓線＋一條電信線
  for (let i = 0; i < POLE_XS.length - 1; i++) {
    const x0 = POLE_XS[i]
    const x1 = POLE_XS[i + 1]
    for (const o of OFFS) {
      const pts = catenary(V(x0, ARM_Y + 0.2, POLE_Z + o), V(x1, ARM_Y + 0.2, POLE_Z + o), 0.55)
      wires.add(taperTube(pts, 0.022, 0.022, 14, 4), null, wireCol)
    }
    const pts = catenary(V(x0, 7.0, POLE_Z - 0.2), V(x1, 7.0, POLE_Z - 0.2), 0.8)
    wires.add(taperTube(pts, 0.03, 0.03, 14, 4), null, wireCol)
  }
  // 終端桿的拉線（下面套黃黑相間的護套）
  const lastX = POLE_XS[POLE_XS.length - 1]
  const anchor = V(lastX + 3.4, 0, POLE_Z + 0.1)
  const guyTop = V(lastX, ARM_Y - 0.4, POLE_Z)
  wires.add(taperTube([guyTop, anchor], 0.02, 0.02, 2, 4), null, wireCol)
  const guard = new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8)
  const guyDir = anchor.clone().sub(guyTop).normalize()
  q.setFromUnitVectors(V(0, 1, 0), guyDir)
  const guardC = anchor.clone().addScaledVector(guyDir, -0.95)
  m.compose(guardC, q, one)
  white.add(guard, m, (p) => (Math.floor((p.y + 10) * 4) % 2 ? new THREE.Color('#e8c31e') : new THREE.Color('#1c1c1c')))

  // 路燈：從桿子伸出一根彎管到路的上方
  const armPts = [V(LAMP_X, 6.85, POLE_Z - 0.1), V(LAMP_X, 7.3, POLE_Z - 0.7), V(LAMP_X, 7.35, LAMP_POS.z + 0.2)]
  concrete.add(taperTube(armPts, 0.05, 0.04, 10, 6), null, steel)
  m.compose(V(LAMP_X, LAMP_POS.y + 0.2, LAMP_POS.z), new THREE.Quaternion(), one)
  concrete.add(new THREE.BoxGeometry(0.3, 0.12, 0.6), m, new THREE.Color('#44484e'))

  return { concrete: concrete.build(), white: white.build(), wires: wires.build() }
}

/** 路燈光錐：上亮下透明 */
function coneTexture() {
  const t = canvasTexture(8, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, 'rgba(255,200,130,0.9)')
    g.addColorStop(0.35, 'rgba(255,190,120,0.35)')
    g.addColorStop(1, 'rgba(255,180,110,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
  return t
}

// ---------------------------------------------------------------------------
// 遠山
// ---------------------------------------------------------------------------

function buildHills() {
  const r = seeded(314)
  const b = new MeshBuilder()
  const layers = [
    { rad: 78, h0: 6, h1: 13, col: '#2a3830' },
    { rad: 100, h0: 10, h1: 19, col: '#2e3a48' },
    { rad: 126, h0: 14, h1: 26, col: '#36425a' },
  ]
  const n = new THREE.Vector3(0, 1, 0)
  const p = new THREE.Vector3()
  const a0 = THREE.MathUtils.degToRad(140)
  const a1 = THREE.MathUtils.degToRad(318)
  const N = 90
  for (const L of layers) {
    const ph = [r() * 6.28, r() * 6.28, r() * 6.28]
    const base = new THREE.Color(L.col)
    const rows: number[][] = [[], [], []]
    for (let i = 0; i <= N; i++) {
      const a = a0 + ((a1 - a0) * i) / N
      const mid = (L.h0 + L.h1) / 2
      const amp = (L.h1 - L.h0) / 2
      const h = mid + amp * (0.55 * Math.sin(a * 3 + ph[0]) + 0.3 * Math.sin(a * 7 + ph[1]) + 0.15 * Math.sin(a * 17 + ph[2])) + (r() - 0.5) * 1.2
      const dir = [Math.cos(a), Math.sin(a)]
      const ring = (rad: number, y: number, k: number) => {
        p.set(dir[0] * rad, y, dir[1] * rad)
        return b.vert(p, n, 0, 0, base.clone().multiplyScalar(k))
      }
      rows[0].push(ring(L.rad - 3, -1.5, 0.7))
      rows[1].push(ring(L.rad + 1 + (r() - 0.5) * 2, h * (0.5 + r() * 0.12), 0.9))
      rows[2].push(ring(L.rad + 4, h, 1.12))
    }
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i < N; i++) {
        const a = rows[k][i]
        const bb = rows[k][i + 1]
        const c = rows[k + 1][i + 1]
        const d = rows[k + 1][i]
        b.idx.push(a, bb, c, a, c, d)
      }
    }
  }
  return b.build()
}

// ---------------------------------------------------------------------------
// 夜霧
// ---------------------------------------------------------------------------

const WHITE = new THREE.Color('#ffffff')
const MIST: { pos: [number, number, number]; size: [number, number]; opacity: number; speed: number }[] = [
  { pos: [2, 0.55, 27], size: [70, 18], opacity: 0.12, speed: 0.006 },
  { pos: [-40, 0.7, -16], size: [34, 46], opacity: 0.1, speed: 0.004 },
  { pos: [18, 0.8, -31], size: [70, 24], opacity: 0.14, speed: 0.005 },
  { pos: [42, 0.6, -4], size: [34, 26], opacity: 0.08, speed: 0.007 },
]

function mistTexture(seed: number) {
  const r = seeded(seed)
  const t = canvasTexture(256, 256, (ctx, w, h) => {
    for (let i = 0; i < 70; i++) {
      const x = r() * w
      const y = r() * h
      const rad = 20 + r() * 60
      const a = 0.05 + r() * 0.12
      for (const dx of [-w, 0, w]) {
        for (const dy of [-h, 0, h]) {
          const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad)
          g.addColorStop(0, `rgba(255,255,255,${a})`)
          g.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.fillStyle = g
          ctx.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2)
        }
      }
    }
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

// ---------------------------------------------------------------------------

export function Landscape({ quality }: { quality: Quality }) {
  const mats = useMats()
  const isNight = useStore((s) => s.isNight)

  const road = useMemo(buildRoad, [])
  const roadMat = useMemo(() => {
    const m = mats.yard.clone()
    m.color.setRGB(0.7, 0.7, 0.72)
    return m
  }, [mats])
  const banks = useMemo(buildBanks, [])
  const water = useMemo(buildWater, [])
  const seedlings = useMemo(() => buildSeedlings(quality), [quality])
  const grass = useMemo(() => buildGrass(quality), [quality])
  const poles = useMemo(buildPoles, [])
  const hills = useMemo(buildHills, [])
  const flat = useMemo(
    () => ({
      poles: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
      insul: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 }),
      wires: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }),
      hills: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, side: THREE.DoubleSide }),
      ditchWater: new THREE.MeshStandardMaterial({ color: '#1f2c33', roughness: 0.08, metalness: 0.1 }),
      bulb: new THREE.MeshBasicMaterial({ color: '#ffb35a', toneMapped: false }),
      cone: new THREE.MeshBasicMaterial({
        map: coneTexture(),
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      }),
    }),
    [],
  )
  const mist = useMemo(
    () =>
      MIST.map((m, i) => ({
        ...m,
        mat: new THREE.MeshBasicMaterial({ map: mistTexture(700 + i), color: '#d5deec', transparent: true, opacity: m.opacity, depthWrite: false }),
      })),
    [],
  )

  useEffect(
    () => () => {
      for (const im of [seedlings, grass.grass, grass.flowers]) {
        im.geometry.dispose()
        ;(im.material as THREE.Material).dispose()
        im.dispose()
      }
    },
    [seedlings, grass],
  )

  const waterMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#1a2630', roughness: 0.12, metalness: 0.35, envMapIntensity: 1.6 })
    // 水面細微波紋：借泥巴的法線貼圖，放大、減弱
    const n = mats.mud.normalMap!.clone()
    n.repeat.set(0.35, 0.35)
    n.needsUpdate = true
    m.normalMap = n
    m.normalScale.set(0.15, 0.15)
    return m
  }, [mats])
  const lampLight = useRef<THREE.PointLight>(null)
  const dl = useMemo(makeDaylight, [])
  const mistColor = useMemo(() => new THREE.Color(), [])
  const bulbBase = useMemo(() => new THREE.Color('#ffb35a'), [])
  useFrame((_, dt) => {
    const s = useStore.getState()
    const l = lanternAt(s.time)
    if (lampLight.current) lampLight.current.intensity = STREET_LAMP_INTENSITY * l
    flat.bulb.color.copy(bulbBase).multiplyScalar(0.35 + 3.2 * l)
    flat.cone.opacity = 0.11 * l
    const night = s.isNight ? 1 : 0.35
    sampleDaylight(s.time, dl)
    mistColor.copy(dl.fog).lerp(WHITE, 0.25)
    for (const m of mist) {
      m.mat.color.copy(mistColor)
      const tex = m.mat.map!
      tex.offset.x += m.speed * dt
      tex.offset.y += m.speed * 0.35 * dt
      m.mat.opacity += (m.opacity * night - m.mat.opacity) * Math.min(1, dt * 0.8)
    }
  })

  return (
    <group>
      {/* 草地 */}
      <mesh geometry={planeGeo(320, 320, TILE.grass)} material={mats.grass} rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow />

      {/* 路、門前小路、水溝 */}
      <mesh geometry={road} material={roadMat} receiveShadow castShadow />
      <mesh geometry={planeGeo(180, DITCH.z1 - DITCH.z0 - 0.1)} material={flat.ditchWater} rotation-x={-Math.PI / 2} position={[0, 0.1, (DITCH.z0 + DITCH.z1) / 2]} />

      {/* 水田 */}
      <mesh geometry={banks.body} material={mats.mud} receiveShadow />
      <mesh geometry={banks.top} material={mats.grass} receiveShadow />
      {/* 水面：低粗糙度，反射環境光與路燈（即時鏡面反射太貴，而且這個鏡頭角度幾乎看不到倒影） */}
      <mesh geometry={water} rotation-x={-Math.PI / 2} position={[0, WATER_Y, 0]} material={waterMat} receiveShadow />
      <primitive object={seedlings} />

      {/* 草、野花 */}
      <primitive object={grass.grass} />
      <primitive object={grass.flowers} />

      {/* 電線桿、路燈 */}
      <mesh geometry={poles.concrete} material={flat.poles} castShadow receiveShadow />
      <mesh geometry={poles.white} material={flat.insul} castShadow />
      <mesh geometry={poles.wires} material={flat.wires} />
      <mesh material={flat.bulb} position={[LAMP_X, LAMP_POS.y + 0.12, LAMP_POS.z]} scale={[0.12, 0.04, 0.24]}>
        <sphereGeometry args={[1, 16, 8]} />
      </mesh>
      <mesh material={flat.cone} position={[LAMP_X, (LAMP_POS.y + 0.1) / 2, LAMP_POS.z]}>
        <coneGeometry args={[2.8, LAMP_POS.y + 0.1, 32, 1, true]} />
      </mesh>
      <pointLight ref={lampLight} position={LAMP_POS} color="#ffb35a" intensity={STREET_LAMP_INTENSITY} distance={14} decay={2} />

      {/* 遠山 */}
      <mesh geometry={hills} material={flat.hills} />

      {/* 植物 */}
      <Tree position={[-15.5, 0, 1.5]} />
      <Tree position={[14.5, 0, -13.5]} scale={0.75} />
      <BananaTrees />
      <BambooGrove />

      {/* 夜霧 */}
      {mist.map((m, i) => (
        <mesh key={i} material={m.mat} rotation-x={-Math.PI / 2} position={m.pos} renderOrder={2}>
          <planeGeometry args={m.size} />
        </mesh>
      ))}

      {/* 螢火蟲 */}
      <group visible={isNight}>
        <Sparkles count={36} scale={[13, 2, 9]} position={[0, 1.4, 1.5]} size={3.5} speed={0.25} color="#e8ff8a" opacity={0.9} noise={1.2} />
        <Sparkles count={70} scale={[40, 1.4, 8]} position={[4, 0.8, 19]} size={3.5} speed={0.3} color="#e8ff8a" opacity={0.9} noise={1.5} />
        <Sparkles count={40} scale={[16, 1.4, 30]} position={[-30, 0.8, -8]} size={3.5} speed={0.3} color="#e8ff8a" opacity={0.9} noise={1.5} />
      </group>
    </group>
  )
}
