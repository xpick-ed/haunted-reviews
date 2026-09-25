import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { lanternAt } from './daylight'
import { TILE, WBox, canvasTexture, planeGeo, useMats } from './kit'
import { taperTube } from './Plants'

// 村路與後院共用的小東西：鐵皮浪板、水田、電線、塑膠汽水箱、鐵窗、夜裡會亮的窗。

// ---------------------------------------------------------------------------
// 鐵皮浪板（亭仔腳、雞舍、透天厝頂樓加蓋）
// ---------------------------------------------------------------------------

const corrugatedCache = new Map<string, THREE.CanvasTexture>()

/** 浪板：一條亮一條暗的波紋，加上一點鏽 */
export function corrugatedTexture(color: string, rust = 0.25) {
  const key = `${color}|${rust}`
  let t = corrugatedCache.get(key)
  if (t) return t
  t = canvasTexture(128, 128, (ctx, w, h) => {
    const base = new THREE.Color(color)
    for (let x = 0; x < w; x++) {
      const k = 0.78 + 0.22 * Math.sin((x / w) * Math.PI * 2 * 8)
      ctx.fillStyle = `#${base.clone().multiplyScalar(k).getHexString()}`
      ctx.fillRect(x, 0, 1, h)
    }
    // 鏽斑：沿著波谷往下流
    for (let i = 0; i < 40 * rust; i++) {
      const x = Math.floor(Math.random() * 8) * (w / 8) + w / 16
      const y = Math.random() * h
      const g = ctx.createLinearGradient(0, y, 0, y + 30)
      g.addColorStop(0, 'rgba(120,60,30,0.45)')
      g.addColorStop(1, 'rgba(120,60,30,0)')
      ctx.fillStyle = g
      ctx.fillRect(x - 2, y, 4, 30)
    }
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  corrugatedCache.set(key, t)
  return t
}

/** 一片浪板：長 len（沿波紋方向）、寬 w；tilt 是往前傾的角度 */
export function Corrugated({
  position,
  size,
  tilt = 0,
  color = '#5f8a8a',
  rotY = 0,
}: {
  position: [number, number, number]
  size: [number, number]
  tilt?: number
  color?: string
  rotY?: number
}) {
  const mat = useMemo(() => {
    const t = corrugatedTexture(color).clone()
    t.needsUpdate = true
    t.repeat.set(size[0] / 1.2, 1)
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.35, side: THREE.DoubleSide })
  }, [color, size])
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh rotation={[-Math.PI / 2 + tilt, 0, 0]} material={mat} castShadow receiveShadow>
        <boxGeometry args={[size[0], size[1], 0.03]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 水田：水面＋田埂
// ---------------------------------------------------------------------------

let paddyWater: THREE.MeshStandardMaterial | null = null
function waterMat() {
  return (paddyWater ??= new THREE.MeshStandardMaterial({ color: '#1a2630', roughness: 0.12, metalness: 0.35, envMapIntensity: 1.6 }))
}

/** xs、zs 是田埂中心線（跟 Landscape 的寫法一樣） */
export function Paddies({ xs, zs }: { xs: number[]; zs: number[] }) {
  const x0 = xs[0]
  const x1 = xs[xs.length - 1]
  const z0 = zs[0]
  const z1 = zs[zs.length - 1]
  return (
    <group>
      <mesh position={[(x0 + x1) / 2, 0.05, (z0 + z1) / 2]} rotation-x={-Math.PI / 2} material={waterMat()} receiveShadow>
        <planeGeometry args={[x1 - x0, z1 - z0]} />
      </mesh>
      {zs.map((z) => (
        <WBox key={`z${z}`} mat="mud" size={[x1 - x0 + 0.5, 0.25, 0.5]} position={[(x0 + x1) / 2, 0.12, z]} />
      ))}
      {xs.map((x) => (
        <WBox key={`x${x}`} mat="mud" size={[0.5, 0.25, z1 - z0]} position={[x, 0.12, (z0 + z1) / 2]} />
      ))}
      <Seedlings xs={xs} zs={zs} />
    </group>
  )
}

/** 秧苗：一格一格排好的小綠點 */
function Seedlings({ xs, zs }: { xs: number[]; zs: number[] }) {
  const mesh = useMemo(() => {
    const mats: THREE.Matrix4[] = []
    const q = new THREE.Quaternion()
    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < zs.length - 1; j++) {
        for (let x = xs[i] + 0.7; x < xs[i + 1] - 0.5; x += 0.55) {
          for (let z = zs[j] + 0.7; z < zs[j + 1] - 0.5; z += 0.55) {
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (x * 7.3 + z * 3.1) % 6.28)
            const h = 0.8 + ((x * 13.7 + z * 5.3) % 1) * 0.4
            mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.05, z), q, new THREE.Vector3(1, h, 1)))
          }
        }
      }
    }
    const geo = new THREE.ConeGeometry(0.05, 0.28, 4, 1, true)
    geo.translate(0, 0.14, 0)
    const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#6f9a4a', roughness: 0.9, side: THREE.DoubleSide }), mats.length)
    mats.forEach((mm, i) => m.setMatrixAt(i, mm))
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
    return m
  }, [xs, zs])
  return <primitive object={mesh} />
}

// ---------------------------------------------------------------------------
// 電線桿與電線
// ---------------------------------------------------------------------------

export function catenary(a: THREE.Vector3, b: THREE.Vector3, sag: number, n = 14) {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    pts.push(a.clone().lerp(b, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0)))
  }
  return pts
}

const poleMat = new THREE.MeshStandardMaterial({ color: '#9a968d', roughness: 0.85 })
const steelMat = new THREE.MeshStandardMaterial({ color: '#5d6167', roughness: 0.45, metalness: 0.6 })
const wireMat = new THREE.MeshStandardMaterial({ color: '#17181b', roughness: 0.6 })
const insulatorMat = new THREE.MeshStandardMaterial({ color: '#e9e6dc', roughness: 0.4 })

const POLE_H = 8.6
const ARM_Y = 7.9

/** 一排電線桿（沿 x）＋電線；lamps 裡的 x 會加上一支伸到路上的路燈 */
export function PoleLine({ xs, z, lamps = [], lampZ }: { xs: number[]; z: number; lamps?: number[]; lampZ: number }) {
  const wires = useMemo(() => {
    const out: THREE.BufferGeometry[] = []
    const V = (x: number, y: number, zz: number) => new THREE.Vector3(x, y, zz)
    for (let i = 0; i < xs.length - 1; i++) {
      for (const o of [-0.6, 0, 0.6]) out.push(taperTube(catenary(V(xs[i], ARM_Y + 0.2, z + o), V(xs[i + 1], ARM_Y + 0.2, z + o), 0.5), 0.02, 0.02, 14, 4))
      out.push(taperTube(catenary(V(xs[i], 6.6, z - 0.18), V(xs[i + 1], 6.6, z - 0.18), 0.75), 0.028, 0.028, 14, 4))
    }
    // 路燈的彎管
    for (const x of lamps) out.push(taperTube([V(x, 6.4, z + 0.1), V(x, 6.85, z + 0.6), V(x, 6.9, lampZ + 0.15)], 0.05, 0.04, 10, 6))
    return out
  }, [xs, z, lamps, lampZ])
  return (
    <group>
      {xs.map((x) => (
        <group key={x} position={[x, 0, z]}>
          <mesh material={poleMat} position={[0, POLE_H / 2 - 0.1, 0]} castShadow>
            <cylinderGeometry args={[0.11, 0.16, POLE_H, 9]} />
          </mesh>
          <mesh material={steelMat} position={[0, ARM_Y, 0]} castShadow>
            <boxGeometry args={[0.1, 0.1, 1.6]} />
          </mesh>
          {[-0.6, 0, 0.6].map((o) => (
            <mesh key={o} material={insulatorMat} position={[0, ARM_Y + 0.12, o]}>
              <cylinderGeometry args={[0.045, 0.06, 0.16, 7]} />
            </mesh>
          ))}
          {/* 桿上的小廣告牌（「通水溝」、「收購舊機車」這種） */}
          <mesh material={insulatorMat} position={[0, 2.2, 0.15]}>
            <boxGeometry args={[0.24, 0.5, 0.02]} />
          </mesh>
        </group>
      ))}
      {wires.map((g, i) => (
        <mesh key={i} geometry={g} material={i >= wires.length - lamps.length ? steelMat : wireMat} />
      ))}
      {lamps.map((x) => (
        <StreetLamp key={x} x={x} z={lampZ} />
      ))}
    </group>
  )
}

const lampHeadMat = new THREE.MeshStandardMaterial({ color: '#44484e', roughness: 0.5, metalness: 0.4 })
const lampGlassMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.3, 0.9), toneMapped: false })

/** 路燈燈頭與光（天黑才亮） */
function StreetLamp({ x, z }: { x: number; z: number }) {
  const light = useMemoLight()
  useFrame(() => {
    const l = lanternAt(useStore.getState().time)
    light.intensity = 16 * l
    lampGlassMat.color.setRGB(0.4 + 1.2 * l, 0.35 + 0.95 * l, 0.3 + 0.6 * l)
  })
  return (
    <group position={[x, 6.75, z]}>
      <mesh material={lampHeadMat} castShadow>
        <boxGeometry args={[0.3, 0.12, 0.6]} />
      </mesh>
      <mesh material={lampGlassMat} position={[0, -0.07, 0]}>
        <boxGeometry args={[0.22, 0.03, 0.46]} />
      </mesh>
      <primitive object={light} position={[0, -0.3, 0]} />
    </group>
  )
}

function useMemoLight() {
  return useMemo(() => new THREE.PointLight('#ffcf8a', 16, 20, 2), [])
}

// ---------------------------------------------------------------------------
// 夜裡會亮的窗、塑膠汽水箱、鐵窗
// ---------------------------------------------------------------------------

/**
 * 窗玻璃：白天是暗的玻璃，天黑變成屋裡的燈光。
 * color 是亮起來的顏色（暖黃＝燈泡、藍白＝電視）；flicker 會閃（電視）。
 */
export function useWindowGlow(color: string, strength = 1, flicker = false) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#1a2230', toneMapped: false, side: THREE.DoubleSide }), [])
  const on = useMemo(() => new THREE.Color(color), [color])
  const off = useMemo(() => new THREE.Color('#1c2533'), [])
  useFrame(({ clock }) => {
    const l = lanternAt(useStore.getState().time)
    const t = clock.elapsedTime
    const f = flicker ? 0.75 + 0.25 * Math.sin(t * 7.3) * Math.sin(t * 2.1 + 1) : 1
    mat.color.copy(off).lerp(on, THREE.MathUtils.clamp(l * strength * f, 0, 1.4))
  })
  return mat
}

const crateMats: Record<string, THREE.MeshStandardMaterial> = {}
const bottleMat = new THREE.MeshStandardMaterial({ color: '#2f5a3a', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 })
const capMat = new THREE.MeshStandardMaterial({ color: '#d8d2c0', roughness: 0.3, metalness: 0.7 })

/** 塑膠汽水箱（一箱 20 瓶），stack 疊幾箱 */
export function Crates({ position, color = '#e2b72c', stack = 2, rotY = 0 }: { position: [number, number, number]; color?: string; stack?: number; rotY?: number }) {
  const m = (crateMats[color] ??= new THREE.MeshStandardMaterial({ color, roughness: 0.55 }))
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {Array.from({ length: stack }, (_, i) => (
        <group key={i} position={[0, i * 0.3, 0]}>
          <mesh material={m} position={[0, 0.14, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.48, 0.28, 0.72]} />
          </mesh>
        </group>
      ))}
      {/* 最上面那箱看得到瓶口 */}
      {[-0.15, 0, 0.15].flatMap((x) =>
        [-0.26, -0.13, 0, 0.13, 0.26].map((z) => (
          <group key={`${x},${z}`} position={[x, stack * 0.3, z]}>
            <mesh material={bottleMat} position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.025, 0.03, 0.1, 6]} />
            </mesh>
            <mesh material={capMat} position={[0, 0.08, 0]}>
              <cylinderGeometry args={[0.018, 0.018, 0.02, 6]} />
            </mesh>
          </group>
        )),
      )}
    </group>
  )
}

/** 鐵窗：窗外的鐵條格子（台灣老房子的標誌），axis 'x' 表示窗在沿 x 的牆上 */
export function IronGrille({ position, w, h, axis = 'x' }: { position: [number, number, number]; w: number; h: number; axis?: 'x' | 'z' }) {
  const mats = useMats()
  const bars = useMemo(() => {
    const out: { p: [number, number, number]; s: [number, number, number] }[] = []
    const n = Math.max(3, Math.round(w / 0.14))
    for (let i = 0; i <= n; i++) out.push({ p: [-w / 2 + (i * w) / n, 0, 0], s: [0.025, h, 0.025] })
    for (const y of [-h / 2, -h / 6, h / 6, h / 2]) out.push({ p: [0, y, 0], s: [w + 0.04, 0.03, 0.03] })
    return out
  }, [w, h])
  return (
    <group position={position} rotation={[0, axis === 'x' ? 0 : Math.PI / 2, 0]}>
      {bars.map((b, i) => (
        <mesh key={i} material={mats.metal} position={b.p}>
          <boxGeometry args={b.s} />
        </mesh>
      ))}
    </group>
  )
}

/** 地上一塊有貼圖的平面（路、水泥地） */
export function Ground({ mat, w, d, position, tint }: { mat: 'yard' | 'mud' | 'grass' | 'stone' | 'tile'; w: number; d: number; position: [number, number, number]; tint?: string }) {
  const mats = useMats()
  const m = useMemo(() => {
    if (!tint) return mats[mat]
    const c = mats[mat].clone()
    c.color.set(tint)
    return c
  }, [mats, mat, tint])
  return <mesh geometry={planeGeo(w, d, TILE[mat])} material={m} rotation-x={-Math.PI / 2} position={position} receiveShadow />
}
