import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { Chibi, newDrive, type Drive, type PoseName } from '../chars/Chibi'
import { SPECS } from '../chars/specs'
import '../chars/specs.past'
import { player } from '../world/player'
import { SCENES } from '../world/scenes'
import { PAST_SPOTS, pastRT, usePast, type EpisodeId } from '../world/past'
import { RIVER, riverCenter, riverHalfWidth, riverWater } from '../world/sceneRiver'
import { FENCE, FLOOR_Y, MAIN, STOVE } from './layout'
import { WBox, canvasTexture, useMats } from './kit'

// 回到 1958 的人與東西（DESIGN §27.1）：叔公、嬸婆、婆婆、年輕的阿公；牛車、嫁妝箱、囍字；
// 漂走的籃子、流走的鞋子、菜脯蛋。規則與進度在 src/world/past.ts。

export function PastProps({ ep }: { ep: EpisodeId }) {
  const outline = useStore((s) => s.quality === 'high')
  if (ep === 'wedding') return <Wedding outline={outline} />
  if (ep === 'kitchen') return <Kitchen outline={outline} />
  return <Creek outline={outline} />
}

// ---------------------------------------------------------------------------
// 共用：站著的人（阿春靠近會轉頭看她）
// ---------------------------------------------------------------------------

function PastNpc({
  id,
  x,
  z,
  heading,
  pose = 'idle',
  expr = 'normal',
  visible = () => true,
  poseOf,
  outline,
}: {
  id: string
  x: number
  z: number
  heading: number
  pose?: PoseName
  expr?: string
  visible?: () => boolean
  poseOf?: () => PoseName
  outline: boolean
}) {
  const group = useRef<THREE.Group>(null)
  const drive = useRef<Drive>(newDrive({ pose, heading, expr }))
  useFrame(() => {
    const g = group.current
    if (!g) return
    g.visible = visible()
    if (!g.visible) return
    const d = drive.current
    if (poseOf) d.pose = poseOf()
    const dx = player.x - x
    const dz = player.z - z
    d.heading = Math.hypot(dx, dz) < 3 ? Math.atan2(dx, dz) : heading
  })
  const y = SCENES.past.floorAt(x, z)
  return (
    <group ref={group} position={[x, y, z]}>
      <Chibi spec={SPECS[id]} drive={drive} outline={outline} />
    </group>
  )
}

/** 紅紙上的「囍」 */
let XI: THREE.CanvasTexture | null = null
function xiTexture() {
  return (XI ??= canvasTexture(
    128,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#c0282a'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#f6d67a'
      ctx.font = '900 96px "Noto Serif TC", serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('囍', w / 2, h / 2 + 6)
    },
    [{ spec: '900 96px "Noto Serif TC"', text: '囍' }],
  ))
}

function Xi({ position, rotation = 0, size = 0.5 }: { position: [number, number, number]; rotation?: number; size?: number }) {
  return (
    <mesh position={position} rotation-y={rotation}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial map={xiTexture()} roughness={0.8} side={THREE.DoubleSide} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// 1958 嫁過來那天
// ---------------------------------------------------------------------------

function Wedding({ outline }: { outline: boolean }) {
  const S = PAST_SPOTS
  return (
    <group userData={{ noMerge: true }}>
      <OxCart />
      <DowryChests />
      {/* 大門柱、正身門上的囍字 */}
      {[-1, 1].map((s) => (
        <Xi key={s} position={[s * (FENCE.gateHalf + 0.15), 1.05, FENCE.z + 0.27]} size={0.34} />
      ))}
      <Xi position={[0, 2.25, MAIN.z1 + 0.12]} size={0.6} />
      <PastNpc id="shugong" x={S.shugong.x} z={S.shugong.z} heading={S.shugong.heading} pose="drink" outline={outline} />
      <PastNpc id="shenpo" x={S.shenpo.x} z={S.shenpo.z} heading={S.shenpo.heading} pose="fan" outline={outline} />
      <PastNpc id="popo" x={S.popo.x} z={S.popo.z} heading={S.popo.heading} outline={outline} />
      {/* 最後阿公站在房門口 */}
      <PastNpc id="agong" x={S.agongDoor.x} z={S.agongDoor.z} heading={S.agongDoor.heading} outline={outline} visible={() => usePast.getState().step >= 3} />
      {/* 婆婆煮湯圓的鍋，冒煙 */}
      <Steam x={STOVE.x} y={FLOOR_Y + 1.15} z={STOVE.z} />
    </group>
  )
}

/** 牛車（剛好蓋住外面的機車）＋一頭水牛 */
function OxCart() {
  const mats = useMats()
  const S = PAST_SPOTS
  const buffalo = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a4440', roughness: 0.95 }), [])
  const horn = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d8cfb8', roughness: 0.6 }), [])
  const head = useRef<THREE.Group>(null)
  const tail = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (head.current) head.current.rotation.x = 0.25 + Math.sin(t * 0.7) * 0.08
    if (tail.current) tail.current.rotation.z = 0.25 + Math.sin(t * 2.3) * 0.25
  })
  return (
    <group>
      {/* 車斗 */}
      <group position={[S.oxcart.x, 0, S.oxcart.z]} rotation-y={-0.12}>
        <WBox mat="wood" size={[2.1, 0.12, 1.2]} position={[0, 0.72, 0]} />
        {[-1, 1].map((s) => (
          <WBox key={s} mat="wood" size={[2.1, 0.28, 0.06]} position={[0, 0.9, s * 0.58]} />
        ))}
        <WBox mat="wood" size={[0.06, 0.28, 1.2]} position={[-1.03, 0.9, 0]} />
        {/* 兩個大木輪 */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0.1, 0.55, s * 0.7]} rotation-x={Math.PI / 2} material={mats.darkWood} castShadow>
            <cylinderGeometry args={[0.55, 0.55, 0.08, 14]} />
          </mesh>
        ))}
        {/* 往前伸的車轅 */}
        {[-1, 1].map((s) => (
          <WBox key={`s${s}`} mat="darkWood" size={[1.6, 0.06, 0.06]} position={[1.75, 0.7, s * 0.34]} />
        ))}
        {/* 車上一床紅被、一個包袱 */}
        <mesh position={[-0.3, 0.86, 0]} castShadow>
          <boxGeometry args={[0.9, 0.18, 0.8]} />
          <meshStandardMaterial color="#b8322e" roughness={0.9} />
        </mesh>
        <mesh position={[0.45, 0.9, 0.1]} castShadow>
          <sphereGeometry args={[0.22, 10, 8]} />
          <meshStandardMaterial color="#3f5d8a" roughness={0.9} />
        </mesh>
      </group>
      {/* 水牛 */}
      <group position={[S.ox.x, 0, S.ox.z]} rotation-y={Math.PI / 2 - 0.12}>
        <mesh material={buffalo} position={[0, 0.85, 0]} rotation-x={Math.PI / 2} castShadow>
          <capsuleGeometry args={[0.36, 0.9, 6, 12]} />
        </mesh>
        {[
          [-0.2, 0.42],
          [0.2, 0.42],
          [-0.2, -0.42],
          [0.2, -0.42],
        ].map(([x, z], i) => (
          <mesh key={i} material={buffalo} position={[x, 0.33, z]} castShadow>
            <cylinderGeometry args={[0.08, 0.07, 0.66, 8]} />
          </mesh>
        ))}
        <group ref={head} position={[0, 0.95, 0.78]}>
          <mesh material={buffalo} position={[0, -0.05, 0.18]} castShadow>
            <boxGeometry args={[0.34, 0.34, 0.5]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} material={horn} position={[s * 0.26, 0.12, 0.05]} rotation={[0, 0, s * 1.1]}>
              <torusGeometry args={[0.2, 0.035, 6, 12, Math.PI * 0.8]} />
            </mesh>
          ))}
        </group>
        <mesh ref={tail} material={buffalo} position={[0, 0.9, -0.95]}>
          <cylinderGeometry args={[0.02, 0.03, 0.5, 5]} />
        </mesh>
      </group>
    </group>
  )
}

/** 嫁妝：兩個紅漆木箱疊著（剛好蓋住腳踏車），貼著囍字 */
function DowryChests() {
  const S = PAST_SPOTS
  const red = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9e2a22', roughness: 0.55 }), [])
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d4a84a', roughness: 0.4, metalness: 0.4 }), [])
  return (
    <group position={[S.dowry.x, 0.1, S.dowry.z]} rotation-y={0.2}>
      {[0, 1].map((i) => (
        <group key={i} position={[i * 0.06, 0.3 + i * 0.58, 0]}>
          <mesh material={red} castShadow receiveShadow>
            <boxGeometry args={[1.05, 0.56, 0.62]} />
          </mesh>
          <mesh material={gold} position={[0, 0.2, 0.315]}>
            <boxGeometry args={[1.0, 0.04, 0.01]} />
          </mesh>
          <Xi position={[0, -0.02, 0.32]} size={0.3} />
        </group>
      ))}
    </group>
  )
}

/** 灶上的鍋冒煙 */
function Steam({ x, y, z }: { x: number; y: number; z: number }) {
  const refs = useRef<(THREE.Mesh | null)[]>([])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#f4efe6', transparent: true, opacity: 0.3, depthWrite: false }), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((m, i) => {
      if (!m) return
      const k = (t * 0.35 + i / 4) % 1
      m.position.set(Math.sin(k * 5 + i) * 0.08, k * 0.9, Math.cos(k * 4 + i) * 0.06)
      m.scale.setScalar(0.08 + k * 0.18)
      ;(m.material as THREE.MeshBasicMaterial).opacity = 0.35 * Math.sin(k * Math.PI)
    })
  })
  return (
    <group position={[x, y, z]}>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          material={mat.clone()}
        >
          <sphereGeometry args={[1, 8, 6]} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 1959 第一盤菜脯蛋
// ---------------------------------------------------------------------------

function Kitchen({ outline }: { outline: boolean }) {
  const S = PAST_SPOTS
  const plate = useRef<THREE.Group>(null)
  const fire = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    const st = usePast.getState()
    if (plate.current) plate.current.visible = st.step >= 2
    if (fire.current) fire.current.intensity = st.step === 0 ? 1.4 + Math.sin(clock.elapsedTime * 11) * 0.3 : 0.3
  })
  return (
    <group userData={{ noMerge: true }}>
      <PastNpc
        id="agong"
        x={S.agongTable.x}
        z={S.agongTable.z}
        heading={S.agongTable.heading}
        outline={outline}
        poseOf={() => (usePast.getState().step >= 2 ? 'eat' : 'idle')}
      />
      {/* 八仙桌上：黑黑的菜脯蛋 */}
      <group ref={plate} position={[S.table.x - 0.2, FLOOR_Y + 0.85, S.table.z]} visible={false}>
        <BlackOmelette />
      </group>
      {/* 灶裡的火 */}
      <pointLight ref={fire} position={[STOVE.x + 0.4, FLOOR_Y + 0.5, STOVE.z]} color="#ff9a3a" intensity={1.4} distance={3.5} decay={2} />
      <Steam x={STOVE.x} y={FLOOR_Y + 1.15} z={STOVE.z} />
    </group>
  )
}

/** 盤子上黑黑的菜脯蛋（阿春手上端的也是這個） */
export function BlackOmelette() {
  return (
    <group>
      <mesh castShadow>
        <cylinderGeometry args={[0.17, 0.12, 0.04, 18]} />
        <meshStandardMaterial color="#f2ede2" roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.03, 0]} scale={[1, 0.35, 0.85]}>
        <sphereGeometry args={[0.12, 12, 8]} />
        <meshStandardMaterial color="#3a2414" roughness={0.9} />
      </mesh>
      <mesh position={[0.05, 0.05, 0.02]} scale={[1, 0.3, 0.7]}>
        <sphereGeometry args={[0.05, 8, 6]} />
        <meshStandardMaterial color="#c98a2e" roughness={0.7} />
      </mesh>
    </group>
  )
}

/** 一籃衫（阿春端著的、漂在水上的） */
export function Basket() {
  const mats = useMats()
  return (
    <group>
      <mesh castShadow material={mats.bamboo}>
        <cylinderGeometry args={[0.24, 0.18, 0.2, 14, 1, true]} />
      </mesh>
      <mesh position={[0, -0.1, 0]} rotation-x={-Math.PI / 2} material={mats.bamboo}>
        <circleGeometry args={[0.18, 14]} />
      </mesh>
      {[
        ['#f2efe6', -0.06, 0.04],
        ['#5d7fa8', 0.07, -0.03],
        ['#c95a4a', 0.0, 0.08],
      ].map(([c, x, z], i) => (
        <mesh key={i} position={[x as number, 0.08 + i * 0.02, z as number]} scale={[1, 0.45, 1]}>
          <sphereGeometry args={[0.12, 10, 8]} />
          <meshStandardMaterial color={c as string} roughness={0.95} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 1957 溪邊
// ---------------------------------------------------------------------------

function Creek({ outline }: { outline: boolean }) {
  const agong = useRef<THREE.Group>(null)
  const drive = useRef<Drive>(newDrive({ pose: 'idle', heading: -Math.PI / 2 }))
  const basket = useRef<THREE.Group>(null)
  const shoe = useRef<THREE.Group>(null)
  const rings = useRef<(THREE.Mesh | null)[]>([])
  const splashAt = useRef<{ x: number; z: number; t: number } | null>(null)
  const lastMode = useRef<string>('hidden')
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#e8f4ff', transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const a = pastRT.agong
    const g = agong.current
    if (g) {
      g.visible = a.mode !== 'hidden'
      const inWater = a.mode === 'swim' || (a.mode === 'back' && Math.abs(a.z - riverCenter(a.x)) < riverHalfWidth(a.x))
      const y = inWater ? riverWater(a.x) - 0.55 : SCENES.past.floorAt(a.x, a.z)
      g.position.set(a.x, y, a.z)
      const d = drive.current
      d.heading = a.mode === 'wet' ? Math.atan2(player.x - a.x, player.z - a.z) : a.heading
      d.speed = a.mode === 'run' ? 3.4 : inWater ? 1.2 : 0
      d.pose = inWater ? 'reach' : 'idle'
      d.expr = a.mode === 'wet' ? 'happy' : a.mode === 'run' ? 'surprised' : 'normal'
      if (a.mode === 'swim' && lastMode.current !== 'swim') splashAt.current = { x: a.x, z: a.z, t }
      lastMode.current = a.mode
    }
    const b = pastRT.basket
    if (basket.current) {
      basket.current.visible = b.mode !== 'none'
      const y = b.mode === 'float' ? riverWater(b.x) + 0.02 + Math.sin(t * 2.4) * 0.03 : SCENES.past.floorAt(b.x, b.z) + 0.75
      basket.current.position.set(b.x, y, b.z)
      basket.current.rotation.set(Math.sin(t * 1.7) * 0.12, t * (b.mode === 'float' ? 0.6 : 0), Math.cos(t * 1.3) * 0.1)
    }
    const sh = pastRT.shoe
    if (shoe.current) {
      shoe.current.visible = sh.on
      shoe.current.position.set(sh.x, riverWater(sh.x) + 0.02 + Math.sin(t * 3) * 0.02, sh.z)
      shoe.current.rotation.y = t * 1.3
    }
    // 跳下水的水花：三圈往外擴
    const sp = splashAt.current
    rings.current.forEach((m, i) => {
      if (!m) return
      const k = sp ? (t - sp.t - i * 0.18) / 1.4 : -1
      m.visible = k > 0 && k < 1
      if (!m.visible || !sp) return
      m.position.set(sp.x, riverWater(sp.x) + 0.03, sp.z)
      m.scale.setScalar(0.3 + k * 1.6)
      ;(m.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - k)
    })
  })

  return (
    <group userData={{ noMerge: true }}>
      <group ref={agong} visible={false}>
        <Chibi spec={SPECS.agong} drive={drive} outline={outline} />
      </group>
      <group ref={basket} visible={false}>
        <Basket />
      </group>
      <group ref={shoe} visible={false}>
        <mesh scale={[0.6, 0.4, 1]}>
          <capsuleGeometry args={[0.07, 0.14, 4, 8]} />
          <meshStandardMaterial color="#3a2c28" roughness={0.8} />
        </mesh>
      </group>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(el) => {
            rings.current[i] = el
          }}
          rotation-x={-Math.PI / 2}
          material={ringMat.clone()}
          visible={false}
        >
          <ringGeometry args={[0.45, 0.55, 28]} />
        </mesh>
      ))}
      <DryingPole />
    </group>
  )
}

/** 對岸晾衫的竹竿（本來要晾在這裡） */
function DryingPole() {
  const mats = useMats()
  const x = RIVER.stonesX
  const z = riverCenter(x) - riverHalfWidth(x) - 1.6
  return (
    <group position={[x, 0, z]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 1.1, 0.8, 0]} rotation-z={s * 0.08} material={mats.bamboo} castShadow>
          <cylinderGeometry args={[0.035, 0.04, 1.6, 6]} />
        </mesh>
      ))}
      <mesh position={[0, 1.55, 0]} rotation-z={Math.PI / 2} material={mats.bamboo} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 2.4, 6]} />
      </mesh>
    </group>
  )
}
