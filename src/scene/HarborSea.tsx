import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { HARBOR } from '../world/sceneHarbor'
import { FLATS, flatsY, tideState, waterY } from '../world/tide'
import { lanternAt, makeDaylight, sampleDaylight } from './daylight'
import { canvasTexture, seeded, useMats } from './kit'

// 海邊的水：港內與外海的海面（跟著潮位升降）、潮間帶的礁石與潮池（退潮會發亮）、
// 遠方的漁火（集魚燈）與海岬的影子。規則與潮汐在 src/world/sceneHarbor.ts、src/world/tide.ts。

const H = HARBOR

/** 月光在海面上的一道亮光：中間亮、兩端淡、被浪打斷 */
const glintTex = canvasTexture(128, 512, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h)
  // 很多細細短短的碎光，越靠中間越密，兩端淡掉
  for (let i = 0; i < 900; i++) {
    const y = Math.random() * h
    const k = Math.sin((y / h) * Math.PI)
    const x = w / 2 + (Math.random() - 0.5) * w * (0.25 + 0.7 * k) * Math.random()
    const len = 3 + Math.random() * 14 * k
    ctx.fillStyle = `rgba(255,255,255,${0.08 + 0.5 * k * Math.random()})`
    ctx.fillRect(x - len / 2, y, len, 1.5)
  }
})

/** 浪花：一條不規則的白色泡沫帶 */
const foamTex = canvasTexture(256, 32, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h)
  const r = seeded(77)
  for (let i = 0; i < 120; i++) {
    const x = r() * w
    const y = h * 0.5 + (r() - 0.5) * h * 0.7
    ctx.fillStyle = `rgba(255,255,255,${0.1 + r() * 0.4})`
    ctx.beginPath()
    ctx.arc(x, y, 1 + r() * 3.5, 0, Math.PI * 2)
    ctx.fill()
  }
})

// ---------------------------------------------------------------------------
// 海面
// ---------------------------------------------------------------------------

export function Sea() {
  const mats = useMats()
  const dl = useMemo(makeDaylight, [])
  const base = useMemo(() => new THREE.Color('#15283a'), [])
  const group = useRef<THREE.Group>(null)
  const glint = useRef<THREE.Mesh>(null)
  const { mat, shimmer, foamMat } = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ color: '#15283a', roughness: 0.06, metalness: 0.5, envMapIntensity: 2, transparent: true, opacity: 0.9 })
    const n = mats.mud.normalMap!.clone()
    n.wrapS = n.wrapT = THREE.RepeatWrapping
    n.repeat.set(26, 13)
    n.needsUpdate = true
    mat.normalMap = n
    mat.normalScale.set(0.3, 0.3)
    const shimmer = mat.clone()
    const n2 = mats.mud.normalMap!.clone()
    n2.wrapS = n2.wrapT = THREE.RepeatWrapping
    n2.repeat.set(60, 30)
    n2.needsUpdate = true
    shimmer.normalMap = n2
    shimmer.normalScale.set(0.16, 0.16)
    shimmer.opacity = 0.3
    shimmer.depthWrite = false
    const t = foamTex.clone()
    t.wrapS = THREE.RepeatWrapping
    t.repeat.set(4, 1)
    t.needsUpdate = true
    const foamMat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.5, color: '#d8e8f0' })
    return { mat, shimmer, foamMat }
  }, [mats])
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const t = clock.elapsedTime
    // 浪：兩層法線往不同方向漂
    mat.normalMap!.offset.x += dt * 0.012
    mat.normalMap!.offset.y += dt * 0.02
    shimmer.normalMap!.offset.x -= dt * 0.03
    shimmer.normalMap!.offset.y += dt * 0.045
    foamMat.map!.offset.x -= dt * 0.04
    const y = waterY(tideState.level) + Math.sin(t * 0.7) * 0.03
    if (group.current) group.current.position.y = y
    sampleDaylight(useStore.getState().time, dl)
    mat.color.copy(base).lerp(dl.sky, 0.08)
    mat.emissive.copy(dl.sky).multiplyScalar(0.03 * (1 - dl.moon))
    shimmer.color.copy(base).lerp(dl.sky, 0.4)
    if (glint.current) {
      const m = glint.current.material as THREE.MeshBasicMaterial
      m.opacity = dl.moon * (0.22 + Math.sin(t * 1.9) * 0.05 + Math.sin(t * 4.7) * 0.03)
    }
    // 浪花：一陣一陣；滿潮時潮間帶外緣的浪比較淡（整片都在水裡）
    foamMat.opacity = 0.16 + Math.sin(t * 1.3) * 0.08
  })
  return (
    <group ref={group} userData={{ noMerge: true }}>
      <mesh material={mat} rotation-x={-Math.PI / 2} position={[0, 0, -51.4]} receiveShadow>
        <planeGeometry args={[220, 100]} />
      </mesh>
      <mesh material={shimmer} rotation-x={-Math.PI / 2} position={[0, 0.006, -51.4]}>
        <planeGeometry args={[220, 100]} />
      </mesh>
      {/* 月光：從外海一路照到港口 */}
      <mesh ref={glint} rotation={[-Math.PI / 2, 0, 0.35]} position={[-6, 0.014, -26]}>
        <planeGeometry args={[7, 42]} />
        <meshBasicMaterial map={glintTex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} color="#d6e4ff" />
      </mesh>
      {/* 堤防外側、消波塊邊的浪花 */}
      <group>
        <mesh material={foamMat} rotation-x={-Math.PI / 2} position={[H.breakwater.x0 - 2.6, 0.012, -7.4]}>
          <planeGeometry args={[1.4, 13]} />
        </mesh>
        <mesh material={foamMat} rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[-15.2, 0.012, -15.4]}>
          <planeGeometry args={[1.2, 9]} />
        </mesh>
        <mesh material={foamMat} rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[12.5, 0.012, FLATS.z0 - 0.4]}>
          <planeGeometry args={[1.0, 15]} />
        </mesh>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 潮間帶：礁石地形、潮池、海藻、藤壺石；退潮後濕濕的一閃一閃
// ---------------------------------------------------------------------------

function buildFlats() {
  const f = FLATS
  const nx = 52
  const nz = 36
  const x0 = f.x0 - 0.2
  const x1 = f.x1 + 1.5
  const z0 = f.z0 - 1.2
  const z1 = f.z1
  const pos: number[] = []
  const col: number[] = []
  const uv: number[] = []
  const c = new THREE.Color()
  const dry = new THREE.Color('#8a8272')
  const wet = new THREE.Color('#4a4a44')
  const moss = new THREE.Color('#4f6a3a')
  const r = seeded(4242)
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx
      const z = z0 + ((z1 - z0) * j) / nz
      // 外緣往下沉進海裡
      const edge = Math.min(1, Math.max(0, (z - z0) / 1.4)) * Math.min(1, Math.max(0, (x1 - x) / 1.4))
      let y = flatsY(Math.min(Math.max(x, f.x0), f.x1), Math.min(Math.max(z, f.z0), f.z1)) - (1 - edge) * 1.2
      y += (r() - 0.5) * 0.08
      // 潮池：往下凹
      for (const p of H.pools) {
        const d = Math.hypot(x - p.x, z - p.z)
        if (d < p.r + 0.3) y -= 0.22 * Math.max(0, 1 - (d / (p.r + 0.3)) ** 2)
      }
      pos.push(x, y, z)
      uv.push(x / 1.6, -z / 1.6)
      const k = (z1 - z) / (z1 - z0)
      c.copy(dry).lerp(wet, Math.min(1, k * 1.3))
      if (r() < 0.25) c.lerp(moss, 0.35 + r() * 0.3)
      const n = (r() - 0.5) * 0.1
      col.push(c.r + n, c.g + n, c.b + n)
    }
  }
  const idx: number[] = []
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i
      idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

const sparkleTex = canvasTexture(32, 32, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.3, 'rgba(210,230,255,0.5)')
  g.addColorStop(1, 'rgba(210,230,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
})

export function Flats() {
  const mats = useMats()
  const geo = useMemo(buildFlats, [])
  const rock = useMemo(() => {
    const m = mats.stone.clone()
    m.vertexColors = true
    m.roughness = 0.85
    return m
  }, [mats])
  const poolMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1f3a44', roughness: 0.04, metalness: 0.5, transparent: true, opacity: 0.85 }), [])
  // 藤壺石、小石頭（一次畫完）
  const stones = useMemo(() => {
    const r = seeded(919)
    const n = 150
    const m = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mats.stone, n)
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const col = new THREE.Color()
    let k = 0
    while (k < n) {
      const x = FLATS.x0 + 0.3 + r() * (FLATS.x1 - FLATS.x0)
      const z = FLATS.z0 - 0.6 + r() * (FLATS.z1 - FLATS.z0)
      if (H.pools.some((p) => Math.hypot(x - p.x, z - p.z) < p.r)) continue
      // 石階前面留空
      if (Math.abs(x - H.steps.x) < 1.2 && z > -4.2) continue
      const s = 0.1 + Math.pow(r(), 2.2) * 0.55
      const y = flatsY(Math.min(x, FLATS.x1), Math.max(z, FLATS.z0)) + s * 0.25
      q.setFromEuler(e.set(r() * 3, r() * 3, r() * 3))
      m.setMatrixAt(k, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s * (1 + r() * 0.6), s * 0.55, s)))
      col.setHSL(0.09 + r() * 0.05, 0.06 + r() * 0.08, 0.26 + r() * 0.22)
      m.setColorAt(k, col)
      k++
    }
    m.castShadow = true
    m.receiveShadow = true
    return m
  }, [mats])
  // 海藻：一小撮一小撮
  const weeds = useMemo(() => {
    const r = seeded(3131)
    const n = 90
    const geo = new THREE.ConeGeometry(0.05, 0.28, 4, 1)
    geo.translate(0, 0.14, 0)
    const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#3f6a2e', roughness: 0.9 }), n)
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    for (let k = 0; k < n; k++) {
      const p = H.pools[k % H.pools.length]
      const a = r() * Math.PI * 2
      const d = p.r * (0.9 + r() * 0.6)
      const x = p.x + Math.cos(a) * d
      const z = p.z + Math.sin(a) * d
      q.setFromEuler(e.set((r() - 0.5) * 0.8, r() * 3, (r() - 0.5) * 0.8))
      m.setMatrixAt(k, new THREE.Matrix4().compose(new THREE.Vector3(x, flatsY(x, z) - 0.05, z), q, new THREE.Vector3(1, 0.6 + r() * 0.9, 1)))
    }
    return m
  }, [])
  // 退潮後礁石上的反光：幾十個小亮點一閃一閃
  const glints = useRef<THREE.InstancedMesh>(null)
  const glintData = useMemo(() => {
    const r = seeded(5150)
    return Array.from({ length: 60 }, () => {
      const x = FLATS.x0 + r() * (FLATS.x1 - FLATS.x0)
      const z = FLATS.z0 + r() * (FLATS.z1 - FLATS.z0)
      return { x, z, y: flatsY(x, z) + 0.06, ph: r() * 6.28, sp: 1.5 + r() * 3 }
    })
  }, [])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }) => {
    const im = glints.current
    if (!im) return
    const t = clock.elapsedTime
    // 水退得越多、越晚（月光）越亮
    const exposed = Math.max(0, 1 - tideState.level * 1.6) * lanternAt(useStore.getState().time)
    im.visible = exposed > 0.02
    if (!im.visible) return
    glintData.forEach((g, i) => {
      const k = Math.max(0, Math.sin(t * g.sp + g.ph)) ** 6 * exposed
      tmp.position.set(g.x, g.y, g.z)
      tmp.scale.setScalar(0.05 + k * 0.28)
      tmp.updateMatrix()
      im.setMatrixAt(i, tmp.matrix)
    })
    im.instanceMatrix.needsUpdate = true
    // 濕的礁石比較亮（反光）
    rock.roughness = 0.85 - exposed * 0.45
  })
  return (
    <group userData={{ noMerge: true }}>
      <mesh geometry={geo} material={rock} receiveShadow castShadow />
      {H.pools.map((p, i) => (
        <mesh key={i} material={poolMat} rotation-x={-Math.PI / 2} position={[p.x, flatsY(p.x, p.z) - 0.08, p.z]}>
          <circleGeometry args={[p.r, 20]} />
        </mesh>
      ))}
      <primitive object={stones} />
      <primitive object={weeds} />
      <instancedMesh ref={glints} args={[undefined, undefined, glintData.length]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={sparkleTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 遠方：海岬的影子、外海的漁火（集魚燈）
// ---------------------------------------------------------------------------

const lightTex = canvasTexture(64, 64, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
  g.addColorStop(0, 'rgba(255,255,240,1)')
  g.addColorStop(0.25, 'rgba(255,240,200,0.6)')
  g.addColorStop(1, 'rgba(255,240,200,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
})

export function Horizon() {
  const hill = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1c2622', roughness: 1 }), [])
  const lights = useRef<(THREE.Sprite | null)[]>([])
  const spots = useMemo(() => {
    const r = seeded(2718)
    return Array.from({ length: 14 }, (_, i) => ({
      x: -70 + r() * 150,
      z: -62 - r() * 40,
      s: 1.2 + r() * 1.8,
      green: i % 4 === 0,
      ph: r() * 6,
    }))
  }, [])
  useFrame(({ clock }) => {
    const l = lanternAt(useStore.getState().time)
    const t = clock.elapsedTime
    lights.current.forEach((sp, i) => {
      if (!sp) return
      const s = spots[i]
      sp.visible = l > 0.05
      ;(sp.material as THREE.SpriteMaterial).opacity = l * (0.7 + Math.sin(t * 1.3 + s.ph) * 0.2)
    })
  })
  return (
    <group userData={{ noMerge: true }}>
      {/* 東北邊的海岬、西北邊的小島：只是遠遠的影子 */}
      <mesh material={hill} position={[70, -2, -70]} scale={[48, 11, 18]}>
        <sphereGeometry args={[1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh material={hill} position={[108, -2, -40]} scale={[30, 16, 30]}>
        <sphereGeometry args={[1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh material={hill} position={[-70, -2, -95]} scale={[22, 6, 10]}>
        <sphereGeometry args={[1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {spots.map((s, i) => (
        <sprite
          key={i}
          ref={(el) => {
            lights.current[i] = el
          }}
          position={[s.x, 0.8, s.z]}
          scale={[s.s, s.s, 1]}
          visible={false}
        >
          <spriteMaterial map={lightTex} color={s.green ? '#b8ffcf' : '#fff2c8'} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      ))}
    </group>
  )
}
