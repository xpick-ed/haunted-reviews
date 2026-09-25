import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { FADE_STALLS, MARKET, MARKET_NPCS } from '../world/sceneMarket'
import { TILE, WBox, canvasTexture, planeGeo, seeded, useMats } from './kit'
import { MergeStatic } from './MergeStatic'
import { Tree } from './Tree'
import { FishTub, Stall, signTexture } from './MarketStalls'
import { FallingPaper, Gate, GhostFires, GroundMist, LanternStrings } from './MarketFx'
import { Chibi, ChibiNpc, newDrive, type Drive } from '../chars/Chibi'
import { SPECS, type ChibiSpec } from '../chars/specs'

// 鬼夜市的畫面（DESIGN §25.1）：規則在 src/world/sceneMarket.ts。
// 永遠是深夜：場景自己的燈（紅、琥珀、鬼火青）＋青色的霧。好兄弟擺攤、逛街。

export function MarketScene() {
  const quality = useStore((s) => s.quality)
  const outline = quality === 'high'
  // 第一次走進來（每晚一次）：阿嬤的感想
  useEffect(() => {
    const s = useStore.getState()
    if (s.flags.market_visit_today) return
    useStore.setState({ flags: { ...s.flags, market_visit_today: true } })
    const id = window.setTimeout(() => useStore.getState().bark(s.flags.hongyi_met ? 'market.arrive.2' : 'market.arrive.1'), 1400)
    return () => window.clearTimeout(id)
  }, [])
  return (
    <group>
      <Atmosphere />
      <Ground />
      <Backdrop />
      <MergeStatic>
        {MARKET.stalls
          .filter((d) => !FADE_STALLS.includes(d.kind))
          .map((d) => (
            <Stall key={d.kind} def={d} />
          ))}
        <Stage />
        <Stools />
      </MergeStatic>
      {/* 鏡頭那一側的攤子：擋到阿嬤時淡出（每個攤子自己合併、自己淡） */}
      {MARKET.stalls
        .filter((d) => FADE_STALLS.includes(d.kind))
        .map((d) => (
          <Fader key={d.kind} id={`stall_${d.kind}`}>
            <MergeStatic>
              <Stall def={d} />
            </MergeStatic>
          </Fader>
        ))}
      <FishTub def={MARKET.stalls.find((s) => s.kind === 'fish')!} />
      <Grill />
      <Puppets />
      <Tree position={[MARKET.tree.x, 0, MARKET.tree.z]} scale={0.85} />
      <Gate />
      <LanternStrings />
      <GhostFires />
      <FallingPaper />
      <GroundMist />
      <ChibiNpc id="jinyubo" pose="idle" position={[MARKET_NPCS.jinyubo.x, 0, MARKET_NPCS.jinyubo.z]} heading={MARKET_NPCS.jinyubo.heading} seesGhosts outline={outline} />
      <ChibiNpc id="hongyi" pose="fan" position={[MARKET_NPCS.hongyi.x, 0, MARKET_NPCS.hongyi.z]} heading={MARKET_NPCS.hongyi.heading} seesGhosts outline={outline} />
      <Shoppers outline={outline} />
      <Shades />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 淡出：World 每幀算出哪些東西擋在鏡頭和阿嬤中間（MARKET_SCENE.buildings），寫在 store.faded。
// 跟三合院的 Fader 一樣：子樹裡的網格換成自己的材質複本，才能單獨調透明度。
// ---------------------------------------------------------------------------

function Fader({ id, children }: { id: string; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const clones = useRef(new Map<THREE.Material, THREE.Material>())
  const seen = useRef(new WeakSet<THREE.Object3D>())
  const opacity = useRef(1)
  const frames = useRef(0)
  useFrame(() => {
    const g = group.current
    if (!g) return
    // MergeStatic 合併完（幾幀之內）就不會再有新網格
    if (frames.current++ < 120)
      g.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh || seen.current.has(m)) return
        seen.current.add(m)
        const swap = (mat: THREE.Material) => {
          let c = clones.current.get(mat)
          if (!c) {
            c = mat.clone()
            // 記住原本的透明度（水、玻璃本來就是半透明）
            c.userData.baseOpacity = mat.opacity
            c.userData.baseTransparent = mat.transparent
            clones.current.set(mat, c)
          }
          return c
        }
        m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material)
      })
    const target = useStore.getState().faded.split(',').includes(id) ? 0.18 : 1
    const prev = opacity.current
    opacity.current += (target - opacity.current) * 0.15
    if (Math.abs(opacity.current - target) < 0.01) opacity.current = target
    if (Math.abs(opacity.current - prev) < 1e-4) return
    const o = opacity.current
    for (const c of clones.current.values()) {
      const wasT = c.transparent
      c.opacity = c.userData.baseOpacity * o
      c.transparent = c.userData.baseTransparent || o < 0.995
      c.depthWrite = !c.userData.baseTransparent && o > 0.5
      if (wasT !== c.transparent) c.needsUpdate = true
    }
  })
  return (
    <group ref={group} userData={{ noMerge: true }}>
      {children}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 燈與霧
// ---------------------------------------------------------------------------

const FOG = new THREE.Color('#0c2224')

function Atmosphere() {
  const { scene } = useThree()
  const lights = useRef<(THREE.PointLight | null)[]>([])
  // 霧拉近一點（離開夜市時還原）；顏色每幀蓋掉全域天色給的顏色
  useEffect(() => {
    const f = scene.fog as THREE.Fog | null
    if (!f) return
    const near = f.near
    const far = f.far
    f.near = 16
    f.far = 62
    return () => {
      f.near = near
      f.far = far
    }
  }, [scene])
  const L = useMemo(
    () => [
      { p: [0, 2.7, 5.6] as const, c: '#ff7a3a', i: 7 },
      { p: [0, 2.7, -0.2] as const, c: '#4fe0c8', i: 6 },
      { p: [0, 2.7, -5.8] as const, c: '#ff5a3a', i: 7 },
      { p: [-7.4, 2.7, 0] as const, c: '#4fe0c8', i: 6 },
      { p: [7.4, 2.7, 0] as const, c: '#ffae4a', i: 6 },
      { p: [0, 2.0, -7.9] as const, c: '#ff3a3a', i: 5 },
    ],
    [],
  )
  useFrame(({ clock }) => {
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(FOG)
    const t = clock.elapsedTime
    lights.current.forEach((l, i) => {
      if (!l) return
      // 燈籠光微微晃
      l.intensity = L[i].i * (0.88 + Math.sin(t * 2.3 + i * 1.7) * 0.06 + Math.sin(t * 7.1 + i) * 0.04)
    })
  })
  return (
    <group>
      <hemisphereLight args={['#58d8c8', '#1a0e14', 0.4]} />
      {L.map((l, i) => (
        <pointLight
          key={i}
          ref={(el) => {
            lights.current[i] = el
          }}
          position={l.p as unknown as [number, number, number]}
          color={l.c}
          intensity={l.i}
          distance={10}
          decay={1.8}
        />
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 地面：石板街、泥土地、街外的黑樹影
// ---------------------------------------------------------------------------

function Ground() {
  const mats = useMats()
  const dirt = useMemo(() => {
    const m = mats.mud.clone()
    m.color.setRGB(0.32, 0.3, 0.3)
    return m
  }, [mats])
  const paving = useMemo(() => {
    const m = mats.stone.clone()
    m.color.setRGB(0.55, 0.55, 0.56)
    return m
  }, [mats])
  const L = MARKET.streetHalf + 0.9
  const C = MARKET.crossHalf + 0.9
  return (
    <group>
      <mesh geometry={planeGeo(90, 70, TILE.mud)} material={dirt} rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow />
      <mesh geometry={planeGeo(L * 2, 21, TILE.stone)} material={paving} rotation-x={-Math.PI / 2} position={[0, 0.012, -0.2]} receiveShadow />
      <mesh geometry={planeGeo(29, C * 2, TILE.stone)} material={paving} rotation-x={-Math.PI / 2} position={[0, 0.014, 0]} receiveShadow />
      {/* 往南出去的泥土小路（回土地公廟） */}
      <mesh geometry={planeGeo(3.2, 14, TILE.mud)} material={mats.mud} rotation-x={-Math.PI / 2} position={[0, 0.006, 16]} receiveShadow />
    </group>
  )
}

/** 街外面：一圈黑黑的樹影和竹叢，讓夜市像是在林子裡的空地 */
function Backdrop() {
  const trees = useMemo(() => {
    const r = seeded(2024)
    const out: { x: number; z: number; s: number; h: number }[] = []
    // 只種在北邊和西邊：鏡頭在東南方，那兩邊的樹會擋住畫面
    for (let i = 0; i < 40; i++) {
      const a = Math.PI * 0.55 + (i / 40) * Math.PI * 1.15 + r() * 0.05
      const rad = 16.5 + r() * 5
      const x = Math.cos(a) * rad * 1.05
      const z = Math.sin(a) * rad * 0.72
      if (z > 3 && x > -14) continue
      out.push({ x, z, s: 1.4 + r() * 1.2, h: 3 + r() * 3 })
    }
    // 攤子後面空地上的幾棵（北側）
    for (const [x, z] of [
      [-9, -7],
      [9, -7.5],
      [-5.8, -8.6],
      [5.6, -9.2],
    ])
      out.push({ x, z, s: 1.3 + r() * 0.6, h: 3.2 + r() * 1.5 })
    return out
  }, [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#10201e', roughness: 1, flatShading: true }), [])
  const trunk = useMemo(() => new THREE.MeshStandardMaterial({ color: '#16110e', roughness: 1 }), [])
  return (
    <MergeStatic>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]}>
          <mesh material={trunk} position={[0, t.h * 0.3, 0]}>
            <cylinderGeometry args={[0.12, 0.18, t.h * 0.6, 6]} />
          </mesh>
          <mesh material={mat} position={[0, t.h * 0.7, 0]} scale={[t.s, t.s * 1.2, t.s]}>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
        </group>
      ))}
    </MergeStatic>
  )
}

// ---------------------------------------------------------------------------
// 布袋戲台（橫街西端）：戲台＋兩尊會動的布袋戲偶＋前面的板凳
// ---------------------------------------------------------------------------

const stageSign = () => signTexture('掌中戲', '#3a0a0a', '#f4d27a')

function Stage() {
  const mats = useMats()
  const sign = useMemo(stageSign, [])
  const backdrop = useMemo(
    () =>
      canvasTexture(256, 128, (ctx, w, h) => {
        // 戲台布景：遠山、雲、月亮
        const g = ctx.createLinearGradient(0, 0, 0, h)
        g.addColorStop(0, '#1d2f5a')
        g.addColorStop(1, '#3a2a4a')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = '#f2e6b0'
        ctx.beginPath()
        ctx.arc(w * 0.75, h * 0.3, 16, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#2a3a5a'
        ctx.beginPath()
        ctx.moveTo(0, h)
        ctx.lineTo(w * 0.25, h * 0.5)
        ctx.lineTo(w * 0.5, h * 0.8)
        ctx.lineTo(w * 0.7, h * 0.45)
        ctx.lineTo(w, h)
        ctx.fill()
      }),
    [],
  )
  const s = MARKET.stage
  return (
    <group position={[s.x, 0, s.z]} rotation-y={Math.PI / 2}>
      {/* 台子 */}
      <WBox mat="darkWood" size={[2.6, 1.0, 1.3]} position={[0, 0.5, 0]} />
      <mesh material={mats.redPaper} position={[0, 0.5, 0.652]}>
        <planeGeometry args={[2.5, 0.8]} />
      </mesh>
      {/* 框：兩柱、上樑、招牌 */}
      {[-1.2, 1.2].map((x) => (
        <WBox key={x} mat="redPaint" size={[0.14, 1.9, 0.14]} position={[x, 1.95, 0.5]} />
      ))}
      <WBox mat="redPaint" size={[2.7, 0.34, 0.2]} position={[0, 2.95, 0.5]} />
      <WBox mat="gold" size={[2.8, 0.06, 0.24]} position={[0, 3.14, 0.5]} castShadow={false} />
      <mesh position={[0, 2.95, 0.61]}>
        <planeGeometry args={[1.1, 0.3]} />
        <meshStandardMaterial map={sign} emissiveMap={sign} emissive="#ffffff" emissiveIntensity={0.5} />
      </mesh>
      {/* 布景 */}
      <mesh position={[0, 1.9, -0.2]}>
        <planeGeometry args={[2.3, 1.7]} />
        <meshStandardMaterial map={backdrop} emissiveMap={backdrop} emissive="#ffffff" emissiveIntensity={0.35} />
      </mesh>
      {/* 兩側紅布 */}
      {[-1, 1].map((x) => (
        <mesh key={x} material={mats.redPaper} position={[x * 1.05, 1.95, 0.4]}>
          <planeGeometry args={[0.3, 1.8]} />
        </mesh>
      ))}
      {/* 小屋頂 */}
      <WBox mat="roof" size={[3.0, 0.1, 1.5]} position={[0, 3.3, 0.2]} rotation-x={0.12} />
    </group>
  )
}

/** 戲偶：兩尊，左右晃、上下跳（戲台在 x 軸西端、朝 +x） */
function Puppets() {
  const a = useRef<THREE.Group>(null)
  const b = useRef<THREE.Group>(null)
  const mat = useMemo(
    () => ({
      robeA: new THREE.MeshStandardMaterial({ color: '#e8e2d4', emissive: '#6a6050', emissiveIntensity: 0.4 }),
      robeB: new THREE.MeshStandardMaterial({ color: '#b8322a', emissive: '#5a1010', emissiveIntensity: 0.4 }),
      skin: new THREE.MeshStandardMaterial({ color: '#f0d0b0', emissive: '#6a5040', emissiveIntensity: 0.4 }),
      hat: new THREE.MeshStandardMaterial({ color: '#1a1a1e', roughness: 0.5 }),
      gold: new THREE.MeshStandardMaterial({ color: '#d8a444', metalness: 0.6, roughness: 0.3 }),
    }),
    [],
  )
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // 打鬥：一來一往
    const k = Math.sin(t * 1.6)
    if (a.current) {
      a.current.position.set(0.25 + Math.max(0, k) * 0.2, 1.35 + Math.abs(Math.sin(t * 5)) * 0.08, -0.35 - k * 0.25)
      a.current.rotation.set(0, 0, Math.sin(t * 4) * 0.25)
    }
    if (b.current) {
      b.current.position.set(0.25 + Math.max(0, -k) * 0.2, 1.35 + Math.abs(Math.cos(t * 4.5)) * 0.08, 0.35 - k * 0.25)
      b.current.rotation.set(0, 0, Math.cos(t * 3.7) * 0.25)
    }
  })
  const s = MARKET.stage
  const puppet = (robe: THREE.Material, hat: THREE.Material) => (
    <group>
      <mesh material={robe} position={[0, 0, 0]}>
        <coneGeometry args={[0.13, 0.36, 10]} />
      </mesh>
      <mesh material={mat.skin} position={[0, 0.26, 0]}>
        <sphereGeometry args={[0.085, 12, 10]} />
      </mesh>
      <mesh material={hat} position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.05, 0.09, 0.08, 10]} />
      </mesh>
    </group>
  )
  return (
    <group position={[s.x + 0.1, 0, s.z]} userData={{ noMerge: true }}>
      <group ref={a}>{puppet(mat.robeA, mat.hat)}</group>
      <group ref={b}>{puppet(mat.robeB, mat.gold)}</group>
    </group>
  )
}

/** 戲台前的板凳 */
function Stools() {
  const pts = [
    [-10.6, -0.9],
    [-10.4, 0.2],
    [-10.7, 1.1],
  ]
  return (
    <group>
      {pts.map(([x, z]) => (
        <group key={`${x},${z}`} position={[x, 0, z]}>
          <WBox mat="wood" size={[0.5, 0.05, 0.28]} position={[0, 0.42, 0]} />
          {[-0.2, 0.2].map((dx) => (
            <WBox key={dx} mat="darkWood" size={[0.05, 0.4, 0.24]} position={[dx, 0.2, 0]} />
          ))}
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 香腸攤的煙
// ---------------------------------------------------------------------------

const smokeTex = canvasTexture(64, 64, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2)
  g.addColorStop(0, 'rgba(220,220,225,0.45)')
  g.addColorStop(1, 'rgba(220,220,225,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
})

function Grill() {
  const d = MARKET.stalls.find((s) => s.kind === 'sausage')!
  const puffs = useRef<(THREE.Sprite | null)[]>([])
  // 攤子本地座標 (0, 1.0, 0.5) 轉到世界
  const base = useMemo(() => new THREE.Vector3(0, 1.0, 0.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), d.face).add(new THREE.Vector3(d.x, 0, d.z)), [d])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    puffs.current.forEach((p, i) => {
      if (!p) return
      const k = (t * 0.35 + i / 5) % 1
      p.position.set(base.x + Math.sin(k * 4 + i) * 0.15, base.y + k * 1.6, base.z + Math.cos(k * 3 + i) * 0.1)
      const sc = 0.25 + k * 0.7
      p.scale.set(sc, sc, 1)
      ;(p.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.35
    })
  })
  return (
    <group userData={{ noMerge: true }}>
      {Array.from({ length: 5 }, (_, i) => (
        <sprite
          key={i}
          ref={(el) => {
            puffs.current[i] = el
          }}
        >
          <spriteMaterial map={smokeTex} transparent depthWrite={false} opacity={0} />
        </sprite>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 好兄弟：顧攤的、逛街的
// ---------------------------------------------------------------------------

/** 從現有角色借身體，換顏色、變成鬼 */
function ghostSpec(base: string, id: string, top: string, hair?: string): ChibiSpec {
  const b = SPECS[base]
  return { ...b, id, ghost: true, top: { ...b.top, color: top }, hair: hair ? { ...b.hair, color: hair } : b.hair }
}

/** 逛街的好兄弟：沿著固定的路線慢慢走，偶爾停下來看攤子 */
const ROUTES: [number, number][][] = [
  [
    [-0.9, 7.2],
    [-0.9, -6.8],
    [0.9, -6.8],
    [0.9, 7.2],
  ],
  [
    [-10.3, -0.7],
    [10.3, -0.7],
    [10.3, 0.7],
    [-10.3, 0.7],
  ],
  [
    [1.3, 6.4],
    [1.3, -0.4],
    [-8.8, -0.4],
    [-8.8, 0.9],
    [-1.3, 0.9],
    [-1.3, 6.4],
  ],
]

// 完整的 3D 角色很貴（手機 draw call），只放一位在主街逛；其他人潮用下面便宜的 <Shades>
const SHOPPER_SPECS = [() => ghostSpec('zhang', 'mk_shop1', '#3a5a6a')]

function Shoppers({ outline }: { outline: boolean }) {
  const specs = useMemo(() => SHOPPER_SPECS.map((f) => f()), [])
  return (
    <group>
      {specs.map((spec, i) => (
        <Walker key={spec.id} spec={spec} route={ROUTES[i]} offset={i * 0.37} outline={outline} />
      ))}
    </group>
  )
}

function routeLength(r: [number, number][]) {
  let L = 0
  for (let i = 0; i < r.length; i++) {
    const a = r[i]
    const b = r[(i + 1) % r.length]
    L += Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  return L
}

function Walker({ spec, route, offset, outline }: { spec: ChibiSpec; route: [number, number][]; offset: number; outline: boolean }) {
  const group = useRef<THREE.Group>(null)
  const drive = useRef<Drive>(newDrive({ pose: 'idle' }))
  const st = useRef({ s: offset * routeLength(route), pause: 0, nextPause: 4 + offset * 6 })
  const len = useMemo(() => routeLength(route), [route])
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const w = st.current
    const d = drive.current
    if (w.pause > 0) {
      w.pause -= dt
      d.speed = 0
    } else {
      w.s = (w.s + dt * 0.55) % len
      d.speed = 0.55
      w.nextPause -= dt
      if (w.nextPause <= 0) {
        w.pause = 2 + Math.random() * 3
        w.nextPause = 6 + Math.random() * 8
      }
    }
    // 路線上的位置
    let s = w.s
    for (let i = 0; i < route.length; i++) {
      const a = route[i]
      const b = route[(i + 1) % route.length]
      const l = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (s <= l) {
        const k = s / l
        group.current?.position.set(a[0] + (b[0] - a[0]) * k, 0, a[1] + (b[1] - a[1]) * k)
        const h = Math.atan2(b[0] - a[0], b[1] - a[1])
        // 停下來時轉頭看旁邊的攤子
        d.heading = w.pause > 0 ? h + (a[0] < 0 ? -1.2 : 1.2) : h
        break
      }
      s -= l
    }
  })
  return (
    <group ref={group} userData={{ noMerge: true }}>
      <Chibi spec={spec} drive={drive} outline={outline} />
    </group>
  )
}

/**
 * 人潮與顧攤的：很淡的青色人影（頭＋斗篷），一個 InstancedMesh 畫完，便宜又熱鬧。
 * 完整的 3D 角色只給有名字的（金魚伯、紅姨）和一位逛街的，手機才跑得動。
 */
const WALKING = 12
/** 顧攤的好兄弟（沒有名字的）：站在這些攤子的櫃台後面 */
const VENDOR_STALLS = ['snail', 'paper', 'sausage', 'money', 'candy', 'balloon', 'mask', 'sugar', 'drink', 'marble'] as const
const SHADES = WALKING + VENDOR_STALLS.length

function Shades() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  // 一個輪廓：圓頭、斗篷、下擺散開（旋轉成形，一個網格）
  const geo = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          [0.0, 0.0],
          [0.3, 0.02],
          [0.25, 0.25],
          [0.2, 0.6],
          [0.16, 0.9],
          [0.19, 1.02],
          [0.18, 1.16],
          [0.11, 1.28],
          [0.0, 1.32],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        14,
      ),
    [],
  )
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.85, 0.78), transparent: true, opacity: 0.2, depthWrite: false }), [])
  const seeds = useMemo(() => {
    const r = seeded(4040)
    return Array.from({ length: WALKING }, (_, i) => {
      const cross = i % 2 === 0
      return { cross, a: cross ? -11 + r() * 22 : -7 + r() * 14.5, lane: (r() - 0.5) * (cross ? 2.6 : 3.4), v: (0.25 + r() * 0.35) * (r() < 0.5 ? -1 : 1), p: r() * 6.28 }
    })
  }, [])
  const vendors = useMemo(
    () =>
      VENDOR_STALLS.map((k, i) => {
        const d = MARKET.stalls.find((s) => s.kind === k)!
        // 攤子本地 (0, 0, -0.3)：櫃台後面
        const p = new THREE.Vector3(0, 0, -0.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), d.face)
        return { x: d.x + p.x, z: d.z + p.z, face: d.face, p: i * 1.7 }
      }),
    [],
  )
  const tmp = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }, rawDt) => {
    const im = mesh.current
    if (!im) return
    const dt = Math.min(rawDt, 0.1)
    const t = clock.elapsedTime
    seeds.forEach((s, i) => {
      s.a += s.v * dt
      const lim = s.cross ? 11 : 7.5
      if (s.a > lim) s.a = -lim
      if (s.a < -lim) s.a = lim
      const bob = Math.sin(t * 2 + s.p) * 0.05
      if (s.cross) tmp.position.set(s.a, 0.1 + bob, s.lane)
      else tmp.position.set(s.lane, 0.1 + bob, s.a)
      // 飄的時候微微前傾、左右晃
      tmp.rotation.set(Math.sin(t * 1.3 + s.p) * 0.06, 0, Math.sin(t * 0.9 + s.p) * 0.08)
      tmp.scale.setScalar(0.9 + Math.sin(s.p) * 0.1)
      tmp.updateMatrix()
      im.setMatrixAt(i, tmp.matrix)
    })
    vendors.forEach((v, i) => {
      tmp.position.set(v.x, 0.12 + Math.sin(t * 1.6 + v.p) * 0.04, v.z)
      tmp.rotation.set(0, v.face, Math.sin(t * 0.7 + v.p) * 0.05)
      tmp.scale.setScalar(1.05)
      tmp.updateMatrix()
      im.setMatrixAt(WALKING + i, tmp.matrix)
    })
    im.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geo, mat, SHADES]} frustumCulled={false} renderOrder={3} userData={{ noMerge: true }} />
}

