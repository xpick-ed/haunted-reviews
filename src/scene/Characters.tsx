import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { player } from '../world/player'
import { SCENES } from '../world/scenes'
import { BED, FLOOR_Y, PILLOW_Z } from './layout'
import { canvasTexture, svgTexture } from './kit'
import {
  BURST_SIZE,
  GRANDMA_SIZE,
  GUEST_SIZE,
  SLEEP_SIZE,
  Z_SIZE,
  burstSvg,
  grandmaSvg,
  guestSleepSvg,
  guestSvg,
  zSvg,
} from '../art/characters'
import { floralFabricTexture } from '../art/fabric'

// 人物：SVG 立繪貼在面向鏡頭的平面上（DESIGN §15.1 的 HD-2D 做法）。
// 阿嬤不受光（她自己會發光）；小美受房間燈光影響。

const ease = (k: number) => 1 - Math.pow(1 - k, 3)
const backOut = (k: number) => {
  const c = 1.70158
  const x = k - 1
  return 1 + (c + 1) * x * x * x + c * x * x
}

// 貼圖只做一次（StrictMode 會掛載兩次，也不重做）
let TEX: ReturnType<typeof makeTextures> | null = null
function textures() {
  return (TEX ??= makeTextures())
}
function makeTextures() {
  const halo = canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(143,244,255,1)')
    g.addColorStop(0.35, 'rgba(143,244,255,0.42)')
    g.addColorStop(1, 'rgba(143,244,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
  return {
    grandmaIdle: svgTexture(grandmaSvg('idle'), GRANDMA_SIZE.w, GRANDMA_SIZE.h, 3),
    grandmaReach: svgTexture(grandmaSvg('reach'), GRANDMA_SIZE.w, GRANDMA_SIZE.h, 3),
    guestAwake: svgTexture(guestSvg('awake'), GUEST_SIZE.w, GUEST_SIZE.h, 3),
    guestScared: svgTexture(guestSvg('scared'), GUEST_SIZE.w, GUEST_SIZE.h, 3),
    guestSleep: svgTexture(guestSleepSvg(), SLEEP_SIZE.w, SLEEP_SIZE.h, 3),
    burst: svgTexture(burstSvg(), BURST_SIZE.w, BURST_SIZE.h, 3),
    z: svgTexture(zSvg(), Z_SIZE.w, Z_SIZE.h, 3),
    halo,
  }
}

// ---------------------------------------------------------------------------
// 阿嬤：半透明、發青白光、飄著、穿牆（她是鬼，不用找路）
// ---------------------------------------------------------------------------

const GM_H = 1.75
const GM_W = (GM_H * GRANDMA_SIZE.w) / GRANDMA_SIZE.h

export function Grandma() {
  const tex = textures()
  const group = useRef<THREE.Group>(null)
  const body = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const light = useRef<THREE.PointLight>(null)
  const floorY = useRef(FLOOR_Y)
  const lean = useRef(0)

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const s = useStore.getState()
    const time = clock.elapsedTime
    // 地板高度平滑跟上（從埕飄上台基不會跳一下）
    const f = SCENES[s.scene].floorAt(player.x, player.z)
    floorY.current += (f - floorY.current) * (1 - Math.exp(-8 * dt))
    const moving = Math.min(1, player.speed / 2.5)
    const bob = Math.sin(time * (2.2 + moving * 4)) * (0.06 + moving * 0.03)
    group.current?.position.set(player.x, floorY.current + 0.15 + bob, player.z)

    if (body.current) {
      // 轉身時 scale.x 從一邊翻到另一邊，會有一下變薄的「轉身」感
      const sx = body.current.scale.x
      body.current.scale.x = sx + (player.facing - sx) * (1 - Math.pow(0.0005, dt))
      // 往前飄時身體微微前傾
      lean.current += (-player.facing * moving * 0.12 - lean.current) * (1 - Math.exp(-6 * dt))
      body.current.rotation.z = Math.sin(time * 1.3) * 0.025 + lean.current
    }
    if (mat.current) mat.current.map = s.busy ? tex.grandmaReach : tex.grandmaIdle
    if (light.current) light.current.intensity = 2.6 + Math.sin(time * 3.1) * 0.5 + s.warm * 3
  })

  return (
    <group ref={group}>
      <Billboard position={[0, GM_H / 2, 0]}>
        <mesh ref={body} renderOrder={2}>
          <planeGeometry args={[GM_W, GM_H]} />
          <meshBasicMaterial ref={mat} map={tex.grandmaIdle} transparent opacity={0.92} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </Billboard>
      <sprite scale={[2.8, 2.8, 1]} position={[0, 0.95, -0.02]} renderOrder={1}>
        <spriteMaterial map={tex.halo} transparent opacity={0.32} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <pointLight ref={light} color="#8ff4ff" intensity={2.6} distance={4.5} decay={2} position={[0, 1.1, 0]} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 小美：床上的立繪、睡著的頭、花布被子、房間的燈
// ---------------------------------------------------------------------------

const GU_W = 0.95
const GU_H = (GU_W * GUEST_SIZE.h) / GUEST_SIZE.w
const GU_POS: [number, number, number] = [BED.x, BED.topY + 0.62, PILLOW_Z + 0.35]

const SLEEP_W = 0.56
const SLEEP_H = (SLEEP_W * SLEEP_SIZE.h) / SLEEP_SIZE.w

const Q = {
  halfTop: (BED.w + 0.12) / 2, // 被面平的部分
  drop: 0.24, // 兩側垂下來的長度
  footDrop: 0.2, // 床尾垂下來的長度
  corner: 0.07,
  baseY: BED.topY + 0.055,
  zFoot: BED.z + BED.l / 2 + 0.05,
  zUntucked: BED.z - 0.35,
  zTucked: PILLOW_Z + 0.22,
  tile: 0.6, // 一格花布在世界裡多大
  nx: 22,
  nz: 30,
}

/** 截面：沿著「垂下─圓角─平面─圓角─垂下」這條路徑，t∈[0,1] 回傳 [x, y 偏移, 弧長] */
function makeProfile(half: number, drop: number, r: number) {
  const flat = 2 * (half - r)
  const arc = (Math.PI / 2) * r
  const total = drop + arc + flat + arc + drop
  return {
    total,
    at(t: number): [number, number] {
      let s = t * total
      if (s < drop) return [-half, -r - (drop - s)]
      s -= drop
      if (s < arc) {
        const a = Math.PI - (s / arc) * (Math.PI / 2)
        return [-(half - r) + Math.cos(a) * r, -r + Math.sin(a) * r]
      }
      s -= arc
      if (s < flat) return [-(half - r) + s, 0]
      s -= flat
      if (s < arc) {
        const a = Math.PI / 2 - (s / arc) * (Math.PI / 2)
        return [half - r + Math.cos(a) * r, -r + Math.sin(a) * r]
      }
      s -= arc
      return [half, -r - s]
    },
  }
}

const SIDE = makeProfile(Q.halfTop, Q.drop, Q.corner)

function Quilt() {
  const tex = useMemo(() => floralFabricTexture(), [])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const n = (Q.nx + 1) * (Q.nz + 1)
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    const idx: number[] = []
    for (let j = 0; j < Q.nz; j++) {
      for (let i = 0; i < Q.nx; i++) {
        const a = j * (Q.nx + 1) + i
        const b = a + 1
        const c = a + Q.nx + 1
        const d = c + 1
        idx.push(a, c, b, b, c, d)
      }
    }
    g.setIndex(idx)
    return g
  }, [])
  const hem = useRef<THREE.Mesh>(null)
  const torso = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const s = useStore.getState()
    const g = s.guest
    const now = performance.now()
    const since = (now - s.tuckAt) / 1000
    const time = clock.elapsedTime

    // 被子上緣：蓋被子時 0.8 秒拉上來
    let zTop = Q.zUntucked
    if (g.sleepDepth >= 1) {
      const k = g.sleepDepth === 1 ? ease(THREE.MathUtils.clamp(since / 0.8, 0, 1)) : 1
      zTop = THREE.MathUtils.lerp(Q.zUntucked, Q.zTucked, k)
    }
    // 再蓋一次：被子輕輕拍兩下
    const pat = g.sleepDepth >= 2 && since < 0.7 ? Math.sin(since * 22) * (1 - since / 0.7) * 0.025 : 0

    const asleep = g.state === 'asleep'
    const breath = 1 + Math.sin(time * 1.35) * 0.07
    const flatLen = Q.zFoot - zTop
    const footArc = (Math.PI / 2) * Q.corner
    const lenTotal = flatLen + footArc + Q.footDrop

    const pos = geo.attributes.position as THREE.BufferAttribute
    const uv = geo.attributes.uv as THREE.BufferAttribute
    for (let j = 0; j <= Q.nz; j++) {
      // 沿長度：平的一段 → 床尾圓角 → 垂下
      const sLen = (j / Q.nz) * lenTotal
      let z: number
      let yLen: number
      if (sLen <= flatLen) {
        z = zTop + sLen
        yLen = 0
      } else if (sLen <= flatLen + footArc) {
        const a = ((sLen - flatLen) / footArc) * (Math.PI / 2)
        z = Q.zFoot + Math.sin(a) * Q.corner
        yLen = -Q.corner + Math.cos(a) * Q.corner
      } else {
        z = Q.zFoot + Q.corner
        yLen = -Q.corner - (sLen - flatLen - footArc)
      }
      for (let i = 0; i <= Q.nx; i++) {
        const t = i / Q.nx
        const [x, ySide] = SIDE.at(t)
        // 被面鼓鼓的
        const onTop = Math.max(0, 1 - Math.abs(x) / Q.halfTop)
        let y = Q.baseY + Math.min(ySide, yLen) + 0.035 * Math.sqrt(onTop) * (yLen === 0 ? 1 : 0.4)

        // 被子底下的身體
        const dz = z - PILLOW_Z
        if (asleep) {
          // 躺著：肩膀到腳一整條，胸口會呼吸
          const along = THREE.MathUtils.smoothstep(dz, 0.2, 0.42) * (1 - THREE.MathUtils.smoothstep(z, Q.zFoot - 0.2, Q.zFoot - 0.02))
          const chest = Math.exp(-Math.pow((dz - 0.6) / 0.35, 2))
          const amp = (0.13 + 0.07 * chest * breath) * along + 0.05 * Math.exp(-Math.pow((z - (Q.zFoot - 0.3)) / 0.12, 2))
          const sigma = 0.22 + 0.08 * chest
          y += amp * Math.exp(-(x * x) / (2 * sigma * sigma)) + pat * chest
        } else {
          // 坐著：屁股 + 兩條腿
          const legs = THREE.MathUtils.smoothstep(dz, 0.35, 0.55) * (1 - THREE.MathUtils.smoothstep(z, Q.zFoot - 0.25, Q.zFoot - 0.05))
          const hip = Math.exp(-Math.pow((dz - 0.45) / 0.22, 2)) * 0.12
          const leg = (xx: number) => Math.exp(-((x - xx) * (x - xx)) / (2 * 0.09 * 0.09))
          y += (leg(-0.15) + leg(0.15)) * 0.09 * legs + hip * Math.exp(-(x * x) / (2 * 0.3 * 0.3))
          y += 0.05 * Math.exp(-Math.pow((z - (Q.zFoot - 0.2)) / 0.1, 2)) * (leg(-0.15) + leg(0.15))
        }

        const k = j * (Q.nx + 1) + i
        pos.setXYZ(k, BED.x + x, y, z)
        // 花布跟著上緣走（拉被子時花樣會跟著移動）
        uv.setXY(k, (t * SIDE.total) / Q.tile, -sLen / Q.tile)
      }
    }
    pos.needsUpdate = true
    uv.needsUpdate = true
    geo.computeVertexNormals()
    geo.computeBoundingSphere()

    if (hem.current) hem.current.position.set(BED.x, Q.baseY + 0.03, zTop)
    if (torso.current) {
      // 睡著但被子沒蓋到胸口：露出帽 T
      torso.current.visible = asleep && zTop > PILLOW_Z + 0.35
      torso.current.scale.y = breath
    }
  })

  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial map={tex} roughness={0.92} side={THREE.DoubleSide} />
      </mesh>
      {/* 被子上緣的白色被套反摺 */}
      <mesh ref={hem} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.045, Q.halfTop * 2 - 0.08, 4, 10]} />
        <meshStandardMaterial color="#f4eee2" roughness={0.9} />
      </mesh>
      <mesh ref={torso} position={[BED.x, BED.topY + 0.08, PILLOW_Z + 0.42]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <capsuleGeometry args={[0.15, 0.3, 4, 12]} />
        <meshStandardMaterial color="#f4a3bd" roughness={0.9} />
      </mesh>
    </group>
  )
}

function Zzz() {
  const tex = textures()
  const refs = useRef<(THREE.Sprite | null)[]>([])
  useFrame(({ clock }) => {
    const s = useStore.getState()
    const k = 1 + Math.min(s.guest.sleepDepth, 3) * 0.25
    const t = clock.elapsedTime
    refs.current.forEach((sp, i) => {
      if (!sp) return
      const p = ((t + i * 0.8) % 2.4) / 2.4
      sp.position.set(BED.x + 0.25 + p * 0.28 + Math.sin(p * Math.PI * 2) * 0.06, BED.topY + 0.45 + p * 0.75, PILLOW_Z - 0.05)
      const size = (0.13 + p * 0.12) * k
      sp.scale.set(size, size, 1)
      ;(sp.material as THREE.SpriteMaterial).opacity = Math.sin(p * Math.PI) * 0.95
      ;(sp.material as THREE.SpriteMaterial).rotation = -0.2 + Math.sin(p * 4) * 0.12
    })
  })
  return (
    <>
      {[0, 1, 2].map((i) => (
        <sprite
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
        >
          <spriteMaterial map={tex.z} transparent depthWrite={false} />
        </sprite>
      ))}
    </>
  )
}

export function Guest() {
  const state = useStore((s) => s.guest.state)
  const tex = textures()

  const body = useRef<THREE.Group>(null)
  const burst = useRef<THREE.Sprite>(null)
  const roomLight = useRef<THREE.PointLight>(null)
  const phoneLight = useRef<THREE.PointLight>(null)

  useFrame(({ clock }) => {
    const s = useStore.getState()
    const since = (performance.now() - s.tuckAt) / 1000
    const scared = s.guest.state === 'scared'

    if (body.current) {
      // 嚇到跳起來
      body.current.position.y = scared && since < 0.6 ? Math.sin((since / 0.6) * Math.PI) * 0.55 : 0
    }
    if (burst.current) {
      const k = scared ? backOut(THREE.MathUtils.clamp(since / 0.35, 0, 1)) : 0
      const wob = 1 + Math.sin(clock.elapsedTime * 18) * 0.04
      burst.current.scale.set(0.6 * k * wob, 0.6 * k * wob, 1)
      ;(burst.current.material as THREE.SpriteMaterial).rotation = Math.sin(clock.elapsedTime * 11) * 0.12
      burst.current.position.y = BED.topY + 1.55 + (body.current?.position.y ?? 0)
    }
    if (roomLight.current) {
      const awake = s.guest.state !== 'asleep'
      let i = awake ? 6 : 1.2
      i += s.warm * 5
      if (s.flicker > 0 && Math.random() < s.flicker * 0.8) i *= 0.15 + Math.random() * 0.6
      roomLight.current.intensity = i
    }
    if (phoneLight.current) {
      phoneLight.current.intensity = s.guest.state === 'awake' ? 1.4 * (0.92 + Math.sin(clock.elapsedTime * 0.7) * 0.08) : 0
    }
  })

  const guestMap = state === 'scared' ? tex.guestScared : tex.guestAwake

  return (
    <group>
      <Quilt />

      {/* 醒著 / 嚇到：坐在床上 */}
      {state !== 'asleep' && (
        <group ref={body}>
          <Billboard position={GU_POS}>
            <mesh castShadow>
              <planeGeometry args={[GU_W, GU_H]} />
              <meshStandardMaterial
                map={guestMap}
                emissiveMap={guestMap}
                emissive="#4d4d4d"
                transparent
                alphaTest={0.4}
                roughness={0.9}
                side={THREE.DoubleSide}
              />
            </mesh>
          </Billboard>
        </group>
      )}
      <sprite ref={burst} position={[BED.x + 0.38, BED.topY + 1.55, PILLOW_Z + 0.35]} scale={[0, 0, 1]} visible={state === 'scared'} renderOrder={3}>
        <spriteMaterial map={tex.burst} transparent depthWrite={false} />
      </sprite>

      {/* 睡著：頭躺在枕頭上 + zzz */}
      {state === 'asleep' && (
        <>
          <mesh position={[BED.x, BED.topY + 0.25, PILLOW_Z + 0.02]} rotation={[-Math.PI / 2 + 0.45, 0, 0]}>
            <planeGeometry args={[SLEEP_W, SLEEP_H]} />
            <meshStandardMaterial map={tex.guestSleep} emissiveMap={tex.guestSleep} emissive="#404040" transparent alphaTest={0.4} roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
          <Zzz />
        </>
      )}

      {/* 房間的燈、手機的藍光 */}
      <pointLight ref={roomLight} position={[BED.x - 0.3, FLOOR_Y + 2.35, BED.z - 0.2]} color="#ffbe6e" intensity={6} distance={7.5} decay={2} />
      <pointLight ref={phoneLight} position={[BED.x, BED.topY + 0.5, PILLOW_Z + 0.75]} color="#7fa8ff" intensity={1.4} distance={2.6} decay={2} />
    </group>
  )
}
