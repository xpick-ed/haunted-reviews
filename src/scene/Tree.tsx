import { useMemo } from 'react'
import * as THREE from 'three'
import { seeded } from './kit'
import { MeshBuilder, banyanLeafTexture, randomQuat, taperTube, windSway } from './Plants'

// 老榕樹：幾股纏在一起的樹幹、往外伸的大枝、垂下來的氣根，樹冠是一片片葉叢卡片。
// 整棵樹兩個 draw call（樹皮、樹葉）。

/** 樹冠：中心 (x, y, z) 與半徑 (rx, ry, rz)，以樹的原點為基準 */
const BLOBS: [number, number, number, number, number, number][] = [
  [0, 5.3, 0, 3.4, 1.8, 3.2],
  [2.7, 4.6, 1.3, 2.3, 1.4, 2.1],
  [-2.6, 4.7, -0.9, 2.4, 1.5, 2.2],
  [0.9, 6.0, -1.7, 2.1, 1.2, 1.9],
  [-1.1, 5.5, 2.3, 2.1, 1.3, 1.9],
  [1.3, 4.4, -2.6, 1.9, 1.1, 1.7],
]
const LEAF_CARDS = 780

let mats: { bark: THREE.MeshStandardMaterial; leaf: THREE.MeshStandardMaterial } | null = null
function materials() {
  if (!mats) {
    mats = {
      bark: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
      leaf: windSway(
        new THREE.MeshStandardMaterial({
          map: banyanLeafTexture(),
          alphaTest: 0.5,
          side: THREE.DoubleSide,
          vertexColors: true,
          roughness: 0.62,
        }),
        0.12,
      ),
    }
  }
  return mats
}

function buildBanyan(seed: number) {
  const r = seeded(seed)
  const blobs = BLOBS.map(([x, y, z, rx, ry, rz]) => ({ c: new THREE.Vector3(x, y, z), rad: new THREE.Vector3(rx, ry, rz) }))
  const bark = new MeshBuilder()
  const dark = new THREE.Color('#4a3f35')
  const mid = new THREE.Color('#6e5f50')
  const barkCol = (p: THREE.Vector3) => dark.clone().lerp(mid, THREE.MathUtils.clamp(p.y / 3, 0, 1))
  const rootCol = new THREE.Color('#7b6b58')
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

  // 主幹：5 股互相纏繞往上，到頂端各自伸成一根大枝通往一團樹冠
  const tops: THREE.Vector3[] = []
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + r() * 0.4
    const b = blobs[k % blobs.length]
    const ring = (ang: number, rad: number, y: number) => V(Math.cos(ang) * rad, y, Math.sin(ang) * rad)
    const end = b.c.clone().add(V(0, -b.rad.y * 0.45, 0))
    const pts = [
      ring(a, 0.95, -0.05),
      ring(a + 0.5, 0.55, 0.9),
      ring(a + 1.0, 0.3, 2.0),
      ring(a + 1.3, 0.35, 3.0),
      V(0, 3.4, 0).lerp(end, 0.55),
      end,
    ]
    tops.push(pts[3])
    bark.add(taperTube(pts, 0.4, 0.08, 22, 8, 1.6), null, barkCol)
  }
  // 小枝
  for (let k = 0; k < 7; k++) {
    const s = tops[k % tops.length].clone().add(V((r() - 0.5) * 0.4, 0.3 + r() * 0.6, (r() - 0.5) * 0.4))
    const b = blobs[Math.floor(r() * blobs.length)]
    const e = b.c.clone().add(V((r() - 0.5) * b.rad.x, (r() - 0.8) * b.rad.y, (r() - 0.5) * b.rad.z))
    bark.add(taperTube([s, s.clone().lerp(e, 0.5).add(V(0, 0.4, 0)), e], 0.12, 0.03, 8, 6), null, barkCol)
  }
  // 板根：沿著地面爬出去
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + r() * 0.5
    const len = 1.4 + r() * 1.0
    const pts = [V(Math.cos(a) * 0.45, 0.4, Math.sin(a) * 0.45), V(Math.cos(a) * (0.5 + len * 0.45), 0.08, Math.sin(a) * (0.5 + len * 0.45)), V(Math.cos(a + 0.15) * (0.5 + len), -0.06, Math.sin(a + 0.15) * (0.5 + len))]
    bark.add(taperTube(pts, 0.24, 0.035, 8, 6, 1.4), null, barkCol)
  }
  // 氣根：從枝幹底下垂下來，有些碰到地、有些懸在半空
  for (let k = 0; k < 22; k++) {
    const b = blobs[Math.floor(r() * blobs.length)]
    const a = r() * Math.PI * 2
    const d = 0.3 + r() * 0.7
    const top = V(b.c.x + Math.cos(a) * b.rad.x * d * 0.8, b.c.y - b.rad.y * (0.55 + r() * 0.3), b.c.z + Math.sin(a) * b.rad.z * d * 0.8)
    const toGround = r() < 0.55
    const endY = toGround ? -0.05 : 0.9 + r() * 1.6
    const midP = V(top.x + (r() - 0.5) * 0.25, (top.y + endY) / 2, top.z + (r() - 0.5) * 0.25)
    const endP = V(top.x + (r() - 0.5) * 0.2, endY, top.z + (r() - 0.5) * 0.2)
    bark.add(taperTube([top, midP, endP], 0.03, toGround ? 0.05 : 0.012, 6, 4), null, rootCol)
  }

  // 樹冠：卡片偏向每團的外殼，法線從中心往外（讓整團像一顆柔和的球受光），裡面的卡片調暗假裝有自遮蔽
  const leaves = new MeshBuilder()
  const vol = blobs.map((b) => b.rad.x * b.rad.y * b.rad.z)
  const volSum = vol.reduce((s, v) => s + v, 0)
  const q = new THREE.Quaternion()
  const dir = new THREE.Vector3()
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()
  const right = new THREE.Vector3()
  const up = new THREE.Vector3()
  blobs.forEach((b, bi) => {
    const count = Math.round((LEAF_CARDS * vol[bi]) / volSum)
    for (let i = 0; i < count; i++) {
      dir.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1)
      if (dir.lengthSq() < 1e-4) dir.set(0, 1, 0)
      dir.normalize()
      const shell = 0.5 + 0.5 * Math.sqrt(r())
      p.copy(dir).multiply(b.rad).multiplyScalar(shell).add(b.c)
      const size = (0.9 + r() * 0.6) / 2
      randomQuat(r, q)
      right.set(1, 0, 0).applyQuaternion(q).multiplyScalar(size)
      up.set(0, 1, 0).applyQuaternion(q).multiplyScalar(size)
      n.copy(dir).divide(b.rad).normalize().add(V(0, 0.5, 0)).normalize()
      const col = new THREE.Color().setHSL(0.26 + (r() - 0.5) * 0.05, 0.45 + r() * 0.15, 0.3 + r() * 0.12)
      col.multiplyScalar(0.45 + 0.55 * shell)
      const w = THREE.MathUtils.clamp((p.y - 3.2) / 4, 0.15, 1)
      leaves.card(p, right, up, n, col, w, w, bi * 1.7 + r() * 0.8)
    }
  })

  return { bark: bark.build(), leaves: leaves.build() }
}

export function Tree({ position = [-15.5, 0, 1.5], scale = 1 }: { position?: [number, number, number]; scale?: number }) {
  const seed = (Math.round(position[0] * 131 + position[2] * 71) & 0xffff) + 1
  const geo = useMemo(() => buildBanyan(seed), [seed])
  const m = materials()
  return (
    <group position={position} scale={scale} rotation-y={(seed % 628) / 100}>
      <mesh geometry={geo.bark} material={m.bark} castShadow receiveShadow />
      <mesh geometry={geo.leaves} material={m.leaf} castShadow />
    </group>
  )
}
