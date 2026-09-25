import { createContext, useContext, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FACE_PATCH, faceTexture } from './faces'
import { SPECS, type ChibiSpec, type Print } from './specs'
import { floralPrint, outlineMat, plaidPrint, stripePrint, toon, toonGradient } from './toon'
import { player } from '../world/player'
import { turnToward, type TurnState } from '../world/motion'

// 3D Q 版角色：大頭、三階卡通光影、深棕描邊。身體由幾何零件組成，
// 手腳掛在關節上用程式擺動（走路、待機呼吸、各種動作），整個人會轉向移動的方向。

export type PoseName =
  | 'idle'
  | 'clasp'
  | 'reach'
  | 'sweep'
  | 'drink'
  | 'phone'
  | 'scared'
  | 'bow'
  | 'fan'
  | 'film' // 雙手舉攝影機到眼前（YouTuber；走路時手也不放下）
  | 'laptop' // 坐著打筆電
  | 'sit' // 坐著，手放在腿上
  | 'wave' // 小孩舉手揮揮
  | 'flashlight' // 右手往前拿手電筒（廟公巡夜）
  | 'eat' // 右手捧碗、左手拿筷子往嘴裡送
  | 'shopkeeper' // 站在櫃台後面，兩手輕輕放在櫃台上（柑仔店阿嬌）
type PropName = 'broom' | 'bottle' | 'phone' | 'fan' | 'incense' | 'camera' | 'laptop' | 'flashlight' | 'bowl'
type LeftPropName = 'chopsticks'

/** 由外部每幀改寫，角色讀它來動 */
export interface Drive {
  /** 目前移動速度（公尺／秒） */
  speed: number
  /** 面向（弧度，0 = 朝 +z） */
  heading: number
  pose: PoseName
  expr: string
  /** 往上跳的高度（嚇到） */
  hop: number
}

export const newDrive = (d: Partial<Drive> = {}): Drive => ({ speed: 0, heading: 0.7, pose: 'idle', expr: 'normal', hop: 0, ...d })

// ---------------------------------------------------------------------------
// 尺寸（縮放前，單位公尺）
// ---------------------------------------------------------------------------

export const R = 0.27 // 頭半徑
const LEG = 0.42
const HIP_Y = 0.44
const HIP_X = 0.1
const TORSO_Y = 0.4
const TORSO_H = 0.445
const SHOULDER_Y = TORSO_Y + 0.37
const SHOULDER_X = 0.185
const NECK_Y = TORSO_Y + TORSO_H - 0.01
const HEAD_C = R * 0.9
const UPPER = 0.19
const FORE = 0.18
/** 頭頂高度（縮放前），給外部擺放用 */
export const TOP_Y = NECK_Y + HEAD_C + R
/** 坐著時屁股的高度 */
export const SEAT_Y = TORSO_Y

// ---------------------------------------------------------------------------
// 姿勢：肩膀往前擺（負＝往前）、肩膀往外張（正＝往外）、手肘彎（負＝往前彎）
// ---------------------------------------------------------------------------

type Arm = [number, number, number]
interface PoseDef {
  l: Arm
  r: Arm
  lean: number
  head: number
  prop?: PropName
  /** 左手拿的東西 */
  propL?: LeftPropName
  /** 走路時手擺動的比例（0＝手固定不擺，例如舉著攝影機） */
  swingL?: number
  swingR?: number
}

const POSES: Record<PoseName, PoseDef> = {
  idle: { l: [0.05, 0.12, -0.18], r: [0.05, 0.12, -0.18], lean: 0, head: 0 },
  clasp: { l: [-0.42, -0.3, -1.3], r: [-0.42, -0.3, -1.3], lean: 0.03, head: 0.06 },
  reach: { l: [-1.3, -0.12, -0.25], r: [-1.3, -0.12, -0.25], lean: 0.32, head: 0.18 },
  sweep: { l: [-0.85, -0.42, -0.75], r: [-0.5, -0.28, -1.0], lean: 0.1, head: 0.08, prop: 'broom' },
  drink: { l: [0.05, 0.15, -0.25], r: [-0.4, -0.12, -1.1], lean: -0.04, head: 0, prop: 'bottle' },
  phone: { l: [-0.72, -0.42, -1.38], r: [-0.72, -0.42, -1.38], lean: 0.02, head: 0.12, prop: 'phone' },
  scared: { l: [-2.7, 0.3, -2.15], r: [-2.7, 0.3, -2.15], lean: -0.12, head: -0.22 },
  bow: { l: [-1.0, -0.36, -1.5], r: [-1.0, -0.36, -1.5], lean: 0.14, head: 0.22, prop: 'incense' },
  fan: { l: [0.05, 0.12, -0.2], r: [-1.1, -0.25, -1.5], lean: 0, head: 0, prop: 'fan' },
  // 以下角度用 scratchpad/pose_solve.py 依手的目標位置解出來（手肘、前臂不穿進身體）
  film: { l: [-1.6, 0.55, -1.0], r: [-1.95, 0.55, -0.45], lean: -0.02, head: 0.04, prop: 'camera', swingL: 0, swingR: 0 },
  laptop: { l: [-0.95, -0.4, 0], r: [-0.95, -0.4, 0], lean: 0.08, head: 0.34, prop: 'laptop', swingL: 0, swingR: 0 },
  sit: { l: [-0.75, -0.1, 0], r: [-0.75, -0.1, 0], lean: 0, head: 0.04 },
  wave: { l: [0.05, 0.12, -0.18], r: [-0.2, 2.35, -0.25], lean: -0.04, head: -0.12, swingR: 0 },
  flashlight: { l: [0.05, 0.12, -0.18], r: [-1.7, 0.7, 0], lean: 0.05, head: 0.1, prop: 'flashlight', swingR: 0 },
  eat: { l: [-1.75, 0.7, -0.8], r: [-1.05, -0.7, 0], lean: 0.04, head: 0.08, prop: 'bowl', propL: 'chopsticks', swingL: 0, swingR: 0 },
  // 手在身體前面約 0.33 公尺、腰上面一點（比例 1 的人約 0.64 公尺高），前臂平放
  shopkeeper: { l: [-0.9, -0.22, -0.62], r: [-0.9, -0.22, -0.62], lean: 0.07, head: 0.06, swingL: 0, swingR: 0 },
}
const DRINK_UP: Arm = [-2.25, -0.4, -1.8]
/** 吃飯：左手在碗邊（低）和嘴邊（POSES.eat.l）之間來回 */
const EAT_LOW: Arm = [-1.15, 0.7, -1.35]

// ---------------------------------------------------------------------------
// 道具擺放：依姿勢算出手的位置與方向，反推道具在手座標裡的擺法
// ---------------------------------------------------------------------------

const AX = new THREE.Vector3(1, 0, 0)
const AZ = new THREE.Vector3(0, 0, 1)

/** 手在軀幹座標（原點在髖部）裡的位置與方向，跟 Chibi 的關節階層算法一樣 */
function handFrame(arm: Arm, side: 1 | -1) {
  const qArm = new THREE.Quaternion().setFromAxisAngle(AZ, side * arm[1]).multiply(new THREE.Quaternion().setFromAxisAngle(AX, arm[0]))
  const qHand = qArm.clone().multiply(new THREE.Quaternion().setFromAxisAngle(AX, arm[2]))
  const pos = new THREE.Vector3(side * SHOULDER_X, SHOULDER_Y - HIP_Y, 0)
    .add(new THREE.Vector3(0, -UPPER, 0).applyQuaternion(qArm))
    .add(new THREE.Vector3(0, -FORE - 0.03, 0).applyQuaternion(qHand))
  return { pos, quat: qHand }
}

interface Fit {
  position: V3
  quaternion: [number, number, number, number]
}

/**
 * 道具在手座標裡的擺法。at：道具原點在軀幹座標的位置（null＝就在手上）；
 * rot：道具在軀幹座標的方向（歐拉角），或 dir：道具的 +z 要指向哪裡。
 */
function propFit(arm: Arm, side: 1 | -1, at: V3 | null, rot: V3 | null, dir?: V3): Fit {
  const f = handFrame(arm, side)
  const inv = f.quat.clone().invert()
  const target = at ? new THREE.Vector3(...at) : f.pos
  const p = target.sub(f.pos).applyQuaternion(inv)
  const want = dir ? new THREE.Quaternion().setFromUnitVectors(AZ, new THREE.Vector3(...dir).normalize()) : new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot ?? [0, 0, 0])))
  const q = inv.multiply(want)
  return { position: [p.x, p.y, p.z], quaternion: [q.x, q.y, q.z, q.w] }
}

/** 軀幹座標的 y（原點在髖部） */
const ty = (yAbs: number) => yAbs - HIP_Y

const FITS = {
  // 攝影機在臉前面、鏡頭朝前
  camera: propFit(POSES.film.r, -1, [0.0, ty(0.955), 0.37], [0, 0, 0]),
  // 筆電平放在腿上，鍵盤在手底下
  laptop: propFit(POSES.laptop.r, -1, [0.0, ty(0.525), 0.29], [0, 0, 0]),
  // 手電筒往前、稍微朝下
  flashlight: propFit(POSES.flashlight.r, -1, null, [0.3, 0, 0]),
  // 碗口朝上
  bowl: propFit(POSES.eat.r, -1, null, [0, 0, 0]),
  // 筷子尖朝嘴巴
  chopsticks: propFit(POSES.eat.l, 1, null, null, [-0.35, 0.3, -0.9]),
}

// ---------------------------------------------------------------------------
// 幾何（共用快取）
// ---------------------------------------------------------------------------

const geoCache = new Map<string, THREE.BufferGeometry>()
function G<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key) as T | undefined
  if (!g) {
    g = make()
    geoCache.set(key, g)
  }
  return g
}
const SPHERE = () => G('sphere', () => new THREE.SphereGeometry(1, 28, 20))
const capsule = (r: number, len: number) => G(`cap${r}|${len}`, () => new THREE.CapsuleGeometry(r, len, 6, 14))
const cyl = (rt: number, rb: number, h: number, seg = 16) => G(`cyl${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg))
const cone = (r: number, h: number) => G(`cone${r}|${h}`, () => new THREE.ConeGeometry(r, h, 10))
const box = (w: number, h: number, d: number) => G(`box${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d))
/** 頭髮帽子：從頭頂往下 thetaLength */
const hairCap = (k: number, tl: number) => G(`hcap${k}|${tl}`, () => new THREE.SphereGeometry(R * k, 32, 14, 0, Math.PI * 2, 0, tl))
/** 後腦勺（只有背面半圈） */
const hairBack = (k: number, t0: number, tl: number) => G(`hback${k}|${t0}|${tl}`, () => new THREE.SphereGeometry(R * k, 24, 12, Math.PI, Math.PI, t0, tl))
const facePatch = () =>
  G('face', () => new THREE.SphereGeometry(R * 1.008, 40, 22, FACE_PATCH.phiStart, FACE_PATCH.phiLength, FACE_PATCH.thetaStart, FACE_PATCH.thetaLength))

const PROFILES: Record<string, [number, number][]> = {
  blouse: [
    [0, 0],
    [0.235, 0],
    [0.248, 0.03],
    [0.228, 0.15],
    [0.212, 0.27],
    [0.2, 0.35],
    [0.16, 0.41],
    [0.09, 0.442],
    [0, 0.445],
  ],
  belly: [
    [0, 0],
    [0.23, 0],
    [0.28, 0.08],
    [0.305, 0.18],
    [0.275, 0.3],
    [0.21, 0.38],
    [0.1, 0.44],
    [0, 0.445],
  ],
  slim: [
    [0, 0],
    [0.2, 0],
    [0.212, 0.04],
    [0.192, 0.16],
    [0.2, 0.3],
    [0.19, 0.37],
    [0.15, 0.42],
    [0.08, 0.442],
    [0, 0.445],
  ],
}
const torsoGeo = (kind: string) => G(`torso${kind}`, () => new THREE.LatheGeometry(PROFILES[kind].map(([x, y]) => new THREE.Vector2(x, y)), 28))

// ---------------------------------------------------------------------------
// 材質
// ---------------------------------------------------------------------------

function darker(hex: string, k: number) {
  return '#' + new THREE.Color(hex).multiplyScalar(k).getHexString()
}

function buildMats(spec: ChibiSpec) {
  const ghost = !!spec.ghost
  const tp = spec.top.print
  const bp = spec.bottom.print
  const topMap = tp ? printTexture(tp) : null
  const bottomMap = bp ? printTexture(bp) : null
  return {
    skin: toon(spec.skin, { ghost }),
    nose: toon(darker(spec.skin, 0.93), { ghost }),
    hair: toon(spec.hair.color, { ghost, glow: ghost ? 0.06 : 0.16 }),
    top: toon(spec.top.color, { map: topMap, ghost }),
    accent: toon(spec.top.accent ?? darker(spec.top.color, 0.85), { ghost }),
    bottom: toon(spec.bottom.color, { map: bottomMap, ghost, fade: ghost }),
    legSkin: toon(spec.skin, { ghost, fade: ghost }),
    feet: toon(spec.feet.color),
    white: toon('#f4f1ea', { ghost }),
    gold: toon('#e0b04a', { ghost, glow: 0.35 }),
    jade: toon('#3fae7a', { ghost, glow: 0.3 }),
    red: toon('#e0453a', { ghost, glow: 0.3 }),
    dark: toon('#1c1a1c', { ghost }),
    visor: toon(spec.extras?.visor ?? '#5fd0a0', { side: THREE.DoubleSide }),
    amber: toon('#8a5a2a', { glow: 0.3 }),
    wood: toon('#b89a5a'),
    screen: SCREEN,
    lens: toon('#233246', { glow: 0.25 }),
    silver: toon('#b9bdc6'),
    metal: toon('#34373e'),
    rice: toon('#f7f3ea'),
    blueBand: toon('#4a78c8'),
    rec: REC,
    beam: BEAM,
    cap: toon(spec.extras?.cap ?? '#d8443a', { side: THREE.DoubleSide }),
    bandana: toon(spec.extras?.bandana ?? '#2f8f7a'),
    tie: toon(spec.extras?.tie ?? '#24365f'),
    innerTop: toon(spec.extras?.innerTop ?? '#a9c8e8'),
    logo: toon(spec.extras?.logo ?? '#e0453a', { glow: 0.3 }),
    hairTie: toon(spec.extras?.hairTie ?? '#e07a8a'),
    glasses: toon(spec.extras?.glassesColor ?? '#1c1a1c'),
    apron: toon(spec.extras?.apron ?? '#3f6aa6', { ghost }),
    sleeveCover: toon(spec.extras?.sleeveCovers ?? '#7fa6d8', { ghost }),
    straw: toon(spec.extras?.strawHat ?? '#e8c872', { ghost, side: THREE.DoubleSide, glow: 0.24 }),
    strawBand: toon('#b8452a', { ghost, side: THREE.DoubleSide }),
    towel: toon(spec.extras?.neckTowel ?? '#f4f1ea', { ghost }),
    towelStripe: toon('#4a82d0', { ghost }),
    bracelet: toon(spec.extras?.bracelet ?? '#3fae7a', { ghost, glow: 0.35 }),
    readLens: toon('#cfe6f2', { ghost, glow: 0.45 }),
  }
}

const SCREEN = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.75, 1.2), toneMapped: false })
const REC = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.15, 0.12), toneMapped: false })
const BEAM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.3, 1.7), toneMapped: false })

function printTexture(p: Print) {
  if (p.kind === 'stripe') return stripePrint(p.base, p.petals[0] ?? '#ffffff', p.repeat ?? 5)
  if (p.kind === 'plaid') return plaidPrint(p.base, p.petals, p.repeat ?? 3)
  return floralPrint(p.base, p.petals, p.center, p.seed, p.repeat)
}
type Mats = ReturnType<typeof buildMats>

const faceMats = new Map<string, THREE.MeshToonMaterial>()
function faceMat(spec: ChibiSpec, expr: string) {
  const key = `${spec.id}|${expr}`
  let m = faceMats.get(key)
  if (!m) {
    const f = spec.faces[expr] ?? Object.values(spec.faces)[0]
    const tex = faceTexture(f)
    m = new THREE.MeshToonMaterial({
      map: tex,
      gradientMap: toonGradient(),
      emissiveMap: tex,
      emissive: new THREE.Color(0.22, 0.22, 0.22),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      opacity: spec.ghost ? 0.95 : 1,
    })
    faceMats.set(key, m)
  }
  return m
}

// ---------------------------------------------------------------------------
// 零件：網格 + 選配的描邊
// ---------------------------------------------------------------------------

const Ctx = createContext({ outline: true, shadow: true, thick: 0.011 })

type V3 = [number, number, number]
function P({ g, m, o = false, position, rotation, scale }: { g: THREE.BufferGeometry; m: THREE.Material; o?: boolean; position?: V3; rotation?: V3; scale?: number | V3 }) {
  const c = useContext(Ctx)
  // 描邊厚度是物件空間的，要除以縮放，世界裡的線才會一樣粗
  const s = scale === undefined ? 1 : typeof scale === 'number' ? scale : (scale[0] + scale[1] + scale[2]) / 3
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={g} material={m} castShadow={c.shadow} />
      {o && c.outline && <mesh geometry={g} material={outlineMat(c.thick / s)} />}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 角色
// ---------------------------------------------------------------------------

export interface ChibiProps {
  spec: ChibiSpec
  drive: MutableRefObject<Drive>
  outline?: boolean
  shadow?: boolean
  /** 坐在床上時不畫腿 */
  legs?: boolean
  /** 只畫頭（睡著躺在枕頭上） */
  headOnly?: boolean
}

export function Chibi({ spec, drive, outline = true, shadow = true, legs = true, headOnly = false }: ChibiProps) {
  const mats = useMemo(() => buildMats(spec), [spec])
  const ctx = useMemo(() => ({ outline, shadow: shadow && !spec.ghost, thick: 0.011 }), [outline, shadow, spec.ghost])
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const torso = useRef<THREE.Group>(null)
  const torsoMesh = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const face = useRef<THREE.Mesh>(null)
  const arms = useRef<{ z: THREE.Group | null; x: THREE.Group | null; e: THREE.Group | null }[]>([
    { z: null, x: null, e: null },
    { z: null, x: null, e: null },
  ])
  const legRefs = useRef<(THREE.Group | null)[]>([null, null])
  const props = useRef<Record<string, THREE.Group | null>>({})
  const cur = useRef({ l: [0, 0, 0] as Arm, r: [0, 0, 0] as Arm, lean: 0, head: 0, phase: 0, legs: [0, 0], twist: 0 })
  const turn = useRef<TurnState>({ heading: drive.current.heading, dir: 1 })

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const d = drive.current
    const c = cur.current
    const t = clock.elapsedTime
    const p = POSES[d.pose] ?? POSES.idle
    const a = THREE.MathUtils.clamp(d.speed / 2.5, 0, 1)
    if (a > 0.04) c.phase += dt * (4 + 7 * a)

    const L: Arm = [...p.l]
    const Rr: Arm = [...p.r]
    let lean = p.lean
    let headX = p.head
    let twist = 0
    if (d.pose === 'sweep') {
      const w = Math.sin(t * 3.2)
      twist = w * 0.3
      L[0] += w * 0.22
      Rr[0] -= w * 0.18
    } else if (d.pose === 'drink') {
      const cyc = (t % 5.5) / 5.5
      const k = THREE.MathUtils.smoothstep(cyc, 0.55, 0.68) * (1 - THREE.MathUtils.smoothstep(cyc, 0.86, 0.97))
      for (let i = 0; i < 3; i++) Rr[i] = THREE.MathUtils.lerp(p.r[i], DRINK_UP[i], k)
      headX -= 0.38 * k
      twist = Math.sin(t * 0.9) * 0.08 // 醉醺醺地晃
    } else if (d.pose === 'fan') {
      Rr[2] += Math.sin(t * 9) * 0.3
    } else if (d.pose === 'scared') {
      L[0] += (Math.random() - 0.5) * 0.08
      Rr[0] += (Math.random() - 0.5) * 0.08
    } else if (d.pose === 'wave') {
      // 手臂舉高，在身體側面左右揮
      Rr[1] += Math.sin(t * 9) * 0.28
    } else if (d.pose === 'eat') {
      // 左手（筷子）在碗邊和嘴邊之間來回
      const k = 0.5 + 0.5 * Math.sin(t * 3.2)
      for (let i = 0; i < 3; i++) L[i] = THREE.MathUtils.lerp(EAT_LOW[i], p.l[i], k)
      headX -= 0.08 * k
    }
    if (spec.ghost) {
      // 飄：手往後拖、身體前傾；快飄（比走路快）時更往前衝、手拖得更後面
      const run = THREE.MathUtils.clamp((d.speed - 2.7) / 1.4, 0, 1)
      L[0] += 0.4 * a + 0.45 * run
      Rr[0] += 0.4 * a + 0.45 * run
      L[1] -= 0.15 * run
      Rr[1] -= 0.15 * run
      lean += 0.22 * a + 0.2 * run
    } else {
      L[0] += Math.sin(c.phase) * 0.6 * a * (p.swingL ?? 1)
      Rr[0] -= Math.sin(c.phase) * 0.6 * a * (p.swingR ?? 1)
    }

    const k = 1 - Math.exp(-12 * dt)
    for (let i = 0; i < 3; i++) {
      c.l[i] += (L[i] - c.l[i]) * k
      c.r[i] += (Rr[i] - c.r[i]) * k
    }
    c.lean += (lean - c.lean) * k
    c.head += (headX - c.head) * k
    c.twist += (twist - c.twist) * k

    // 腿：走路前後擺；鬼的腳往後拖、輕輕晃
    const legTarget = spec.ghost
      ? [0.35 * a + Math.sin(t * 2.3) * 0.1, 0.35 * a + Math.sin(t * 2.3 + 1.2) * 0.1]
      : [Math.sin(c.phase) * 0.6 * a, -Math.sin(c.phase) * 0.6 * a]
    for (let i = 0; i < 2; i++) {
      c.legs[i] += (legTarget[i] - c.legs[i]) * k
      const lg = legRefs.current[i]
      if (lg) lg.rotation.x = c.legs[i]
    }

    // 轉向：接近 180° 時維持同一個轉向，而且有速度上限（見 world/motion.ts）
    turnToward(turn.current, d.heading, dt)
    if (root.current) {
      root.current.rotation.y = headOnly ? 0 : turn.current.heading
      root.current.position.y = d.hop
    }
    if (body.current) body.current.position.y = spec.ghost ? 0 : Math.abs(Math.sin(c.phase)) * 0.035 * a
    if (torso.current) {
      torso.current.rotation.x = c.lean
      torso.current.rotation.y = c.twist
    }
    if (torsoMesh.current) torsoMesh.current.scale.y = 1 + Math.sin(t * 2.1) * 0.012
    if (head.current && !headOnly) {
      head.current.rotation.x = c.head + Math.sin(t * 1.3) * 0.025
      head.current.rotation.y = -c.twist * 0.5
    }
    arms.current.forEach((arm, i) => {
      const side = i === 0 ? 1 : -1
      const v = i === 0 ? c.l : c.r
      if (arm.z) arm.z.rotation.z = side * v[1]
      if (arm.x) arm.x.rotation.x = v[0]
      if (arm.e) arm.e.rotation.x = v[2]
    })
    for (const [name, g] of Object.entries(props.current)) if (g) g.visible = p.prop === name || p.propL === name
    if (face.current) {
      const want = faceMat(spec, spec.faces[d.expr] ? d.expr : Object.keys(spec.faces)[0])
      if (face.current.material !== want) face.current.material = want
    }
  })

  const headNode = <Head spec={spec} mats={mats} faceRef={face} />

  const hs = spec.headScale ?? 1
  if (headOnly) {
    return (
      <Ctx.Provider value={ctx}>
        <group ref={root} scale={spec.scale * hs}>
          {headNode}
        </group>
      </Ctx.Provider>
    )
  }

  const sleeveUpper = spec.top.sleeve === 'none' ? mats.skin : mats.top
  const sleeveFore = spec.top.sleeve === 'long' ? mats.top : mats.skin
  const torsoKind = spec.belly ? 'belly' : spec.top.kind === 'blouse' ? 'blouse' : 'slim'

  return (
    <Ctx.Provider value={ctx}>
      <group ref={root} scale={spec.scale}>
        <group ref={body}>
          {legs &&
            [1, -1].map((side, i) => (
              <group
                key={side}
                ref={(el) => {
                  legRefs.current[i] = el
                }}
                position={[side * HIP_X, HIP_Y, 0]}
              >
                <Leg spec={spec} mats={mats} />
              </group>
            ))}
          {legs && spec.bottom.kind === 'skirt' && <P g={skirtGeo()} m={mats.bottom} o={!spec.ghost} scale={[1, 1, 0.82]} />}
          <group ref={torso} position={[0, HIP_Y, 0]}>
            <group ref={torsoMesh} position={[0, TORSO_Y - HIP_Y, 0]}>
              <P g={torsoGeo(torsoKind)} m={mats.top} o scale={[1, 1, 0.82]} />
              {!legs && <P g={SPHERE()} m={mats.top} position={[0, 0.02, 0]} scale={[0.22, 0.06, 0.18]} />}
            </group>
            <TorsoExtras spec={spec} mats={mats} />
            {[1, -1].map((side, i) => (
              <group
                key={side}
                ref={(el) => {
                  arms.current[i].z = el
                }}
                position={[side * SHOULDER_X, SHOULDER_Y - HIP_Y, 0]}
              >
                <group
                  ref={(el) => {
                    arms.current[i].x = el
                  }}
                >
                  <P g={SPHERE()} m={sleeveUpper} scale={spec.top.sleeve === 'short' ? 0.075 : 0.064} />
                  <P g={capsule(spec.top.sleeve === 'short' ? 0.07 : 0.06, UPPER - 0.1)} m={sleeveUpper} o position={[0, -UPPER / 2, 0]} />
                  <group
                    ref={(el) => {
                      arms.current[i].e = el
                    }}
                    position={[0, -UPPER, 0]}
                  >
                    <P g={capsule(0.053, FORE - 0.1)} m={sleeveFore} o position={[0, -FORE / 2, 0]} />
                    {spec.extras?.sleeveCovers && <SleeveCover mats={mats} />}
                    <group position={[0, -FORE - 0.03, 0]}>
                      {i === 0 && spec.extras?.bracelet && (
                        <P g={G('bracelet', () => new THREE.TorusGeometry(0.05, 0.012, 8, 22))} m={mats.bracelet} position={[0, 0.045, 0]} rotation={[Math.PI / 2, 0, 0]} />
                      )}
                      <P g={SPHERE()} m={mats.skin} o scale={[0.046, 0.056, 0.036]} />
                      <P g={SPHERE()} m={mats.skin} o position={[-side * 0.034, 0.014, 0.022]} scale={0.02} />
                      {i === 1 && (
                        <HandProps
                          mats={mats}
                          refs={(name, el) => {
                            props.current[name] = el
                          }}
                        />
                      )}
                      {i === 0 && (
                        <LeftHandProps
                          mats={mats}
                          refs={(name, el) => {
                            props.current[name] = el
                          }}
                        />
                      )}
                    </group>
                  </group>
                </group>
              </group>
            ))}
            <group ref={head} position={[0, NECK_Y - HIP_Y, 0]}>
              <P g={cyl(0.062, 0.07, 0.08)} m={mats.skin} position={[0, 0, 0]} />
              <group position={[0, HEAD_C * hs, 0]} scale={hs}>
                {headNode}
              </group>
            </group>
          </group>
        </group>
      </group>
    </Ctx.Provider>
  )
}

function Leg({ spec, mats }: { spec: ChibiSpec; mats: Mats }) {
  const kind = spec.bottom.kind
  return (
    <group>
      {kind === 'wide' && <P g={cyl(0.1, 0.118, LEG - 0.02)} m={mats.bottom} o={!spec.ghost} position={[0, -(LEG - 0.02) / 2, 0]} />}
      {/* 長裙：腿藏在裙子裡，只露小腿（鬼連小腿都沒有） */}
      {kind === 'skirt' && !spec.ghost && <P g={capsule(0.05, 0.08)} m={mats.legSkin} o position={[0, -LEG + 0.1, 0]} />}
      {kind === 'pants' && <P g={capsule(0.078, LEG - 0.17)} m={mats.bottom} o={!spec.ghost} position={[0, -LEG / 2 + 0.01, 0]} />}
      {kind === 'shorts' && (
        <>
          <P g={cyl(0.098, 0.098, 0.17)} m={mats.bottom} o={!spec.ghost} position={[0, -0.07, 0]} />
          <P g={capsule(0.062, 0.2)} m={mats.legSkin} o={!spec.ghost} position={[0, -0.27, 0]} />
        </>
      )}
      {spec.feet.kind === 'slipper' && (
        <>
          <P g={box(0.12, 0.035, 0.21)} m={mats.feet} position={[0, -LEG + 0.02, 0.035]} />
          <P g={box(0.11, 0.02, 0.05)} m={mats.white} position={[0, -LEG + 0.055, 0.06]} />
        </>
      )}
      {spec.feet.kind === 'shoe' && <P g={capsule(0.06, 0.1)} m={mats.feet} o position={[0, -LEG + 0.05, 0.04]} rotation={[Math.PI / 2, 0, 0]} />}
    </group>
  )
}

function TorsoExtras({ spec, mats }: { spec: ChibiSpec; mats: Mats }) {
  const e = spec.extras ?? {}
  const base = TORSO_Y - HIP_Y
  const neck = NECK_Y - HIP_Y
  return (
    <group>
      {e.collar && <P g={cyl(0.088, 0.098, 0.06, 20)} m={mats.accent} o position={[0, neck + 0.01, 0]} />}
      {e.knots &&
        (spec.top.kind === 'jacket'
          ? [0.38, 0.3, 0.22, 0.14].map((y) => <P key={y} g={SPHERE()} m={toon(e.knots!)} scale={0.016} position={[0, base + y, 0.172]} />)
          : [
              [0.06, 0.4, 0.15],
              [0.11, 0.33, 0.15],
              [0.15, 0.24, 0.14],
              [0.16, 0.13, 0.15],
            ].map(([x, y, z]) => <P key={y} g={SPHERE()} m={toon(e.knots!)} scale={0.016} position={[x, base + y, z + 0.02]} />))}
      {e.hood && (
        <>
          <P g={G('hood', () => new THREE.TorusGeometry(0.12, 0.05, 10, 22))} m={mats.top} o position={[0, neck - 0.02, -0.1]} rotation={[Math.PI / 2 - 0.35, 0, 0]} />
          {[-1, 1].map((s) => (
            <P key={s} g={cyl(0.007, 0.007, 0.13, 6)} m={mats.white} position={[s * 0.045, neck - 0.1, 0.165]} />
          ))}
        </>
      )}
      {e.shirtCollar &&
        [-1, 1].map((sd) => (
          <P key={`col${sd}`} g={box(0.075, 0.014, 0.055)} m={mats.top} o position={[sd * 0.045, neck - 0.012, 0.105]} rotation={[0.55, sd * 0.55, sd * 0.45]} />
        ))}
      {e.tie && (
        <group>
          <P g={box(0.05, 0.045, 0.03)} m={mats.tie} o position={[0.012, neck - 0.07, 0.158]} rotation={[0.2, 0, 0.14]} />
          <P g={box(0.055, 0.2, 0.012)} m={mats.tie} o position={[0.024, neck - 0.2, 0.174]} rotation={[0.08, 0, 0.1]} />
        </group>
      )}
      {e.innerTop && (
        <group>
          <P g={box(0.1, 0.34, 0.012)} m={mats.innerTop} position={[0, base + 0.22, 0.168]} />
          {[-1, 1].map((sd) => (
            <P key={`cd${sd}`} g={box(0.022, 0.35, 0.016)} m={mats.accent} position={[sd * 0.06, base + 0.22, 0.17]} />
          ))}
        </group>
      )}
      {e.logo && <P g={cyl(0.03, 0.03, 0.006, 18)} m={mats.logo} position={[0.08, base + 0.3, 0.166]} rotation={[Math.PI / 2 - 0.12, 0, 0]} />}
      {e.apron && <Apron mats={mats} />}
      {e.readingGlasses && <ReadingGlasses mats={mats} />}
      {e.neckTowel && <NeckTowel mats={mats} />}
      {e.towel && (
        <group position={[SHOULDER_X - 0.04, SHOULDER_Y - HIP_Y, 0]}>
          <P g={box(0.13, 0.02, 0.2)} m={mats.white} position={[0, 0.055, 0]} />
          <P g={box(0.13, 0.26, 0.02)} m={mats.white} position={[0.01, -0.07, 0.14]} rotation={[0.15, 0, 0]} />
          <P g={box(0.13, 0.22, 0.02)} m={mats.white} position={[0.01, -0.05, -0.13]} rotation={[-0.15, 0, 0]} />
        </group>
      )}
    </group>
  )
}

/** 頭：頭（球）、臉、耳朵、鼻子、頭髮、配件。原點在頭的中心。 */
function Head({ spec, mats, faceRef }: { spec: ChibiSpec; mats: Mats; faceRef: MutableRefObject<THREE.Mesh | null> }) {
  const e = spec.extras ?? {}
  const first = Object.keys(spec.faces)[0]
  const c = useContext(Ctx)
  return (
    <group>
      <group scale={[1.03, 0.97, 0.98]}>
        <mesh geometry={SPHERE()} material={mats.skin} scale={R} castShadow={c.shadow} />
        {c.outline && <mesh geometry={SPHERE()} material={outlineMat(c.thick / R)} scale={R} />}
        <mesh ref={faceRef} geometry={facePatch()} material={faceMat(spec, first)} renderOrder={1} />
      </group>
      {[1, -1].map((s) => (
        <P key={s} g={SPHERE()} m={mats.skin} o position={[s * R * 0.99, -0.14 * R, 0]} scale={[0.035, 0.056, 0.045]} />
      ))}
      <P g={SPHERE()} m={e.redNose ? mats.red : mats.nose} position={[0, -0.34 * R, 0.955 * R]} scale={e.redNose ? 0.046 : 0.028} />
      {e.earrings &&
        [1, -1].map((s) => <P key={s} g={SPHERE()} m={mats.gold} position={[s * R * 1.0, -0.33 * R, 0.02]} scale={0.02} />)}
      {e.glasses && <Glasses mats={mats} thin={e.glasses === 'thin'} />}
      <Hair spec={spec} mats={mats} />
      {e.cap && <Cap mats={mats} />}
      {e.strawHat && <StrawHat mats={mats} />}
      {e.bandana && <Bandana mats={mats} />}
    </group>
  )
}

function Glasses({ mats, thin = false }: { mats: Mats; thin?: boolean }) {
  const rim = thin ? G('rimThin', () => new THREE.TorusGeometry(0.052, 0.0055, 6, 22)) : G('rim', () => new THREE.TorusGeometry(0.058, 0.009, 6, 20))
  const m = thin ? mats.glasses : mats.dark
  const ex = 0.35 * R
  const ey = -0.19 * R
  const ez = 0.99 * R
  return (
    <group>
      {[1, -1].map((s) => (
        <P key={s} g={rim} m={m} position={[s * ex, ey, ez]} rotation={[0, s * 0.3, 0]} />
      ))}
      <P g={cyl(thin ? 0.004 : 0.007, thin ? 0.004 : 0.007, 0.06, 6)} m={m} position={[0, ey + 0.01, ez + 0.02]} rotation={[0, 0, Math.PI / 2]} />
    </group>
  )
}

/** 反戴的棒球帽：帽頂蓋在頭上、帽簷在後腦勺 */
function Cap({ mats }: { mats: Mats }) {
  return (
    <group>
      <P g={hairCap(1.13, 0.36 * Math.PI)} m={mats.cap} o rotation={[0.12, 0, 0]} />
      <P g={G('capbrim', () => new THREE.CircleGeometry(0.17, 18, 0, Math.PI))} m={mats.cap} position={[0, R * 0.33, -R * 1.0]} rotation={[-Math.PI / 2 - 0.2, 0, 0]} />
      <P g={SPHERE()} m={mats.cap} position={[0, R * 1.12, -R * 0.12]} scale={0.024} />
      {/* 反戴時前面看得到的調整帶開口 */}
      <P g={G('capstrap', () => new THREE.TorusGeometry(0.05, 0.012, 6, 14, Math.PI))} m={mats.cap} position={onHead(1.12, 0.35 * Math.PI, 0)} rotation={[0.25, 0, 0]} />
    </group>
  )
}

/** 綁在額頭的頭巾，結打在後腦 */
function Bandana({ mats }: { mats: Mats }) {
  return (
    <group>
      <group position={[0, R * 0.4, 0]} rotation={[-0.15, 0, 0]}>
        <P g={G('band', () => new THREE.TorusGeometry(R * 0.96, 0.034, 8, 36))} m={mats.bandana} o rotation={[Math.PI / 2, 0, 0]} />
      </group>
      <group position={[0, R * 0.28, -R * 0.96]}>
        <P g={SPHERE()} m={mats.bandana} o scale={[0.045, 0.04, 0.035]} />
        {[-1, 1].map((s) => (
          <P key={s} g={box(0.045, 0.15, 0.012)} m={mats.bandana} o position={[s * 0.035, -0.08, -0.02]} rotation={[0.25, 0, s * 0.35]} />
        ))}
      </group>
    </group>
  )
}

/** 把一個點放在頭的球面上：theta 從頭頂量、phi 從正前方往右量 */
function onHead(k: number, theta: number, phi: number): V3 {
  return [R * k * Math.sin(theta) * Math.sin(phi), R * k * Math.cos(theta), R * k * Math.sin(theta) * Math.cos(phi)]
}
function normalRot(theta: number, phi: number, tiltDown = 0): V3 {
  const n = new THREE.Vector3(...onHead(1, theta + tiltDown, phi)).normalize()
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n)
  const eu = new THREE.Euler().setFromQuaternion(q)
  return [eu.x, eu.y, eu.z]
}

function Hair({ spec, mats }: { spec: ChibiSpec; mats: Mats }) {
  const h = mats.hair
  switch (spec.hair.style) {
    case 'bun':
      return (
        <group>
          <P g={hairCap(1.06, 0.56 * Math.PI)} m={h} o rotation={[-0.4, 0, 0]} />
          <P g={hairBack(1.045, 0.3 * Math.PI, 0.42 * Math.PI)} m={h} />
          <P g={SPHERE()} m={h} o position={[0, R * 0.78, -R * 0.6]} scale={0.115} />
          {/* 玉簪 */}
          <group position={[0, R * 0.8, -R * 0.6]} rotation={[0.2, 0, 1.2]}>
            <P g={cyl(0.012, 0.012, 0.36, 8)} m={mats.jade} />
            <P g={SPHERE()} m={mats.jade} position={[0, 0.19, 0]} scale={0.028} />
            <P g={SPHERE()} m={mats.gold} position={[0, -0.18, 0]} scale={0.016} />
          </group>
        </group>
      )
    case 'long':
      return (
        <group>
          <P g={hairCap(1.075, 0.5 * Math.PI)} m={h} o rotation={[-0.22, 0, 0]} />
          <P g={G('longback', () => new THREE.SphereGeometry(R * 1.1, 28, 14, Math.PI * 1.02, Math.PI * 0.96, 0.25 * Math.PI, 0.62 * Math.PI))} m={h} o position={[0, -0.06, 0]} scale={[1, 1.25, 1]} />
          {[1, -1].map((s) => (
            <P key={s} g={capsule(0.05, 0.2)} m={h} o position={[s * R * 0.9, -R * 0.55, R * 0.22]} rotation={[0.1, 0, s * 0.08]} />
          ))}
          <P g={G('bangs', () => new THREE.SphereGeometry(R * 1.085, 28, 6, Math.PI / 2 - 1.05, 2.1, 0.18 * Math.PI, 0.16 * Math.PI))} m={h} o />
        </group>
      )
    case 'short':
      return (
        <group>
          <P g={hairCap(1.07, 0.47 * Math.PI)} m={h} o rotation={[-0.15, 0, 0]} />
          <P g={hairBack(1.05, 0.3 * Math.PI, 0.35 * Math.PI)} m={h} />
          {[
            [0.08, 0],
            [0.22, 1.2],
            [0.22, -1.2],
            [0.28, 2.6],
            [0.28, -2.6],
            [0.33, Math.PI],
          ].map(([th, ph], i) => (
            <P key={i} g={cone(0.07, 0.17)} m={h} o position={onHead(1.0, th * Math.PI, ph)} rotation={normalRot(th * Math.PI, ph)} />
          ))}
          {[-0.35, 0, 0.35].map((ph, i) => (
            <P key={`f${i}`} g={cone(0.05, 0.12)} m={h} position={onHead(1.04, 0.3 * Math.PI, ph)} rotation={normalRot(0.3 * Math.PI, ph, 0.9)} />
          ))}
        </group>
      )
    case 'bald':
      return (
        <group>
          {[1, -1].map((s) => (
            <P key={s} g={SPHERE()} m={h} o position={[s * R * 0.9, -0.08 * R, -0.22 * R]} scale={[0.3 * R, 0.42 * R, 0.55 * R]} />
          ))}
          <P g={SPHERE()} m={h} o position={[0, -0.12 * R, -0.84 * R]} scale={[0.72 * R, 0.34 * R, 0.32 * R]} />
        </group>
      )
    case 'crew':
      return (
        <group>
          <P g={hairCap(1.035, 0.44 * Math.PI)} m={h} o rotation={[-0.2, 0, 0]} />
          <P g={hairBack(1.03, 0.3 * Math.PI, 0.35 * Math.PI)} m={h} />
        </group>
      )
    case 'messy':
      // 亂翹的染髮（通常戴著帽子）：瀏海往下翹、兩側往外翹
      return (
        <group>
          <P g={hairCap(1.07, 0.5 * Math.PI)} m={h} o rotation={[-0.18, 0, 0]} />
          <P g={hairBack(1.05, 0.3 * Math.PI, 0.38 * Math.PI)} m={h} />
          {[-0.55, -0.2, 0.15, 0.5].map((ph, i) => (
            <P key={i} g={cone(0.055, 0.14)} m={h} o position={onHead(1.04, 0.31 * Math.PI, ph)} rotation={normalRot(0.31 * Math.PI, ph, 1.0 + (i % 2) * 0.3)} />
          ))}
          {[-1, 1].map((sd) => (
            <P key={`s${sd}`} g={cone(0.06, 0.15)} m={h} o position={onHead(1.03, 0.42 * Math.PI, sd * 1.35)} rotation={normalRot(0.42 * Math.PI, sd * 1.35, 0.5)} />
          ))}
        </group>
      )
    case 'sidepart':
      // 上班族旁分：一邊梳得鼓起來
      return (
        <group>
          <P g={hairCap(1.06, 0.45 * Math.PI)} m={h} o rotation={[-0.12, 0, 0]} />
          <P g={hairBack(1.045, 0.3 * Math.PI, 0.36 * Math.PI)} m={h} />
          <P g={SPHERE()} m={h} o position={onHead(0.98, 0.22 * Math.PI, -0.45)} scale={[0.15, 0.075, 0.12]} rotation={[0.35, -0.45, 0.25]} />
          <P g={SPHERE()} m={h} o position={onHead(0.97, 0.3 * Math.PI, 0.55)} scale={[0.12, 0.06, 0.1]} rotation={[0.5, 0.55, -0.2]} />
        </group>
      )
    case 'bowl':
      // 小孩的西瓜皮：一圈剪齊，瀏海在眉毛上面
      return (
        <group>
          <P g={hairCap(1.09, 0.47 * Math.PI)} m={h} o />
          <P g={hairBack(1.07, 0.3 * Math.PI, 0.42 * Math.PI)} m={h} />
        </group>
      )
    case 'ponytail':
      // 低馬尾＋側分瀏海
      return (
        <group>
          <P g={hairCap(1.07, 0.52 * Math.PI)} m={h} o rotation={[-0.3, 0, 0]} />
          <P g={hairBack(1.055, 0.3 * Math.PI, 0.45 * Math.PI)} m={h} />
          <P g={G('sidebangs', () => new THREE.SphereGeometry(R * 1.08, 24, 6, Math.PI / 2 - 1.15, 1.55, 0.19 * Math.PI, 0.15 * Math.PI))} m={h} o />
          <group position={[0, -R * 0.2, -R * 0.98]} rotation={[0.5, 0, 0]}>
            <P g={SPHERE()} m={mats.hairTie} scale={0.036} />
            <P g={capsule(0.056, 0.22)} m={h} o position={[0, -0.15, -0.03]} rotation={[0.15, 0, 0]} />
          </group>
        </group>
      )
    case 'lowbun':
      // 中分往後梳、低低的髮髻在後頸，插一支金簪、垂一串紅穗（紅姨）
      return (
        <group>
          <P g={hairCap(1.065, 0.5 * Math.PI)} m={h} o rotation={[-0.32, 0, 0]} />
          <P g={hairBack(1.05, 0.3 * Math.PI, 0.46 * Math.PI)} m={h} />
          {[-1, 1].map((sd) => (
            <P key={sd} g={SPHERE()} m={h} o position={onHead(1.0, 0.36 * Math.PI, sd * 0.62)} scale={[0.075, 0.06, 0.05]} rotation={[0, sd * 0.62, sd * 0.5]} />
          ))}
          <group position={[0, -R * 0.3, -R * 0.98]}>
            <P g={SPHERE()} m={h} o scale={[0.125, 0.1, 0.095]} />
            <group position={[0, 0.02, -0.04]} rotation={[0.1, 0, 1.15]}>
              <P g={cyl(0.009, 0.009, 0.3, 8)} m={mats.gold} />
              <P g={SPHERE()} m={mats.gold} position={[0, 0.16, 0]} scale={0.024} />
            </group>
            <group position={[0.13, -0.05, -0.05]}>
              <P g={SPHERE()} m={mats.red} scale={0.018} />
              <P g={cone(0.022, 0.1)} m={mats.red} position={[0, -0.06, 0]} rotation={[Math.PI, 0, 0]} />
            </group>
          </group>
        </group>
      )
    case 'perm': {
      const curls: V3[] = []
      for (let i = 0; i < 26; i++) {
        const th = (0.05 + (i % 5) * 0.11) * Math.PI
        const ph = (i / 26) * Math.PI * 2 * 3.1
        const front = Math.abs(Math.atan2(Math.sin(ph), Math.cos(ph))) < 0.75
        if (front && th > 0.3 * Math.PI) continue
        curls.push(onHead(0.98, th, ph))
      }
      return (
        <group>
          <P g={hairCap(1.0, 0.45 * Math.PI)} m={h} rotation={[-0.2, 0, 0]} />
          {curls.map((p, i) => (
            <P key={i} g={SPHERE()} m={h} o position={p} scale={0.085} />
          ))}
          {spec.extras?.visor && (
            <group position={[0, R * 0.36, 0]}>
              <P g={G('visorband', () => new THREE.TorusGeometry(R * 0.96, 0.022, 8, 24, Math.PI))} m={mats.visor} rotation={[Math.PI / 2, 0, 0]} />
              <P g={G('visorbrim', () => new THREE.CircleGeometry(0.17, 18, 0, Math.PI))} m={mats.visor} position={[0, -0.02, R * 0.9]} rotation={[Math.PI / 2 - 0.25, 0, 0]} />
            </group>
          )}
        </group>
      )
    }
  }
}

// ---------------------------------------------------------------------------
// 更多配件（DESIGN §25 的 NPC）
// ---------------------------------------------------------------------------

/** 兩點之間的一段細棍子（鍊子、背帶） */
function Seg({ a, b, r, m }: { a: V3; b: V3; r: number; m: THREE.Material }) {
  const va = new THREE.Vector3(...a)
  const vb = new THREE.Vector3(...b)
  const dir = vb.clone().sub(va)
  const len = Math.round(dir.length() * 1000) / 1000
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
  const mid = va.add(vb).multiplyScalar(0.5)
  return <mesh geometry={cyl(r, r, len, 5)} material={m} position={[mid.x, mid.y, mid.z]} quaternion={q} />
}

/**
 * 長裙（旗袍下襬）：從腰到小腿，下面稍微收。
 * 鬼的裙子用漸淡貼圖（上面 35% 不透明）：v 壓到 0.3–1，下襬才不會整段消失，只淡到一半左右
 */
const skirtGeo = () =>
  G('skirt', () => {
    const g = new THREE.LatheGeometry(
      [
        [0.188, 0.08],
        [0.2, 0.2],
        [0.216, 0.32],
        [0.232, 0.4],
        [0.238, 0.44],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
      28,
    )
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setY(i, 0.3 + uv.getY(i) * 0.7)
    return g
  })

/** 圍裙：胸前一片、腰下一片（貼著軀幹的弧面）、腰帶、背帶、白口袋。在軀幹座標（原點在髖部） */
function Apron({ mats }: { mats: Mats }) {
  const bib = G('apronBib', () =>
    new THREE.LatheGeometry(
      [
        [0.258, -0.02],
        [0.241, 0.11],
        [0.225, 0.23],
        [0.213, 0.31],
        [0.203, 0.335],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
      12,
      -0.58,
      1.16,
    ),
  )
  const skirt = G('apronSkirt', () =>
    new THREE.LatheGeometry(
      [
        [0.272, -0.3],
        [0.264, -0.16],
        [0.258, -0.02],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
      16,
      -0.95,
      1.9,
    ),
  )
  const corner = (sd: number): V3 => [sd * 0.203 * Math.sin(0.55), 0.33, 0.203 * Math.cos(0.55) * 0.82]
  return (
    <group>
      <group scale={[1, 1, 0.82]}>
        <P g={bib} m={mats.apron} o />
        <P g={skirt} m={mats.apron} o />
        <P g={G('apronBelt', () => new THREE.TorusGeometry(0.258, 0.013, 6, 36))} m={mats.apron} position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]} />
      </group>
      {/* 背帶：從胸前兩角繞到後頸 */}
      {[-1, 1].map((sd) => (
        <Seg key={sd} a={corner(sd)} b={[sd * 0.085, 0.405, -0.01]} r={0.011} m={mats.apron} />
      ))}
      <P g={G('apronStrap', () => new THREE.TorusGeometry(0.085, 0.011, 6, 14, Math.PI))} m={mats.apron} position={[0, 0.405, -0.01]} rotation={[-Math.PI / 2, 0, 0]} />
      {/* 口袋 */}
      <P g={box(0.15, 0.075, 0.012)} m={mats.white} o position={[0, -0.14, 0.262 * 0.82 + 0.004]} />
      <P g={box(0.004, 0.07, 0.014)} m={mats.apron} position={[0, -0.14, 0.262 * 0.82 + 0.006]} />
    </group>
  )
}

/** 袖套：套在前臂上，兩端是鬆緊帶（在手肘座標） */
function SleeveCover({ mats }: { mats: Mats }) {
  const band = G('coverBand', () => new THREE.TorusGeometry(0.058, 0.012, 6, 18))
  return (
    <group>
      <P g={capsule(0.062, FORE - 0.11)} m={mats.sleeveCover} o position={[0, -FORE / 2 + 0.005, 0]} />
      <P g={band} m={mats.sleeveCover} position={[0, -0.03, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <P g={band} m={mats.sleeveCover} position={[0, -FORE + 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  )
}

/** 老花眼鏡用鍊子掛在胸前（軀幹座標） */
function ReadingGlasses({ mats }: { mats: Mats }) {
  const y = 0.29
  const z = 0.196
  return (
    <group>
      {[-1, 1].map((sd) => (
        <Seg key={sd} a={[sd * 0.068, 0.39, 0.055]} b={[sd * 0.066, y + 0.01, z - 0.006]} r={0.0035} m={mats.gold} />
      ))}
      <group position={[0, y, z]} rotation={[-0.3, 0, 0]}>
        {[-1, 1].map((sd) => (
          <group key={sd} position={[sd * 0.034, 0, 0]}>
            <P g={G('rgRim', () => new THREE.TorusGeometry(0.029, 0.0055, 6, 18))} m={mats.gold} />
            <mesh geometry={G('rgLens', () => new THREE.CircleGeometry(0.026, 16))} material={mats.readLens} position={[0, 0, -0.001]} />
          </group>
        ))}
        <P g={cyl(0.004, 0.004, 0.018, 5)} m={mats.gold} position={[0, 0.006, 0]} rotation={[0, 0, Math.PI / 2]} />
      </group>
    </group>
  )
}

/** 毛巾掛脖子：後頸一圈、兩端垂在胸前貼著肚子，下緣一條藍色條紋（軀幹座標） */
function NeckTowel({ mats }: { mats: Mats }) {
  return (
    <group>
      <P g={G('towelArc', () => new THREE.TorusGeometry(0.108, 0.03, 8, 18, Math.PI))} m={mats.towel} o position={[0, 0.378, 0.005]} rotation={[-Math.PI / 2 + 0.18, 0, 0]} />
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * 0.098, 0.285, 0.19]} rotation={[-0.5, sd * 0.12, sd * 0.06]}>
          <P g={box(0.078, 0.24, 0.022)} m={mats.towel} o />
          <P g={box(0.08, 0.026, 0.024)} m={mats.towelStripe} position={[0, -0.085, 0]} />
        </group>
      ))}
    </group>
  )
}

/** 草帽往後戴（前面的帽簷翹起來，鏡頭從上面看還看得到臉）。原點在頭的中心 */
function StrawHat({ mats }: { mats: Mats }) {
  return (
    <group position={[0, R * 0.56, -R * 0.14]} rotation={[-0.45, 0, 0]}>
      <P g={cyl(0.2, 0.245, 0.15, 28)} m={mats.straw} o position={[0, 0.075, 0]} />
      <P g={G('strawBand', () => new THREE.CylinderGeometry(0.248, 0.25, 0.035, 28, 1, true))} m={mats.strawBand} position={[0, 0.02, 0]} />
      <P g={G('strawBrim', () => new THREE.CylinderGeometry(0.25, 0.42, 0.05, 32, 1, true))} m={mats.straw} o position={[0, -0.02, 0]} />
    </group>
  )
}

/** 右手拿的東西（依姿勢顯示其中一個） */
function HandProps({ mats, refs }: { mats: Mats; refs: (name: string, el: THREE.Group | null) => void }) {
  const fanGeo = G('fan', () => new THREE.CircleGeometry(0.15, 18, 0, Math.PI))
  const fanMat = useMemo(() => toon('#f3e2c0', { side: THREE.DoubleSide, map: floralPrint('#f3e2c0', ['#e0453a'], '#f2c44a', 5, 1) }), [])
  return (
    <group>
      <group ref={(el) => refs('broom', el)} visible={false} rotation={[0.35, 0, 0]}>
        <P g={cyl(0.013, 0.013, 0.78, 6)} m={mats.wood} position={[0, -0.2, 0.02]} />
        <P g={cone(0.13, 0.26)} m={mats.wood} position={[0, -0.66, 0.02]} />
      </group>
      <group ref={(el) => refs('bottle', el)} visible={false} position={[0, -0.02, 0.05]} rotation={[Math.PI, 0, 0]}>
        <P g={cyl(0.038, 0.04, 0.15, 12)} m={mats.amber} position={[0, 0.02, 0]} />
        <P g={cyl(0.041, 0.041, 0.05, 12)} m={mats.red} position={[0, 0.0, 0]} />
        <P g={cyl(0.014, 0.022, 0.06, 8)} m={mats.amber} position={[0, 0.12, 0]} />
      </group>
      <group ref={(el) => refs('phone', el)} visible={false} position={[-0.05, 0.0, 0.05]} rotation={[-1.1, 0, 0]}>
        <P g={box(0.08, 0.15, 0.012)} m={mats.dark} />
        <mesh geometry={G('screen', () => new THREE.PlaneGeometry(0.068, 0.13))} material={mats.screen} position={[0, 0, 0.007]} />
      </group>
      <group ref={(el) => refs('fan', el)} visible={false} position={[0, 0.03, 0.03]} rotation={[0, 0, 0]}>
        <mesh geometry={fanGeo} material={fanMat} />
      </group>
      {/* 攝影機：機身、鏡頭、翻開的螢幕（朝自己）、錄影紅燈 */}
      <group ref={(el) => refs('camera', el)} visible={false} position={FITS.camera.position} quaternion={FITS.camera.quaternion}>
        <P g={box(0.075, 0.085, 0.15)} m={mats.dark} o />
        <P g={cyl(0.034, 0.03, 0.05, 16)} m={mats.lens} o position={[0, 0.005, 0.095]} rotation={[Math.PI / 2, 0, 0]} />
        <P g={box(0.075, 0.055, 0.008)} m={mats.dark} o position={[0.075, 0.01, -0.035]} rotation={[0, -0.25, 0]} />
        <mesh geometry={G('camscreen', () => new THREE.PlaneGeometry(0.066, 0.046))} material={mats.screen} position={[0.076, 0.01, -0.041]} rotation={[0, Math.PI - 0.25, 0]} />
        <mesh geometry={SPHERE()} material={mats.rec} position={[-0.02, 0.046, 0.05]} scale={0.011} />
      </group>
      {/* 筆電：底座平放，螢幕在遠端往後仰、朝向自己發光 */}
      <group ref={(el) => refs('laptop', el)} visible={false} position={FITS.laptop.position} quaternion={FITS.laptop.quaternion}>
        <P g={box(0.28, 0.014, 0.19)} m={mats.silver} o />
        <group position={[0, 0.007, 0.095]} rotation={[0.3, 0, 0]}>
          <P g={box(0.28, 0.18, 0.008)} m={mats.silver} o position={[0, 0.09, 0]} />
          <mesh geometry={G('lapscreen', () => new THREE.PlaneGeometry(0.25, 0.155))} material={mats.screen} position={[0, 0.09, -0.005]} rotation={[0, Math.PI, 0]} />
        </group>
      </group>
      {/* 手電筒：握把在手上、燈頭朝前 */}
      <group ref={(el) => refs('flashlight', el)} visible={false} position={FITS.flashlight.position} quaternion={FITS.flashlight.quaternion}>
        <P g={cyl(0.022, 0.022, 0.15, 12)} m={mats.metal} o position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]} />
        <P g={cyl(0.036, 0.024, 0.05, 14)} m={mats.metal} o position={[0, 0, 0.125]} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={G('flashlens', () => new THREE.CircleGeometry(0.031, 16))} material={mats.beam} position={[0, 0, 0.151]} />
      </group>
      {/* 飯碗：碗口朝上、上面一坨白飯 */}
      <group ref={(el) => refs('bowl', el)} visible={false} position={FITS.bowl.position} quaternion={FITS.bowl.quaternion}>
        <P g={G('bowl', () => new THREE.LatheGeometry([[0, 0], [0.035, 0], [0.04, 0.008], [0.068, 0.045], [0.072, 0.06]].map(([x, y]) => new THREE.Vector2(x, y)), 18))} m={mats.white} o position={[0, 0.02, 0.02]} />
        <P g={cyl(0.069, 0.069, 0.008, 18)} m={mats.blueBand} position={[0, 0.07, 0.02]} />
        <P g={SPHERE()} m={mats.rice} position={[0, 0.075, 0.02]} scale={[0.058, 0.03, 0.058]} />
      </group>
      <group ref={(el) => refs('incense', el)} visible={false} position={[0.05, 0, 0.03]} rotation={[Math.PI - 0.3, 0, 0]}>
        {[-0.02, 0, 0.02].map((x) => (
          <group key={x} position={[x, 0.14, 0]}>
            <P g={cyl(0.004, 0.004, 0.3, 4)} m={mats.red} />
            <P g={SPHERE()} m={mats.gold} position={[0, 0.15, 0]} scale={0.01} />
          </group>
        ))}
      </group>
    </group>
  )
}

/** 左手拿的東西（筷子） */
function LeftHandProps({ mats, refs }: { mats: Mats; refs: (name: string, el: THREE.Group | null) => void }) {
  return (
    <group ref={(el) => refs('chopsticks', el)} visible={false} position={FITS.chopsticks.position} quaternion={FITS.chopsticks.quaternion}>
      {[-0.008, 0.008].map((x) => (
        <P key={x} g={cyl(0.0035, 0.005, 0.2, 5)} m={mats.wood} position={[x, 0, 0.07]} rotation={[Math.PI / 2, 0, 0]} />
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// NPC：站在固定位置、做固定的動作；看得到鬼的人阿嬤靠近會轉頭看她
// ---------------------------------------------------------------------------

export function ChibiNpc({
  id,
  pose = 'idle',
  position,
  heading = 0.7,
  seesGhosts = false,
  outline = true,
}: {
  id: string
  pose?: PoseName
  position: V3
  heading?: number
  seesGhosts?: boolean
  outline?: boolean
}) {
  const drive = useRef(newDrive({ pose, heading }))
  drive.current.pose = pose
  useFrame(() => {
    const d = drive.current
    if (!seesGhosts) {
      d.heading = heading
      return
    }
    const dx = player.x - position[0]
    const dz = player.z - position[2]
    d.heading = Math.hypot(dx, dz) < 4 ? Math.atan2(dx, dz) : heading
  })
  return (
    <group position={position} userData={{ noMerge: true }}>
      <Chibi spec={SPECS[id]} drive={drive} outline={outline} />
    </group>
  )
}

export function ChibiGroup({ children }: { children: ReactNode }) {
  return <group userData={{ noMerge: true }}>{children}</group>
}
