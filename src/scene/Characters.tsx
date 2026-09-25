import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { player } from '../world/player'
import { SCENES } from '../world/scenes'
import { BED, FLOOR_Y, PILLOW_Z } from './layout'
import { canvasTexture, svgTexture } from './kit'
import { BURST_SIZE, Z_SIZE, burstSvg, zSvg } from '../art/characters'
import { floralFabricTexture } from '../art/fabric'
import { Chibi, R as HEAD_R, SEAT_Y, TOP_Y, newDrive } from '../chars/Chibi'
import { SPECS } from '../chars/specs'

// 人物：3D Q 版角色（src/chars/）。阿嬤是鬼：半透明、發光、沒有影子。
// 小美坐在床上、嚇到會跳起來、睡著時頭躺在枕頭上；花布被子與房間燈光也在這裡。

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
    burst: svgTexture(burstSvg(), BURST_SIZE.w, BURST_SIZE.h, 3),
    z: svgTexture(zSvg(), Z_SIZE.w, Z_SIZE.h, 3),
    halo,
  }
}

// ---------------------------------------------------------------------------
// 阿嬤：半透明、發青白光、飄著、沒有影子
// ---------------------------------------------------------------------------

export function Grandma() {
  const tex = textures()
  const quality = useStore((s) => s.quality)
  const group = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const floorY = useRef(FLOOR_Y)
  const drive = useRef(newDrive({ pose: 'clasp', heading: 0.7 }))

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const s = useStore.getState()
    const time = clock.elapsedTime
    // 地板高度平滑跟上（從埕飄上台基不會跳一下）
    const f = SCENES[s.scene].floorAt(player.x, player.z)
    floorY.current += (f - floorY.current) * (1 - Math.exp(-8 * dt))
    const moving = Math.min(1, player.speed / 2.5)
    const bob = Math.sin(time * (2.2 + moving * 3)) * 0.05
    group.current?.position.set(player.x, floorY.current + 0.18 + bob, player.z)

    const d = drive.current
    d.speed = player.speed
    if (Math.hypot(player.vx, player.vz) > 0.25) d.heading = Math.atan2(player.vx, player.vz)
    d.pose = s.busy ? 'reach' : 'clasp'
    d.expr = s.busy ? 'reach' : 'normal'
    if (light.current) light.current.intensity = 2.6 + Math.sin(time * 3.1) * 0.5 + s.warm * 3
  }, -2)

  return (
    <group ref={group}>
      <Chibi spec={SPECS.grandma} drive={drive} outline={quality === 'high'} />
      <sprite scale={[2.1, 2.1, 1]} position={[0, 0.55, 0]} renderOrder={1}>
        <spriteMaterial map={tex.halo} transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      {/* 照亮周圍的青白光：放在頭上後方，不要直接打在她臉上 */}
      <pointLight ref={light} color="#8ff4ff" intensity={2.6} distance={4.5} decay={2} position={[0, 1.9, -0.35]} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 小美：床上的立繪、睡著的頭、花布被子、房間的燈
// ---------------------------------------------------------------------------

const MEI = SPECS.xiaomei
/** 坐在床上：屁股貼在床墊上 */
const MEI_POS: [number, number, number] = [BED.x, BED.topY - SEAT_Y * MEI.scale + 0.03, PILLOW_Z + 0.3]
const MEI_TOP = BED.topY + (TOP_Y - SEAT_Y) * MEI.scale

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
  const quality = useStore((s) => s.quality)
  const tex = textures()
  const drive = useRef(newDrive({ pose: 'phone', expr: 'awake', heading: 0.5 }))
  const sleepDrive = useRef(newDrive({ expr: 'asleep' }))

  const body = useRef<THREE.Group>(null)
  const burst = useRef<THREE.Sprite>(null)
  const roomLight = useRef<THREE.PointLight>(null)
  const phoneLight = useRef<THREE.PointLight>(null)

  useFrame(({ clock }) => {
    const s = useStore.getState()
    const since = (performance.now() - s.tuckAt) / 1000
    const scared = s.guest.state === 'scared'

    // 嚇到跳起來
    const hop = scared && since < 0.6 ? Math.sin((since / 0.6) * Math.PI) * 0.45 : 0
    const d = drive.current
    d.hop = hop
    d.pose = scared ? 'scared' : 'phone'
    d.expr = scared ? 'scared' : 'awake'
    if (burst.current) {
      const k = scared ? backOut(THREE.MathUtils.clamp(since / 0.35, 0, 1)) : 0
      const wob = 1 + Math.sin(clock.elapsedTime * 18) * 0.04
      burst.current.scale.set(0.6 * k * wob, 0.6 * k * wob, 1)
      ;(burst.current.material as THREE.SpriteMaterial).rotation = Math.sin(clock.elapsedTime * 11) * 0.12
      burst.current.position.y = MEI_TOP + 0.3 + hop
    }
    if (roomLight.current) {
      const awake = s.guest.state !== 'asleep'
      // 3D 角色的卡通材質對近距離的點光很敏感，燈不能太亮（頭會爆白）
      let i = awake ? 2.6 : 0.7
      i += s.warm * 2.5
      if (s.flicker > 0 && Math.random() < s.flicker * 0.8) i *= 0.15 + Math.random() * 0.6
      roomLight.current.intensity = i
    }
    if (phoneLight.current) {
      phoneLight.current.intensity = s.guest.state === 'awake' ? 0.35 * (0.92 + Math.sin(clock.elapsedTime * 0.7) * 0.08) : 0
    }
  })

  return (
    <group>
      <Quilt />

      {/* 醒著 / 嚇到：坐在床上 */}
      {state !== 'asleep' && (
        <group ref={body} position={MEI_POS} userData={{ noMerge: true }}>
          <Chibi spec={MEI} drive={drive} legs={false} outline={quality === 'high'} />
        </group>
      )}
      <sprite ref={burst} position={[BED.x + 0.32, MEI_TOP + 0.3, PILLOW_Z + 0.3]} scale={[0, 0, 1]} visible={state === 'scared'} renderOrder={3}>
        <spriteMaterial map={tex.burst} transparent depthWrite={false} />
      </sprite>

      {/* 睡著：頭躺在枕頭上 + zzz */}
      {state === 'asleep' && (
        <>
          {/* 頭躺在枕頭上，臉朝上（稍微轉向鏡頭） */}
          <group position={[BED.x, BED.topY + 0.13 + HEAD_R * MEI.scale * 0.7, PILLOW_Z + 0.02]} rotation={[-Math.PI / 2 + 0.35, 0, 0]} userData={{ noMerge: true }}>
            <Chibi spec={MEI} drive={sleepDrive} headOnly outline={quality === 'high'} />
          </group>
          <Zzz />
        </>
      )}

      {/* 房間的燈、手機的藍光 */}
      <pointLight ref={roomLight} position={[BED.x - 0.3, FLOOR_Y + 2.35, BED.z - 0.2]} color="#ffbe6e" intensity={6} distance={7.5} decay={2} />
      <pointLight ref={phoneLight} position={[BED.x, BED.topY + 0.45, PILLOW_Z + 0.85]} color="#7fa8ff" intensity={0.35} distance={1.8} decay={2} />
    </group>
  )
}
