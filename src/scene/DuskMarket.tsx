import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { DMARKET, marketOpen, todaySpecial } from '../world/sceneDuskMarket'
import { INGREDIENTS } from '../world/night/items'
import { player } from '../world/player'
import { lanternAt } from './daylight'
import { TILE, WBox, planeGeo, seeded, useMats } from './kit'
import { MergeStatic } from './MergeStatic'
import { Fader } from './OldStreetFader'
import { Paddies, PoleLine, useWindowGlow } from './VillageKit'
import { BULBS, MarketStatic, NightTarps, SpecialBoard, StallRoof } from './DuskMarketStalls'
import { Chibi, SEAT_Y, newDrive, type Drive, type PoseName } from '../chars/Chibi'
import { SPECS } from '../chars/specs'
import '../chars/specs.dmarket'

// 黃昏市場的畫面（DESIGN §32.1）：規則與座標在 src/world/sceneDuskMarket.ts。
// 傍晚：燈泡亮著、攤販吆喝、有人在買菜；晚上：收攤了，帆布蓋起來，只剩阿葉嬸（陰陽眼）守著她的老位置。
// 高的東西（攤子、牌樓、房子）都在北邊；南邊鏡頭這一側只放矮的（菜攤、豆花車、水溝、水田）。

const M = DMARKET
const N = M.north

export function DuskMarketScene() {
  const quality = useStore((s) => s.quality)
  const open = useStore((s) => marketOpen(s))
  const night = useStore((s) => s.meta.night)
  const outline = quality === 'high'
  // 第一次走進來（每天一次）：阿嬤的感想
  useEffect(() => {
    const s = useStore.getState()
    if (s.flags.dmarket_visit_today) return
    useStore.setState({ flags: { ...s.flags, dmarket_visit_today: true } })
    const id = window.setTimeout(() => {
      const st = useStore.getState()
      st.bark(marketOpen(st) ? (st.flags.dmarket_seen ? 'dm.arrive.dusk.2' : 'dm.arrive.dusk.1') : 'dm.arrive.night')
      if (!st.flags.dmarket_seen) useStore.setState({ flags: { ...useStore.getState().flags, dmarket_seen: true } })
    }, 1400)
    return () => window.clearTimeout(id)
  }, [])
  return (
    <group>
      <Grounds />
      <Backdrop />
      <MergeStatic>
        <MarketStatic />
      </MergeStatic>
      {/* 屋頂：擋到鏡頭時淡掉 */}
      {(Object.keys(M.stalls) as (keyof typeof M.stalls)[]).map((id) => (
        <Fader key={id} id={`dm_roof_${id}`}>
          <MergeStatic>
            <StallRoof id={id} />
          </MergeStatic>
        </Fader>
      ))}
      <group visible={!open}>
        <NightTarps />
      </group>
      <SpecialBoard text={INGREDIENTS[todaySpecial(night)].name} />
      <Bulbs />
      <MarketLight />
      <Vendors open={open} outline={outline} />
      <Aye outline={outline} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 地面：水泥地（濕濕的水窪）、南邊的水溝和水田、草地
// ---------------------------------------------------------------------------

function Grounds() {
  const mats = useMats()
  const floor = useMemo(() => {
    const m = mats.yard.clone()
    m.color.setRGB(0.66, 0.66, 0.68)
    return m
  }, [mats])
  const puddle = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a4450', roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0.7 }), [])
  const water = useMemo(() => new THREE.MeshStandardMaterial({ color: '#141c20', roughness: 0.1, metalness: 0.3 }), [])
  const puddles = useMemo(() => {
    const r = seeded(9090)
    return Array.from({ length: 9 }, () => ({ x: -12 + r() * 24, z: -2.8 + r() * 4.8, sx: 0.4 + r() * 0.8, sz: 0.25 + r() * 0.5, a: r() * Math.PI }))
  }, [])
  return (
    <group>
      <mesh geometry={planeGeo(200, 200, TILE.grass)} material={mats.grass} rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow />
      <mesh geometry={planeGeo(31, 12.6, TILE.yard)} material={floor} rotation-x={-Math.PI / 2} position={[0, 0.012, -1.6]} receiveShadow />
      {puddles.map((p, i) => (
        <mesh key={i} material={puddle} rotation={[-Math.PI / 2, 0, p.a]} position={[p.x, 0.016, p.z]} scale={[p.sx, p.sz, 1]}>
          <circleGeometry args={[1, 18]} />
        </mesh>
      ))}
      {/* 走道南邊的排水溝（鐵格子蓋） */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.018, 4.55]}>
        <planeGeometry args={[30, 0.3]} />
        <meshStandardMaterial color="#2a2c2e" roughness={0.6} metalness={0.4} />
      </mesh>
      {/* 水溝、水田（鏡頭這一側） */}
      {[5.0, 5.6].map((z) => (
        <WBox key={z} mat="stone" size={[60, 0.3, 0.12]} position={[0, 0.15, z]} />
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.06, 5.3]} material={water}>
        <planeGeometry args={[60, 0.6]} />
      </mesh>
      <Paddies xs={[-36, -24, -12, 0, 12, 24, 36]} zs={[6.0, 15, 24]} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 背景：北邊的透天厝（晚上窗戶亮）、電線桿
// ---------------------------------------------------------------------------

const HOUSES = [
  { x: -11.5, w: 6.5, h: 6.2, color: '#d8cfbe' },
  { x: -4.2, w: 5.4, h: 7.0, color: '#c9c2b4' },
  { x: 4.6, w: 6.0, h: 6.4, color: '#e0d6c2' },
  { x: 11.8, w: 5.8, h: 5.6, color: '#cfc6b6' },
]

function Backdrop() {
  const mats = useMats()
  const glow = useWindowGlow('#ffd9a0', 0.9)
  const wallMats = useMemo(
    () =>
      HOUSES.map((h) => {
        const m = mats.plaster.clone()
        m.color.set(h.color)
        return m
      }),
    [mats],
  )
  const z = -11.2
  return (
    <group>
      <MergeStatic>
        {HOUSES.map((h, i) => (
          <group key={h.x}>
            <mesh material={wallMats[i]} position={[h.x, h.h / 2, z]} castShadow receiveShadow>
              <boxGeometry args={[h.w, h.h, 3]} />
            </mesh>
            {/* 頂樓的鐵皮加蓋、水塔 */}
            <mesh position={[h.x - h.w * 0.15, h.h + 0.6, z - 0.2]} castShadow>
              <boxGeometry args={[h.w * 0.6, 1.2, 2.2]} />
              <meshStandardMaterial color="#7d9aa0" roughness={0.55} metalness={0.3} />
            </mesh>
            <mesh position={[h.x + h.w * 0.3, h.h + 0.55, z]}>
              <cylinderGeometry args={[0.45, 0.45, 1.1, 12]} />
              <meshStandardMaterial color="#e8e4dc" roughness={0.5} />
            </mesh>
            {/* 窗戶（二、三樓） */}
            {[2.6, 4.9].map((y) =>
              [-0.25, 0.25].map((k) => (
                <mesh key={`${y}${k}`} material={glow} position={[h.x + k * h.w, y, z + 1.51]}>
                  <planeGeometry args={[1.0, 0.9]} />
                </mesh>
              )),
            )}
          </group>
        ))}
      </MergeStatic>
      <PoleLine xs={[-16, -6, 6, 16]} z={-8.4} lamps={[]} lampZ={-8.4} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 燈：屋簷下的燈泡（傍晚亮、收攤關掉）＋一盞跟著阿嬤走的暖光
// ---------------------------------------------------------------------------

function Bulbs() {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff2c0', toneMapped: false }), [])
  const cord = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.8 }), [])
  const on = useMemo(() => new THREE.Color(1.6, 1.3, 0.75), [])
  const off = useMemo(() => new THREE.Color('#3a3530'), [])
  useFrame(() => {
    const s = useStore.getState()
    const k = marketOpen(s) ? 0.55 + 0.45 * lanternAt(s.time) : 0
    mat.color.copy(off).lerp(on, k)
  })
  return (
    <group>
      {BULBS.map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh material={cord} position={[0, (N.roofY + 0.05 - y) / 2, 0]}>
            <boxGeometry args={[0.012, N.roofY + 0.05 - y, 0.012]} />
          </mesh>
          <mesh material={mat}>
            <sphereGeometry args={[0.07, 10, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** 整個市場一盞點光源：跟著阿嬤在走道上移動（燈泡太多顆，不能每顆都打光） */
function MarketLight() {
  const light = useRef<THREE.PointLight>(null)
  useFrame(() => {
    const l = light.current
    if (!l) return
    const s = useStore.getState()
    l.position.set(THREE.MathUtils.clamp(player.x, -12, 12), 2.1, -2.2)
    l.intensity = marketOpen(s) ? 1.2 + 3.0 * lanternAt(s.time) : 0
  })
  return <pointLight ref={light} color="#ffd8a0" intensity={0} distance={11} decay={2} />
}

// ---------------------------------------------------------------------------
// 人：攤販（傍晚）、來買菜的人（傍晚）、阿葉嬸（陰陽眼）
// ---------------------------------------------------------------------------

interface NpcDef {
  id: string
  x: number
  z: number
  heading: number
  pose: PoseName
  /** 坐在板凳上（板凳的高度） */
  seat?: number
}

/** 攤販站在櫃台後面；菜阿婆坐小板凳 */
const VENDORS: NpcDef[] = [
  { id: 'wanbo', x: (M.stalls.zahuo.x0 + M.stalls.zahuo.x1) / 2 + 0.3, z: N.front - 1.0, heading: 0, pose: 'shopkeeper' },
  { id: 'alan', x: (M.stalls.pork.x0 + M.stalls.pork.x1) / 2 - 0.4, z: N.front - 1.0, heading: 0, pose: 'shopkeeper' },
  { id: 'azhong', x: (M.stalls.fish.x0 + M.stalls.fish.x1) / 2 + 0.2, z: N.front - 1.0, heading: 0, pose: 'shopkeeper' },
  { id: 'guoshen', x: (M.stalls.guo.x0 + M.stalls.guo.x1) / 2 - 0.2, z: N.front - 1.0, heading: 0, pose: 'shopkeeper' },
  { id: 'caipo', x: M.veg.x - M.veg.w / 2 + 0.25, z: M.veg.z + M.veg.d / 2 + 0.3, heading: 2.4, pose: 'sit', seat: 0.34 },
  { id: 'douhuabo', x: M.douhua.x + 1.25, z: M.douhua.z + 0.35, heading: -2.2, pose: 'idle' },
]

/** 站著買菜的人（有碰撞，見 sceneDuskMarket 的 npcs） */
const SHOPPERS: NpcDef[] = [
  { id: 'dm_shop1', x: M.shoppers[0].x, z: M.shoppers[0].z, heading: Math.PI + 0.2, pose: 'clasp' },
  { id: 'dm_shop2', x: M.shoppers[1].x, z: M.shoppers[1].z, heading: Math.PI - 0.3, pose: 'idle' },
  { id: 'dm_shop3', x: M.shoppers[2].x, z: M.shoppers[2].z, heading: 0.2, pose: 'idle' },
]

function Npc({ d, outline, visible, facePlayer = false, shadow = true }: { d: NpcDef; outline: boolean; visible: () => boolean; facePlayer?: boolean; shadow?: boolean }) {
  const spec = SPECS[d.id]
  const group = useRef<THREE.Group>(null)
  const drive = useRef<Drive>(newDrive({ pose: d.pose, heading: d.heading }))
  const y = d.seat != null ? d.seat - SEAT_Y * spec.scale + 0.03 : 0.02
  useFrame(() => {
    const g = group.current
    if (!g) return
    g.visible = visible()
    if (!facePlayer) return
    const dx = player.x - d.x
    const dz = player.z - d.z
    drive.current.heading = Math.hypot(dx, dz) < 4 ? Math.atan2(dx, dz) : d.heading
  })
  return (
    <group ref={group} position={[d.x, y, d.z]} userData={{ noMerge: true }}>
      <Chibi spec={spec} drive={drive} outline={outline} legs={d.seat == null} shadow={shadow} />
    </group>
  )
}

function Vendors({ open, outline }: { open: boolean; outline: boolean }) {
  // 晚上收攤：人都回家了（不卸載，免得重建角色）
  const isOpen = () => marketOpen(useStore.getState())
  void open
  return (
    <group>
      {/* 攤販站在屋簷的陰影下：不投影子（省下一大堆 draw call） */}
      {VENDORS.map((d) => (
        <Npc key={d.id} d={d} outline={outline} visible={isOpen} shadow={false} />
      ))}
      {SHOPPERS.map((d) => (
        <Npc key={d.id} d={d} outline={outline} visible={isOpen} />
      ))}
      <Walker outline={outline} />
    </group>
  )
}

/** 逛市場的阿公：沿著走道慢慢走，偶爾停下來看攤子 */
const ROUTE: [number, number][] = [
  [-11.5, -0.6],
  [11.5, -0.6],
  [11.5, 0.9],
  [-11.5, 0.9],
]

function Walker({ outline }: { outline: boolean }) {
  const group = useRef<THREE.Group>(null)
  const drive = useRef<Drive>(newDrive({ pose: 'idle' }))
  const st = useRef({ s: 7, pause: 0, nextPause: 5 })
  const len = useMemo(() => ROUTE.reduce((L, a, i) => L + Math.hypot(ROUTE[(i + 1) % ROUTE.length][0] - a[0], ROUTE[(i + 1) % ROUTE.length][1] - a[1]), 0), [])
  useFrame((_, rawDt) => {
    const g = group.current
    if (!g) return
    g.visible = marketOpen(useStore.getState())
    if (!g.visible) return
    const dt = Math.min(rawDt, 0.1)
    const w = st.current
    const d = drive.current
    if (w.pause > 0) {
      w.pause -= dt
      d.speed = 0
    } else {
      w.s = (w.s + dt * 0.6) % len
      d.speed = 0.6
      w.nextPause -= dt
      if (w.nextPause <= 0) {
        w.pause = 2.5 + Math.random() * 3
        w.nextPause = 6 + Math.random() * 7
      }
    }
    let s = w.s
    for (let i = 0; i < ROUTE.length; i++) {
      const a = ROUTE[i]
      const b = ROUTE[(i + 1) % ROUTE.length]
      const l = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (s <= l) {
        const k = s / l
        g.position.set(a[0] + (b[0] - a[0]) * k, 0.02, a[1] + (b[1] - a[1]) * k)
        const h = Math.atan2(b[0] - a[0], b[1] - a[1])
        // 停下來時轉頭看旁邊的攤子（北邊那排）
        d.heading = w.pause > 0 ? Math.PI : h
        break
      }
      s -= l
    }
  })
  return (
    <group ref={group} userData={{ noMerge: true }}>
      <Chibi spec={SPECS.dm_walker} drive={drive} outline={outline} />
    </group>
  )
}

/** 阿葉嬸：坐在她的老位置（開陰陽眼才看得到；傍晚、晚上都在），阿嬤靠近就轉過來 */
function Aye({ outline }: { outline: boolean }) {
  const d: NpcDef = { id: 'aye', x: M.ghost.x + 0.05, z: M.ghost.z + 0.55, heading: 2.7, pose: 'sit', seat: 0.32 }
  const lamp = useRef<THREE.Mesh>(null)
  const lampMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.4, 1.2), toneMapped: false, transparent: true, opacity: 0.85 }), [])
  useFrame(({ clock }) => {
    const m = lamp.current
    if (!m) return
    const s = useStore.getState()
    m.visible = s.vision
    const t = clock.elapsedTime
    m.scale.setScalar(1 + Math.sin(t * 3.1) * 0.08)
  })
  return (
    <group>
      <Npc d={d} outline={outline} visible={() => useStore.getState().vision} facePlayer />
      {/* 她的小油燈（鬼火的顏色） */}
      <mesh ref={lamp} material={lampMat} position={[M.ghost.x - 0.3, 0.62, M.ghost.z]}>
        <sphereGeometry args={[0.07, 10, 8]} />
      </mesh>
    </group>
  )
}
