import { createContext, useContext, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { outlineMat, toonGradient } from './toon'

// 壁虎：阿嬤附身之後可以沿著牆和天花板爬，不用開門就能進房間（DESIGN §26.2）。
// 台灣老房子的「蝘蜓」：半透明的米粉色、大黑眼睛、腳趾有吸盤。叫聲「嘖嘖嘖」——老人家說壁虎叫是在說「對啦」。
// 原點在肚子貼著的那一點，本地 +y 是「離開牆面」的方向，面向 +z；
// 父元件把它轉到牆上或天花板（天花板就是整個翻過來）。全長大約 0.18 公尺，太小看不到的話父元件可以放大。

export interface GeckoDrive {
  /** 爬的速度（公尺／秒）：腳的擺動跟著變 */
  speed: number
  /** 面向（弧度，0 = 朝 +z；在本地的 xz 平面上轉） */
  heading: number
  pose: 'crawl' | 'still' | 'chirp'
}

export const newGeckoDrive = (d: Partial<GeckoDrive> = {}): GeckoDrive => ({ speed: 0, heading: 0, pose: 'still', ...d })

// ---------------------------------------------------------------------------
// 尺寸（公尺）
// ---------------------------------------------------------------------------

const BODY_Y = 0.011
const BODY_R = 0.012
const BODY_LEN = 0.05
const HEAD: [number, number, number] = [0, 0.013, 0.05]
const LEG = { x: 0.013, zf: 0.022, zb: -0.02, len: 0.022 }
const TAIL_SEG = 5
const TAIL_LEN = 0.017

type V3 = [number, number, number]

// ---------------------------------------------------------------------------
// 材質與幾何
// ---------------------------------------------------------------------------

const geo = new Map<string, THREE.BufferGeometry>()
function G<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geo.get(key) as T | undefined
  if (!g) {
    g = make()
    geo.set(key, g)
  }
  return g
}
const SPHERE = () => G('sphere', () => new THREE.SphereGeometry(1, 18, 12))
const capsule = (r: number, len: number) => G(`cap${r}|${len}`, () => new THREE.CapsuleGeometry(r, len, 4, 10))

/** 半透明的卡通材質（toon() 的快取不處理透明度，這裡自己做） */
const skinCache = new Map<string, THREE.MeshToonMaterial>()
function skin(color: string, opacity: number, glow = 0.3) {
  const key = `${color}|${opacity}|${glow}`
  let m = skinCache.get(key)
  if (!m) {
    const c = new THREE.Color(color)
    m = new THREE.MeshToonMaterial({ color: c, gradientMap: toonGradient(), transparent: opacity < 1, opacity })
    m.emissive.copy(c).multiplyScalar(glow)
    skinCache.set(key, m)
  }
  return m
}

let spots: THREE.CanvasTexture | null = null
/** 背上淡淡的斑點 */
function spotTexture() {
  if (spots) return spots
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 64, 64)
  ctx.fillStyle = 'rgba(150,108,84,0.45)'
  for (let i = 0; i < 14; i++) {
    ctx.beginPath()
    ctx.arc((i * 23) % 64, (i * 37) % 64, 2 + (i % 3), 0, Math.PI * 2)
    ctx.fill()
  }
  spots = new THREE.CanvasTexture(c)
  spots.colorSpace = THREE.SRGBColorSpace
  spots.wrapS = spots.wrapT = THREE.RepeatWrapping
  return spots
}

function buildMats(possessed: boolean) {
  // 有貼圖的皮：自發光壓低，米粉色才看得出來
  const back = skin('#f3d6c4', 0.9, 0.12)
  back.map = spotTexture()
  return {
    back,
    belly: skin('#f4dfcf', 0.82, 0.35),
    toe: skin('#f7e2d4', 0.95, 0.4),
    throat: skin('#f9e8dc', 0.8, 0.45),
    eye: possessed
      ? new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.4, 2.8), toneMapped: false })
      : new THREE.MeshToonMaterial({ color: '#1c1614', gradientMap: toonGradient() }),
    shine: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  }
}
type Mats = ReturnType<typeof buildMats>

const AURA = new THREE.MeshBasicMaterial({ color: '#8ff4ff', transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false })

const Ctx = createContext({ outline: true, color: '#5a3e34', thick: 0.0022 })

function P({ g, m, o = true, position, rotation, scale }: { g: THREE.BufferGeometry; m: THREE.Material; o?: boolean; position?: V3; rotation?: V3; scale?: number | V3 }) {
  const c = useContext(Ctx)
  const s = scale === undefined ? 1 : typeof scale === 'number' ? scale : (scale[0] + scale[1] + scale[2]) / 3
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={g} material={m} />
      {o && c.outline && <mesh geometry={g} material={outlineMat(c.thick / s, c.color)} />}
    </group>
  )
}

export function Gecko({ drive, possessed = false, outline = true }: { drive: MutableRefObject<GeckoDrive>; possessed?: boolean; outline?: boolean }) {
  const mats = useMemo(() => buildMats(possessed), [possessed])
  const ctx = useMemo(() => ({ outline, color: possessed ? '#4fd8ef' : '#5a3e34', thick: 0.0022 }), [outline, possessed])
  const root = useRef<THREE.Group>(null)
  const spine = useRef<(THREE.Group | null)[]>([])
  const head = useRef<THREE.Group>(null)
  const throat = useRef<THREE.Mesh>(null)
  const legs = useRef<(THREE.Group | null)[]>([])
  const tail = useRef<(THREE.Group | null)[]>([])
  const eyes = useRef<(THREE.Group | null)[]>([])
  const aura = useRef<THREE.Mesh>(null)
  const st = useRef({ phase: 0, walk: 0, blinkT: 3, blink: 0, lookT: 2, look: 0, lookWant: 0, chirp: 0 })

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const t = clock.elapsedTime
    const d = drive.current
    const s = st.current
    const moving = d.pose === 'crawl' ? THREE.MathUtils.clamp(d.speed / 0.6, 0, 1) : 0
    s.walk += (moving - s.walk) * (1 - Math.exp(-12 * dt))
    const a = s.walk
    // 壁虎爬行是一頓一頓的：步頻快，身體左右扭成 S 形
    if (a > 0.02) s.phase += dt * (9 + 12 * a)
    const sw = Math.sin(s.phase)

    if (root.current) root.current.rotation.y = d.heading

    // 脊椎：前半、後半反向扭，S 形
    spine.current.forEach((g, i) => {
      if (!g) return
      g.rotation.y = (i === 0 ? 1 : -1) * sw * 0.28 * a
    })
    // 腳：對角一起，往前往後掃（在牆面上），抬起來時離牆一點點
    const legAng = [sw, -sw, -sw, sw]
    legs.current.forEach((g, i) => {
      if (!g) return
      const sd = i % 2 === 0 ? 1 : -1
      const front = i < 2
      g.rotation.y = sd * (front ? 0.5 : -0.45) + legAng[i] * 0.55 * a * sd
      g.rotation.z = sd * -0.15 - Math.max(0, legAng[i]) * 0.3 * a * sd
    })
    // 尾巴：跟著身體甩，末端慢一拍
    tail.current.forEach((g, i) => {
      if (!g) return
      const idle = d.pose === 'still' ? Math.sin(t * 1.1 - i * 0.6) * 0.06 : 0
      g.rotation.y = Math.sin(s.phase - 1.2 - i * 0.7) * 0.3 * a + idle
    })

    // 靜止時偶爾轉頭看一下
    s.lookT -= dt
    if (s.lookT <= 0) {
      s.lookT = 1.2 + Math.random() * 2.5
      s.lookWant = d.pose === 'crawl' ? 0 : (Math.random() - 0.5) * 0.9
    }
    s.look += (s.lookWant - s.look) * (1 - Math.exp(-10 * dt))
    // 叫：喉嚨一鼓一鼓（嘖、嘖、嘖），頭跟著點
    if (d.pose === 'chirp') s.chirp += dt
    else s.chirp = 0
    const beat = d.pose === 'chirp' ? Math.max(0, Math.sin(s.chirp * Math.PI * 2 * 3.2)) : 0
    if (head.current) {
      head.current.rotation.y = s.look + sw * -0.2 * a
      head.current.rotation.x = -beat * 0.18
    }
    if (throat.current) {
      const k = 1 + beat * 0.9
      throat.current.scale.set(0.009 * k, 0.006 * k, 0.012)
    }

    s.blinkT -= dt
    if (s.blinkT <= 0) {
      s.blinkT = 2 + Math.random() * 4
      s.blink = 1
    }
    s.blink = Math.max(0, s.blink - dt * 8)
    eyes.current.forEach((g) => g && (g.scale.y = Math.max(0.1, 1 - (s.blink > 0 ? Math.sin(s.blink * Math.PI) : 0))))

    if (aura.current) {
      aura.current.visible = possessed
      const p = 1 + Math.sin(t * 3) * 0.08
      aura.current.scale.set(0.05 * p, 0.03 * p, 0.12 * p)
    }
  })

  const m = mats
  return (
    <Ctx.Provider value={ctx}>
      <group ref={root}>
        {/* 前半身（肩膀＋頭）：跟著脊椎的第一節扭 */}
        <group ref={(el) => void (spine.current[0] = el)} position={[0, BODY_Y, 0.004]}>
          <P g={capsule(BODY_R, BODY_LEN * 0.45)} m={m.back} position={[0, 0, 0.013]} rotation={[Math.PI / 2, 0, 0]} scale={[1.05, 0.62, 1]} />
          <mesh geometry={SPHERE()} material={m.belly} position={[0, -0.005, 0.014]} scale={[0.011, 0.004, 0.022]} />
          {/* 前腳 */}
          {[1, -1].map((sd, i) => (
            <Leg key={sd} sd={sd} z={LEG.zf} refs={legs} i={i} mats={m} />
          ))}
          {/* 頭：扁扁的三角形，眼睛很大、長在兩側 */}
          <group ref={head} position={[HEAD[0], HEAD[1] - BODY_Y, HEAD[2] - 0.004]}>
            <P g={SPHERE()} m={m.back} scale={[0.0135, 0.0085, 0.017]} />
            <mesh geometry={SPHERE()} material={m.back} position={[0, -0.001, 0.013]} scale={[0.009, 0.006, 0.01]} />
            <mesh ref={throat} geometry={SPHERE()} material={m.throat} position={[0, -0.006, 0.004]} scale={[0.009, 0.006, 0.012]} />
            {[1, -1].map((sd, i) => (
              <group key={sd} ref={(el) => void (eyes.current[i] = el)} position={[sd * 0.011, 0.004, 0.004]}>
                <mesh geometry={SPHERE()} material={m.eye} scale={0.0055} />
                <mesh geometry={SPHERE()} material={m.shine} position={[sd * 0.0025, 0.003, 0.002]} scale={0.0016} />
              </group>
            ))}
          </group>
        </group>
        {/* 後半身＋尾巴：脊椎第二節 */}
        <group ref={(el) => void (spine.current[1] = el)} position={[0, BODY_Y, -0.004]}>
          <P g={capsule(BODY_R * 0.95, BODY_LEN * 0.4)} m={m.back} position={[0, 0, -0.012]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.6, 1]} />
          {[1, -1].map((sd, i) => (
            <Leg key={sd} sd={sd} z={LEG.zb + 0.004} refs={legs} i={i + 2} mats={m} />
          ))}
          <group position={[0, 0, -0.034]}>
            <TailSegment i={0} refs={tail} mats={m} />
          </group>
        </group>
        <mesh ref={aura} geometry={SPHERE()} material={AURA} position={[0, 0.012, 0]} visible={false} />
      </group>
    </Ctx.Provider>
  )
}

/** 一隻腳：往外撇，末端一團吸盤腳趾 */
function Leg({ sd, z, refs, i, mats }: { sd: number; z: number; refs: MutableRefObject<(THREE.Group | null)[]>; i: number; mats: Mats }) {
  return (
    <group ref={(el) => void (refs.current[i] = el)} position={[sd * LEG.x * 0.8, -0.002, z]}>
      {/* 腳往 +x（或 -x）伸出去，稍微往下貼牆 */}
      <P g={capsule(0.0032, LEG.len)} m={mats.back} position={[sd * LEG.len * 0.55, -0.004, 0]} rotation={[0, 0, Math.PI / 2 + sd * 0.25]} />
      <group position={[sd * (LEG.len + 0.006), -0.008, 0]}>
        {[-0.5, 0, 0.5].map((a, j) => (
          <mesh key={j} geometry={SPHERE()} material={mats.toe} position={[sd * Math.cos(a) * 0.005, 0, Math.sin(a) * 0.006 + 0.002]} scale={[0.0028, 0.0016, 0.0028]} />
        ))}
      </group>
    </group>
  )
}

/** 尾巴的一節（遞迴，越來越細） */
function TailSegment({ i, refs, mats }: { i: number; refs: MutableRefObject<(THREE.Group | null)[]>; mats: Mats }) {
  const r = 0.0085 - i * 0.0014
  return (
    <group ref={(el) => void (refs.current[i] = el)}>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <P g={capsule(r, TAIL_LEN - r)} m={mats.back} position={[0, TAIL_LEN / 2, 0]} scale={[1, 1, 0.7]} />
        {i < TAIL_SEG - 1 && (
          <group position={[0, TAIL_LEN, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <TailSegment i={i + 1} refs={refs} mats={mats} />
          </group>
        )}
      </group>
    </group>
  )
}
