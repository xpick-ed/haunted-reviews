import { useMemo } from 'react'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { seeded, useMats, TILE, planeGeo } from './kit'
import { Silvergrass, type Clump } from './RiverPlants'

// 村子北邊往溪邊的小路（DESIGN §26.1）：從村子西頭（檳榔攤西邊）的路邊往北走到出口。
// 原本在透天厝和老榕樹中間，但從鏡頭看會被榕樹整個擋住，所以搬到西頭空曠的地方。
// 泥土小路、路邊的石頭、芒草；晚上有幾隻火金姑在路口飄，引人往溪邊走。

/** 小路中心線：從路口（z≈-2.3）慢慢彎到出口（z≈-9.5），再往北淡出 */
const LANE: [number, number][] = [
  [-20.2, -2.3],
  [-20.2, -3.8],
  [-20.0, -5.1],
  [-19.8, -6.4],
  [-19.9, -8.2],
  [-20.0, -9.8],
  [-20.1, -12.5],
  [-19.9, -15],
]

function laneGeometry(width: number) {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const pts = LANE.map(([x, z]) => new THREE.Vector3(x, 0, z))
  const curve = new THREE.CatmullRomCurve3(pts)
  const n = 40
  const tan = new THREE.Vector3()
  const p = new THREE.Vector3()
  let dist = 0
  let prev: THREE.Vector3 | null = null
  for (let i = 0; i <= n; i++) {
    curve.getPointAt(i / n, p)
    curve.getTangentAt(i / n, tan)
    if (prev) dist += p.distanceTo(prev)
    prev = p.clone()
    const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize()
    // 越往北越窄（小路走進田裡）
    const w = width * (1 - (i / n) * 0.35) * (0.94 + Math.sin(i * 1.7) * 0.06)
    for (const s of [-1, 1]) {
      pos.push(p.x + side.x * s * w * 0.5, 0.03, p.z + side.z * s * w * 0.5)
      uv.push((s * w) / TILE.mud, dist / TILE.mud)
    }
    if (i > 0) {
      const a = (i - 1) * 2
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  const nrm = new Float32Array(pos.length)
  for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  g.setIndex(idx)
  return { geo: g, curve }
}

export function VillageRiverPath() {
  const mats = useMats()
  const isNight = useStore((s) => s.isNight)
  const { geo, stones, clumps } = useMemo(() => {
    const { geo, curve } = laneGeometry(1.35)
    const r = seeded(1313)
    const stones: { x: number; z: number; s: number; rot: number }[] = []
    const clumps: Clump[] = []
    const p = new THREE.Vector3()
    const tan = new THREE.Vector3()
    for (let i = 0; i < 26; i++) {
      const t = 0.08 + (i / 26) * 0.9
      curve.getPointAt(t, p)
      curve.getTangentAt(t, tan)
      const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize()
      const s = i % 2 ? 1 : -1
      stones.push({ x: p.x + side.x * s * (0.8 + r() * 0.2), z: p.z + side.z * s * (0.8 + r() * 0.2), s: 0.1 + r() * 0.1, rot: r() * 3 })
      if (r() < 0.55 && p.z < -4.8) clumps.push({ x: p.x + side.x * s * (1.2 + r() * 0.8), z: p.z + side.z * s * (1.2 + r() * 0.8), s: 0.6 + r() * 0.4, rot: r() * 6 })
    }
    return { geo, stones, clumps }
  }, [])
  const mud = useMemo(() => {
    const m = mats.mud.clone()
    m.color.set('#a39276')
    m.side = THREE.DoubleSide
    return m
  }, [mats])
  const stoneMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8b877c', roughness: 0.9, flatShading: true }), [])
  return (
    <group>
      <mesh geometry={geo} material={mud} receiveShadow />
      {stones.map((s, i) => (
        <mesh key={i} position={[s.x, s.s * 0.3, s.z]} rotation={[s.rot, s.rot * 2, 0]} scale={[s.s * 1.4, s.s * 0.7, s.s]} material={stoneMat} castShadow receiveShadow>
          <icosahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
      <Silvergrass spots={clumps} />
      {/* 路口的小木牌下方鋪一片碎石，看得出這裡是入口 */}
      <mesh geometry={planeGeo(1.4, 1.0, TILE.yard)} material={mats.yard} rotation-x={-Math.PI / 2} position={[-20.2, 0.028, -2.6]} receiveShadow />
      <group visible={isNight}>
        <Sparkles count={14} scale={[2.6, 1.2, 7]} position={[-19.9, 0.8, -8]} size={4} speed={0.35} color="#d8ff7a" opacity={0.95} noise={1.2} />
      </group>
    </group>
  )
}
