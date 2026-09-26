import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { OLDSTREET } from '../world/sceneOldStreet'
import { lanternAt } from './daylight'
import { TILE, WBox, canvasTexture, planeGeo, useMats } from './kit'
import { MergeStatic } from './MergeStatic'
import { Fader } from './OldStreetFader'
import { Paddies } from './VillageKit'
import { Arcade, Lot, signTexture } from './OldStreetFacades'
import { CinemaLobby, CinemaShell, EndFront, Marquee } from './OldStreetShops'
import { STYLES } from './oldStreetStyles'
import { OldStreetWest, WEST_LOTS } from './OldStreetWest'
import { OldStreetEast, EAST_LOTS } from './OldStreetEast'
import '../chars/specs.oldstreet'
import { Nakashi } from './Nakashi'

// 老街的畫面（DESIGN §27.1）：規則與座標在 src/world/sceneOldStreet.ts。
// 北邊（鏡頭對面）是一整排 1930 年代的牌樓厝，一樓亭仔腳；南邊（鏡頭這一側）只放矮的東西：攤車、路燈、長椅、圳溝，
// 才不會擋住阿嬤。走進戲院大廳時整棟戲院淡出。

const O = OLDSTREET
const A = O.arcade

export function OldStreetScene() {
  const quality = useStore((s) => s.quality)
  const isNight = useStore((s) => s.isNight)
  const outline = quality === 'high'
  // 第一次走進來（每天一次）：阿嬤的感想
  useEffect(() => {
    const s = useStore.getState()
    if (s.flags.oldstreet_visit_today) return
    useStore.setState({ flags: { ...s.flags, oldstreet_visit_today: true } })
    const id = window.setTimeout(() => {
      const st = useStore.getState()
      st.bark(st.isNight ? 'oldstreet.arrive.night' : 'oldstreet.arrive.dusk')
    }, 1400)
    return () => window.clearTimeout(id)
  }, [])
  const iceLot = O.lots.find((l) => l.id === 'ice')!
  // 可以走進去的店自己畫（OldStreetWest.tsx、OldStreetEast.tsx），這裡只畫其他的
  const own = new Set(['cinema', ...WEST_LOTS, ...EAST_LOTS])
  const cinemaLot = O.lots.find((l) => l.id === 'cinema')!
  return (
    <group>
      <Grounds />
      <MergeStatic>
        <Arcade skip={[iceLot.x0]} />
        {O.lots
          .filter((l) => !own.has(l.id))
          .map((l) => (
            <Lot key={l.id} x0={l.x0} x1={l.x1} top={l.top} endWall={l.id === 'end'} style={STYLES[l.id]} />
          ))}
        <EndFront />
        <Canal />
        <Benches />
        <Mailboxes />
        <Pots />
      </MergeStatic>
      {/* 戲院：走進大廳時外殼整個淡出，大廳裡面照樣看得到 */}
      <Fader id="os_cinema">
        <MergeStatic>
          <Lot x0={cinemaLot.x0} x1={cinemaLot.x1} top={cinemaLot.top} style={STYLES.cinema} />
          <CinemaShell />
        </MergeStatic>
        <Marquee />
      </Fader>
      <CinemaLobby outline={outline} />
      <OldStreetWest outline={outline} />
      <OldStreetEast outline={outline} />
      {O.lampXs.map((x) => (
        <StreetLamp key={x} x={x} />
      ))}
      <Fader id={`os_cart_${O.carts[0].id}`}>
        <DouhuaCart />
      </Fader>
      <Fader id={`os_cart_${O.carts[1].id}`}>
        <YamCart />
      </Fader>
      <Vespa />
      <StreetLights />
      <Nakashi outline={outline} />
      <group visible={isNight}>
        {/* 路燈下的小飛蟲 */}
        {O.lampXs.map((x) => (
          <Sparkles key={x} count={10} scale={[1.2, 1.0, 1.2]} position={[x, 3.0, O.lampZ - 0.4]} size={2.5} speed={0.8} color="#fff2c0" opacity={0.8} noise={2} />
        ))}
      </group>
    </group>
  )
}


// ---------------------------------------------------------------------------
// 地面：石板街、亭仔腳前的排水溝、圳溝、南邊的田
// ---------------------------------------------------------------------------

function Grounds() {
  const mats = useMats()
  const slabs = useMemo(() => {
    const m = mats.stone.clone()
    m.color.set('#b3aea2')
    return m
  }, [mats])
  const water = useMemo(() => new THREE.MeshStandardMaterial({ color: '#16242a', roughness: 0.08, metalness: 0.35 }), [])
  const streetW = O.canal.z0 - A.colZ
  return (
    <group>
      <mesh geometry={planeGeo(200, 200, TILE.grass)} material={mats.grass} rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow />
      <mesh geometry={planeGeo(52, streetW, TILE.stone)} material={slabs} rotation-x={-Math.PI / 2} position={[0, 0.02, (A.colZ + O.canal.z0) / 2]} receiveShadow />
      {/* 亭仔腳前面一條石砌的排水溝 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.025, A.colZ + 0.22]}>
        <planeGeometry args={[52, 0.18]} />
        <meshStandardMaterial color="#3a3a38" roughness={0.9} />
      </mesh>
      {/* 圳溝 */}
      {[O.canal.z0, O.canal.z1].map((z) => (
        <WBox key={z} mat="stone" size={[60, 0.36, 0.2]} position={[0, 0.18, z]} />
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.07, (O.canal.z0 + O.canal.z1) / 2]} material={water}>
        <planeGeometry args={[60, O.canal.z1 - O.canal.z0]} />
      </mesh>
      <Paddies xs={[-36, -24, -12, 0, 12, 24, 36]} zs={[6.4, 15, 24, 33]} />
      <Paddies xs={[-36, -24, -12, 0, 12, 24, 36]} zs={[-40, -28, -14]} />
    </group>
  )
}

/** 圳溝邊的石欄杆 */
function Canal() {
  const posts = useMemo(() => Array.from({ length: 31 }, (_, i) => -22.5 + i * 1.5), [])
  return (
    <group>
      {posts.map((x) => (
        <WBox key={x} mat="stone" size={[0.16, 0.55, 0.16]} position={[x, 0.36 + 0.27, O.canal.z0]} />
      ))}
      <WBox mat="stone" size={[45.2, 0.1, 0.12]} position={[0, 0.88, O.canal.z0]} />
      <WBox mat="stone" size={[45.2, 0.07, 0.1]} position={[0, 0.58, O.canal.z0]} />
    </group>
  )
}

function Benches() {
  return (
    <group>
      {O.benches.map((b) => (
        <group key={b.x} position={[b.x, 0.02, b.z]}>
          {[-0.12, 0.02, 0.16].map((dz) => (
            <WBox key={dz} mat="wood" size={[1.5, 0.05, 0.11]} position={[0, 0.45, dz]} />
          ))}
          <WBox mat="wood" size={[1.5, 0.3, 0.05]} position={[0, 0.72, 0.22]} />
          {[-0.62, 0.62].map((x) => (
            <WBox key={x} mat="metal" size={[0.06, 0.45, 0.42]} position={[x, 0.22, 0.04]} />
          ))}
        </group>
      ))}
    </group>
  )
}

/** 綠色（平信）、紅色（限時）的郵筒 */
function Mailboxes() {
  const green = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2e7d4a', roughness: 0.45 }), [])
  const red = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c62828', roughness: 0.45 }), [])
  const M = O.mailbox
  return (
    <group position={[M.x, 0.02, M.z]}>
      {[
        [-0.23, green],
        [0.23, red],
      ].map(([x, m]) => (
        <group key={x as number} position={[x as number, 0, 0]}>
          <mesh material={m as THREE.Material} position={[0, 0.55, 0]} castShadow>
            <boxGeometry args={[0.4, 1.1, 0.4]} />
          </mesh>
          <mesh material={m as THREE.Material} position={[0, 1.1, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 0.4, 16, 1, false, 0, Math.PI]} />
          </mesh>
          <mesh position={[0, 0.85, 0.205]}>
            <planeGeometry args={[0.26, 0.05]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** 亭仔腳裡的盆栽（靠牆放，不擋路） */
function Pots() {
  const mats = useMats()
  const spots: [number, number][] = [
    [-15.0, A.frontZ + 0.35],
    [-9.5, A.frontZ + 0.35],
    [-0.5, A.frontZ + 0.35],
    [11.5, A.frontZ + 0.35],
    [16.7, A.frontZ + 0.35],
  ]
  return (
    <group>
      {spots.map(([x, z], i) => (
        <group key={x} position={[x, 0.14, z]}>
          <mesh material={mats.terracotta} position={[0, 0.2, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.15, 0.4, 12]} />
          </mesh>
          <mesh material={mats.leaf} position={[0, 0.6 + (i % 2) * 0.1, 0]} scale={[1, 1.3, 1]} castShadow>
            <icosahedronGeometry args={[0.28, 1]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 路燈、攤車、偉士牌
// ---------------------------------------------------------------------------

const lampGlass = new THREE.MeshBasicMaterial({ color: '#3a3428', toneMapped: false })

function StreetLamp({ x }: { x: number }) {
  const mats = useMats()
  return (
    <group position={[x, 0.02, O.lampZ]}>
      <mesh material={mats.metal} position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.08, 3.2, 8]} />
      </mesh>
      <mesh material={mats.metal} position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.14, 0.18, 0.3, 8]} />
      </mesh>
      {/* 往街心伸出去的燈臂 */}
      <mesh material={mats.metal} position={[0, 3.12, -0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.62, 6]} />
      </mesh>
      <group position={[0, 2.95, -0.58]}>
        <mesh material={lampGlass}>
          <cylinderGeometry args={[0.13, 0.09, 0.28, 6]} />
        </mesh>
        <mesh material={mats.black} position={[0, 0.2, 0]}>
          <coneGeometry args={[0.2, 0.14, 6]} />
        </mesh>
      </group>
    </group>
  )
}

function StreetLights() {
  const lamps = useRef<(THREE.PointLight | null)[]>([])
  const warm = useMemo(() => new THREE.Color('#ffcf7a'), [])
  const off = useMemo(() => new THREE.Color('#3a3428'), [])
  const lit = [O.lampXs[1], O.lampXs[3]]
  useFrame(({ clock }) => {
    const l = lanternAt(useStore.getState().time)
    const t = clock.elapsedTime
    lampGlass.color.copy(off).lerp(warm, l).multiplyScalar(1 + l * 0.6)
    lamps.current.forEach((p, i) => {
      if (!p) return
      // 老燈泡偶爾閃一下
      const blink = Math.sin(t * 0.6 + i * 3) > 0.992 ? 0.4 : 1
      p.intensity = 4.2 * l * blink
    })
  })
  return (
    <group>
      {lit.map((x, i) => (
        <pointLight
          key={x}
          ref={(el) => {
            lamps.current[i] = el
          }}
          position={[x, 2.8, O.lampZ - 0.6]}
          color="#ffc978"
          intensity={0}
          distance={9}
          decay={2}
        />
      ))}
      {/* 戲院跑馬燈、冰果室裡的燈 */}
      <NightLight position={[(O.lots[2].x0 + O.lots[2].x1) / 2, 3.0, A.colZ + 0.8]} color="#ffb85c" power={3.2} />
      <NightLight position={[O.ice.counterX, 2.8, A.frontZ + 0.2]} color="#ffe8f0" power={3.0} />
      <NightLight position={[O.photo.doorX - 1.5, 2.4, A.frontZ + 0.6]} color="#ffe6c0" power={1.6} />
    </group>
  )
}

function NightLight({ position, color, power }: { position: [number, number, number]; color: string; power: number }) {
  const ref = useRef<THREE.PointLight>(null)
  useFrame(() => {
    if (ref.current) ref.current.intensity = power * (0.15 + 0.85 * lanternAt(useStore.getState().time))
  })
  return <pointLight ref={ref} position={position} color={color} intensity={0} distance={7} decay={2} />
}

function DouhuaCart() {
  const mats = useMats()
  const c = O.carts[0]
  const sign = useMemo(() => signTexture('豆花', '#f4efe2', '#1d4f8a', '#1d4f8a'), [])
  const stripes = useMemo(() => {
    const t = canvasTexture(128, 32, (ctx, w, h) => {
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 ? '#f4efe2' : '#2e6fb5'
        ctx.fillRect((i * w) / 8, 0, w / 8, h)
      }
    })
    t.wrapS = THREE.RepeatWrapping
    return t
  }, [])
  return (
    <group position={[c.x, 0.02, c.z]}>
      {/* 車身與輪子 */}
      <WBox mat="wood" size={[1.5, 0.55, 0.75]} position={[0, 0.62, 0]} />
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} material={mats.black} position={[x, 0.26, 0.4]} castShadow>
          <torusGeometry args={[0.22, 0.04, 6, 18]} />
        </mesh>
      ))}
      {/* 玻璃櫃、豆花桶、碗 */}
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[1.3, 0.34, 0.6]} />
        <meshStandardMaterial color="#dfeff2" transparent opacity={0.25} depthWrite={false} roughness={0.05} />
      </mesh>
      <mesh material={mats.metal} position={[-0.3, 1.12, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.3, 16]} />
      </mesh>
      {[0.2, 0.42].map((x) => (
        <mesh key={x} material={mats.cloth} position={[x, 0.96, 0.05]}>
          <cylinderGeometry args={[0.09, 0.06, 0.08, 12]} />
        </mesh>
      ))}
      {/* 布棚 */}
      {[-0.7, 0.7].map((x) => (
        <WBox key={x} mat="metal" size={[0.04, 1.3, 0.04]} position={[x, 1.55, -0.3]} />
      ))}
      <mesh position={[0, 2.22, -0.05]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[1.7, 0.03, 0.9]} />
        <meshStandardMaterial map={stripes} roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.55, 0.39]}>
        <planeGeometry args={[0.8, 0.3]} />
        <meshStandardMaterial map={sign} roughness={0.6} />
      </mesh>
    </group>
  )
}

function YamCart() {
  const mats = useMats()
  const c = O.carts[1]
  const sign = useMemo(() => signTexture('烤番薯', '#c3302a', '#fff2d8', '#e9c46a'), [])
  const coals = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff6a1a', toneMapped: false }), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const k = 0.7 + 0.3 * Math.sin(t * 3.1) * Math.sin(t * 1.7)
    coals.color.setRGB(1.4 * k, 0.45 * k, 0.1 * k)
  })
  return (
    <group position={[c.x, 0.02, c.z]}>
      <WBox mat="wood" size={[1.5, 0.5, 0.8]} position={[0, 0.55, 0]} />
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} material={mats.black} position={[x, 0.24, 0.42]} castShadow>
          <torusGeometry args={[0.2, 0.04, 6, 18]} />
        </mesh>
      ))}
      {/* 汽油桶改的烤爐 */}
      <mesh material={mats.black} position={[-0.25, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.6, 16]} />
      </mesh>
      <mesh material={coals} position={[-0.25, 1.41, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.24, 16]} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.35 + i * 0.1, 1.46, -0.05 + (i % 2) * 0.1]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.05, 0.12, 4, 8]} />
          <meshStandardMaterial color="#7a3a22" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0.45, 1.05, 0.41]}>
        <planeGeometry args={[0.6, 0.3]} />
        <meshStandardMaterial map={sign} roughness={0.6} />
      </mesh>
      {[-0.7, 0.7].map((x) => (
        <WBox key={x} mat="metal" size={[0.04, 1.1, 0.04]} position={[x, 1.35, -0.34]} />
      ))}
      <mesh position={[0, 1.95, -0.1]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[1.6, 0.03, 0.8]} />
        <meshStandardMaterial color="#c8342b" roughness={0.8} />
      </mesh>
    </group>
  )
}

/** 停在街邊的偉士牌（薄荷綠） */
function Vespa() {
  const mats = useMats()
  const S = O.scooter
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8fd0b8', roughness: 0.3, metalness: 0.2 }), [])
  return (
    <group position={[S.x, 0.02, S.z]} rotation={[0, Math.PI / 2 - 0.25, 0]} userData={{ noMerge: false }}>
      {[-0.52, 0.52].map((z) => (
        <mesh key={z} material={mats.black} position={[0, 0.2, z]} rotation={[0, Math.PI / 2, 0]} castShadow>
          <torusGeometry args={[0.17, 0.05, 8, 20]} />
        </mesh>
      ))}
      <mesh material={body} position={[0, 0.5, -0.3]} scale={[0.55, 0.5, 1]} castShadow>
        <sphereGeometry args={[0.42, 16, 12]} />
      </mesh>
      <mesh material={body} position={[0, 0.34, 0.2]} castShadow>
        <boxGeometry args={[0.34, 0.1, 0.6]} />
      </mesh>
      <mesh material={body} position={[0, 0.7, 0.5]} rotation={[-0.25, 0, 0]} castShadow>
        <boxGeometry args={[0.46, 0.8, 0.08]} />
      </mesh>
      <mesh position={[0, 0.78, -0.25]} castShadow>
        <boxGeometry args={[0.3, 0.1, 0.6]} />
        <meshStandardMaterial color="#3a2a1e" roughness={0.6} />
      </mesh>
      <mesh material={mats.metal} position={[0, 1.12, 0.55]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 0.6, 6]} />
      </mesh>
      <mesh position={[0, 1.1, 0.62]}>
        <sphereGeometry args={[0.08, 12, 10]} />
        <meshStandardMaterial color="#f4f1ea" roughness={0.2} metalness={0.4} />
      </mesh>
    </group>
  )
}
