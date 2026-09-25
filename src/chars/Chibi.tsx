import { createContext, useContext, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FACE_PATCH, faceTexture } from './faces'
import { SPECS, type ChibiSpec } from './specs'
import { floralPrint, outlineMat, toon, toonGradient } from './toon'
import { player } from '../world/player'

// 3D Q 版角色：大頭、三階卡通光影、深棕描邊。身體由幾何零件組成，
// 手腳掛在關節上用程式擺動（走路、待機呼吸、各種動作），整個人會轉向移動的方向。

export type PoseName = 'idle' | 'clasp' | 'reach' | 'sweep' | 'drink' | 'phone' | 'scared' | 'bow' | 'fan'
type PropName = 'broom' | 'bottle' | 'phone' | 'fan' | 'incense'

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
}
const DRINK_UP: Arm = [-2.25, -0.4, -1.8]

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
  const topMap = tp ? floralPrint(tp.base, tp.petals, tp.center, tp.seed, tp.repeat) : null
  const bottomMap = bp ? floralPrint(bp.base, bp.petals, bp.center, bp.seed, bp.repeat) : null
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
    screen: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.75, 1.2), toneMapped: false }),
  }
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
  const cur = useRef({ l: [0, 0, 0] as Arm, r: [0, 0, 0] as Arm, lean: 0, head: 0, heading: drive.current.heading, phase: 0, legs: [0, 0], twist: 0 })

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
    }
    if (spec.ghost) {
      // 飄：手往後拖、身體前傾
      L[0] += 0.4 * a
      Rr[0] += 0.4 * a
      lean += 0.22 * a
    } else {
      L[0] += Math.sin(c.phase) * 0.6 * a
      Rr[0] -= Math.sin(c.phase) * 0.6 * a
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

    // 轉向（走最短的角度）
    let dh = d.heading - c.heading
    dh = Math.atan2(Math.sin(dh), Math.cos(dh))
    c.heading += dh * (1 - Math.exp(-10 * dt))
    if (root.current) {
      root.current.rotation.y = headOnly ? 0 : c.heading
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
    for (const [name, g] of Object.entries(props.current)) if (g) g.visible = p.prop === name
    if (face.current) {
      const want = faceMat(spec, spec.faces[d.expr] ? d.expr : Object.keys(spec.faces)[0])
      if (face.current.material !== want) face.current.material = want
    }
  })

  const headNode = <Head spec={spec} mats={mats} faceRef={face} />

  if (headOnly) {
    return (
      <Ctx.Provider value={ctx}>
        <group ref={root} scale={spec.scale}>
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
                    <group position={[0, -FORE - 0.03, 0]}>
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
                    </group>
                  </group>
                </group>
              </group>
            ))}
            <group ref={head} position={[0, NECK_Y - HIP_Y, 0]}>
              <P g={cyl(0.062, 0.07, 0.08)} m={mats.skin} position={[0, 0, 0]} />
              <group position={[0, HEAD_C, 0]}>{headNode}</group>
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
      {e.glasses && <Glasses mats={mats} />}
      <Hair spec={spec} mats={mats} />
    </group>
  )
}

function Glasses({ mats }: { mats: Mats }) {
  const rim = G('rim', () => new THREE.TorusGeometry(0.058, 0.009, 6, 20))
  const ex = 0.35 * R
  const ey = -0.19 * R
  const ez = 0.99 * R
  return (
    <group>
      {[1, -1].map((s) => (
        <P key={s} g={rim} m={mats.dark} position={[s * ex, ey, ez]} rotation={[0, s * 0.3, 0]} />
      ))}
      <P g={cyl(0.007, 0.007, 0.06, 6)} m={mats.dark} position={[0, ey + 0.01, ez + 0.02]} rotation={[0, 0, Math.PI / 2]} />
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
