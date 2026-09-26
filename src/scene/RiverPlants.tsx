import { useMemo } from 'react'
import * as THREE from 'three'
import type { Quality } from '../store'
import { RIVER, inRiver, riverCenter, riverGround, riverHalfWidth, riverRidge } from '../world/sceneRiver'
import { seeded, windify } from './kit'
import { buildGrass } from './Landscape'
import { BAMBOO, BambooGrove } from './Plants'
import { Tree } from './Tree'

// 溪邊的植物：草地、芒草（一叢一叢，頂端銀白色的穗）、北岸的竹林、遠處的樹。

const R = RIVER

/** 草長在哪裡：河岸上、不在小路和平台上 */
function riverGrass(x: number, z: number): 'grass' | null {
  const d = Math.abs(z - riverCenter(x)) - riverHalfWidth(x)
  if (d < R.bank * 0.8) return null
  if (Math.abs(x) < 1.1 && z > 2.5) return null // 小路
  if (x > R.deck.x0 - 0.3 && x < R.deck.x1 + 0.3 && z > R.deck.z0 && z < R.deck.z1 + 0.4) return null
  if (Math.hypot(x - R.shrine.x, z - R.shrine.z) < 0.9) return null
  if (Math.hypot(x - R.boulder.x, z - R.boulder.z) < R.boulder.r + 0.2) return null
  if (z < -11 || z > 13) return null
  return 'grass'
}

export function RiverPlants({ quality }: { quality: Quality }) {
  const grass = useMemo(() => buildGrass(quality, { ground: riverGrass, rMin: 0.5, rSpan: 22, seed: 6161, scale: 0.85 }), [quality])
  const clumps = useMemo(() => silvergrassSpots(quality === 'high' ? 150 : 80), [quality])
  return (
    <group>
      <primitive object={grass.grass} />
      <primitive object={grass.flowers} />
      <Silvergrass spots={clumps} />
      {/* 北岸的竹林：同一叢竹子的幾何，搬到三個地方 */}
      {R.groves.map((g, i) => (
        <group key={i} position={[g.x - BAMBOO.x, 0, g.z - BAMBOO.z]} scale={[g.rx / BAMBOO.rx, 1, 1]}>
          <BambooGrove />
        </group>
      ))}
      {/* 山坡上的樹（北邊，鏡頭對面） */}
      <Tree position={[-17, riverRidge(-13), -13]} scale={0.8} />
      <Tree position={[9.5, riverRidge(-14), -14]} scale={0.7} />
      <Tree position={[-3, riverRidge(-16), -16]} scale={0.9} />
      <Tree position={[16, riverRidge(-15.5), -15.5]} scale={0.75} />
      <Tree position={[20, 0, -4]} scale={0.6} />
      <Tree position={[-22, 0, 2]} scale={0.65} />
    </group>
  )
}

/** 芒草長的地方：兩岸水邊，南岸小路兩旁留空 */
function silvergrassSpots(n: number) {
  const r = seeded(4040)
  const out: Clump[] = []
  let tries = 0
  while (out.length < n && tries < n * 20) {
    tries++
    const x = -19 + r() * 38
    const side = r() < 0.55 ? 1 : -1
    const c = riverCenter(x)
    const hw = riverHalfWidth(x)
    const z = c + side * (hw + 0.15 + Math.pow(r(), 1.6) * 2.6)
    if (inRiver(x, z)) continue
    if (Math.abs(x) < 1.3 && z > 1) continue // 小路
    if (Math.abs(x - R.stonesX) < 0.8) continue // 踏腳石的上下岸
    if (x > R.deck.x0 - 0.4 && x < R.deck.x1 + 0.4 && z > R.deck.z0 - 0.3) continue
    if (Math.abs(x - R.washX) < 1.2 && side > 0) continue // 洗衣石
    if (Math.abs(x - R.weirX) < 0.9) continue
    if (Math.hypot(x - R.shrine.x, z - R.shrine.z) < 1.1) continue
    if (Math.hypot(x - R.kids.x, z - R.kids.z) < 1.6) continue
    out.push({ x, y: riverGround(x, z), z, s: 0.7 + r() * 0.6, rot: r() * Math.PI * 2 })
  }
  return out
}

let grassMat: THREE.MeshStandardMaterial | null = null
let clumpGeo: THREE.BufferGeometry | null = null

/** 一叢芒草：九片彎彎的長葉＋三根銀白色的穗 */
function buildClump() {
  const r = seeded(99)
  const pos: number[] = []
  const col: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const base = new THREE.Color('#3f5a2a')
  const tip = new THREE.Color('#a7b86a')
  const plumeA = new THREE.Color('#c9c3b0')
  const plumeB = new THREE.Color('#f4efe2')
  const push = (p: THREE.Vector3, c: THREE.Color) => {
    pos.push(p.x, p.y, p.z)
    col.push(c.r, c.g, c.b)
    nor.push(0, 1, 0)
    uv.push(0, 0)
  }
  // 葉：細長的三角帶，往外彎
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.4
    const h = 0.9 + r() * 0.6
    const lean = 0.25 + r() * 0.45
    const w = 0.05
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a))
    const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(w)
    const segs = 4
    let prevL: THREE.Vector3 | null = null
    let prevR: THREE.Vector3 | null = null
    for (let k = 0; k <= segs; k++) {
      const t = k / segs
      const center = dir.clone().multiplyScalar(lean * t * t).setY(h * t - lean * 0.3 * t * t * t)
      const wk = 1 - t * 0.9
      const L = center.clone().add(side.clone().multiplyScalar(wk))
      const Rr = center.clone().sub(side.clone().multiplyScalar(wk))
      const c = base.clone().lerp(tip, t)
      if (prevL && prevR) {
        push(prevL, base.clone().lerp(tip, t - 1 / segs))
        push(prevR, base.clone().lerp(tip, t - 1 / segs))
        push(L, c)
        push(prevR, base.clone().lerp(tip, t - 1 / segs))
        push(Rr, c)
        push(L, c)
      }
      prevL = L
      prevR = Rr
    }
  }
  // 穗：往一邊垂的細長片，越上面越白
  for (let i = 0; i < 3; i++) {
    const a = r() * Math.PI * 2
    const h0 = 1.1 + r() * 0.4
    const len = 0.45 + r() * 0.2
    const dir = new THREE.Vector3(Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35).normalize()
    const bend = new THREE.Vector3(Math.cos(a), -0.6, Math.sin(a)).multiplyScalar(0.18)
    const side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(0.07)
    const p0 = dir.clone().multiplyScalar(h0 * 0.65)
    const p1 = p0.clone().add(dir.clone().multiplyScalar(len)).add(bend)
    const mid = p0.clone().lerp(p1, 0.5)
    for (const [a1, b1, c1] of [
      [p0, mid.clone().add(side), mid.clone().sub(side)],
      [mid.clone().add(side), p1, mid.clone().sub(side)],
    ] as THREE.Vector3[][]) {
      push(a1, plumeA)
      push(b1, plumeB)
      push(c1, plumeB)
    }
    // 穗下面的莖
    const s2 = side.clone().multiplyScalar(0.2)
    push(new THREE.Vector3(0, 0, 0).add(s2), base)
    push(p0.clone().add(s2), tip)
    push(new THREE.Vector3(0, 0, 0).sub(s2), base)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  return g
}

export interface Clump {
  x: number
  y?: number
  z: number
  s: number
  rot: number
}

export function Silvergrass({ spots }: { spots: Clump[] }) {
  const mesh = useMemo(() => {
    clumpGeo ??= buildClump()
    grassMat ??= windify(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 }), 0.07, 0.9)
    const m = new THREE.InstancedMesh(clumpGeo, grassMat, spots.length)
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    spots.forEach((p, i) => {
      q.setFromAxisAngle(up, p.rot)
      m.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y ?? 0, p.z), q, new THREE.Vector3(p.s, p.s, p.s)))
    })
    m.instanceMatrix.needsUpdate = true
    m.castShadow = true
    m.receiveShadow = true
    return m
  }, [spots])
  return <primitive object={mesh} />
}
