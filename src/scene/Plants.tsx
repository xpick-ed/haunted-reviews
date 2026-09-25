import { useMemo } from 'react'
import * as THREE from 'three'
import { canvasTexture, seeded, wind } from './kit'

// 植物共用工具（榕樹、香蕉樹、竹叢都用）：合併網格的 MeshBuilder、會變細的管子、
// 依頂點屬性擺動的風、canvas 畫的葉片貼圖。

// ---------------------------------------------------------------------------
// 風：頂點屬性 aSway（x = 擺動權重，y = 相位）。根部權重 0 不動、尖端擺最多，
// 所以整棵樹合併成一個網格也能各自擺動。
// ---------------------------------------------------------------------------

export function windSway<T extends THREE.Material>(mat: T, strength: number): T {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wind
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute vec2 aSway;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        float swT = sin(uTime * 1.3 + aSway.y) * 0.7 + sin(uTime * 2.1 + aSway.y * 1.9) * 0.3;
        transformed.x += swT * aSway.x * ${strength.toFixed(3)};
        transformed.z += swT * aSway.x * ${(strength * 0.6).toFixed(3)};
        transformed.y -= abs(swT) * aSway.x * ${(strength * 0.2).toFixed(3)};`,
      )
  }
  mat.customProgramCacheKey = () => `sway-${strength}`
  return mat
}

// ---------------------------------------------------------------------------
// MeshBuilder：把很多小零件（卡片、管子、現成幾何）寫進同一個網格，一次 draw call
// ---------------------------------------------------------------------------

const _v = new THREE.Vector3()
const _n = new THREE.Vector3()
const _m3 = new THREE.Matrix3()

export type Sway = [number, number]

export class MeshBuilder {
  pos: number[] = []
  nor: number[] = []
  uv: number[] = []
  col: number[] = []
  sw: number[] = []
  idx: number[] = []

  get count() {
    return this.pos.length / 3
  }

  vert(p: THREE.Vector3, n: THREE.Vector3, u: number, v: number, c: THREE.Color, w = 0, ph = 0) {
    this.pos.push(p.x, p.y, p.z)
    this.nor.push(n.x, n.y, n.z)
    this.uv.push(u, v)
    this.col.push(c.r, c.g, c.b)
    this.sw.push(w, ph)
    return this.count - 1
  }

  /** 一張卡片：right / up 是半邊長向量，n 是整張卡片共用的法線。下緣擺動 w0、上緣 w1。 */
  card(center: THREE.Vector3, right: THREE.Vector3, up: THREE.Vector3, n: THREE.Vector3, c: THREE.Color, w0: number, w1: number, ph: number) {
    const a = this.vert(_v.copy(center).sub(right).sub(up), n, 0, 0, c, w0, ph)
    const b = this.vert(_v.copy(center).add(right).sub(up), n, 1, 0, c, w0, ph)
    const d = this.vert(_v.copy(center).add(right).add(up), n, 1, 1, c, w1, ph)
    const e = this.vert(_v.copy(center).sub(right).add(up), n, 0, 1, c, w1, ph)
    this.idx.push(a, b, d, a, d, e)
  }

  /** 把現成的幾何整個加進來（可帶矩陣）。顏色、擺動可以依頂點位置決定。 */
  add(
    g: THREE.BufferGeometry,
    m: THREE.Matrix4 | null,
    c: THREE.Color | ((p: THREE.Vector3) => THREE.Color),
    sway?: (p: THREE.Vector3) => Sway,
  ) {
    const base = this.count
    const P = g.attributes.position as THREE.BufferAttribute
    const N = g.attributes.normal as THREE.BufferAttribute
    const U = g.attributes.uv as THREE.BufferAttribute | undefined
    if (m) _m3.getNormalMatrix(m)
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i)
      if (m) _v.applyMatrix4(m)
      _n.fromBufferAttribute(N, i)
      if (m) _n.applyMatrix3(_m3).normalize()
      const col = typeof c === 'function' ? c(_v) : c
      const [w, ph] = sway ? sway(_v) : [0, 0]
      this.pos.push(_v.x, _v.y, _v.z)
      this.nor.push(_n.x, _n.y, _n.z)
      this.uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0)
      this.col.push(col.r, col.g, col.b)
      this.sw.push(w, ph)
    }
    if (g.index) for (let j = 0; j < g.index.count; j++) this.idx.push(base + g.index.getX(j))
    else for (let j = 0; j < P.count; j++) this.idx.push(base + j)
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(this.sw, 2))
    g.setIndex(this.idx)
    g.computeBoundingSphere()
    g.computeBoundingBox()
    return g
  }
}

/**
 * 沿著曲線的圓管，半徑從 r0（起點）漸變到 r1（終點）。
 * flare > 1 會讓起點那端膨得更快（樹根、樹幹底部）。
 */
export function taperTube(points: THREE.Vector3[], r0: number, r1: number, segs = 12, radial = 7, flare = 1): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points)
  const frames = curve.computeFrenetFrames(segs, false)
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    curve.getPointAt(t, p)
    const r = r1 + (r0 - r1) * Math.pow(1 - t, flare)
    const N = frames.normals[i]
    const B = frames.binormals[i]
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2
      n.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a)).normalize()
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r)
      nor.push(n.x, n.y, n.z)
      uv.push(j / radial, t)
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j
      const b = (i + 1) * (radial + 1) + j
      idx.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

/** 隨機單位四元數（卡片方向用） */
export function randomQuat(r: () => number, q = new THREE.Quaternion()) {
  return q.setFromEuler(new THREE.Euler(r() * Math.PI * 2, r() * Math.PI * 2, r() * Math.PI * 2))
}

// ---------------------------------------------------------------------------
// 葉片貼圖（canvas 畫的，透明背景）
// ---------------------------------------------------------------------------

function leafPath(ctx: CanvasRenderingContext2D, len: number, wid: number) {
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(len * 0.45, -wid, len, 0)
  ctx.quadraticCurveTo(len * 0.45, wid, 0, 0)
  ctx.closePath()
}

/** 榕樹：一小叢油亮的橢圓葉 */
function drawBanyanLeaves(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const r = seeded(11)
  const cx = w / 2
  const cy = h / 2
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#5a4630'
  ctx.lineWidth = 3
  for (let k = 0; k < 6; k++) {
    const a = r() * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(a) * 80, cy + Math.sin(a) * 80)
    ctx.stroke()
  }
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2
    const d = 8 + r() * 76
    const len = 30 + r() * 16
    const wid = 9 + r() * 5
    ctx.save()
    ctx.translate(cx + Math.cos(a) * d * 0.85, cy + Math.sin(a) * d * 0.85)
    ctx.rotate(a + (r() - 0.5) * 1.1)
    const g = ctx.createLinearGradient(0, -wid, 0, wid)
    const light = 0.75 + r() * 0.25
    g.addColorStop(0, `rgb(${170 * light},${214 * light},${120 * light})`)
    g.addColorStop(1, `rgb(${92 * light},${150 * light},${64 * light})`)
    leafPath(ctx, len, wid)
    ctx.fillStyle = g
    ctx.fill()
    ctx.strokeStyle = 'rgba(40,70,25,0.45)'
    ctx.lineWidth = 1
    ctx.stroke()
    // 葉脈與反光
    ctx.strokeStyle = 'rgba(225,245,190,0.55)'
    ctx.beginPath()
    ctx.moveTo(2, 0)
    ctx.lineTo(len - 3, 0)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.16)'
    ctx.beginPath()
    ctx.ellipse(len * 0.45, -wid * 0.35, len * 0.28, wid * 0.18, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

/** 竹葉：幾根細枝垂下來的長披針形葉 */
function drawBambooLeaves(ctx: CanvasRenderingContext2D, w: number) {
  const r = seeded(23)
  ctx.lineCap = 'round'
  for (let t = 0; t < 4; t++) {
    const x0 = w * (0.25 + r() * 0.5)
    const y0 = 20 + r() * 30
    const x1 = x0 + (r() - 0.5) * 90
    const y1 = y0 + 70 + r() * 50
    ctx.strokeStyle = '#6f7a3a'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
    for (let i = 0; i < 6; i++) {
      const k = r()
      const ox = x0 + (x1 - x0) * k
      const oy = y0 + (y1 - y0) * k
      const a = Math.PI / 2 + (r() - 0.5) * 1.9
      const len = 60 + r() * 50
      const wid = 7 + r() * 5
      ctx.save()
      ctx.translate(ox, oy)
      ctx.rotate(a)
      const g = ctx.createLinearGradient(0, 0, len, 0)
      g.addColorStop(0, '#5f8f36')
      g.addColorStop(1, '#a9c86a')
      leafPath(ctx, len, wid)
      ctx.fillStyle = g
      ctx.fill()
      ctx.strokeStyle = 'rgba(230,245,190,0.4)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(2, 0)
      ctx.lineTo(len - 4, 0)
      ctx.stroke()
      ctx.restore()
    }
  }
}

/** 香蕉葉：底部是葉柄、中肋、斜向葉脈，邊緣有幾道被風撕裂的裂口。上方是葉尖。 */
function drawBananaLeaf(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const r = seeded(37)
  const cx = w / 2
  const stem = 70
  const half = (y: number) => {
    const s = (h - stem - y) / (h - stem - 12)
    if (s <= 0) return 3
    if (s >= 1) return 0
    return 3 + (w / 2 - 7) * Math.pow(Math.sin(Math.PI * Math.min(1, s * 0.92 + 0.04)), 0.55)
  }
  ctx.beginPath()
  ctx.moveTo(cx - 3, h)
  for (let y = h; y >= 10; y -= 4) ctx.lineTo(cx - half(y), y)
  for (let y = 10; y <= h; y += 4) ctx.lineTo(cx + half(y), y)
  ctx.closePath()
  const g = ctx.createLinearGradient(0, 0, w, 0)
  g.addColorStop(0, '#a9cf72')
  g.addColorStop(0.5, '#c9e38e')
  g.addColorStop(1, '#a3c96c')
  ctx.fillStyle = g
  ctx.fill()
  // 斜向葉脈
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(70,110,35,0.35)'
  for (let y = h - stem - 6; y > 16; y -= 5) {
    const hw = half(y)
    ctx.beginPath()
    ctx.moveTo(cx - hw, y - hw * 0.4)
    ctx.lineTo(cx, y)
    ctx.lineTo(cx + hw, y - hw * 0.4)
    ctx.stroke()
  }
  // 中肋
  ctx.strokeStyle = '#e4efb4'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(cx, h)
  ctx.lineTo(cx, 14)
  ctx.stroke()
  // 乾掉的邊
  ctx.strokeStyle = 'rgba(150,120,60,0.55)'
  ctx.lineWidth = 3
  for (let k = 0; k < 4; k++) {
    const y0 = 30 + r() * (h - stem - 80)
    const side = r() < 0.5 ? -1 : 1
    ctx.beginPath()
    for (let y = y0; y < y0 + 40; y += 4) ctx.lineTo(cx + side * (half(y) - 1), y)
    ctx.stroke()
  }
  // 裂口：從邊緣沿葉脈方向切進去，留一點點中肋
  ctx.globalCompositeOperation = 'destination-out'
  for (let k = 0; k < 9; k++) {
    const y = 40 + r() * (h - stem - 70)
    const side = r() < 0.5 ? -1 : 1
    const hw = half(y)
    const depth = hw * (0.55 + r() * 0.4)
    const gap = 1.5 + r() * 2.5
    ctx.beginPath()
    ctx.moveTo(cx + side * (hw + 2), y - (hw + 2) * 0.4 - gap)
    ctx.lineTo(cx + side * (hw - depth), y - (hw - depth) * 0.4)
    ctx.lineTo(cx + side * (hw + 2), y - (hw + 2) * 0.4 + gap)
    ctx.closePath()
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'
}

const texCache: Record<string, THREE.CanvasTexture> = {}
function cachedTex(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  if (!texCache[key]) {
    const t = canvasTexture(w, h, draw)
    t.anisotropy = 8
    texCache[key] = t
  }
  return texCache[key]
}

export const banyanLeafTexture = () => cachedTex('banyan', 256, 256, drawBanyanLeaves)
export const bambooLeafTexture = () => cachedTex('bamboo', 256, 256, (ctx, w) => drawBambooLeaves(ctx, w))
export const bananaLeafTexture = () => cachedTex('banana', 128, 512, drawBananaLeaf)

// ---------------------------------------------------------------------------
// 香蕉樹
// ---------------------------------------------------------------------------

/** 三合院四個角外面的香蕉樹（第一棵結了一串香蕉跟香蕉花） */
export const BANANA_SPOTS: [number, number][] = [
  [-13.2, 7.0],
  [13.8, -1.6],
  [-13.0, -8.8],
  [13.3, -7.4],
]

let bananaMats: { trunk: THREE.MeshStandardMaterial; leaf: THREE.MeshStandardMaterial } | null = null

function buildBananas() {
  const trunk = new MeshBuilder()
  const leaves = new MeshBuilder()
  const up = new THREE.Vector3(0, 1, 0)
  const tmp = new THREE.Vector3()
  const nrm = new THREE.Vector3()
  const leafGreen = new THREE.Color('#86b458')
  const leafDry = new THREE.Color('#c49a5c')

  BANANA_SPOTS.forEach(([x, z], ti) => {
    const r = seeded(500 + ti * 17)
    const H = 2.4 + r() * 0.8
    const lean = new THREE.Vector3(r() - 0.5, 0, r() - 0.5).normalize().multiplyScalar(0.25 + r() * 0.2)
    const base = new THREE.Vector3(x, -0.05, z)
    const top = new THREE.Vector3(x + lean.x, H, z + lean.z)
    const trunkPts = [base, new THREE.Vector3(x + lean.x * 0.3, H * 0.45, z + lean.z * 0.3), top]
    const trunkCol = (p: THREE.Vector3) => new THREE.Color('#5f5a36').lerp(new THREE.Color('#8a8d52'), THREE.MathUtils.clamp(p.y / H, 0, 1))
    trunk.add(taperTube(trunkPts, 0.2, 0.12, 8, 9, 2), null, trunkCol)
    // 旁邊冒出來的小芽
    const sx = x + (r() - 0.5) * 1.2
    const sz = z + (r() - 0.5) * 1.2
    trunk.add(taperTube([new THREE.Vector3(sx, -0.05, sz), new THREE.Vector3(sx, 0.9, sz)], 0.08, 0.05, 3, 7), null, trunkCol)

    // 葉子：從樹頂放射出去，嫩葉比較直立、老葉下垂，一兩片乾枯掛著
    const n = 8
    for (let k = 0; k < n + 1; k++) {
      const small = k === n
      const dry = k === 0 || (k === 3 && ti % 2 === 0)
      const yaw = (k / n) * Math.PI * 2 + r() * 0.5
      const pitch = small ? 1.25 : dry ? -0.9 - r() * 0.3 : 0.25 + r() * 0.7
      const L = small ? 1.1 : 1.8 + r() * 0.8
      const W = small ? 0.35 : 0.62 + r() * 0.2
      const droop = dry ? 0.05 : 0.25 + r() * 0.25
      const f = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw))
      const s = new THREE.Vector3(-f.z, 0, f.x)
      const origin = top.clone().addScaledVector(f, 0.08).add(new THREE.Vector3(0, -0.1 + r() * 0.2, 0))
      const col = dry ? leafDry : leafGreen.clone().offsetHSL((r() - 0.5) * 0.03, 0, (r() - 0.5) * 0.08)
      const ph = ti * 2.1 + k * 0.73
      const rows = 12
      const idx: number[][] = []
      for (let i = 0; i <= rows; i++) {
        const t = i / rows
        const row: number[] = []
        for (const xw of [-1, 0, 1]) {
          tmp
            .copy(origin)
            .addScaledVector(f, L * t * Math.cos(pitch))
            .addScaledVector(up, L * t * Math.sin(pitch) - droop * L * t * t)
            .addScaledVector(s, (xw * W) / 2)
            .addScaledVector(up, -Math.abs(xw) * 0.14 * W * t)
          nrm.set(0, 1, 0)
          const w = dry ? 0.25 * t : Math.pow(t, 1.5) * 0.9
          row.push(leaves.vert(tmp, nrm, (xw + 1) / 2, t, col, w, ph))
        }
        idx.push(row)
      }
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < 2; j++) {
          const a = idx[i][j]
          const b = idx[i][j + 1]
          const c = idx[i + 1][j + 1]
          const d = idx[i + 1][j]
          leaves.idx.push(a, b, c, a, c, d)
        }
      }
    }

    // 第一棵：垂下來的一串香蕉＋紫紅色香蕉花
    if (ti === 0) {
      const f = new THREE.Vector3(1, 0, 0.3).normalize()
      const stalk = [
        top.clone().add(new THREE.Vector3(0, -0.15, 0)),
        top.clone().addScaledVector(f, 0.35).add(new THREE.Vector3(0, 0.05, 0)),
        top.clone().addScaledVector(f, 0.6).add(new THREE.Vector3(0, -0.5, 0)),
        top.clone().addScaledVector(f, 0.68).add(new THREE.Vector3(0, -1.25, 0)),
      ]
      trunk.add(taperTube(stalk, 0.045, 0.03, 12, 6), null, new THREE.Color('#7d8a45'))
      const curve = new THREE.CatmullRomCurve3(stalk)
      const finger = new THREE.CapsuleGeometry(0.035, 0.14, 3, 6)
      const m = new THREE.Matrix4()
      const q = new THREE.Quaternion()
      for (let hnd = 0; hnd < 6; hnd++) {
        const t = 0.45 + hnd * 0.07
        const c = curve.getPointAt(t)
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2
          const dir = new THREE.Vector3(Math.cos(a) * 0.8, 0.6, Math.sin(a) * 0.8).normalize()
          q.setFromUnitVectors(up, dir)
          m.compose(c.clone().addScaledVector(dir, 0.1), q, new THREE.Vector3(1, 1, 1))
          trunk.add(finger, m, new THREE.Color('#8fae44'))
        }
      }
      const bud = new THREE.SphereGeometry(0.12, 10, 8)
      m.compose(stalk[3].clone().add(new THREE.Vector3(0, -0.12, 0)), new THREE.Quaternion(), new THREE.Vector3(1, 1.9, 1))
      trunk.add(bud, m, new THREE.Color('#6b2338'))
    }
  })
  return { trunk: trunk.build(), leaves: leaves.build() }
}

export function BananaTrees() {
  const geo = useMemo(buildBananas, [])
  if (!bananaMats) {
    bananaMats = {
      trunk: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }),
      leaf: windSway(
        new THREE.MeshStandardMaterial({
          map: bananaLeafTexture(),
          alphaTest: 0.45,
          side: THREE.DoubleSide,
          vertexColors: true,
          roughness: 0.55,
        }),
        0.22,
      ),
    }
  }
  return (
    <group>
      <mesh geometry={geo.trunk} material={bananaMats.trunk} castShadow receiveShadow />
      <mesh geometry={geo.leaves} material={bananaMats.leaf} castShadow receiveShadow />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 竹叢（正身後面）
// ---------------------------------------------------------------------------

export const BAMBOO = { x: 6.5, z: -13.1, rx: 3.3, rz: 1.1 }

let bambooMats: { culm: THREE.MeshStandardMaterial; leaf: THREE.MeshStandardMaterial } | null = null

function buildBamboo() {
  const r = seeded(77)
  const culms = new MeshBuilder()
  const leaves = new MeshBuilder()
  const q = new THREE.Quaternion()
  const m = new THREE.Matrix4()
  const up = new THREE.Vector3(0, 1, 0)
  const node =new THREE.CylinderGeometry(1, 1, 0.035, 7, 1, true)
  const tan = new THREE.Vector3()
  const p = new THREE.Vector3()
  const right = new THREE.Vector3()
  const upv = new THREE.Vector3()
  const n = new THREE.Vector3()

  for (let i = 0; i < 16; i++) {
    const bx = BAMBOO.x + (r() * 2 - 1) * BAMBOO.rx
    const bz = BAMBOO.z + (r() * 2 - 1) * BAMBOO.rz
    const H = 6 + r() * 3
    const out = new THREE.Vector3(bx - BAMBOO.x, 0, bz - BAMBOO.z).normalize()
    const lean = out.multiplyScalar(0.6 + r() * 1.0).add(new THREE.Vector3((r() - 0.5) * 0.6, 0, 0.3 + r() * 0.3))
    const pts = [
      new THREE.Vector3(bx, -0.05, bz),
      new THREE.Vector3(bx + lean.x * 0.25, H * 0.5, bz + lean.z * 0.25),
      new THREE.Vector3(bx + lean.x, H, bz + lean.z),
    ]
    const curve = new THREE.CatmullRomCurve3(pts)
    const old = r() < 0.3
    const green = new THREE.Color(old ? '#9c9a52' : '#6d8c3a').offsetHSL(0, 0, (r() - 0.5) * 0.06)
    const ph = i * 1.37
    const swayAt = (y: number): Sway => [Math.pow(THREE.MathUtils.clamp(y / H, 0, 1), 2), ph]
    const r0 = 0.06 + r() * 0.025
    culms.add(taperTube(pts, r0, r0 * 0.45, 14, 7), null, green, (v) => swayAt(v.y))
    // 竹節
    const nodeCol = green.clone().offsetHSL(0, -0.05, 0.12)
    for (let t = 0.04; t < 0.97; t += 0.05 + r() * 0.015) {
      curve.getPointAt(t, p)
      curve.getTangentAt(t, tan)
      const rr = (r0 + (r0 * 0.45 - r0) * t) * 1.18
      q.setFromUnitVectors(up, tan)
      m.compose(p, q, new THREE.Vector3(rr, 1, rr))
      culms.add(node, m, nodeCol, (v) => swayAt(v.y))
    }
    // 上半段的葉叢
    const leafCol = new THREE.Color('#79a64a').offsetHSL((r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.1)
    for (let k = 0; k < 14; k++) {
      const t = 0.5 + r() * 0.5
      curve.getPointAt(t, p)
      const a = r() * Math.PI * 2
      const d = 0.25 + r() * 0.7
      const c = p.clone().add(new THREE.Vector3(Math.cos(a) * d, (r() - 0.6) * 0.5, Math.sin(a) * d))
      const size = 0.5 + r() * 0.35
      randomQuat(r, q)
      right.set(1, 0, 0).applyQuaternion(q).multiplyScalar(size)
      // 竹葉往下垂：卡片的「上」大致朝上
      upv.set((r() - 0.5) * 0.6, 1, (r() - 0.5) * 0.6).normalize().multiplyScalar(size)
      right.sub(upv.clone().multiplyScalar(right.dot(upv) / upv.lengthSq()))
      n.set(Math.cos(a), 0.7, Math.sin(a)).normalize()
      const [w] = swayAt(c.y)
      leaves.card(c, right, upv, n, leafCol.clone().multiplyScalar(0.8 + 0.3 * t), w, w + 0.1, ph)
    }
  }
  return { culms: culms.build(), leaves: leaves.build() }
}

export function BambooGrove() {
  const geo = useMemo(buildBamboo, [])
  if (!bambooMats) {
    bambooMats = {
      culm: windSway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42 }), 0.35),
      leaf: windSway(
        new THREE.MeshStandardMaterial({
          map: bambooLeafTexture(),
          alphaTest: 0.5,
          side: THREE.DoubleSide,
          vertexColors: true,
          roughness: 0.6,
        }),
        0.35,
      ),
    }
  }
  return (
    <group>
      <mesh geometry={geo.culms} material={bambooMats.culm} castShadow receiveShadow />
      <mesh geometry={geo.leaves} material={bambooMats.leaf} castShadow />
    </group>
  )
}
