import { createContext, useContext, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { outlineMat, toon } from './toon'

// 阿咪：深夜在屋裡亂晃的橘貓，阿嬤可以附身在牠身上（DESIGN §25.2）。
// 跟 Q 版人物同一套卡通光影與描邊。原點在四隻腳中間的地面，面向 +z；
// 父元件負責擺位置、每幀改 drive（heading 由父元件自己平滑，這裡直接用）。

export interface CatDrive {
  /** 移動速度（公尺／秒）：走路的步頻跟著變 */
  speed: number
  /** 面向（弧度，0 = 朝 +z） */
  heading: number
  pose: 'walk' | 'sit' | 'sleep' | 'meow' | 'rub'
}

export const newCatDrive = (d: Partial<CatDrive> = {}): CatDrive => ({ speed: 0, heading: 0, pose: 'walk', ...d })

// ---------------------------------------------------------------------------
// 尺寸（公尺）：耳朵尖大約 0.46 高，身體長 0.42
// ---------------------------------------------------------------------------

const BODY_Y = 0.2
const BODY_R = 0.095
const BODY_LEN = 0.2
const HEAD_R = 0.1
const HEAD_POS: [number, number, number] = [0, 0.3, 0.19]
const LEG_R = 0.027
const LEG_LEN = 0.12
const HIP = { x: 0.058, y: 0.17, zf: 0.115, zb: -0.115 }
const TAIL_SEG = 5
const TAIL_LEN = 0.062

type V3 = [number, number, number]

// ---------------------------------------------------------------------------
// 材質與幾何（共用快取）
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
const SPHERE = () => G('sphere', () => new THREE.SphereGeometry(1, 24, 16))
const capsule = (r: number, len: number) => G(`cap${r}|${len}`, () => new THREE.CapsuleGeometry(r, len, 6, 14))
const cone = (r: number, h: number) => G(`cone${r}|${h}`, () => new THREE.ConeGeometry(r, h, 10))
const cyl = (r: number, h: number) => G(`cyl${r}|${h}`, () => new THREE.CylinderGeometry(r, r, h, 5))

let tabby: THREE.CanvasTexture | null = null
/** 虎斑：沿著身體一圈一圈的深橘色條紋（膠囊的 v 方向是身體長邊） */
function tabbyTexture() {
  if (tabby) return tabby
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 128
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ec9a44'
  ctx.fillRect(0, 0, 64, 128)
  ctx.fillStyle = '#c96a24'
  for (let i = 0; i < 7; i++) {
    const y = 12 + i * 16
    ctx.beginPath()
    // 條紋在背上最寬、往肚子變細（u 的中間是背）
    ctx.moveTo(0, y + 3)
    ctx.quadraticCurveTo(32, y - 5, 64, y + 3)
    ctx.lineTo(64, y + 6)
    ctx.quadraticCurveTo(32, y + 3, 0, y + 6)
    ctx.fill()
  }
  tabby = new THREE.CanvasTexture(c)
  tabby.colorSpace = THREE.SRGBColorSpace
  tabby.wrapS = THREE.RepeatWrapping
  return tabby
}

function buildMats(possessed: boolean) {
  // 附身時毛色不變（客人看到的還是一隻普通的貓），只有眼睛發青光、描邊帶一點青色、外面一圈淡淡的光
  const ghost = false
  return {
    fur: toon('#ec9a44', { ghost }),
    furTabby: toon('#ffffff', { ghost, map: tabbyTexture(), glow: 0.2 }),
    stripe: toon('#c96a24', { ghost }),
    white: toon('#f8f0e2', { ghost }),
    pink: toon('#f29aa6', { ghost }),
    dark: toon('#2a1e1e'),
    mouth: toon('#7a2e34'),
    iris: possessed
      ? new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.4, 2.8), toneMapped: false })
      : toon('#e8b83a', { glow: 0.45 }),
    shine: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  }
}
type Mats = ReturnType<typeof buildMats>

const AURA = new THREE.MeshBasicMaterial({ color: '#8ff4ff', transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false })
const WHISKER = new THREE.MeshBasicMaterial({ color: '#f4efe6' })

// ---------------------------------------------------------------------------
// 零件：網格 + 描邊（描邊厚度除以縮放，世界裡一樣粗）
// ---------------------------------------------------------------------------

const Ctx = createContext({ outline: true, color: '#3b2a2a', thick: 0.008 })

function P({ g, m, o = true, position, rotation, scale }: { g: THREE.BufferGeometry; m: THREE.Material; o?: boolean; position?: V3; rotation?: V3; scale?: number | V3 }) {
  const c = useContext(Ctx)
  const s = scale === undefined ? 1 : typeof scale === 'number' ? scale : (scale[0] + scale[1] + scale[2]) / 3
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={g} material={m} castShadow />
      {o && c.outline && <mesh geometry={g} material={outlineMat(c.thick / s, c.color)} />}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 姿勢：每個部位的目標值，每幀往目標平滑
// ---------------------------------------------------------------------------

interface Shape {
  /** 身體中心高度、俯仰（負＝前面抬高，坐著） */
  bodyY: number
  bodyPitch: number
  /** 側傾（磨蹭） */
  roll: number
  /** 頭的位置與俯仰（負＝抬頭） */
  headY: number
  headZ: number
  headPitch: number
  /** 前腳、後腳的額外角度（正＝往前） */
  front: number
  back: number
  /** 後腳往上縮（坐著、睡著） */
  backLift: number
  frontLift: number
  /** 尾巴根部往上翹（正＝往上）、每一節再往上彎多少、往旁邊繞（坐著、睡覺圈住身體） */
  tailUp: number
  tailCurl: number
  tailWrap: number
  /** 嘴巴張多大 */
  mouth: number
  /** 眼睛閉（1＝全閉） */
  shut: number
}

// 腳的角度：0＝直直往下；−π/2＝往前平放（坐著的後腳、睡覺的四隻腳）。
// 坐著時身體往後仰 0.75，前腳要 +0.72 才會垂直地面。
const SIT: Shape = { bodyY: 0.15, bodyPitch: -0.75, roll: 0, headY: 0.36, headZ: 0.11, headPitch: 0.2, front: 0.72, back: -0.82, backLift: 0, frontLift: 0, tailUp: -0.9, tailCurl: 0.02, tailWrap: 1.2, mouth: 0, shut: 0 }
const SHAPES: Record<CatDrive['pose'], Shape> = {
  walk: { bodyY: BODY_Y, bodyPitch: 0, roll: 0, headY: HEAD_POS[1], headZ: HEAD_POS[2], headPitch: 0.05, front: 0, back: 0, backLift: 0, frontLift: 0, tailUp: 1.0, tailCurl: 0.25, tailWrap: 0, mouth: 0, shut: 0 },
  sit: SIT,
  sleep: { bodyY: 0.1, bodyPitch: 0, roll: 0.12, headY: 0.14, headZ: 0.2, headPitch: 0.5, front: -1.45, back: -1.4, backLift: 0, frontLift: 0, tailUp: -0.3, tailCurl: 0.02, tailWrap: 2.0, mouth: 0, shut: 1 },
  meow: { ...SIT, headY: 0.37, headZ: 0.12, headPitch: -0.45, tailUp: -0.6, tailWrap: 0.8, mouth: 1, shut: 0.35 },
  rub: { bodyY: 0.19, bodyPitch: 0.05, roll: 0.3, headY: 0.28, headZ: 0.2, headPitch: 0.15, front: 0, back: 0, backLift: 0, frontLift: 0, tailUp: 1.2, tailCurl: 0.2, tailWrap: -0.3, mouth: 0, shut: 0.6 },
}

const ease = (cur: number, want: number, k: number) => cur + (want - cur) * k

export function Cat({ drive, possessed = false, outline = true }: { drive: MutableRefObject<CatDrive>; possessed?: boolean; outline?: boolean }) {
  const mats = useMemo(() => buildMats(possessed), [possessed])
  const ctx = useMemo(() => ({ outline, color: possessed ? '#4fd8ef' : '#3b2a2a', thick: 0.008 }), [outline, possessed])
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const legs = useRef<(THREE.Group | null)[]>([])
  const tail = useRef<(THREE.Group | null)[]>([])
  const ears = useRef<(THREE.Group | null)[]>([])
  const eyes = useRef<(THREE.Group | null)[]>([])
  const mouth = useRef<THREE.Mesh>(null)
  const aura = useRef<THREE.Mesh>(null)
  const st = useRef({
    phase: 0,
    shape: { ...SHAPES.walk },
    blinkT: 2 + Math.random() * 3,
    blink: 0,
    twitchT: 3,
    twitch: [0, 0],
    walk: 0,
  })

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const t = clock.elapsedTime
    const d = drive.current
    const s = st.current
    const want = SHAPES[d.pose] ?? SHAPES.walk
    const k = 1 - Math.exp(-8 * dt)
    const sh = s.shape
    for (const key of Object.keys(want) as (keyof Shape)[]) sh[key] = ease(sh[key], want[key], k)

    // 走路：步頻跟著速度，相位用累加的（速度一變不會跳）
    const moving = d.pose === 'walk' || d.pose === 'rub' ? THREE.MathUtils.clamp(d.speed / 1.4, 0, 1) : 0
    s.walk = ease(s.walk, moving, 1 - Math.exp(-10 * dt))
    const a = s.walk
    if (a > 0.02) s.phase += dt * (5 + 9 * a)
    const sw = Math.sin(s.phase)

    if (root.current) root.current.rotation.y = d.heading

    if (body.current) {
      const breathe = d.pose === 'sleep' ? Math.sin(t * 1.4) * 0.012 : 0
      body.current.position.y = sh.bodyY + Math.abs(Math.cos(s.phase)) * 0.012 * a + breathe
      body.current.rotation.x = sh.bodyPitch
      body.current.rotation.z = sh.roll * (d.pose === 'rub' ? 0.7 + 0.3 * Math.sin(t * 2.4) : 1)
      body.current.scale.set(1, 1 + breathe * 2, 1)
    }

    // 腳：對角的兩隻一起動（左前＋右後、右前＋左後）
    const legAng = [sw, -sw, -sw, sw]
    legs.current.forEach((g, i) => {
      if (!g) return
      const front = i < 2
      g.rotation.x = legAng[i] * 0.55 * a + (front ? sh.front : sh.back)
      g.position.y = HIP.y - BODY_Y + (front ? sh.frontLift : sh.backLift) + Math.max(0, -legAng[i]) * 0.012 * a
    })

    if (head.current) {
      head.current.position.set(0, sh.headY, sh.headZ)
      const bob = d.pose === 'walk' ? Math.sin(s.phase * 2) * 0.02 * a : 0
      head.current.rotation.x = sh.headPitch + bob
      head.current.rotation.z = d.pose === 'rub' ? -0.35 + Math.sin(t * 2.4) * 0.1 : Math.sin(t * 0.7) * 0.04
      head.current.rotation.y = d.pose === 'sit' ? Math.sin(t * 0.45) * 0.3 : 0
    }

    // 尾巴：根部翹起，一節一節往後延遲地擺
    tail.current.forEach((g, i) => {
      if (!g) return
      const lag = i * 0.55
      const amp = d.pose === 'sleep' ? 0.05 : d.pose === 'walk' ? 0.18 + 0.1 * a : 0.28
      g.rotation.z = Math.sin(t * (d.pose === 'sleep' ? 0.8 : 2.2) - lag) * amp
      g.rotation.x = i === 0 ? sh.tailUp : sh.tailCurl
      g.rotation.y = i === 0 ? sh.tailWrap : sh.tailWrap * 0.35
    })

    // 眨眼、耳朵抽一下
    s.blinkT -= dt
    if (s.blinkT <= 0) {
      s.blinkT = 2.5 + Math.random() * 4
      s.blink = 1
    }
    s.blink = Math.max(0, s.blink - dt * 7)
    const shut = Math.max(sh.shut, s.blink > 0 ? Math.sin(s.blink * Math.PI) : 0)
    eyes.current.forEach((g) => g && (g.scale.y = Math.max(0.08, 1 - shut)))
    s.twitchT -= dt
    if (s.twitchT <= 0) {
      s.twitchT = 1.5 + Math.random() * 4
      s.twitch[Math.random() < 0.5 ? 0 : 1] = 1
    }
    ears.current.forEach((g, i) => {
      if (!g) return
      s.twitch[i] = Math.max(0, s.twitch[i] - dt * 5)
      const sd = i === 0 ? 1 : -1
      g.rotation.z = sd * (-0.28 - Math.sin(s.twitch[i] * Math.PI) * 0.35) + (d.pose === 'sleep' ? sd * -0.25 : 0)
    })

    if (mouth.current) {
      const open = sh.mouth * (d.pose === 'meow' ? 0.6 + 0.4 * Math.abs(Math.sin(t * 5)) : 1)
      mouth.current.visible = open > 0.05
      mouth.current.scale.set(0.022, 0.028 * open + 0.001, 0.012)
    }
    if (aura.current) {
      aura.current.visible = possessed
      const p = 1 + Math.sin(t * 2.6) * 0.06
      aura.current.scale.set(0.27 * p, 0.26 * p, 0.36 * p)
    }
  })

  const m = mats
  return (
    <Ctx.Provider value={ctx}>
      <group ref={root}>
        <group ref={body} position={[0, BODY_Y, 0]}>
          {/* 身體：橫躺的膠囊（虎斑）、胸口一塊白毛 */}
          <P g={capsule(BODY_R, BODY_LEN)} m={m.furTabby} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.92]} />
          <P g={SPHERE()} m={m.white} o={false} position={[0, -0.03, 0.12]} scale={[0.07, 0.075, 0.05]} />
          {/* 腳：掛在肩膀和髖部，往下是一截腿＋白色腳掌 */}
          {(
            [
              [HIP.x, HIP.zf],
              [-HIP.x, HIP.zf],
              [HIP.x, HIP.zb],
              [-HIP.x, HIP.zb],
            ] as [number, number][]
          ).map(([x, z], i) => (
            <group
              key={i}
              ref={(el) => {
                legs.current[i] = el
              }}
              position={[x, HIP.y - BODY_Y, z]}
            >
              <P g={capsule(LEG_R, LEG_LEN)} m={i < 2 ? m.fur : m.stripe} position={[0, -LEG_LEN / 2 - 0.01, 0]} />
              <P g={SPHERE()} m={m.white} position={[0, -LEG_LEN - 0.03, 0.01]} scale={[0.03, 0.022, 0.036]} />
            </group>
          ))}
          {/* 尾巴：從屁股往後往上，一節接一節 */}
          <group position={[0, 0.04, -BODY_LEN / 2 - BODY_R * 0.75]}>
            <TailSegment i={0} refs={tail} mats={m} />
          </group>
        </group>

        {/* 頭（不跟身體一起轉，才能坐著抬頭、睡覺時擱在前腳上） */}
        <group ref={head} position={HEAD_POS}>
          <P g={SPHERE()} m={m.fur} scale={[HEAD_R * 1.12, HEAD_R * 0.95, HEAD_R]} />
          {/* 額頭的 M 字虎紋 */}
          {[-0.03, 0, 0.03].map((x, i) => (
            <mesh key={i} geometry={SPHERE()} material={m.stripe} position={[x, 0.06, 0.07]} rotation={[0.6, 0, x * 8]} scale={[0.009, 0.026, 0.008]} />
          ))}
          {/* 臉頰鼓鼓的白毛、鼻子、嘴 */}
          {[-1, 1].map((sd) => (
            <P key={sd} g={SPHERE()} m={m.white} o={false} position={[sd * 0.026, -0.035, 0.078]} scale={[0.032, 0.026, 0.026]} />
          ))}
          <mesh geometry={SPHERE()} material={m.pink} position={[0, -0.018, 0.1]} scale={[0.012, 0.009, 0.008]} />
          <mesh ref={mouth} geometry={SPHERE()} material={m.mouth} position={[0, -0.056, 0.086]} visible={false} />
          {/* 眼睛：琥珀色、直立的瞳孔；附身時變成青色發光 */}
          {[-1, 1].map((sd, i) => (
            <group
              key={sd}
              ref={(el) => {
                eyes.current[i] = el
              }}
              position={[sd * 0.042, 0.012, 0.088]}
              rotation={[0, sd * 0.42, 0]}
            >
              <mesh geometry={SPHERE()} material={m.iris} scale={[0.02, 0.023, 0.01]} />
              {!possessed && <mesh geometry={SPHERE()} material={m.dark} position={[0, 0, 0.006]} scale={[0.006, 0.018, 0.006]} />}
              <mesh geometry={SPHERE()} material={m.shine} position={[-0.006, 0.008, 0.009]} scale={0.0045} />
            </group>
          ))}
          {/* 鬍鬚 */}
          {[-1, 1].map((sd) =>
            [-0.012, 0, 0.012].map((dy, j) => (
              <mesh
                key={`${sd}${j}`}
                geometry={cyl(0.0012, 0.08)}
                material={WHISKER}
                position={[sd * 0.07, -0.03 + dy, 0.075]}
                rotation={[0, 0, sd * (Math.PI / 2 + dy * 12 - 0.05)]}
              />
            )),
          )}
          {/* 耳朵：外面橘、裡面粉紅 */}
          {[-1, 1].map((sd, i) => (
            <group
              key={sd}
              ref={(el) => {
                ears.current[i] = el
              }}
              position={[sd * 0.058, 0.07, -0.005]}
            >
              <P g={cone(0.038, 0.075)} m={m.fur} position={[0, 0.03, 0]} />
              <mesh geometry={cone(0.024, 0.05)} material={m.pink} position={[0, 0.026, 0.012]} />
            </group>
          ))}
        </group>

        <mesh ref={aura} geometry={SPHERE()} material={AURA} position={[0, 0.24, 0.03]} visible={false} />
      </group>
    </Ctx.Provider>
  )
}

/** 尾巴的一節：自己的膠囊 + 下一節（遞迴，關節一節一節傳下去） */
function TailSegment({ i, refs, mats }: { i: number; refs: MutableRefObject<(THREE.Group | null)[]>; mats: Mats }) {
  const r = 0.024 - i * 0.002
  return (
    <group
      ref={(el) => {
        refs.current[i] = el
      }}
    >
      {/* 尾巴往 -z 長：膠囊轉平，原點在這一節的根部 */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <P g={capsule(r, TAIL_LEN - r)} m={i % 2 === 0 ? mats.fur : mats.stripe} position={[0, TAIL_LEN / 2, 0]} />
        {i < TAIL_SEG - 1 && (
          <group position={[0, TAIL_LEN, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <TailSegment i={i + 1} refs={refs} mats={mats} />
          </group>
        )}
      </group>
    </group>
  )
}
