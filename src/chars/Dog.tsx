import { createContext, useContext, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { outlineMat, toon } from './toon'

// 小黑：阿春民宿門口的黑色土狗（DESIGN §26.2）。阿嬤可以附身在牠身上，吠一聲把人嚇走、把廟公引開。
// 跟阿咪（Cat.tsx）同一套卡通光影與描邊。原點在四隻腳中間的地面，面向 +z；
// 父元件負責擺位置、每幀改 drive（heading 由父元件自己平滑，這裡直接用）。

export interface DogDrive {
  /** 移動速度（公尺／秒）：走路的步頻跟著變 */
  speed: number
  /** 面向（弧度，0 = 朝 +z） */
  heading: number
  pose: 'walk' | 'sit' | 'lie' | 'bark' | 'wag'
}

export const newDogDrive = (d: Partial<DogDrive> = {}): DogDrive => ({ speed: 0, heading: 0, pose: 'sit', ...d })

// ---------------------------------------------------------------------------
// 尺寸（公尺）：耳朵尖大約 0.66 高，身體長 0.55（台灣土狗：瘦、腿長、耳朵立著、尾巴捲在背上）
// ---------------------------------------------------------------------------

const BODY_Y = 0.36
const BODY_R = 0.105
const BODY_LEN = 0.3
const HEAD_R = 0.105
const HEAD_POS: [number, number, number] = [0, 0.52, 0.27]
const LEG_R = 0.032
const LEG_LEN = 0.22
const HIP = { x: 0.065, y: 0.32, zf: 0.15, zb: -0.15 }
const TAIL_SEG = 5
const TAIL_LEN = 0.058

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
const cone = (r: number, h: number) => G(`cone${r}|${h}`, () => new THREE.ConeGeometry(r, h, 4))

function buildMats(possessed: boolean) {
  // 附身時毛色不變（客人看到的還是那隻小黑），只有眼睛發青光、描邊帶一點青色、外面一圈淡淡的光。
  // 黑狗不能真的全黑：夜裡會看不見，給一點暖灰的自發光
  return {
    fur: toon('#2e2828', { glow: 0.3 }),
    furDark: toon('#221d1d', { glow: 0.28 }),
    chest: toon('#efe6d6'),
    brow: toon('#8a5a36'),
    nose: toon('#141010'),
    pink: toon('#e98a96'),
    mouth: toon('#6a2228'),
    tongue: toon('#f07c8a'),
    iris: possessed
      ? new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.4, 2.8), toneMapped: false })
      : toon('#c98a2a', { glow: 0.45 }),
    shine: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  }
}
type Mats = ReturnType<typeof buildMats>

const AURA = new THREE.MeshBasicMaterial({ color: '#8ff4ff', transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false })

// ---------------------------------------------------------------------------
// 零件：網格 + 描邊（描邊厚度除以縮放，世界裡一樣粗）
// ---------------------------------------------------------------------------

const Ctx = createContext({ outline: true, color: '#120e0e', thick: 0.009 })

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
  /** 身體往後縮（吠的時候的反作用） */
  bodyZ: number
  /** 頭的位置與俯仰（負＝抬頭） */
  headY: number
  headZ: number
  headPitch: number
  /** 前腳、後腳的額外角度（正＝往前） */
  front: number
  back: number
  /** 尾巴根部往上翹、每一節往前捲多少（土狗的尾巴捲在背上） */
  tailUp: number
  tailCurl: number
  /** 嘴巴張多大、舌頭伸多長 */
  mouth: number
  tongue: number
  /** 眼睛閉（1＝全閉） */
  shut: number
  /** 耳朵往後貼（趴著、放鬆） */
  earBack: number
}

// 腳的角度：0＝直直往下；−π/2＝往前平放（坐著的後腳、趴著的四隻腳）。
const STAND: Shape = { bodyY: BODY_Y, bodyPitch: 0, bodyZ: 0, headY: HEAD_POS[1], headZ: HEAD_POS[2], headPitch: 0.1, front: 0, back: 0, tailUp: 1.1, tailCurl: 0.55, mouth: 0, tongue: 0, shut: 0, earBack: 0 }
const SHAPES: Record<DogDrive['pose'], Shape> = {
  walk: STAND,
  // 坐著：身體往後仰，後腳往前折，前腳要 +0.62 才會垂直地面
  sit: { bodyY: 0.3, bodyPitch: -0.62, bodyZ: -0.04, headY: 0.62, headZ: 0.18, headPitch: 0.15, front: 0.62, back: -0.95, tailUp: -0.4, tailCurl: 0.2, mouth: 0.25, tongue: 0.5, shut: 0, earBack: 0 },
  lie: { bodyY: 0.14, bodyPitch: 0, bodyZ: 0, headY: 0.2, headZ: 0.36, headPitch: 0.35, front: -1.45, back: -1.4, tailUp: -0.2, tailCurl: 0.05, mouth: 0, tongue: 0, shut: 0.85, earBack: 0.6 },
  bark: { ...STAND, headY: 0.6, headZ: 0.3, headPitch: -0.45, mouth: 1, tongue: 0.2, earBack: -0.1 },
  wag: { ...STAND, headPitch: 0.05, mouth: 0.45, tongue: 1, shut: 0.25, earBack: 0.35 },
}

const ease = (cur: number, want: number, k: number) => cur + (want - cur) * k

export function Dog({ drive, possessed = false, outline = true }: { drive: MutableRefObject<DogDrive>; possessed?: boolean; outline?: boolean }) {
  const mats = useMemo(() => buildMats(possessed), [possessed])
  const ctx = useMemo(() => ({ outline, color: possessed ? '#4fd8ef' : '#120e0e', thick: 0.009 }), [outline, possessed])
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const legs = useRef<(THREE.Group | null)[]>([])
  const tail = useRef<(THREE.Group | null)[]>([])
  const ears = useRef<(THREE.Group | null)[]>([])
  const eyes = useRef<(THREE.Group | null)[]>([])
  const jaw = useRef<THREE.Group>(null)
  const tongue = useRef<THREE.Mesh>(null)
  const aura = useRef<THREE.Mesh>(null)
  const st = useRef({
    phase: 0,
    shape: { ...SHAPES.sit },
    blinkT: 2 + Math.random() * 3,
    blink: 0,
    twitchT: 3,
    twitch: [0, 0],
    walk: 0,
    barkPh: 0,
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
    const moving = d.pose === 'walk' || d.pose === 'wag' || d.pose === 'bark' ? THREE.MathUtils.clamp(d.speed / 1.8, 0, 1) : 0
    s.walk = ease(s.walk, moving, 1 - Math.exp(-10 * dt))
    const a = s.walk
    if (a > 0.02) s.phase += dt * (5 + 8 * a)
    const sw = Math.sin(s.phase)

    // 吠：一聲一聲（每 0.45 秒），頭往上甩、身體往後頓一下
    if (d.pose === 'bark') s.barkPh += dt / 0.45
    else s.barkPh = 0
    const pulse = d.pose === 'bark' ? Math.pow(Math.max(0, Math.sin((s.barkPh % 1) * Math.PI)), 2) : 0

    if (root.current) root.current.rotation.y = d.heading

    if (body.current) {
      const breathe = d.pose === 'lie' ? Math.sin(t * 1.3) * 0.01 : d.pose === 'sit' || d.pose === 'wag' ? Math.sin(t * 5) * 0.004 : 0
      body.current.position.y = sh.bodyY + Math.abs(Math.cos(s.phase)) * 0.018 * a + breathe
      body.current.position.z = sh.bodyZ - pulse * 0.035
      body.current.rotation.x = sh.bodyPitch
      // 搖尾巴的時候屁股也跟著扭
      body.current.rotation.y = d.pose === 'wag' ? Math.sin(t * 14) * 0.06 : 0
    }

    // 腳：對角的兩隻一起動（左前＋右後、右前＋左後）
    const legAng = [sw, -sw, -sw, sw]
    legs.current.forEach((g, i) => {
      if (!g) return
      const front = i < 2
      g.rotation.x = legAng[i] * 0.6 * a + (front ? sh.front : sh.back)
      g.position.y = HIP.y - BODY_Y + Math.max(0, -legAng[i]) * 0.015 * a
    })

    if (head.current) {
      head.current.position.set(0, sh.headY + pulse * 0.02, sh.headZ + (sh.bodyZ - pulse * 0.035) * 0.6)
      const bob = d.pose === 'walk' ? Math.sin(s.phase * 2) * 0.03 * a : 0
      head.current.rotation.x = sh.headPitch + bob - pulse * 0.25
      // 歪頭（聽到聲音、撒嬌）
      head.current.rotation.z = d.pose === 'wag' ? Math.sin(t * 1.3) * 0.18 : d.pose === 'sit' ? Math.sin(t * 0.6) * 0.08 : 0
      head.current.rotation.y = d.pose === 'sit' ? Math.sin(t * 0.4) * 0.35 : d.pose === 'lie' ? 0.15 : 0
    }

    // 尾巴：捲在背上；走路、搖尾巴的時候左右甩
    tail.current.forEach((g, i) => {
      if (!g) return
      const lag = i * 0.45
      const fast = d.pose === 'wag' ? 16 : d.pose === 'walk' ? 7 : 2
      const amp = d.pose === 'wag' ? 0.45 : d.pose === 'walk' ? 0.12 + 0.12 * a : d.pose === 'lie' ? 0.03 : 0.1
      g.rotation.z = Math.sin(t * fast - lag) * amp
      g.rotation.x = i === 0 ? sh.tailUp : sh.tailCurl
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
      g.rotation.z = sd * (-0.12 - Math.sin(s.twitch[i] * Math.PI) * 0.3)
      g.rotation.x = -sh.earBack * 0.9 - pulse * 0.2
    })

    if (jaw.current) jaw.current.rotation.x = (sh.mouth * 0.45 + pulse * 0.35) * (d.pose === 'wag' ? 0.8 + 0.2 * Math.sin(t * 9) : 1)
    if (tongue.current) {
      // 喘氣：舌頭一伸一縮
      const out = sh.tongue * (d.pose === 'wag' || d.pose === 'sit' ? 0.85 + 0.15 * Math.sin(t * 9) : 1)
      tongue.current.visible = out > 0.08
      tongue.current.scale.set(0.024, 0.008, 0.02 + 0.035 * out)
    }
    if (aura.current) {
      aura.current.visible = possessed
      const p = 1 + Math.sin(t * 2.6) * 0.06
      aura.current.scale.set(0.3 * p, 0.34 * p, 0.46 * p)
    }
  })

  const m = mats
  return (
    <Ctx.Provider value={ctx}>
      <group ref={root}>
        <group ref={body} position={[0, BODY_Y, 0]}>
          {/* 身體：橫躺的膠囊、胸口一塊白毛（土狗常見的「白胸」） */}
          <P g={capsule(BODY_R, BODY_LEN)} m={m.fur} rotation={[Math.PI / 2, 0, 0]} scale={[0.92, 1, 1]} />
          <P g={SPHERE()} m={m.chest} o={false} position={[0, -0.02, 0.2]} scale={[0.065, 0.085, 0.05]} />
          {/* 腳：掛在肩膀和髖部，細長；前腳下面一點白襪 */}
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
              {/* 大腿（後腳粗一點） */}
              <P g={capsule(i < 2 ? LEG_R : LEG_R * 1.25, LEG_LEN * 0.45)} m={m.fur} position={[0, -LEG_LEN * 0.25, 0]} />
              <P g={capsule(LEG_R * 0.85, LEG_LEN * 0.55)} m={m.furDark} position={[0, -LEG_LEN * 0.68, 0]} />
              <P g={SPHERE()} m={i < 2 ? m.chest : m.furDark} position={[0, -LEG_LEN - 0.012, 0.012]} scale={[0.032, 0.022, 0.042]} />
            </group>
          ))}
          {/* 尾巴：從屁股往上往前捲 */}
          <group position={[0, 0.06, -BODY_LEN / 2 - BODY_R * 0.7]}>
            <TailSegment i={0} refs={tail} mats={m} />
          </group>
        </group>

        {/* 頭（不跟身體一起轉，才能坐著抬頭、趴著擱在前腳上） */}
        <group ref={head} position={HEAD_POS}>
          <P g={SPHERE()} m={m.fur} scale={[HEAD_R * 0.98, HEAD_R * 0.92, HEAD_R * 1.02]} />
          {/* 眉毛上的兩點黃褐色（四眼狗） */}
          {[-1, 1].map((sd) => (
            <mesh key={sd} geometry={SPHERE()} material={m.brow} position={[sd * 0.038, 0.045, 0.085]} scale={[0.014, 0.01, 0.008]} />
          ))}
          {/* 口鼻：往前伸的一截，下巴另外一塊會張開 */}
          <P g={capsule(0.045, 0.06)} m={m.fur} position={[0, -0.03, 0.11]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh geometry={SPHERE()} material={m.nose} position={[0, -0.018, 0.17]} scale={[0.022, 0.016, 0.014]} />
          <group ref={jaw} position={[0, -0.055, 0.07]}>
            <P g={capsule(0.03, 0.05)} m={m.furDark} position={[0, -0.006, 0.05]} rotation={[Math.PI / 2, 0, 0]} />
            <mesh geometry={SPHERE()} material={m.mouth} position={[0, 0.014, 0.05]} scale={[0.026, 0.008, 0.045]} />
            <mesh ref={tongue} geometry={SPHERE()} material={m.tongue} position={[0, 0.012, 0.085]} visible={false} />
          </group>
          {/* 眼睛：琥珀色；附身時變成青色發光 */}
          {[-1, 1].map((sd, i) => (
            <group
              key={sd}
              ref={(el) => {
                eyes.current[i] = el
              }}
              position={[sd * 0.045, 0.02, 0.085]}
              rotation={[0, sd * 0.38, 0]}
            >
              <mesh geometry={SPHERE()} material={m.iris} scale={[0.018, 0.019, 0.009]} />
              {!possessed && <mesh geometry={SPHERE()} material={m.nose} position={[0, 0, 0.006]} scale={0.011} />}
              <mesh geometry={SPHERE()} material={m.shine} position={[-0.005, 0.007, 0.009]} scale={0.0045} />
            </group>
          ))}
          {/* 耳朵：立著、尖尖的三角（四角錐） */}
          {[-1, 1].map((sd, i) => (
            <group
              key={sd}
              ref={(el) => {
                ears.current[i] = el
              }}
              position={[sd * 0.058, 0.075, -0.015]}
            >
              <P g={cone(0.042, 0.1)} m={m.fur} position={[0, 0.045, 0]} rotation={[0, Math.PI / 4, 0]} />
              <mesh geometry={cone(0.026, 0.065)} material={m.pink} position={[0, 0.04, 0.014]} rotation={[0, Math.PI / 4, 0]} />
            </group>
          ))}
        </group>

        <mesh ref={aura} geometry={SPHERE()} material={AURA} position={[0, 0.38, 0.04]} visible={false} />
      </group>
    </Ctx.Provider>
  )
}

/** 尾巴的一節：自己的膠囊 + 下一節（遞迴，關節一節一節傳下去） */
function TailSegment({ i, refs, mats }: { i: number; refs: MutableRefObject<(THREE.Group | null)[]>; mats: Mats }) {
  const r = 0.026 - i * 0.003
  return (
    <group
      ref={(el) => {
        refs.current[i] = el
      }}
    >
      {/* 尾巴往 -z 長：膠囊轉平，原點在這一節的根部 */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <P g={capsule(r, TAIL_LEN - r)} m={i === TAIL_SEG - 1 ? mats.furDark : mats.fur} position={[0, TAIL_LEN / 2, 0]} />
        {i < TAIL_SEG - 1 && (
          <group position={[0, TAIL_LEN, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <TailSegment i={i + 1} refs={refs} mats={mats} />
          </group>
        )}
      </group>
    </group>
  )
}
