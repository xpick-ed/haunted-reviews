import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { MARKET } from '../world/sceneMarket'
import { BRUSH_FONT, canvasTexture, seeded } from './kit'

// 鬼夜市會動的氣氛：一串串的燈籠、飄著的鬼火、落下的冥紙、地上的霧、入口牌樓。
// 全部用 InstancedMesh（一種東西一個 draw call），手機也跑得動。

// ---------------------------------------------------------------------------
// 燈籠串
// ---------------------------------------------------------------------------

type V3 = [number, number, number]

/** 一條電線：兩端點＋下垂量 */
interface Wire {
  a: V3
  b: V3
  sag: number
}

const WIRES: Wire[] = (() => {
  const out: Wire[] = []
  const edge = MARKET.streetHalf + 0.55
  // 橫跨主街
  for (const z of [7.3, 4.8, -2.4, -5.1, -7.7]) out.push({ a: [-edge, 2.45, z], b: [edge, 2.45, z], sag: 0.32 })
  // 沿著主街兩側攤子的前緣
  for (const s of [-1, 1]) {
    out.push({ a: [s * edge, 2.4, 7.6], b: [s * edge, 2.4, 2.1], sag: 0.22 })
    out.push({ a: [s * edge, 2.4, -2.1], b: [s * edge, 2.4, -7.9], sag: 0.22 })
  }
  // 橫跨橫街
  const ce = MARKET.crossHalf + 0.7
  for (const x of [-9.6, -5.2, 5.2, 9.6]) out.push({ a: [x, 2.45, -ce], b: [x, 2.45, ce], sag: 0.3 })
  // 老樹上垂下來的幾串
  const t = MARKET.tree
  for (const dz of [-1.2, 0.4, 1.8]) out.push({ a: [t.x - 1.6, 3.4, t.z + dz], b: [t.x - 0.2, 3.9, t.z + dz * 0.6], sag: 0.25 })
  return out
})()

const wireAt = (w: Wire, k: number): V3 => [
  w.a[0] + (w.b[0] - w.a[0]) * k,
  w.a[1] + (w.b[1] - w.a[1]) * k - Math.sin(k * Math.PI) * w.sag,
  w.a[2] + (w.b[2] - w.a[2]) * k,
]

/** 燈籠的顏色：紅、琥珀、鬼火青（HDR，讓 Bloom 暈開） */
const LANTERN_COLORS = [new THREE.Color(2.0, 0.34, 0.2), new THREE.Color(2.1, 1.05, 0.32), new THREE.Color(0.32, 1.75, 1.5)]

interface Hang {
  p: V3
  drop: number
  phase: number
  color: number
}

const HANGS: Hang[] = (() => {
  const r = seeded(4411)
  const out: Hang[] = []
  WIRES.forEach((w) => {
    const len = Math.hypot(w.b[0] - w.a[0], w.b[2] - w.a[2])
    const n = Math.max(2, Math.round(len / 0.72))
    for (let i = 1; i < n; i++) {
      const p = wireAt(w, i / n)
      const pick = r()
      out.push({ p, drop: 0.16 + r() * 0.1, phase: r() * 6.28, color: pick < 0.5 ? 0 : pick < 0.72 ? 1 : 2 })
    }
  })
  return out
})()

const LANTERN_PROFILE = [
  [0.0, -0.17],
  [0.07, -0.16],
  [0.12, -0.11],
  [0.14, -0.04],
  [0.14, 0.04],
  [0.12, 0.11],
  [0.07, 0.16],
  [0.0, 0.17],
].map(([x, y]) => new THREE.Vector2(x, y))

function lanternPaperTex() {
  // 燈籠紙：直的竹骨＋上下深色的圈
  return canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(0,0,0,0.28)'
    for (let i = 0; i < 8; i++) ctx.fillRect((i * w) / 8, 0, 2, h)
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, w, 6)
    ctx.fillRect(0, h - 6, w, 6)
  })
}

export function LanternStrings() {
  const body = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.LatheGeometry(LANTERN_PROFILE, 12), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: lanternPaperTex(), toneMapped: false }), [])
  const wireGeo = useMemo(() => {
    const pts: number[] = []
    for (const w of WIRES) {
      const n = 14
      for (let i = 0; i < n; i++) pts.push(...wireAt(w, i / n), ...wireAt(w, (i + 1) / n))
    }
    // 燈籠的吊繩
    for (const h of HANGS) pts.push(h.p[0], h.p[1], h.p[2], h.p[0], h.p[1] - h.drop + 0.17, h.p[2])
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }) => {
    const im = body.current
    if (!im) return
    const t = clock.elapsedTime
    HANGS.forEach((h, i) => {
      const sway = Math.sin(t * 1.3 + h.phase) * 0.12
      const len = h.drop + 0.17
      tmp.position.set(h.p[0] + Math.sin(sway) * len * 0.6, h.p[1] - len, h.p[2] + Math.sin(sway * 0.7 + 1) * len * 0.4)
      tmp.rotation.set(sway * 0.4, t * 0.1 + h.phase, sway)
      tmp.updateMatrix()
      im.setMatrixAt(i, tmp.matrix)
    })
    im.instanceMatrix.needsUpdate = true
  })
  return (
    <group userData={{ noMerge: true }}>
      <instancedMesh
        ref={(im) => {
          body.current = im
          if (im && !im.instanceColor) HANGS.forEach((h, i) => im.setColorAt(i, LANTERN_COLORS[h.color]))
        }}
        args={[geo, mat, HANGS.length]}
        frustumCulled={false}
      />
      <lineSegments geometry={wireGeo}>
        <lineBasicMaterial color="#141014" />
      </lineSegments>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 鬼火：青綠色的小火球，在街道上方慢慢飄
// ---------------------------------------------------------------------------

const WISPS = 18

export function GhostFires() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.IcosahedronGeometry(0.075, 1), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.9, 1.6), toneMapped: false, transparent: true, opacity: 0.9 }), [])
  const seeds = useMemo(() => {
    const r = seeded(808)
    return Array.from({ length: WISPS }, (_, i) => {
      const onCross = i % 3 === 0
      return {
        x: onCross ? -10 + r() * 20 : -1.6 + r() * 3.2,
        z: onCross ? -1.4 + r() * 2.8 : -7.5 + r() * 15,
        y: 2.9 + r() * 1.8,
        s: 0.6 + r() * 0.8,
        p: r() * 6.28,
      }
    })
  }, [])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }) => {
    const im = mesh.current
    if (!im) return
    const t = clock.elapsedTime
    seeds.forEach((w, i) => {
      tmp.position.set(w.x + Math.sin(t * 0.3 * w.s + w.p) * 1.1, w.y + Math.sin(t * 0.9 * w.s + w.p * 2) * 0.35, w.z + Math.cos(t * 0.25 * w.s + w.p) * 1.3)
      const pulse = 0.8 + Math.sin(t * 5 + w.p) * 0.2
      tmp.scale.setScalar(pulse)
      tmp.updateMatrix()
      im.setMatrixAt(i, tmp.matrix)
    })
    im.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geo, mat, WISPS]} frustumCulled={false} userData={{ noMerge: true }} />
}

// ---------------------------------------------------------------------------
// 冥紙：從天上飄下來，一邊翻；地上也散著一些
// ---------------------------------------------------------------------------

function joss() {
  // 黃紙中間一塊金箔
  return canvasTexture(32, 32, (ctx, w, h) => {
    ctx.fillStyle = '#e2c46a'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#c8962a'
    ctx.fillRect(8, 8, w - 16, h - 16)
    ctx.fillStyle = '#a8321e'
    ctx.fillRect(13, 13, w - 26, h - 26)
  })
}

const FALLING = 36
const GROUND = 70

export function FallingPaper() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.PlaneGeometry(0.12, 0.12), [])
  const mat = useMemo(() => {
    const t = joss()
    return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.3, side: THREE.DoubleSide, roughness: 0.9 })
  }, [])
  const bits = useMemo(() => {
    const r = seeded(99)
    return Array.from({ length: FALLING }, () => ({ x: -9 + r() * 18, z: -8 + r() * 16, y: r() * 5, v: 0.18 + r() * 0.16, p: r() * 6.28, s: 0.7 + r() * 0.6 }))
  }, [])
  const ground = useMemo(() => {
    const g = new THREE.InstancedMesh(geo, mat, GROUND)
    const r = seeded(123)
    const o = new THREE.Object3D()
    for (let i = 0; i < GROUND; i++) {
      // 撒在街上（主街或橫街）
      const cross = r() < 0.4
      const x = cross ? -11 + r() * 22 : (r() - 0.5) * MARKET.streetHalf * 2
      const z = cross ? (r() - 0.5) * MARKET.crossHalf * 2 : -8 + r() * 16.5
      o.position.set(x, 0.025 + i * 0.0002, z)
      o.rotation.set(-Math.PI / 2, 0, r() * 6.28)
      o.scale.setScalar(0.8 + r() * 0.5)
      o.updateMatrix()
      g.setMatrixAt(i, o.matrix)
    }
    g.receiveShadow = true
    g.userData.noMerge = true
    return g
  }, [geo, mat])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }, rawDt) => {
    const im = mesh.current
    if (!im) return
    const dt = Math.min(rawDt, 0.1)
    const t = clock.elapsedTime
    bits.forEach((b, i) => {
      b.y -= b.v * dt
      if (b.y < 0.05) b.y = 5 + Math.random()
      tmp.position.set(b.x + Math.sin(t * 1.1 * b.s + b.p) * 0.5, b.y, b.z + Math.cos(t * 0.8 * b.s + b.p) * 0.3)
      tmp.rotation.set(t * 2.2 * b.s + b.p, t * 1.3 + b.p, Math.sin(t * 3 + b.p))
      tmp.updateMatrix()
      im.setMatrixAt(i, tmp.matrix)
    })
    im.instanceMatrix.needsUpdate = true
  })
  return (
    <group userData={{ noMerge: true }}>
      <instancedMesh ref={mesh} args={[geo, mat, FALLING]} frustumCulled={false} />
      <primitive object={ground} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 地上的霧：大片、很淡的青色霧團慢慢飄
// ---------------------------------------------------------------------------

const mistTex = canvasTexture(128, 128, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2)
  g.addColorStop(0, 'rgba(170,235,225,0.55)')
  g.addColorStop(0.5, 'rgba(150,220,210,0.22)')
  g.addColorStop(1, 'rgba(150,220,210,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
})

export function GroundMist() {
  const puffs = useRef<(THREE.Sprite | null)[]>([])
  const seeds = useMemo(() => {
    const r = seeded(515)
    return Array.from({ length: 14 }, (_, i) => ({
      x: -12 + r() * 24,
      z: i < 8 ? -8 + r() * 16 : -1.5 + r() * 3,
      s: 4 + r() * 3,
      v: 0.15 + r() * 0.2,
      p: r() * 6.28,
    }))
  }, [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    seeds.forEach((m, i) => {
      const sp = puffs.current[i]
      if (!sp) return
      const x = ((m.x + t * m.v + 14) % 28) - 14
      sp.position.set(x, 0.35 + Math.sin(t * 0.4 + m.p) * 0.1, m.z + Math.sin(t * 0.2 + m.p) * 0.6)
      const k = Math.min(1, (14 - Math.abs(x)) / 3)
      ;(sp.material as THREE.SpriteMaterial).opacity = 0.2 * k
    })
  })
  return (
    <group userData={{ noMerge: true }}>
      {seeds.map((m, i) => (
        <sprite
          key={i}
          ref={(el) => {
            puffs.current[i] = el
          }}
          scale={[m.s, m.s * 0.35, 1]}
          renderOrder={2}
        >
          <spriteMaterial map={mistTex} transparent depthWrite={false} opacity={0.2} fog={false} />
        </sprite>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 入口牌樓：兩根紅柱、橫樑、小屋頂、匾額「陰間夜市」。擋到鏡頭時淡出（MARKET_SCENE.buildings 的 'gate'）
// ---------------------------------------------------------------------------

export function Gate() {
  const z = MARKET.gateZ
  const mats = useMemo(() => {
    const plaque = canvasTexture(
      512,
      128,
      (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h)
        g.addColorStop(0, '#1e3a38')
        g.addColorStop(1, '#0e2220')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
        ctx.strokeStyle = '#d9a64a'
        ctx.lineWidth = 6
        ctx.strokeRect(8, 8, w - 16, h - 16)
        ctx.fillStyle = '#9ff4e0'
        ctx.font = `700 80px ${BRUSH_FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('陰間夜市', w / 2, h / 2 + 4)
      },
      [{ spec: `700 80px ${BRUSH_FONT}`, text: '陰間夜市' }],
    )
    return {
      red: new THREE.MeshStandardMaterial({ color: '#7a1f1a', roughness: 0.55 }),
      wood: new THREE.MeshStandardMaterial({ color: '#2e1d14', roughness: 0.7 }),
      roof: new THREE.MeshStandardMaterial({ color: '#2a3a3a', roughness: 0.6 }),
      gold: new THREE.MeshStandardMaterial({ color: '#c8963a', roughness: 0.35, metalness: 0.7 }),
      plaque: new THREE.MeshStandardMaterial({ map: plaque, emissiveMap: plaque, emissive: '#ffffff', emissiveIntensity: 0.7, roughness: 0.6 }),
      glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.8, 1.5), toneMapped: false }),
    }
  }, [])
  const all = useMemo(() => Object.values(mats), [mats])
  const op = useRef(1)
  useFrame(() => {
    const target = useStore.getState().faded.split(',').includes('gate') ? 0.12 : 1
    const prev = op.current
    op.current += (target - op.current) * 0.15
    if (Math.abs(op.current - prev) < 1e-4) return
    for (const m of all) {
      const wasT = m.transparent
      m.opacity = op.current
      m.transparent = op.current < 0.995
      m.depthWrite = op.current > 0.5
      if (wasT !== m.transparent) m.needsUpdate = true
    }
  })
  const H = 4.3
  return (
    <group position={[0, 0, z]} userData={{ noMerge: true }}>
      {[-2.35, 2.35].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh material={mats.red} position={[0, H / 2, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.17, H, 14]} />
          </mesh>
          <mesh material={mats.wood} position={[0, 0.2, 0]}>
            <boxGeometry args={[0.46, 0.4, 0.46]} />
          </mesh>
        </group>
      ))}
      <mesh material={mats.wood} position={[0, H - 0.2, 0]} castShadow>
        <boxGeometry args={[5.5, 0.32, 0.34]} />
      </mesh>
      <mesh material={mats.red} position={[0, H - 0.72, 0]}>
        <boxGeometry args={[4.7, 0.16, 0.2]} />
      </mesh>
      {/* 小屋頂：兩片斜板＋金色屋脊 */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={mats.roof} position={[0, H + 0.12, s * 0.28]} rotation-x={s * 0.5} castShadow>
          <boxGeometry args={[6.1, 0.07, 0.7]} />
        </mesh>
      ))}
      <mesh material={mats.gold} position={[0, H + 0.3, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.05, 0.05, 6.2, 8]} />
      </mesh>
      {/* 匾額（朝南，進來的人跟鏡頭都看得到） */}
      <mesh material={mats.plaque} position={[0, H - 0.25, 0.18]}>
        <planeGeometry args={[1.9, 0.48]} />
      </mesh>
      {/* 兩顆青色燈 */}
      {[-1.6, 1.6].map((x) => (
        <group key={x} position={[x, H - 0.95, 0.05]}>
          <mesh material={mats.wood} position={[0, 0.28, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.3, 4]} />
          </mesh>
          <mesh material={mats.glow} scale={[1, 1.25, 1]}>
            <sphereGeometry args={[0.16, 14, 10]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
