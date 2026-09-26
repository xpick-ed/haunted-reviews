import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { RIVER, riverCenter, riverGround, riverHalfWidth, riverRidge, riverWater, steppingStones } from '../world/sceneRiver'
import { lanternAt, makeDaylight, sampleDaylight } from './daylight'
import { TILE, WBox, canvasTexture, seeded, useMats } from './kit'
import { MergeStatic } from './MergeStatic'
import { Ground } from './VillageKit'
import { RiverPlants } from './RiverPlants'
import { FireflyGlow, Fireflies, Ripples, RiverKids, Waterfall } from './RiverFx'

// 溪邊＋螢火蟲（DESIGN §26.1）：村子北邊的一條小溪。石頭溪床、慢慢流的水、攔沙壩的小瀑布、
// 踏腳石、釣魚平台、洗衣石、土地公石、老水車；北岸是竹林，晚上滿滿的火金姑。
// 鏡頭在南邊（+z），高的東西（竹林、水車、山坡）放北邊。規則與地形在 src/world/sceneRiver.ts。

const R = RIVER

export function RiverScene() {
  const quality = useStore((s) => s.quality)
  const outline = quality === 'high'
  useRiverBridge()
  const ripples = useMemo(() => [...steppingStones().filter((_, i) => i % 2 === 0), [R.kids.x + 0.8, R.kids.z - 0.9] as [number, number]], [])
  return (
    <group>
      <Terrain />
      <Water />
      {/* 從出口往北走到水邊的泥土小路 */}
      <Ground mat="mud" w={1.6} d={8.4} position={[0, 0.035, 7.6]} tint="#9a8a70" />
      <RiverPlants quality={quality} />
      <MergeStatic>
        <Weir />
        <Stones />
        <Deck />
        <WashingStones />
        <Shrine />
        <WheelFrame />
      </MergeStatic>
      <Pebbles />
      <Boulder />
      <Wheel />
      <Waterfall />
      <Ripples spots={ripples} />
      <ShrineCandle />
      <Fireflies count={quality === 'high' ? 900 : 380} />
      {quality === 'high' && <FireflyGlow />}
      <RiverKids outline={outline} />
      <NightFill />
    </group>
  )
}

/** 第一次來溪邊，阿嬤講一句 */
function useRiverBridge() {
  useEffect(() => {
    const s = useStore.getState()
    if (s.flags.river_seen) return
    useStore.setState({ flags: { ...s.flags, river_seen: true } })
    const t = window.setTimeout(() => {
      const st = useStore.getState()
      st.bark(st.isNight ? 'river.enter.night' : 'river.enter')
    }, 1200)
    return () => window.clearTimeout(t)
  }, [])
}

// ---------------------------------------------------------------------------
// 地形：一張起伏的網格。河岸是草地，斜坡與溪床是泥土和石頭（同一張網格分兩個材質）
// ---------------------------------------------------------------------------

const TERRAIN = { x0: -34, x1: 34, z0: -24, z1: 20, nx: 136, nz: 88 }

function buildTerrain() {
  const { x0, x1, z0, z1, nx, nz } = TERRAIN
  const pos: number[] = []
  const col: number[] = []
  const uv: number[] = []
  const bankCol = new THREE.Color()
  const top = new THREE.Color('#ffffff')
  const ridge = new THREE.Color('#7f8f6a')
  const slope = new THREE.Color('#9a8568')
  const bed = new THREE.Color('#8c8a80')
  const wet = new THREE.Color('#5c5a52')
  const r = seeded(515)
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx
      const z = z0 + ((z1 - z0) * j) / nz
      const y = riverGround(x, z) + riverRidge(z)
      pos.push(x, y, z)
      uv.push(x / TILE.grass, -z / TILE.grass)
      const d = Math.abs(z - riverCenter(x)) - riverHalfWidth(x)
      const n = (r() - 0.5) * 0.08
      if (d < -0.4) bankCol.copy(bed).lerp(wet, THREE.MathUtils.clamp(-d / 1.5, 0, 1))
      else if (d < R.bank) bankCol.copy(slope).lerp(top, THREE.MathUtils.smoothstep(d, 0.2, R.bank))
      else bankCol.copy(top).lerp(ridge, THREE.MathUtils.clamp(riverRidge(z) / 2.5, 0, 0.8))
      col.push(bankCol.r + n, bankCol.g + n, bankCol.b + n)
    }
  }
  // 兩組三角形：河道（泥土）、河岸（草）
  const channel: number[] = []
  const banks: number[] = []
  const at = (i: number, j: number) => j * (nx + 1) + i
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const cx = x0 + ((x1 - x0) * (i + 0.5)) / nx
      const cz = z0 + ((z1 - z0) * (j + 0.5)) / nz
      const d = Math.abs(cz - riverCenter(cx)) - riverHalfWidth(cx)
      const list = d < R.bank * 0.65 ? channel : banks
      const a = at(i, j)
      const b = at(i + 1, j)
      const c = at(i, j + 1)
      const e = at(i + 1, j + 1)
      list.push(a, c, b, b, c, e)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex([...banks, ...channel])
  g.addGroup(0, banks.length, 0)
  g.addGroup(banks.length, channel.length, 1)
  g.computeVertexNormals()
  return g
}

function Terrain() {
  const mats = useMats()
  const geo = useMemo(buildTerrain, [])
  const materials = useMemo(() => {
    const grass = mats.grass.clone()
    grass.vertexColors = true
    const mud = mats.mud.clone()
    mud.vertexColors = true
    // 同一組 UV（草地的比例），泥土貼圖另外縮放
    const k = TILE.grass / TILE.mud
    for (const key of ['map', 'normalMap', 'roughnessMap'] as const) {
      const t = mud[key]
      if (!t) continue
      const c = t.clone()
      c.repeat.set(k, k)
      c.needsUpdate = true
      mud[key] = c
    }
    return [grass, mud]
  }, [mats])
  return <mesh geometry={geo} material={materials} receiveShadow userData={{ noMerge: true }} />
}

// ---------------------------------------------------------------------------
// 水：沿著溪畫一條水帶（攔沙壩上游、下游各一條，下游低一截），法線貼圖順著水流移動
// ---------------------------------------------------------------------------

function ribbon(xa: number, xb: number, y: number) {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const step = 0.5
  const n = Math.ceil((xb - xa) / step)
  for (let i = 0; i <= n; i++) {
    const x = xa + ((xb - xa) * i) / n
    const c = riverCenter(x)
    const hw = riverHalfWidth(x) + 0.3
    for (const s of [-1, 1]) {
      const z = c + s * hw
      pos.push(x, y, z)
      uv.push(x / 6, z / 6)
    }
    if (i > 0) {
      const a = (i - 1) * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  // 法線朝上（index 順序的關係，確保不是朝下）
  const nrm = g.attributes.normal as THREE.BufferAttribute
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0)
  return g
}

/** 月光倒影：中間亮、兩端淡、有幾道波紋斷開 */
const glintTex = canvasTexture(64, 256, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h)
  for (let y = 0; y < h; y += 6) {
    const k = Math.sin((y / h) * Math.PI)
    const len = w * (0.25 + 0.7 * k) * (0.7 + Math.random() * 0.3)
    ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.7 * k * Math.random()})`
    ctx.fillRect((w - len) / 2, y, len, 3)
  }
})

function Water() {
  const mats = useMats()
  const up = useMemo(() => ribbon(TERRAIN.x0, R.weirX + 0.05, R.waterUp), [])
  const down = useMemo(() => ribbon(R.weirX + 0.05, TERRAIN.x1, R.waterDown), [])
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#23363e', roughness: 0.05, metalness: 0.45, envMapIntensity: 2.2 })
    const n = mats.mud.normalMap!.clone()
    n.wrapS = n.wrapT = THREE.RepeatWrapping
    n.repeat.set(1.4, 1.4)
    n.needsUpdate = true
    m.normalMap = n
    m.normalScale.set(0.22, 0.22)
    return m
  }, [mats])
  const shimmer = useMemo(() => {
    // 第二層：更細、流得更快，疊上去有水在流的感覺
    const m = mat.clone()
    const n = mats.mud.normalMap!.clone()
    n.wrapS = n.wrapT = THREE.RepeatWrapping
    n.repeat.set(3.2, 2.2)
    n.needsUpdate = true
    m.normalMap = n
    m.normalScale.set(0.12, 0.12)
    m.transparent = true
    m.opacity = 0.28
    m.depthWrite = false
    return m
  }, [mat, mats])
  const dl = useMemo(makeDaylight, [])
  const base = useMemo(() => new THREE.Color('#23363e'), [])
  const glint = useRef<THREE.Mesh>(null)
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    mat.normalMap!.offset.x -= dt * 0.05
    shimmer.normalMap!.offset.x -= dt * 0.16
    shimmer.normalMap!.offset.y += dt * 0.02
    // 水面映著天色：傍晚是橘紅的，晚上是深藍的
    const t = useStore.getState().time
    sampleDaylight(t, dl)
    // 底色保持深藍綠，天色只淡淡地映上去（太多會像泥巴路）
    mat.color.copy(base).lerp(dl.sky, 0.06)
    mat.emissive.copy(dl.sky).multiplyScalar(0.025 * (1 - dl.moon))
    shimmer.color.copy(base).lerp(dl.sky, 0.35)
    shimmer.emissive.copy(dl.sky).multiplyScalar(0.04 * (1 - dl.moon))
    // 月光在水面上的一道亮光（晚上才有），跟著水紋閃
    if (glint.current) {
      const m = glint.current.material as THREE.MeshBasicMaterial
      m.opacity = dl.moon * (0.32 + Math.sin(clock.elapsedTime * 2.3) * 0.06 + Math.sin(clock.elapsedTime * 5.1) * 0.04)
    }
  })
  const gx = -3.5
  return (
    <group userData={{ noMerge: true }}>
      <mesh geometry={up} material={mat} receiveShadow />
      <mesh geometry={down} material={mat} receiveShadow />
      <mesh geometry={up} material={shimmer} position-y={0.005} />
      <mesh geometry={down} material={shimmer} position-y={0.005} />
      <mesh ref={glint} position={[gx, R.waterUp + 0.012, riverCenter(gx)]} rotation={[-Math.PI / 2, 0, 0.5]}>
        <planeGeometry args={[0.9, riverHalfWidth(gx) * 1.8]} />
        <meshBasicMaterial map={glintTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} color="#cfe0ff" />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 攔沙壩、踏腳石、釣魚平台、洗衣石、土地公石、水車
// ---------------------------------------------------------------------------

function Weir() {
  const c = riverCenter(R.weirX)
  const hw = riverHalfWidth(R.weirX)
  const w = hw * 2 + 2.4
  const bottom = R.waterDown - 0.5
  const top = R.waterUp + 0.04
  return (
    <group>
      <WBox mat="yard" size={[0.7, top - bottom, w]} position={[R.weirX, (top + bottom) / 2, c]} />
      {/* 壩兩端埋進河岸的水泥 */}
      {[-1, 1].map((s) => (
        <WBox key={s} mat="stone" size={[1.1, 0.5, 0.6]} position={[R.weirX, 0.05, c + s * (w / 2 - 0.1)]} />
      ))}
    </group>
  )
}

function Stones() {
  const mats = useMats()
  const stones = useMemo(() => {
    const r = seeded(91)
    return steppingStones().map(([x, z]) => ({ x, z, s: 0.28 + r() * 0.08, rot: r() * 3 }))
  }, [])
  return (
    <group>
      {stones.map((s, i) => (
        <mesh key={i} position={[s.x, riverWater(s.x) + 0.02, s.z]} rotation-y={s.rot} scale={[s.s, 0.16, s.s * 0.85]} material={mats.stone} castShadow receiveShadow>
          <cylinderGeometry args={[1, 1.12, 1, 9]} />
        </mesh>
      ))}
    </group>
  )
}

function Deck() {
  const d = R.deck
  const w = d.x1 - d.x0
  const len = d.z1 - d.z0
  const cx = (d.x0 + d.x1) / 2
  const cz = (d.z0 + d.z1) / 2
  const planks = Math.round(len / 0.24)
  return (
    <group>
      {/* 木板一片一片 */}
      {Array.from({ length: planks }, (_, i) => (
        <WBox key={i} mat="wood" size={[w, 0.05, 0.22]} position={[cx, d.y - 0.025, d.z0 + 0.12 + i * (len / planks)]} />
      ))}
      {/* 樑與柱子（插進水裡） */}
      {[d.x0 + 0.1, d.x1 - 0.1].map((x) => (
        <WBox key={x} mat="darkWood" size={[0.1, 0.12, len]} position={[x, d.y - 0.1, cz]} />
      ))}
      {[d.x0 + 0.1, d.x1 - 0.1].flatMap((x) =>
        [d.z0 + 0.15, cz, d.z1 - 0.15].map((z) => <WBox key={`${x}${z}`} mat="darkWood" size={[0.11, 1.0, 0.11]} position={[x, d.y - 0.55, z]} />),
      )}
      {/* 靠水那頭的矮欄杆 */}
      {[d.x0 + 0.08, d.x1 - 0.08].map((x) => (
        <WBox key={`p${x}`} mat="darkWood" size={[0.08, 0.6, 0.08]} position={[x, d.y + 0.3, d.z0 + 0.08]} />
      ))}
      <WBox mat="wood" size={[w, 0.06, 0.06]} position={[cx, d.y + 0.56, d.z0 + 0.08]} />
      {/* 放在平台上的水桶與魚簍 */}
      <mesh position={[d.x1 - 0.35, d.y + 0.16, d.z1 - 0.5]} castShadow>
        <cylinderGeometry args={[0.16, 0.13, 0.32, 12, 1, true]} />
        <meshStandardMaterial color="#3d6e8a" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[d.x0 + 0.35, d.y + 0.14, d.z1 - 0.45]} castShadow>
        <sphereGeometry args={[0.17, 10, 8]} />
        <meshStandardMaterial color="#b89a5c" roughness={0.9} />
      </mesh>
      {/* 靠在欄杆上的竹釣竿 */}
      <mesh position={[d.x1 - 0.12, d.y + 0.9, d.z0 + 0.2]} rotation={[-0.55, 0, 0.12]} castShadow>
        <cylinderGeometry args={[0.012, 0.022, 2.4, 6]} />
        <meshStandardMaterial color="#c8a864" roughness={0.6} />
      </mesh>
    </group>
  )
}

function WashingStones() {
  const mats = useMats()
  const z = riverCenter(R.washX) + riverHalfWidth(R.washX)
  const y = riverWater(R.washX)
  return (
    <group>
      {/* 大塊的平石頭，一半泡在水裡：以前大家蹲在這裡洗衣服 */}
      <mesh position={[R.washX, y + 0.04, z - 0.15]} rotation={[0.08, 0.3, -0.05]} scale={[0.8, 0.1, 0.5]} material={mats.stone} castShadow receiveShadow>
        <cylinderGeometry args={[1, 1.05, 1, 10]} />
      </mesh>
      <mesh position={[R.washX + 0.95, y + 0.03, z + 0.05]} rotation={[-0.05, 1.1, 0.06]} scale={[0.55, 0.09, 0.4]} material={mats.stone} castShadow receiveShadow>
        <cylinderGeometry args={[1, 1.05, 1, 9]} />
      </mesh>
      <mesh position={[R.washX - 0.9, y + 0.05, z + 0.1]} rotation={[0.04, -0.6, 0]} scale={[0.5, 0.11, 0.38]} material={mats.stone} castShadow receiveShadow>
        <cylinderGeometry args={[1, 1.05, 1, 8]} />
      </mesh>
      {/* 木盆與洗衣板 */}
      <mesh position={[R.washX + 0.4, 0.05, z + 0.9]} castShadow>
        <cylinderGeometry args={[0.32, 0.26, 0.16, 16, 1, true]} />
        <meshStandardMaterial color="#8a6238" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      <WBox mat="wood" size={[0.28, 0.02, 0.5]} position={[R.washX - 0.1, 0.12, z + 1.05]} rotation={[0.9, 0.2, 0]} />
    </group>
  )
}

function Shrine() {
  const mats = useMats()
  const { x, z } = R.shrine
  return (
    <group position={[x, 0.02, z]} rotation-y={-0.35}>
      {/* 石頭公：一顆長長的石頭，綁紅布 */}
      <mesh position={[0, 0.4, 0]} rotation={[0.05, 0.4, 0.06]} scale={[0.22, 0.46, 0.15]} material={mats.stone} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 0]} />
      </mesh>
      <mesh position={[0, 0.36, 0]} rotation-y={0.4} scale={[0.2, 0.06, 0.14]}>
        <cylinderGeometry args={[1, 1, 1, 10]} />
        <meshStandardMaterial color="#b3261e" roughness={0.8} />
      </mesh>
      {/* 石台、香爐、香、橘子 */}
      <WBox mat="stone" size={[0.8, 0.12, 0.55]} position={[0, 0.06, 0.28]} />
      <mesh position={[0, 0.19, 0.36]} castShadow>
        <cylinderGeometry args={[0.07, 0.06, 0.1, 10]} />
        <meshStandardMaterial color="#6e5230" roughness={0.6} metalness={0.3} />
      </mesh>
      {[-0.03, 0, 0.03].map((dx, i) => (
        <mesh key={i} position={[dx, 0.32, 0.36]} rotation-z={dx * 3}>
          <cylinderGeometry args={[0.005, 0.005, 0.24, 4]} />
          <meshStandardMaterial color="#b3261e" roughness={0.9} />
        </mesh>
      ))}
      {[-0.22, 0.22].map((dx) => (
        <mesh key={dx} position={[dx, 0.17, 0.4]} castShadow>
          <sphereGeometry args={[0.05, 8, 6]} />
          <meshStandardMaterial color="#e8892a" roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}

/** 土地公石前的小蠟燭：晚上一點暖光，閃閃的 */
function ShrineCandle() {
  const light = useRef<THREE.PointLight>(null)
  const flame = useRef<THREE.Mesh>(null)
  const { x, z } = R.shrine
  // 蠟燭在石台前（跟著石頭公轉 -0.35）
  const cx = x + Math.sin(-0.35) * 0.36 + 0.15
  const cz = z + Math.cos(-0.35) * 0.36
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const l = lanternAt(useStore.getState().time)
    const f = 0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07
    if (light.current) light.current.intensity = l * 0.7 * f
    if (flame.current) flame.current.scale.set(1, f, 1)
  })
  return (
    <group userData={{ noMerge: true }}>
      <mesh position={[cx, 0.2, cz]}>
        <cylinderGeometry args={[0.018, 0.018, 0.1, 8]} />
        <meshStandardMaterial color="#d8342a" roughness={0.6} />
      </mesh>
      <mesh ref={flame} position={[cx, 0.27, cz]}>
        <coneGeometry args={[0.014, 0.05, 8]} />
        <meshBasicMaterial color={new THREE.Color(3, 1.8, 0.6)} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[cx + 0.1, 0.55, cz + 0.35]} color="#ffb05a" distance={3.5} decay={2} intensity={0} />
    </group>
  )
}

function WheelFrame() {
  const { x, z, r } = R.wheel
  return (
    <group>
      {/* 兩邊的 A 字木架＋軸 */}
      {[-1, 1].map((s) => (
        <group key={s} position={[x, 0, z + s * 0.45]}>
          <WBox mat="darkWood" size={[0.12, r + 0.9, 0.12]} position={[-0.45, (r + 0.9) / 2 - 0.3, 0]} rotation={[0, 0, -0.32]} />
          <WBox mat="darkWood" size={[0.12, r + 0.9, 0.12]} position={[0.45, (r + 0.9) / 2 - 0.3, 0]} rotation={[0, 0, 0.32]} />
        </group>
      ))}
      <WBox mat="wood" size={[0.14, 0.14, 1.2]} position={[x, r * 0.55 + 0.1, z]} />
      {/* 引水的木槽（往北岸） */}
      <WBox mat="wood" size={[0.5, 0.18, 1.6]} position={[x, 0.18, z - 1.2]} />
    </group>
  )
}

/** 水車：慢慢轉，葉片撥著水 */
function Wheel() {
  const wheel = useRef<THREE.Group>(null)
  const { x, z, r } = R.wheel
  const paddles = 12
  useFrame((_, dt) => {
    if (wheel.current) wheel.current.rotation.z -= Math.min(dt, 0.1) * 0.45
  })
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: 0.85 }), [])
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a3220', roughness: 0.9 }), [])
  return (
    <group position={[x, r * 0.55 + 0.1, z]} userData={{ noMerge: true }}>
      <group ref={wheel}>
        {[-0.3, 0.3].map((dz) => (
          <mesh key={dz} position={[0, 0, dz]} material={dark} castShadow>
            <torusGeometry args={[r, 0.045, 6, 28]} />
          </mesh>
        ))}
        <mesh rotation-x={Math.PI / 2} material={dark}>
          <cylinderGeometry args={[0.13, 0.13, 0.75, 10]} />
        </mesh>
        {Array.from({ length: paddles }, (_, i) => {
          const a = (i / paddles) * Math.PI * 2
          return (
            <group key={i} rotation-z={a}>
              <mesh position={[r * 0.5, 0, 0]} material={dark}>
                <boxGeometry args={[r, 0.04, 0.04]} />
              </mesh>
              <mesh position={[r - 0.05, 0, 0]} material={wood} castShadow>
                <boxGeometry args={[0.28, 0.035, 0.62]} />
              </mesh>
            </group>
          )
        })}
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 溪床的小石頭（instanced）與南岸的大石頭（上面長青苔）
// ---------------------------------------------------------------------------

function Pebbles() {
  const mesh = useMemo(() => {
    const r = seeded(303)
    const n = 220
    const m = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), n)
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const col = new THREE.Color()
    let k = 0
    while (k < n) {
      const x = -30 + r() * 60
      const c = riverCenter(x)
      const hw = riverHalfWidth(x)
      // 大多在水邊與溪床，少數在岸上
      const off = (r() - 0.5) * 2 * (hw + 1.2)
      const z = c + off
      if (Math.abs(x - R.stonesX) < 0.5 && Math.abs(off) < hw) continue
      const s = 0.06 + Math.pow(r(), 2.5) * 0.32
      const y = riverGround(x, z) + s * 0.35
      q.setFromEuler(e.set(r() * 3, r() * 3, r() * 3))
      m.setMatrixAt(k, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s * (1 + r() * 0.5), s * 0.6, s)))
      col.setHSL(0.08 + r() * 0.06, 0.08 + r() * 0.08, 0.32 + r() * 0.25)
      m.setColorAt(k, col)
      k++
    }
    m.instanceMatrix.needsUpdate = true
    m.castShadow = true
    m.receiveShadow = true
    return m
  }, [])
  return <primitive object={mesh} />
}

function Boulder() {
  const mats = useMats()
  const { x, z, r } = R.boulder
  const moss = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4d6b34', roughness: 1, flatShading: true }), [])
  return (
    <group position={[x, 0, z]} userData={{ noMerge: true }}>
      <mesh position={[0, r * 0.45, 0]} scale={[r, r * 0.75, r * 0.85]} material={mats.stone} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 1]} />
      </mesh>
      <mesh position={[-0.1, r * 0.95, 0.05]} scale={[r * 0.75, r * 0.2, r * 0.6]} material={moss}>
        <icosahedronGeometry args={[1, 1]} />
      </mesh>
      <mesh position={[0.9, 0.12, 0.35]} scale={[0.38, 0.26, 0.3]} rotation-y={0.8} material={mats.stone} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 0]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 晚上的補光：溪邊沒有路燈，給一點冷冷的月光，讓水面和石頭看得出形狀
// ---------------------------------------------------------------------------

function NightFill() {
  const hemi = useRef<THREE.HemisphereLight>(null)
  useFrame(() => {
    const l = lanternAt(useStore.getState().time)
    if (hemi.current) hemi.current.intensity = 0.28 * l
  })
  return <hemisphereLight ref={hemi} color="#8fa8d8" groundColor="#1d2a1a" intensity={0} />
}
