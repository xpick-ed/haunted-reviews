import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { useStore, type Quality } from '../store'
import { GARDEN, gardenStore } from '../world/sceneGarden'
import { lanternAt } from './daylight'
import { TILE, WBox, canvasTexture, planeGeo, seeded, useMats, windify } from './kit'
import { MergeStatic } from './MergeStatic'
import { Tree } from './Tree'
import { buildGrass } from './Landscape'
import { Corrugated, Ground, Paddies } from './VillageKit'
import { GardenChickens } from './GardenChickens'
import { sfx } from '../audio/sfx'

// 後院菜園＋雞舍（DESIGN §25.1）：地瓜葉、地瓜壟、絲瓜棚、雞舍與雞圈、竹篩曬菜脯、手壓式抽水機、稻草人。
// 鏡頭在 +x +z（南邊），高的東西（雞舍、絲瓜棚）放在北邊。規則與座標在 src/world/sceneGarden.ts。

const G = GARDEN

export function GardenScene() {
  const quality = useStore((s) => s.quality)
  const isNight = useStore((s) => s.isNight)
  useGardenBridge()
  return (
    <group>
      <Grounds />
      <Greenery quality={quality} />
      <MergeStatic>
        <Fences />
        <Coop />
        <Rack />
        <Well />
        <Compost />
        <Scarecrow />
        <Trellis />
      </MergeStatic>
      <Crops />
      <Harvested />
      <GardenChickens />
      <CoopLight />
      <Tree position={[-17, 0, -15]} scale={0.8} />
      <Tree position={[16, 0, -14]} scale={0.65} />
      <group visible={isNight}>
        <Sparkles count={30} scale={[22, 1.4, 16]} position={[0, 0.8, -1]} size={3.5} speed={0.3} color="#e8ff8a" opacity={0.9} noise={1.4} />
      </group>
    </group>
  )
}

/** 把 store 的寫入掛給 sceneGarden.ts 的熱點用；第一次來的時候阿嬤講一句 */
function useGardenBridge() {
  useEffect(() => {
    gardenStore.set = (fn) => useStore.setState(fn)
    const s = useStore.getState()
    let t = 0
    if (!s.flags.garden_seen) {
      useStore.setState({ flags: { ...s.flags, garden_seen: true } })
      t = window.setTimeout(() => useStore.getState().bark('garden.enter'), 1200)
    }
    return () => {
      window.clearTimeout(t)
      gardenStore.set = undefined
    }
  }, [])
  // 拿到東西的聲音（旗標從沒有變成有）
  const flags = useStore((s) => s.flags)
  const prev = useRef(flags)
  useEffect(() => {
    const was = prev.current
    prev.current = flags
    for (const k of ['garden_leaf_today', 'garden_potato_today', 'garden_radish_today', 'garden_egg_today']) {
      if (flags[k] && !was[k]) sfx.play(k === 'garden_leaf_today' ? 'cloth' : 'pickup', { volume: 0.7 })
    }
  }, [flags])
}

// ---------------------------------------------------------------------------
// 地面：草地、菜園的土、小路、雞圈的泥地；籬笆外是田
// ---------------------------------------------------------------------------

function Grounds() {
  const mats = useMats()
  return (
    <group>
      <mesh geometry={planeGeo(200, 200, TILE.grass)} material={mats.grass} rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow />
      {/* 菜園的土 */}
      <Ground mat="mud" w={G.leaf.x1 - G.leaf.x0 + 1.2} d={G.leaf.z1 - G.potato.z0 + 1.2} position={[(G.leaf.x0 + G.leaf.x1) / 2, 0.012, (G.leaf.z1 + G.potato.z0) / 2]} tint="#7a5e44" />
      {/* 小路：從南邊的籬笆門往北，一條往西的岔路 */}
      <Ground mat="mud" w={1.3} d={19} position={[0, 0.014, 0.2]} tint="#a08c6e" />
      <Ground mat="mud" w={12.4} d={1.1} position={[-3.6, 0.015, -2.35]} tint="#a08c6e" />
      <Ground mat="mud" w={3.0} d={1.1} position={[1.8, 0.015, -3.4]} tint="#a08c6e" />
      {/* 雞圈的泥地、曬菜脯的水泥地 */}
      <Ground mat="mud" w={G.run.x1 - G.run.x0} d={G.run.z1 - G.coop.z0} position={[(G.run.x0 + G.run.x1) / 2, 0.013, (G.run.z1 + G.coop.z0) / 2]} tint="#8a7458" />
      <Ground mat="yard" w={4.4} d={2.8} position={[G.rack.x, 0.013, G.rack.z]} tint="#b8b0a2" />
      {/* 籬笆外：東西兩邊的田 */}
      <Paddies xs={[-40, -28, -14.5]} zs={[-24, -12, 0, 12]} />
      <Paddies xs={[14.5, 28, 40]} zs={[-24, -12, 0, 12]} />
    </group>
  )
}

function gardenGround(x: number, z: number): 'grass' | null {
  if (Math.abs(x) > 12.3 || z < -10.7 || z > 12) return Math.abs(x) > 14.3 ? null : z < -10.7 && z > -20 ? 'grass' : null
  if (x > G.leaf.x0 - 0.7 && x < G.leaf.x1 + 0.7 && z > G.potato.z0 - 0.7 && z < G.leaf.z1 + 0.7) return null
  if (Math.abs(x) < 0.9) return null
  if (z > -3.0 && z < -1.7 && x < 3.4) return null
  if (x > G.run.x0 - 0.2 && x < G.run.x1 + 0.2 && z > G.coop.z0 - 0.2 && z < G.run.z1 + 0.2) return null
  if (Math.abs(x - G.rack.x) < 2.3 && Math.abs(z - G.rack.z) < 1.5) return null
  if (Math.hypot(x - G.well.x, z - G.well.z) < 1.4 || Math.hypot(x - G.jar.x, z - G.jar.z) < 0.7) return null
  if (Math.hypot(x - G.compost.x, z - G.compost.z) < 1.3) return null
  return 'grass'
}

function Greenery({ quality }: { quality: Quality }) {
  const grass = useMemo(() => buildGrass(quality, { ground: gardenGround, rMin: 0.5, rSpan: 17, seed: 6262, scale: 0.6 }), [quality])
  return (
    <group>
      <primitive object={grass.grass} />
      <primitive object={grass.flowers} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 菜：地瓜葉（心形葉子）、地瓜壟、絲瓜棚上的藤
// ---------------------------------------------------------------------------

let leafTex: THREE.CanvasTexture | null = null
/** 心形葉子（地瓜葉、絲瓜葉共用） */
function heartLeafTexture() {
  return (leafTex ??= canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    const g = ctx.createLinearGradient(0, h, 0, 0)
    g.addColorStop(0, '#3f7a34')
    g.addColorStop(1, '#79b14e')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(w / 2, h * 0.96)
    ctx.bezierCurveTo(w * 0.1, h * 0.62, w * 0.02, h * 0.2, w * 0.3, h * 0.1)
    ctx.bezierCurveTo(w * 0.42, h * 0.06, w * 0.48, h * 0.16, w / 2, h * 0.24)
    ctx.bezierCurveTo(w * 0.52, h * 0.16, w * 0.58, h * 0.06, w * 0.7, h * 0.1)
    ctx.bezierCurveTo(w * 0.98, h * 0.2, w * 0.9, h * 0.62, w / 2, h * 0.96)
    ctx.fill()
    ctx.strokeStyle = 'rgba(210,240,170,0.55)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(w / 2, h * 0.94)
    ctx.lineTo(w / 2, h * 0.28)
    for (const s of [-1, 1]) {
      ctx.moveTo(w / 2, h * 0.7)
      ctx.lineTo(w / 2 + s * w * 0.24, h * 0.42)
      ctx.moveTo(w / 2, h * 0.52)
      ctx.lineTo(w / 2 + s * w * 0.2, h * 0.26)
    }
    ctx.stroke()
  }))
}

let leafMat: THREE.MeshStandardMaterial | null = null
function leafMaterial() {
  return (leafMat ??= windify(new THREE.MeshStandardMaterial({ map: heartLeafTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75 }), 0.18, 2))
}

/** 一堆葉子（instanced）：每片 [x, y, z, 大小, 傾斜, 轉向, 亮度] */
function Leaves({ items }: { items: number[][] }) {
  const mesh = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1)
    geo.translate(0, 0.5, 0)
    const m = new THREE.InstancedMesh(geo, leafMaterial(), items.length)
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const c = new THREE.Color()
    items.forEach(([x, y, z, s, tilt, rot, k], i) => {
      e.set(-tilt, rot, 0, 'YXZ')
      q.setFromEuler(e)
      m.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s)))
      m.setColorAt(i, c.setHSL(0.27 + (k - 0.5) * 0.05, 0.45, 0.35 + k * 0.25))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.castShadow = true
    m.receiveShadow = true
    m.computeBoundingSphere()
    return m
  }, [items])
  return <primitive object={mesh} />
}

function Crops() {
  const mats = useMats()
  const { leaf, vine, canopy } = useMemo(() => {
    const r = seeded(4321)
    const leaf: number[][] = []
    const vine: number[][] = []
    const canopy: number[][] = []
    // 地瓜葉：四行，一叢一叢
    for (let row = 0; row < 4; row++) {
      const z = G.leaf.z0 + 0.4 + row * ((G.leaf.z1 - G.leaf.z0 - 0.8) / 3)
      for (let x = G.leaf.x0 + 0.3; x < G.leaf.x1 - 0.2; x += 0.22 + r() * 0.1) {
        const n = 3 + Math.floor(r() * 3)
        for (let i = 0; i < n; i++) {
          leaf.push([x + (r() - 0.5) * 0.25, 0.14, z + (r() - 0.5) * 0.3, 0.16 + r() * 0.1, 0.5 + r() * 0.7, r() * Math.PI * 2, r()])
        }
      }
    }
    // 地瓜壟上的藤：稀一點、貼著土
    for (let row = 0; row < 3; row++) {
      const z = G.potato.z0 + 0.8 + row * ((G.potato.z1 - G.potato.z0 - 1.6) / 2)
      for (let x = G.potato.x0 + 0.3; x < G.potato.x1 - 0.2; x += 0.16 + r() * 0.1) {
        vine.push([x, 0.28 + r() * 0.06, z + (r() - 0.5) * 0.7, 0.13 + r() * 0.08, 1.0 + r() * 0.4, r() * Math.PI * 2, r()])
      }
    }
    // 絲瓜棚頂：大片、幾乎平躺
    const T = G.trellis
    for (let i = 0; i < 220; i++) {
      canopy.push([T.x0 + r() * (T.x1 - T.x0), T.h - 0.02 + r() * 0.1, T.z0 + r() * (T.z1 - T.z0), 0.3 + r() * 0.16, 1.35 + r() * 0.3, r() * Math.PI * 2, r() * 0.8 + 0.2])
    }
    // 柱子上爬的藤
    for (const x of [T.x0, T.x1])
      for (const z of [T.z0, T.z1])
        for (let y = 0.2; y < T.h; y += 0.22) canopy.push([x + (r() - 0.5) * 0.2, y, z + (r() - 0.5) * 0.2, 0.2, 0.3 + r() * 0.4, r() * 6.28, r()])
    return { leaf, vine, canopy }
  }, [])
  const luffa = useMemo(() => {
    const r = seeded(99)
    const T = G.trellis
    return Array.from({ length: 9 }, () => ({ x: T.x0 + 0.3 + r() * (T.x1 - T.x0 - 0.6), z: T.z0 + 0.3 + r() * (T.z1 - T.z0 - 0.6), len: 0.3 + r() * 0.2, tilt: (r() - 0.5) * 0.3 }))
  }, [])
  const luffaMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5f8a3a', roughness: 0.6 }), [])
  const flowerMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.5, emissive: '#6a4a00', emissiveIntensity: 0.2 }), [])
  return (
    <group userData={{ noMerge: true }}>
      {/* 土壟 */}
      {[0, 1, 2, 3].map((row) => {
        const z = G.leaf.z0 + 0.4 + row * ((G.leaf.z1 - G.leaf.z0 - 0.8) / 3)
        return <WBox key={`l${row}`} mat="mud" size={[G.leaf.x1 - G.leaf.x0, 0.14, 0.55]} position={[(G.leaf.x0 + G.leaf.x1) / 2, 0.07, z]} />
      })}
      {[0, 1, 2].map((row) => {
        const z = G.potato.z0 + 0.8 + row * ((G.potato.z1 - G.potato.z0 - 1.6) / 2)
        return (
          <mesh key={`p${row}`} material={mats.mud} position={[(G.potato.x0 + G.potato.x1) / 2, 0, z]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 1.5]} castShadow receiveShadow>
            <cylinderGeometry args={[0.3, 0.3, G.potato.x1 - G.potato.x0, 12, 1, false, 0, Math.PI]} />
          </mesh>
        )
      })}
      <Leaves items={leaf} />
      <Leaves items={vine} />
      <Leaves items={canopy} />
      {luffa.map((l, i) => (
        <group key={i} position={[l.x, G.trellis.h - 0.05, l.z]} rotation={[l.tilt, 0, l.tilt * 0.5]}>
          <mesh material={luffaMat} position={[0, -l.len / 2 - 0.05, 0]} castShadow>
            <capsuleGeometry args={[0.05, l.len, 4, 10]} />
          </mesh>
          {i % 2 === 0 && (
            <mesh material={flowerMat} position={[0.12, -0.02, 0.05]}>
              <sphereGeometry args={[0.05, 8, 6]} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

/** 拿過之後看得到的變化：挖出來的地瓜擺在壟邊、竹篩空了一格、窩裡沒有蛋 */
function Harvested() {
  const potato = useStore((s) => !!s.flags.garden_potato_today)
  const egg = useStore((s) => !!s.flags.garden_egg_today)
  const potatoMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a2435a', roughness: 0.7 }), [])
  const eggMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f1e6d2', roughness: 0.5 }), [])
  return (
    <group userData={{ noMerge: true }}>
      {/* 壟裡露出來的地瓜（挖了就少了） */}
      {!potato &&
        [-7.8, -5.6, -4.1].map((x, i) => (
          <mesh key={x} material={potatoMat} position={[x, 0.2, G.potato.z1 - 0.6 - i * 0.05]} rotation={[0.3, i, 1.2]} scale={[1, 1.6, 1]} castShadow>
            <sphereGeometry args={[0.07, 10, 8]} />
          </mesh>
        ))}
      {potato && (
        <group position={[-6.2, 0, G.potato.z1 + 0.45]}>
          <mesh position={[0, 0.02, -0.5]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.35, 16]} />
            <meshStandardMaterial color="#4a3526" roughness={1} />
          </mesh>
        </group>
      )}
      {/* 雞窩裡的蛋 */}
      {!egg &&
        [-0.06, 0.07].map((x) => (
          <mesh key={x} material={eggMat} position={[G.nest.x + x, 0.56, G.coop.z1 + 0.25]} scale={[1, 1.3, 1]} castShadow>
            <sphereGeometry args={[0.035, 10, 8]} />
          </mesh>
        ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 絲瓜棚：四根竹柱、竹竿格子
// ---------------------------------------------------------------------------

function Trellis() {
  const mats = useMats()
  const T = G.trellis
  const poles: { p: [number, number, number]; r: [number, number, number]; len: number }[] = []
  for (const x of [T.x0, T.x1]) for (const z of [T.z0, T.z1]) poles.push({ p: [x, T.h / 2, z], r: [0, 0, 0], len: T.h + 0.05 })
  for (let i = 0; i <= 4; i++) poles.push({ p: [T.x0 + (i / 4) * (T.x1 - T.x0), T.h, (T.z0 + T.z1) / 2], r: [Math.PI / 2, 0, 0], len: T.z1 - T.z0 + 0.3 })
  for (let i = 0; i <= 4; i++) poles.push({ p: [(T.x0 + T.x1) / 2, T.h + 0.04, T.z0 + (i / 4) * (T.z1 - T.z0)], r: [0, 0, Math.PI / 2], len: T.x1 - T.x0 + 0.3 })
  return (
    <group>
      {poles.map((b, i) => (
        <mesh key={i} material={mats.bamboo} position={b.p} rotation={b.r} castShadow>
          <cylinderGeometry args={[0.035, 0.04, b.len, 7]} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 雞舍＋雞圈
// ---------------------------------------------------------------------------

let wireTex: THREE.CanvasTexture | null = null
/** 鐵絲網（六角網簡化成斜格） */
function wireTexture() {
  if (wireTex) return wireTex
  wireTex = canvasTexture(64, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(190,195,200,0.9)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(w, h)
    ctx.moveTo(w, 0)
    ctx.lineTo(0, h)
    ctx.stroke()
  })
  wireTex.wrapS = wireTex.wrapT = THREE.RepeatWrapping
  return wireTex
}

function WireMesh({ position, w, h, rotY = 0 }: { position: [number, number, number]; w: number; h: number; rotY?: number }) {
  const mat = useMemo(() => {
    const t = wireTexture().clone()
    t.needsUpdate = true
    t.repeat.set(w / 0.12, h / 0.12)
    return new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.6 })
  }, [w, h])
  return (
    <mesh material={mat} position={position} rotation={[0, rotY, 0]}>
      <planeGeometry args={[w, h]} />
    </mesh>
  )
}

function Coop() {
  const mats = useMats()
  const C = G.coop
  const R = G.run
  const cx = (C.x0 + C.x1) / 2
  const cz = (C.z0 + C.z1) / 2
  const hFront = 1.9
  const hBack = 1.5
  const straw = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d9b565', roughness: 1 }), [])
  // 雞圈的柱子
  const posts: [number, number][] = []
  for (let x = R.x0; x <= R.x1 + 0.01; x += 1.2) posts.push([x, R.z1])
  for (let z = R.z0; z <= R.z1 + 0.01; z += 1.35) {
    posts.push([R.x1, z])
    if (Math.abs(z - R.gateZ) > R.gateW / 2) posts.push([R.x0, z])
  }
  posts.push([R.x0, R.gateZ - R.gateW / 2], [R.x0, R.gateZ + R.gateW / 2])
  return (
    <group>
      {/* 小屋：木板牆，前面高後面低，前牆有一個雞進出的小門 */}
      <WBox mat="wood" size={[C.x1 - C.x0, hBack, 0.1]} position={[cx, hBack / 2, C.z0]} />
      {[C.x0, C.x1].map((x) => (
        <WBox key={x} mat="wood" size={[0.1, hFront, C.z1 - C.z0]} position={[x, hFront / 2, cz]} />
      ))}
      <WBox mat="wood" size={[G.nest.x - 0.35 - C.x0, hFront, 0.1]} position={[(C.x0 + G.nest.x - 0.35) / 2, hFront / 2, C.z1]} />
      <WBox mat="wood" size={[C.x1 - G.nest.x - 0.35, hFront, 0.1]} position={[(C.x1 + G.nest.x + 0.35) / 2, hFront / 2, C.z1]} />
      <WBox mat="wood" size={[0.7, hFront - 0.9, 0.1]} position={[G.nest.x, 0.9 + (hFront - 0.9) / 2, C.z1]} />
      {/* 雞窩（伸出來的木箱，裡面鋪稻草） */}
      <WBox mat="wood" size={[0.6, 0.06, 0.45]} position={[G.nest.x, 0.46, C.z1 + 0.18]} />
      {[-0.3, 0.3].map((x) => (
        <WBox key={x} mat="wood" size={[0.04, 0.22, 0.45]} position={[G.nest.x + x, 0.57, C.z1 + 0.18]} />
      ))}
      <mesh material={straw} position={[G.nest.x, 0.51, C.z1 + 0.2]} scale={[1, 0.25, 0.7]}>
        <sphereGeometry args={[0.26, 12, 8]} />
      </mesh>
      {/* 雞爬上去的斜板 */}
      <WBox mat="wood" size={[0.22, 0.03, 0.9]} position={[G.nest.x + 0.9, 0.25, C.z1 + 0.4]} rotation={[0.55, 0, 0]} />
      {/* 側面的鐵絲網窗 */}
      <WireMesh position={[C.x1 + 0.06, 1.2, cz]} w={1.6} h={0.6} rotY={Math.PI / 2} />
      {/* 鐵皮屋頂（往後斜） */}
      <Corrugated position={[cx, (hFront + hBack) / 2 + 0.06, cz]} size={[C.x1 - C.x0 + 0.5, Math.hypot(C.z1 - C.z0, hFront - hBack) + 0.5]} tilt={-Math.atan2(hFront - hBack, C.z1 - C.z0)} color="#7d8a7a" />
      {/* 雞圈：竹柱＋兩條橫竹＋鐵絲網 */}
      {posts.map(([x, z], i) => (
        <mesh key={i} material={mats.bamboo} position={[x, 0.55, z]} castShadow>
          <cylinderGeometry args={[0.035, 0.04, 1.1, 6]} />
        </mesh>
      ))}
      {[0.35, 0.95].map((y) => (
        <group key={y}>
          <mesh material={mats.bamboo} position={[(R.x0 + R.x1) / 2, y, R.z1]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, R.x1 - R.x0, 6]} />
          </mesh>
          <mesh material={mats.bamboo} position={[R.x1, y, (R.z0 + R.z1) / 2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, R.z1 - R.z0, 6]} />
          </mesh>
          <mesh material={mats.bamboo} position={[R.x0, y, (R.z0 + R.gateZ - R.gateW / 2) / 2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, R.gateZ - R.gateW / 2 - R.z0, 6]} />
          </mesh>
          <mesh material={mats.bamboo} position={[R.x0, y, (R.z1 + R.gateZ + R.gateW / 2) / 2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, R.z1 - R.gateZ - R.gateW / 2, 6]} />
          </mesh>
        </group>
      ))}
      <WireMesh position={[(R.x0 + R.x1) / 2, 0.5, R.z1]} w={R.x1 - R.x0} h={0.9} />
      <WireMesh position={[R.x1, 0.5, (R.z0 + R.z1) / 2]} w={R.z1 - R.z0} h={0.9} rotY={Math.PI / 2} />
      <WireMesh position={[R.x0, 0.5, (R.z0 + R.gateZ - R.gateW / 2) / 2]} w={R.gateZ - R.gateW / 2 - R.z0} h={0.9} rotY={Math.PI / 2} />
      <WireMesh position={[R.x0, 0.5, (R.z1 + R.gateZ + R.gateW / 2) / 2]} w={R.z1 - R.gateZ - R.gateW / 2} h={0.9} rotY={Math.PI / 2} />
      {/* 飼料槽、水盆 */}
      <WBox mat="wood" size={[0.9, 0.14, 0.24]} position={[8.4, 0.07, -3.2]} />
      <mesh material={straw} position={[8.4, 0.15, -3.2]} scale={[1, 0.2, 0.3]}>
        <sphereGeometry args={[0.42, 10, 6]} />
      </mesh>
      <mesh material={mats.terracotta} position={[4.2, 0.05, -2.3]}>
        <cylinderGeometry args={[0.24, 0.2, 0.1, 14]} />
      </mesh>
      {/* 靠在雞舍牆邊的農具：鋤頭、竹掃把、斗笠、竹簍 */}
      <group position={[C.x0 - 0.12, 0, cz + 0.6]}>
        <mesh material={mats.bamboo} position={[0, 0.8, 0]} rotation={[0, 0, 0.18]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 1.5, 6]} />
        </mesh>
        <mesh material={mats.metal} position={[0.14, 1.52, 0]} rotation={[0, 0, 0.18]}>
          <boxGeometry args={[0.24, 0.05, 0.16]} />
        </mesh>
        <mesh material={mats.bamboo} position={[0, 0.75, 0.5]} rotation={[0.1, 0, 0.14]} castShadow>
          <cylinderGeometry args={[0.018, 0.018, 1.3, 6]} />
        </mesh>
        <mesh material={mats.bamboo} position={[0.08, 0.2, 0.5]} rotation={[0.1, 0, 0.14]}>
          <coneGeometry args={[0.18, 0.4, 10, 1, true]} />
        </mesh>
        <mesh material={straw} position={[-0.05, 1.3, -0.5]} rotation={[0, 0, Math.PI / 2 - 0.2]}>
          <coneGeometry args={[0.3, 0.12, 16]} />
        </mesh>
        <mesh material={mats.bamboo} position={[-0.25, 0.2, -0.2]} castShadow>
          <cylinderGeometry args={[0.2, 0.15, 0.4, 12, 1, true]} />
        </mesh>
      </group>
    </group>
  )
}

/** 雞舍門口的小燈泡（天黑才亮） */
function CoopLight() {
  const light = useRef<THREE.PointLight>(null)
  const bulb = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffd9a0', toneMapped: false }), [])
  useFrame(() => {
    const l = lanternAt(useStore.getState().time)
    if (light.current) light.current.intensity = 2.4 * l
    bulb.color.setRGB(0.3 + 0.9 * l, 0.25 + 0.7 * l, 0.2 + 0.45 * l)
  })
  return (
    <group position={[G.nest.x + 0.9, 1.75, G.coop.z1 + 0.12]}>
      <mesh material={bulb}>
        <sphereGeometry args={[0.05, 10, 8]} />
      </mesh>
      <pointLight ref={light} position={[0, -0.1, 0.3]} color="#ffb35c" intensity={0} distance={6} decay={2} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 竹篩曬菜脯
// ---------------------------------------------------------------------------

function Rack() {
  const mats = useMats()
  const R = G.rack
  const strips = useMemo(() => {
    const r = seeded(11)
    const out: { x: number; z: number; rot: number; tray: number }[] = []
    for (let t = 0; t < 3; t++) for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2
      const rad = Math.sqrt(r()) * 0.4
      out.push({ x: Math.cos(a) * rad, z: Math.sin(a) * rad, rot: r() * Math.PI, tray: t })
    }
    return out
  }, [])
  const stripMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b98a4a', roughness: 0.8 }), [])
  const trayX = [-1.05, 0, 1.05]
  return (
    <group position={[R.x, 0, R.z]}>
      {/* 兩個木架 */}
      {[-1.3, 1.3].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          {[-0.4, 0.4].map((z) => (
            <mesh key={z} material={mats.wood} position={[0, 0.34, z]} rotation={[z > 0 ? 0.2 : -0.2, 0, 0]} castShadow>
              <boxGeometry args={[0.06, 0.72, 0.06]} />
            </mesh>
          ))}
        </group>
      ))}
      {[-0.35, 0.35].map((z) => (
        <mesh key={z} material={mats.bamboo} position={[0, 0.68, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 3.1, 6]} />
        </mesh>
      ))}
      {/* 三個竹篩 */}
      {trayX.map((x) => (
        <group key={x} position={[x, 0.72, 0]}>
          <mesh material={mats.bamboo} castShadow receiveShadow>
            <cylinderGeometry args={[0.5, 0.48, 0.04, 24]} />
          </mesh>
          <mesh material={mats.bamboo} position={[0, 0.03, 0]}>
            <torusGeometry args={[0.49, 0.025, 6, 24]} />
          </mesh>
        </group>
      ))}
      {strips.map((s, i) => (
        <mesh key={i} material={stripMat} position={[trayX[s.tray] + s.x, 0.76, s.z]} rotation={[0, s.rot, 0]}>
          <boxGeometry args={[0.18, 0.025, 0.04]} />
        </mesh>
      ))}
      {/* 旁邊一甕醃好的菜脯 */}
      <mesh material={mats.ceramic} position={[1.9, 0.3, 0.55]} castShadow>
        <cylinderGeometry args={[0.22, 0.26, 0.6, 16]} />
      </mesh>
      <mesh material={mats.redPaper} position={[1.9, 0.62, 0.55]}>
        <cylinderGeometry args={[0.2, 0.2, 0.05, 16]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 手壓式抽水機、水缸、堆肥、稻草人、竹籬笆
// ---------------------------------------------------------------------------

function Well() {
  const mats = useMats()
  const W = G.well
  const pump = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2f4a3a', roughness: 0.45, metalness: 0.5 }), [])
  const jarGeo = useMemo(
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
        24,
      ),
    [],
  )
  return (
    <group>
      <group position={[W.x, 0, W.z]}>
        {/* 水泥台、洗衣的小池 */}
        <WBox mat="stone" size={[1.2, 0.3, 1.0]} position={[0, 0.15, 0]} />
        <WBox mat="stone" size={[0.8, 0.12, 0.6]} position={[0.15, 0.36, 0.1]} />
        {/* 抽水機：圓筒、出水口、壓桿 */}
        <mesh material={pump} position={[-0.3, 0.75, -0.2]} castShadow>
          <cylinderGeometry args={[0.1, 0.12, 0.7, 12]} />
        </mesh>
        <mesh material={pump} position={[-0.3, 1.13, -0.2]}>
          <cylinderGeometry args={[0.12, 0.1, 0.08, 12]} />
        </mesh>
        <mesh material={pump} position={[-0.14, 0.95, -0.2]} rotation={[0, 0, -Math.PI / 2 + 0.3]}>
          <cylinderGeometry args={[0.035, 0.03, 0.26, 8]} />
        </mesh>
        <mesh material={pump} position={[-0.6, 1.3, -0.2]} rotation={[0, 0, 0.5]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 0.8, 6]} />
        </mesh>
      </group>
      <mesh geometry={jarGeo} material={mats.ceramic} position={[G.jar.x, 0, G.jar.z]} castShadow receiveShadow />
      <mesh position={[G.jar.x, 0.62, G.jar.z]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.31, 20]} />
        <meshStandardMaterial color="#15222a" roughness={0.05} metalness={0.2} />
      </mesh>
    </group>
  )
}

function Compost() {
  const mats = useMats()
  const C = G.compost
  const heap = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a3524', roughness: 1, flatShading: true }), [])
  return (
    <group position={[C.x, 0, C.z]}>
      <mesh material={heap} position={[0, 0.1, 0]} scale={[1.1, 0.5, 0.9]} castShadow receiveShadow>
        <icosahedronGeometry args={[0.8, 1]} />
      </mesh>
      {[
        [-0.9, -0.8],
        [0.9, -0.8],
        [-0.9, 0.8],
        [0.9, 0.8],
      ].map(([x, z]) => (
        <mesh key={`${x},${z}`} material={mats.bamboo} position={[x, 0.4, z]} castShadow>
          <cylinderGeometry args={[0.03, 0.035, 0.8, 6]} />
        </mesh>
      ))}
      <mesh material={mats.leaf} position={[0.3, 0.5, 0.1]} scale={[1, 0.4, 1]}>
        <icosahedronGeometry args={[0.3, 0]} />
      </mesh>
    </group>
  )
}

function Scarecrow() {
  const mats = useMats()
  const S = G.scarecrow
  const shirt = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5f7fa0', roughness: 0.95 }), [])
  const straw = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d9b565', roughness: 1 }), [])
  return (
    <group position={[S.x, 0, S.z]} rotation={[0, 0.5, 0.04]}>
      <mesh material={mats.bamboo} position={[0, 0.95, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.04, 1.9, 6]} />
      </mesh>
      <mesh material={mats.bamboo} position={[0, 1.35, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 1.2, 6]} />
      </mesh>
      {/* 阿公的舊衫 */}
      <mesh material={shirt} position={[0, 1.15, 0]} castShadow>
        <boxGeometry args={[0.55, 0.55, 0.2]} />
      </mesh>
      <mesh material={shirt} position={[0, 1.33, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.1, 1.0, 8]} />
      </mesh>
      {/* 稻草頭、斗笠 */}
      <mesh material={straw} position={[0, 1.62, 0]} castShadow>
        <sphereGeometry args={[0.16, 12, 10]} />
      </mesh>
      <mesh material={straw} position={[0, 1.8, 0]} castShadow>
        <coneGeometry args={[0.34, 0.16, 18]} />
      </mesh>
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} material={straw} position={[x, 1.3, 0]} rotation={[0, 0, x > 0 ? -1.2 : 1.2]}>
          <coneGeometry args={[0.07, 0.18, 6]} />
        </mesh>
      ))}
    </group>
  )
}

/** 竹籬笆：一根根竹樁＋兩條橫竹；南邊中間留門 */
function Fences() {
  const mats = useMats()
  const lines: { a: [number, number]; b: [number, number] }[] = [
    { a: [-12.6, -10.8], b: [12.6, -10.8] },
    { a: [-12.6, -10.8], b: [-12.6, G.fenceZ] },
    { a: [12.6, -10.8], b: [12.6, G.fenceZ] },
    { a: [-12.6, G.fenceZ], b: [-G.gateHalf, G.fenceZ] },
    { a: [G.gateHalf, G.fenceZ], b: [12.6, G.fenceZ] },
  ]
  const stakes: [number, number, number][] = []
  const r = seeded(31)
  for (const l of lines) {
    const len = Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1])
    const n = Math.ceil(len / 0.45)
    for (let i = 0; i <= n; i++) {
      const t = i / n
      stakes.push([l.a[0] + (l.b[0] - l.a[0]) * t, l.a[1] + (l.b[1] - l.a[1]) * t, 0.85 + r() * 0.2])
    }
  }
  return (
    <group>
      {stakes.map(([x, z, h], i) => (
        <mesh key={i} material={mats.bamboo} position={[x, h / 2, z]} castShadow>
          <cylinderGeometry args={[0.028, 0.032, h, 5]} />
        </mesh>
      ))}
      {lines.flatMap((l, i) => {
        const len = Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1])
        const ang = Math.atan2(l.b[0] - l.a[0], l.b[1] - l.a[1])
        return [0.3, 0.68].map((y) => (
          <mesh key={`${i}-${y}`} material={mats.bamboo} position={[(l.a[0] + l.b[0]) / 2, y, (l.a[1] + l.b[1]) / 2]} rotation={[Math.PI / 2, 0, -ang]}>
            <cylinderGeometry args={[0.022, 0.022, len, 6]} />
          </mesh>
        ))
      })}
      {/* 籬笆門的兩根門柱 */}
      {[-G.gateHalf, G.gateHalf].map((x) => (
        <mesh key={x} material={mats.wood} position={[x, 0.65, G.fenceZ]} castShadow>
          <boxGeometry args={[0.14, 1.3, 0.14]} />
        </mesh>
      ))}
    </group>
  )
}
