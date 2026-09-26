import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useStore } from '../store'
import { HAN_SPOT, HILL, HILL_GHOSTS, TOMBS, hillGate, isQingming, isQingmingDusk, terraceY, tombById, tombPoint, type HillGhost } from '../world/sceneHill'
import { player } from '../world/player'
import { lanternAt } from './daylight'
import { canvasTexture, seeded, useMats, windify } from './kit'
import { Chibi, SEAT_Y, newDrive, type Drive } from '../chars/Chibi'
import { ChibiNpc } from '../chars/Chibi'
import { SPECS } from '../chars/specs'

// 山上墓仔埔的零件：相思樹、芒草、山谷（村子的燈、遠山、納骨塔、月亮）、鬼火、鬼鄰居、火伯的香爐、清明掃墓。

const H = HILL

// ---------------------------------------------------------------------------
// 相思樹：細細歪歪的樹幹，一團一團深綠色的小葉子
// ---------------------------------------------------------------------------

let ACACIA: { bark: THREE.MeshStandardMaterial; leaf: THREE.MeshStandardMaterial; leaf2: THREE.MeshStandardMaterial } | null = null
function acaciaMats() {
  return (ACACIA ??= {
    bark: new THREE.MeshStandardMaterial({ color: '#4a3a2e', roughness: 0.95 }),
    leaf: windify(new THREE.MeshStandardMaterial({ color: '#3a5632', roughness: 1, flatShading: true }), 0.035, 0.4),
    leaf2: windify(new THREE.MeshStandardMaterial({ color: '#2e4a2c', roughness: 1, flatShading: true }), 0.035, 0.4),
  })
}

export function Acacia({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const m = acaciaMats()
  const parts = useMemo(() => {
    const r = seeded(Math.round(position[0] * 97 + position[2] * 53) + 11)
    const lean = (r() - 0.5) * 0.35
    const trunk: { y: number; h: number; x: number; rz: number }[] = []
    let x = 0
    let y = 0
    for (let i = 0; i < 3; i++) {
      const h = 1.0 + r() * 0.3
      const rz = lean + (r() - 0.5) * 0.25
      trunk.push({ y: y + h / 2, h, x: x - Math.sin(rz) * h * 0.5, rz })
      x -= Math.sin(rz) * h
      y += Math.cos(rz) * h
    }
    const blobs = Array.from({ length: 8 }, () => ({
      x: x + (r() - 0.5) * 2.4,
      y: y + 0.2 + r() * 1.1,
      z: (r() - 0.5) * 2.2,
      s: 0.75 + r() * 0.55,
      c: r() < 0.5,
    }))
    return { trunk, blobs }
  }, [position])
  return (
    <group position={position} scale={scale}>
      {parts.trunk.map((t, i) => (
        <mesh key={i} material={m.bark} position={[t.x, t.y, 0]} rotation-z={t.rz} castShadow>
          <cylinderGeometry args={[0.09 - i * 0.02, 0.13 - i * 0.025, t.h, 7]} />
        </mesh>
      ))}
      {parts.blobs.map((b, i) => (
        <mesh key={`b${i}`} material={b.c ? m.leaf : m.leaf2} position={[b.x, b.y, b.z]} scale={[b.s * 1.2, b.s * 0.6, b.s]} castShadow receiveShadow>
          <icosahedronGeometry args={[1, 1]} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 芒草：一叢一叢細長的葉子，頂上是銀白色的花穗，隨風搖
// ---------------------------------------------------------------------------

function silverClump() {
  const blades: THREE.BufferGeometry[] = []
  for (let i = 0; i < 9; i++) {
    const g = new THREE.PlaneGeometry(0.11, 1.2, 1, 5)
    g.translate(0, 0.62, 0)
    // 葉子往外彎，越高彎越多
    const pos = g.attributes.position as THREE.BufferAttribute
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k)
      pos.setZ(k, y * y * 0.22)
      pos.setX(k, pos.getX(k) * (1 - y / 1.4))
    }
    g.rotateY((i / 9) * Math.PI * 2 + i * 0.3)
    g.rotateX(0.1)
    blades.push(g)
  }
  // 花穗：幾絲細長、往外垂的毛（不是一根錐子）
  const plumes: THREE.BufferGeometry[] = []
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const p = new THREE.SphereGeometry(1, 6, 5)
    p.scale(0.034, 0.24, 0.034)
    p.translate(0, 0.17, 0)
    p.rotateX(0.55 + (i % 2) * 0.25)
    p.rotateY(a)
    p.translate(Math.sin(a) * 0.05, 1.22 + (i % 3) * 0.06, Math.cos(a) * 0.05)
    plumes.push(p)
  }
  const stem = new THREE.CylinderGeometry(0.006, 0.008, 0.5, 4)
  stem.translate(0, 1.05, 0)
  plumes.push(stem)
  return { blades: mergeGeometries(blades), plume: mergeGeometries(plumes) }
}

export function Silvergrass() {
  const mats = useMemo(
    () => ({
      blade: windify(new THREE.MeshStandardMaterial({ color: '#9aa866', roughness: 0.9, side: THREE.DoubleSide, emissive: '#1c2210', emissiveIntensity: 0.4 }), 0.09),
      plume: windify(new THREE.MeshStandardMaterial({ color: '#e2d8bf', roughness: 1, emissive: '#4a4a52', emissiveIntensity: 0.35 }), 0.12),
    }),
    [],
  )
  const meshes = useMemo(() => {
    const geo = silverClump()
    const r = seeded(9090)
    const spots: [number, number][] = []
    // 山頂邊緣、兩道擋土牆的上緣、入口兩邊、東西兩端
    for (let x = -18.5; x <= 18.5; x += 1.3) spots.push([x + (r() - 0.5) * 0.8, H.ridgeZ + 0.5 + r() * 0.6])
    for (const z of [H.wall1Z - 0.5, H.wall2Z - 0.5]) for (let x = -18; x <= 18; x += 2.6) spots.push([x + (r() - 0.5) * 1.2, z - r() * 0.3])
    for (let i = 0; i < 26; i++) spots.push([(r() < 0.5 ? -1 : 1) * (16 + r() * 5), -10 + r() * 21])
    for (let i = 0; i < 10; i++) spots.push([(r() < 0.5 ? -1 : 1) * (3.2 + r() * 5), 8.8 + r() * 2.6])
    const ok = ([x, z]: [number, number]) => {
      if (Math.abs(x) < 1.6) return false
      if (Math.abs(x - H.lookout.x) < 1.3 && z < H.ridgeZ + 1.3) return false
      for (const t of TOMBS) {
        const [cx, cz] = tombPoint(t, 0, 0.2)
        if (Math.hypot(x - cx, z - cz) < t.w * 0.75) return false
      }
      return true
    }
    const mats4: THREE.Matrix4[] = []
    for (const s of spots.filter(ok)) {
      const k = 0.75 + r() * 0.5
      mats4.push(new THREE.Matrix4().compose(new THREE.Vector3(s[0], terraceY(s[1]), s[1]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28), new THREE.Vector3(k, k * (0.85 + r() * 0.3), k)))
    }
    const make = (g: THREE.BufferGeometry, m: THREE.Material) => {
      const im = new THREE.InstancedMesh(g, m, mats4.length)
      mats4.forEach((mm, i) => im.setMatrixAt(i, mm))
      im.castShadow = true
      im.receiveShadow = true
      return im
    }
    return [make(geo.blades, mats.blade), make(geo.plume, mats.plume)]
  }, [mats])
  return (
    <group>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 山谷：山頂往北看下去是整片田、村子的燈、遠山、納骨塔，天上有月亮
// ---------------------------------------------------------------------------

const VALLEY_Y = -9

export function Valley() {
  const mats = useMats()
  const field = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2c3a28', roughness: 1 }), [])
  const water = useMemo(() => new THREE.MeshStandardMaterial({ color: '#18222c', roughness: 0.15, metalness: 0.35, envMapIntensity: 1.4 }), [])
  const far = useMemo(() => new THREE.MeshStandardMaterial({ color: '#27313a', roughness: 1 }), [])
  const lightsMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 1.4, 0.7), toneMapped: false }), [])
  const moonTex = useMemo(
    () =>
      canvasTexture(128, 128, (ctx, w, h) => {
        const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
        g.addColorStop(0, 'rgba(255,250,228,1)')
        g.addColorStop(0.28, 'rgba(255,246,220,1)')
        g.addColorStop(0.34, 'rgba(220,230,255,0.35)')
        g.addColorStop(1, 'rgba(200,215,255,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }),
    [],
  )
  const moon = useRef<THREE.SpriteMaterial>(null)
  const { paddies, lights } = useMemo(() => {
    const r = seeded(2323)
    const pad: { x: number; z: number; w: number; d: number }[] = []
    for (let i = 0; i < 26; i++) pad.push({ x: -90 + r() * 150, z: -30 - r() * 90, w: 6 + r() * 10, d: 4 + r() * 8 })
    const pts: THREE.Matrix4[] = []
    // 村子：幾團燈（房子）＋一條路燈
    const clusters: [number, number, number][] = [
      [-34, -52, 14],
      [8, -66, 10],
      [-66, -86, 12],
      [34, -96, 8],
      [-12, -110, 9],
    ]
    for (const [cx, cz, n] of clusters) for (let i = 0; i < n; i++) pts.push(new THREE.Matrix4().makeTranslation(cx + (r() - 0.5) * 12, VALLEY_Y + 0.4 + r() * 1.2, cz + (r() - 0.5) * 9))
    for (let i = 0; i < 18; i++) pts.push(new THREE.Matrix4().makeTranslation(-80 + i * 8, VALLEY_Y + 0.8, -44 - i * 2.8))
    return { paddies: pad, lights: pts }
  }, [])
  const lightMesh = useMemo(() => {
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 6, 4), lightsMat, lights.length)
    lights.forEach((m, i) => im.setMatrixAt(i, m))
    return im
  }, [lights, lightsMat])
  useFrame(() => {
    const l = lanternAt(useStore.getState().time)
    lightsMat.color.setRGB(0.3 + 1.9 * l, 0.25 + 1.2 * l, 0.15 + 0.55 * l)
    if (moon.current) moon.current.opacity = 0.15 + 0.85 * l
  })
  return (
    <group>
      <mesh material={field} rotation-x={-Math.PI / 2} position={[-20, VALLEY_Y, -90]} receiveShadow>
        <planeGeometry args={[300, 150]} />
      </mesh>
      {paddies.map((p, i) => (
        <mesh key={i} material={water} rotation-x={-Math.PI / 2} position={[p.x, VALLEY_Y + 0.05, p.z]}>
          <planeGeometry args={[p.w, p.d]} />
        </mesh>
      ))}
      <primitive object={lightMesh} />
      {/* 遠山：山谷對面一排矮山（霧會把它們變淡） */}
      {[
        [-120, -125, 50, 22],
        [-60, -135, 55, 28],
        [0, -130, 48, 20],
        [60, -122, 52, 24],
      ].map(([x, z, r, h], i) => (
        <mesh key={i} material={far} position={[x, VALLEY_Y, z]} scale={[r, h, r * 0.6]}>
          <sphereGeometry args={[1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      ))}
      {/* 遠方山腰的納骨塔：三層小塔，蓋在對面矮山的山腰 */}
      <group position={[-62, VALLEY_Y + 19.5, -112]}>
        {[0, 1, 2].map((i) => (
          <group key={i} position={[0, i * 1.5, 0]}>
            <mesh material={mats.plaster} scale={[1 - i * 0.2, 1, 1 - i * 0.2]}>
              <boxGeometry args={[2.2, 1.2, 2.2]} />
            </mesh>
            <mesh material={mats.redPaint} position={[0, 0.72, 0]} scale={[1 - i * 0.2, 1, 1 - i * 0.2]}>
              <coneGeometry args={[1.9, 0.5, 4]} />
            </mesh>
          </group>
        ))}
      </group>
      <sprite position={[-70, 48, -150]} scale={[26, 26, 1]}>
        <spriteMaterial ref={moon} map={moonTex} transparent depthWrite={false} fog={false} />
      </sprite>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 鬼火：老墳旁邊幾點青綠色的小光，晚上才有
// ---------------------------------------------------------------------------

export function GhostWisps() {
  const isNight = useStore((s) => s.isNight)
  const tex = useMemo(
    () =>
      canvasTexture(64, 64, (ctx, w, h) => {
        const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
        g.addColorStop(0, 'rgba(200,255,235,1)')
        g.addColorStop(0.3, 'rgba(120,240,210,0.6)')
        g.addColorStop(1, 'rgba(80,200,180,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }),
    [],
  )
  const spots = useMemo(
    () =>
      ['t0a', 't1a', 't2a', 't0b'].map((id, i) => {
        const t = tombById(id)
        const [x, z] = tombPoint(t, (i % 2 ? 1 : -1) * 0.9, 0.6)
        return { x, y: terraceY(t.z) + 1.0, z, ph: i * 1.7 }
      }),
    [],
  )
  const refs = useRef<(THREE.Sprite | null)[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((s, i) => {
      if (!s) return
      const p = spots[i]
      s.position.set(p.x + Math.sin(t * 0.5 + p.ph) * 0.5, p.y + Math.sin(t * 0.9 + p.ph) * 0.25, p.z + Math.cos(t * 0.4 + p.ph) * 0.4)
      ;(s.material as THREE.SpriteMaterial).opacity = 0.35 + Math.sin(t * 1.7 + p.ph) * 0.2
    })
  })
  if (!isNight) return null
  return (
    <group>
      {spots.map((_, i) => (
        <sprite
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          scale={[0.45, 0.45, 1]}
        >
          <spriteMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 鬼鄰居：站著的會輕輕飄，坐著的坐在墓手上；阿嬤靠近會轉頭看她
// ---------------------------------------------------------------------------

export function HillGhosts({ outline }: { outline: boolean }) {
  return (
    <group>
      {HILL_GHOSTS.map((g) => (
        <HillGhostNpc key={g.id} g={g} outline={outline} />
      ))}
    </group>
  )
}

function HillGhostNpc({ g, outline }: { g: HillGhost; outline: boolean }) {
  const spec = SPECS[g.spec]
  const group = useRef<THREE.Group>(null)
  const drive = useRef<Drive>(newDrive({ pose: g.pose, heading: g.heading }))
  const base = terraceY(g.z)
  // 坐在墓手上：墓手外圈高 0.62（墳大小會縮放一點）
  const y = g.seated ? base + 0.6 - SEAT_Y * spec.scale + 0.03 : base + 0.12
  const ph = useMemo(() => g.x * 1.3, [g.x])
  useFrame(({ clock }) => {
    const grp = group.current
    if (!grp) return
    grp.visible = hillGate.ghostsVisible(useStore.getState())
    const t = clock.elapsedTime
    grp.position.y = y + (g.seated ? 0 : Math.sin(t * 1.3 + ph) * 0.05)
    const dx = player.x - g.x
    const dz = player.z - g.z
    // 會說話的鬼：阿嬤靠近就轉過來；不說話的鬼一直看著自己的方向
    const talks = g.id === 'huobo' || g.id === 'yuyi'
    drive.current.heading = talks && Math.hypot(dx, dz) < 4.5 ? Math.atan2(dx, dz) : g.heading
  })
  return (
    <group ref={group} position={[g.x, y, g.z]} userData={{ noMerge: true }}>
      <Chibi spec={spec} drive={drive} outline={outline} legs={!g.seated} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 火伯的香爐：颱風之後一直是歪的，阿嬤扶正之後才插得了香
// ---------------------------------------------------------------------------

export function HuoboBowl() {
  const fixed = useStore((s) => !!s.flags.huobo_bowl)
  const t = tombById('huobo')
  const k = t.w / 2.6
  const [x, z] = tombPoint(t, 0, 0.36 * k)
  const y = terraceY(t.z) + 0.1 * k
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8e7a4e', roughness: 0.5, metalness: 0.5 }), [])
  return (
    <group position={[x, y, z]} rotation={[fixed ? 0 : 0.2, t.rot, fixed ? 0 : 0.55]}>
      <mesh material={mat} position={[0, 0.07, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.08, 0.14, 12]} />
      </mesh>
      {!fixed && (
        // 倒出來的香灰
        <mesh position={[0.14, -0.06, 0.04]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.12, 12]} />
          <meshStandardMaterial color="#9a958a" roughness={1} />
        </mesh>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 香：有人拜的墳插著香，香頭一閃一閃，冒一縷煙
// ---------------------------------------------------------------------------

export function IncenseSmoke() {
  const huoboFixed = useStore((s) => !!s.flags.huobo_bowl)
  const qingming = useStore((s) => isQingming(s))
  const ids = ['ama', 'yuyi', ...(huoboFixed ? ['huobo'] : []), ...(qingming ? ['agong'] : [])]
  const puffTex = useMemo(
    () =>
      canvasTexture(64, 64, (ctx, w, h) => {
        const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2)
        g.addColorStop(0, 'rgba(230,230,236,0.55)')
        g.addColorStop(1, 'rgba(230,230,236,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }),
    [],
  )
  const tipMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.6, 0.2), toneMapped: false }), [])
  const stickMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b8262a', roughness: 0.6 }), [])
  const spots = ids.map((id) => {
    const t = tombById(id)
    const k = t.w / 2.6
    const [x, z] = tombPoint(t, 0, 0.36 * k)
    return { id, x, y: terraceY(t.z) + 0.22 * k, z }
  })
  const puffs = useRef<(THREE.Sprite | null)[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    tipMat.color.setRGB(1.8 + Math.sin(t * 5) * 0.4, 0.5, 0.15)
    puffs.current.forEach((p, i) => {
      if (!p) return
      const k = (t * 0.25 + (i % 3) / 3) % 1
      const s = spots[Math.floor(i / 3)]
      if (!s) return
      p.position.set(s.x + Math.sin(k * 5 + i) * 0.06, s.y + 0.3 + k * 1.1, s.z)
      p.scale.setScalar(0.12 + k * 0.4)
      ;(p.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.5
    })
  })
  return (
    <group>
      {spots.map((s, si) => (
        <group key={s.id} position={[s.x, s.y, s.z]}>
          {[-0.035, 0, 0.035].map((dx, i) => (
            <group key={i} position={[dx, 0.14, 0]} rotation-z={dx * 3}>
              <mesh material={stickMat}>
                <cylinderGeometry args={[0.005, 0.005, 0.28, 4]} />
              </mesh>
              <mesh material={tipMat} position={[0, 0.145, 0]}>
                <sphereGeometry args={[0.012, 6, 4]} />
              </mesh>
            </group>
          ))}
          {[0, 1, 2].map((i) => (
            <sprite
              key={i}
              ref={(el) => {
                puffs.current[si * 3 + i] = el
              }}
            >
              <spriteMaterial map={puffTex} transparent depthWrite={false} />
            </sprite>
          ))}
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 清明：小翰來掃墓（傍晚），墳前有供品、燒墓紙的桶子
// ---------------------------------------------------------------------------

export function QingmingScene({ outline }: { outline: boolean }) {
  const qingming = useStore((s) => isQingming(s))
  const dusk = useStore((s) => isQingmingDusk(s))
  const ama = tombById('ama')
  const flames = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const [bx, bz] = tombPoint(ama, -1.55, 1.25)
  const [px, pz] = tombPoint(ama, 0.35, 0.95)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (flames.current) flames.current.children.forEach((f, i) => f.scale.set(1, 0.8 + Math.sin(t * 12 + i * 2) * 0.25, 1))
    if (light.current) light.current.intensity = 1.6 + Math.sin(t * 13) * 0.3 + Math.sin(t * 7.3) * 0.2
  })
  if (!qingming) return null
  const y = H.t2
  const hanHeading = Math.atan2(ama.x - HAN_SPOT.x, ama.z - HAN_SPOT.z)
  return (
    <group>
      {/* 供品：水果、紅龜粿 */}
      <group position={[px, y + 0.1, pz]} rotation-y={ama.rot}>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.2, 0.18, 0.03, 16]} />
          <meshStandardMaterial color="#e8e2d4" roughness={0.4} />
        </mesh>
        {[
          [-0.08, 0.06, '#f0a030'],
          [0.07, 0.04, '#e84a3a'],
          [0, -0.07, '#f5d24a'],
        ].map(([x, z, c], i) => (
          <mesh key={i} position={[x as number, 0.08, z as number]}>
            <sphereGeometry args={[0.055, 10, 8]} />
            <meshStandardMaterial color={c as string} roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[-0.42, 0.04, 0.02]} scale={[1, 0.45, 0.8]}>
          <sphereGeometry args={[0.1, 12, 8]} />
          <meshStandardMaterial color="#d8323a" roughness={0.5} />
        </mesh>
      </group>
      {/* 燒墓紙的鐵桶（傍晚才有火） */}
      <group position={[bx, y, bz]}>
        <mesh position={[0, 0.2, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.18, 0.4, 14, 1, true]} />
          <meshStandardMaterial color="#3a3432" roughness={0.8} metalness={0.4} side={THREE.DoubleSide} />
        </mesh>
        {dusk && (
          <>
            <group ref={flames} position={[0, 0.38, 0]}>
              {[0, 1, 2].map((i) => (
                <mesh key={i} position={[(i - 1) * 0.06, 0.08, (i % 2) * 0.04]}>
                  <coneGeometry args={[0.07, 0.24, 6]} />
                  <meshBasicMaterial color={new THREE.Color(2.4, 1.1, 0.3)} toneMapped={false} transparent opacity={0.85} />
                </mesh>
              ))}
            </group>
            <pointLight ref={light} position={[0, 0.8, 0]} color="#ff9a4a" intensity={1.6} distance={5} decay={2} />
          </>
        )}
      </group>
      {dusk && <ChibiNpc id="xiaohan" pose="sweep" position={[HAN_SPOT.x, y + 0.02, HAN_SPOT.z]} heading={hanHeading} outline={outline} />}
    </group>
  )
}
