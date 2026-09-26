import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { audio } from '../audio'
import { GUEST_ROOMS, type GuestRoomDef } from './layout'
import { canvasTexture, svgTexture } from './kit'
import { Chibi, R as HEAD_R, SEAT_Y, TOP_Y, newDrive, type Drive, type PoseName } from '../chars/Chibi'
import { SPECS } from '../chars/specs'
import { BURST_SIZE, Z_SIZE, burstSvg, zSvg } from '../art/characters'
import { floralFabricTexture } from '../art/fabric'
import { night } from '../world/night/director'
import { SIGHT_HALF, SIGHT_RANGE, clearLine, type GuestRT } from '../world/night/sim'
import { NEED_INFO } from '../world/night/guests'
import { HOME } from '../world/scenes'
import { player } from '../world/player'
import { Cat, newCatDrive, type CatDrive } from '../chars/Cat'
import { Dog, newDogDrive, type DogDrive } from '../chars/Dog'
import { Gecko, newGeckoDrive, type GeckoDrive } from '../chars/Gecko'
import { turnToward, type TurnState } from '../world/motion'
import type { RoomId } from '../world/night/types'

// 深夜的客人（DESIGN §5、§21）：床上坐著／睡著、下床走動；視線扇形、懷疑的「？」、需求泡泡、zzz。
// 廟公（手電筒）與狗也畫在這裡。資料都從 night.sim 每幀讀。

const ease = (k: number) => 1 - Math.pow(1 - k, 3)
const backOut = (k: number) => {
  const c = 1.70158
  const x = k - 1
  return 1 + (c + 1) * x * x * x + c * x * x
}

let TEX: ReturnType<typeof makeTextures> | null = null
function textures() {
  return (TEX ??= makeTextures())
}
function makeTextures() {
  const mark = (ch: string, color: string) =>
    canvasTexture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = color
      ctx.strokeStyle = '#3b2a2a'
      ctx.lineWidth = 8
      ctx.beginPath()
      ctx.arc(w / 2, h / 2, 50, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#3b2a2a'
      ctx.font = '900 80px "Noto Sans TC", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(ch, w / 2, h / 2 + 6)
    })
  return {
    burst: svgTexture(burstSvg(), BURST_SIZE.w, BURST_SIZE.h, 3),
    z: svgTexture(zSvg(), Z_SIZE.w, Z_SIZE.h, 3),
    question: mark('?', '#ffe08a'),
  }
}

const bubbleCache = new Map<string, THREE.CanvasTexture>()
/** 想法泡泡：白色雲朵 + 圖示 */
function bubbleTexture(icon: string) {
  let t = bubbleCache.get(icon)
  if (!t) {
    t = canvasTexture(160, 150, (ctx) => {
      ctx.fillStyle = '#fffaf0'
      ctx.strokeStyle = '#3b2a2a'
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.ellipse(80, 64, 62, 52, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      for (const [x, y, r] of [
        [44, 122, 12],
        [30, 140, 7],
      ]) {
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
      ctx.font = '64px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(icon, 80, 68)
    })
    bubbleCache.set(icon, t)
  }
  return t
}

/** 床上坐著時做的事（依客人類型） */
function bedPose(g: GuestRT): PoseName {
  if (g.scaredT > 0) return 'scared'
  switch (g.def.type) {
    case 'business':
      return 'laptop'
    case 'thrill':
      return 'film'
    case 'child':
      return g.needs.some((n) => n.kind === 'play') ? 'wave' : 'sit'
    case 'elder':
    case 'parent':
      return 'sit'
    default:
      return 'phone'
  }
}

function expr(g: GuestRT) {
  if (g.scaredT > 0) return 'scared'
  if (!g.awake) return 'asleep'
  if (g.def.seesGhost && Math.hypot(player.x - g.x, player.z - g.z) < 3) return 'happy'
  return 'awake'
}

export function Guests() {
  const phase = useStore((s) => s.phase)
  const night1 = useStore((s) => s.meta.night)
  const quality = useStore((s) => s.quality)
  // 只有深夜畫；客人組合依晚上不同
  const sim = phase === 'night' ? night.sim : null
  const key = sim ? sim.guests.map((g) => g.id).join(',') + night1 : 'none'
  if (!sim) return null
  const rooms = (['r1', 'r2'] as RoomId[]).filter((r) => sim.guests.some((g) => g.room === r))
  return (
    <group key={key} userData={{ noMerge: true }}>
      {rooms.map((r) => (
        <GuestRoom key={r} room={GUEST_ROOMS[r]} guests={sim.guests.filter((g) => g.room === r)} outline={quality === 'high'} />
      ))}
      {sim.miaogong && <Miaogong outline={quality === 'high'} />}
      {sim.dog && <DogActor outline={quality === 'high'} />}
      <CatActor outline={quality === 'high'} />
      <GeckoActor outline={quality === 'high'} />
      {sim.event === 'blackout' && <Storm />}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 一間客房：被子、燈、房客
// ---------------------------------------------------------------------------

function GuestRoom({ room, guests, outline }: { room: GuestRoomDef; guests: GuestRT[]; outline: boolean }) {
  const light = useRef<THREE.PointLight>(null)
  useFrame(() => {
    const lit = useStore.getState().roomLit[room.id]
    if (light.current) light.current.intensity = 0.25 + lit * 2.4
  })
  return (
    <group>
      <Quilt room={room} guests={guests} />
      {guests.map((g) => (
        <GuestFigure key={g.id} g={g} room={room} count={guests.length} outline={outline} />
      ))}
      <pointLight ref={light} position={[room.lamp[0], room.bed.topY + 1.85, room.lamp[1]]} color="#ffbe6e" intensity={2.6} distance={7.5} decay={2} />
    </group>
  )
}

function GuestFigure({ g, room, count, outline }: { g: GuestRT; room: GuestRoomDef; count: number; outline: boolean }) {
  const tex = textures()
  const spec = SPECS[g.id]
  const drive = useRef<Drive>(newDrive({ pose: 'sit', expr: 'awake', heading: 0.5 }))
  const sleepDrive = useRef<Drive>(newDrive({ expr: 'asleep' }))
  const sitting = useRef<THREE.Group>(null)
  const walking = useRef<THREE.Group>(null)
  const lying = useRef<THREE.Group>(null)
  const burst = useRef<THREE.Sprite>(null)
  const question = useRef<THREE.Sprite>(null)
  const bubbles = useRef<(THREE.Sprite | null)[]>([])
  const zzz = useRef<(THREE.Sprite | null)[]>([])
  const cone = useRef<THREE.Mesh>(null)
  const coneMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffe7a0', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, vertexColors: true, toneMapped: false }), [])
  const coneGeo = useMemo(() => makeFan(CONE_RAYS), [])
  const scale = spec.scale
  const off = count > 1 ? (g.slot === 0 ? -0.33 : 0.33) : 0
  const sitPos: [number, number, number] = [room.bed.x + off, room.bed.topY - SEAT_Y * scale + 0.03, room.pillowZ + 0.3]
  const headTop = room.bed.topY + (TOP_Y - SEAT_Y) * scale
  const scaredAt = useRef(0)
  const wasScared = useRef(false)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const inBed = g.mode === 'bed'
    const d = drive.current
    d.expr = expr(g)
    const scared = g.scaredT > 0
    if (scared && !wasScared.current) scaredAt.current = t
    wasScared.current = scared
    const since = t - scaredAt.current
    d.hop = scared && since < 0.6 ? Math.sin((since / 0.6) * Math.PI) * 0.4 : 0

    if (sitting.current) sitting.current.visible = inBed && g.awake
    if (lying.current) lying.current.visible = inBed && !g.awake
    if (walking.current) walking.current.visible = !inBed
    if (inBed) {
      d.pose = bedPose(g)
      d.speed = 0
      d.heading = g.heading
      if (g.def.seesGhost && Math.hypot(player.x - g.x, player.z - g.z) < 3.5) d.heading = Math.atan2(player.x - g.x, player.z - g.z)
    } else {
      d.pose = g.scaredT > 0 ? 'scared' : g.filming || g.def.patrol ? 'film' : 'idle'
      d.speed = g.speed
      d.heading = g.heading
      walking.current?.position.set(g.x, HOME.floorAt(g.x, g.z), g.z)
    }
    const head: [number, number, number] = inBed ? [sitPos[0], headTop + 0.15, sitPos[2]] : [g.x, HOME.floorAt(g.x, g.z) + TOP_Y * scale + 0.15, g.z]
    if (!g.awake && inBed) {
      head[1] = room.bed.topY + 0.4
      head[2] = room.pillowZ
    }

    // 嚇到的「！」
    if (burst.current) {
      const k = scared ? backOut(THREE.MathUtils.clamp(since / 0.35, 0, 1)) : 0
      burst.current.visible = k > 0.01
      burst.current.scale.setScalar(0.55 * k)
      burst.current.position.set(head[0] + 0.25, head[1] + 0.3 + d.hop, head[2])
    }
    // 懷疑的「？」：越懷疑越大
    if (question.current) {
      const q = g.def.seesGhost ? 0 : g.suspicion
      const show = g.awake && !scared && q > 0.12
      question.current.visible = show
      if (show) {
        const pulse = 1 + Math.sin(t * (6 + q * 10)) * 0.08 * q
        question.current.scale.setScalar((0.2 + q * 0.35) * pulse)
        question.current.position.set(head[0], head[1] + 0.3, head[2])
        ;(question.current.material as THREE.SpriteMaterial).color.setRGB(1, 1 - q * 0.6, 1 - q * 0.8)
      }
    }
    // 需求泡泡（觀察過才看得到）
    const known = g.needs.filter((n) => n.known)
    bubbles.current.forEach((b, i) => {
      if (!b) return
      const n = known[i]
      b.visible = !!n && !scared
      if (!n) return
      const m = b.material as THREE.SpriteMaterial
      const tx = bubbleTexture(NEED_INFO[n.kind].icon)
      if (m.map !== tx) {
        m.map = tx
        m.needsUpdate = true
      }
      const bob = Math.sin(t * 2 + i) * 0.04
      b.position.set(head[0] - 0.35 - i * 0.42, head[1] + 0.45 + bob, head[2])
    })
    // zzz
    zzz.current.forEach((sp, i) => {
      if (!sp) return
      sp.visible = inBed && !g.awake
      if (!sp.visible) return
      const p = ((t + i * 0.8 + g.slot * 0.4) % 2.4) / 2.4
      sp.position.set(sitPos[0] + 0.2 + p * 0.25, room.bed.topY + 0.4 + p * 0.7, room.pillowZ - 0.05)
      const size = (0.12 + p * 0.1) * (1 + g.sleep * 0.4)
      sp.scale.set(size, size, 1)
      ;(sp.material as THREE.SpriteMaterial).opacity = Math.sin(p * Math.PI) * 0.9
    })
    // 視線扇形（看不到鬼的人才畫，阿嬤在附近才畫）
    if (cone.current) {
      const near = Math.hypot(player.x - g.x, player.z - g.z) < 11
      const show = g.awake && !g.def.seesGhost && near && useStore.getState().scene === 'home'
      cone.current.visible = show
      if (show) {
        const pos: [number, number] = inBed ? [sitPos[0], sitPos[2]] : [g.x, g.z]
        cone.current.position.set(0, HOME.floorAt(pos[0], pos[1]) + 0.03, 0)
        // 用模擬的 heading：畫出來的就是真正看得到的範圍（被牆擋住的地方不畫）
        updateFan(coneGeo, g.x, g.z, g.heading)
        const q = g.suspicion
        coneMat.color.setRGB(0.85, 0.8 - q * 0.6, 0.5 - q * 0.45)
        // 要轉頭了（「嗯？」）：扇形閃一下，提醒玩家停下來
        coneMat.opacity = 0.16 + q * 0.3 + (g.tellT > 0 ? 0.14 + Math.sin(t * 30) * 0.07 : 0)
      }
    }
  })

  return (
    <group>
      <group ref={sitting} position={sitPos}>
        <Chibi spec={spec} drive={drive} legs={false} outline={outline} />
      </group>
      <group ref={walking} visible={false}>
        <Chibi spec={spec} drive={drive} outline={outline} />
      </group>
      <group ref={lying} position={[room.bed.x + off, room.bed.topY + 0.13 + HEAD_R * scale * 0.7, room.pillowZ + 0.02]} rotation={[-Math.PI / 2 + 0.35, 0, 0]} visible={false}>
        <Chibi spec={spec} drive={sleepDrive} headOnly outline={outline} />
      </group>
      <sprite ref={burst} visible={false} renderOrder={3}>
        <spriteMaterial map={tex.burst} transparent depthWrite={false} depthTest={false} />
      </sprite>
      <sprite ref={question} visible={false} renderOrder={3}>
        <spriteMaterial map={tex.question} transparent depthWrite={false} depthTest={false} />
      </sprite>
      {[0, 1, 2].map((i) => (
        <sprite
          key={`b${i}`}
          ref={(el) => {
            bubbles.current[i] = el
          }}
          scale={[0.42, 0.39, 1]}
          visible={false}
          renderOrder={3}
        >
          <spriteMaterial transparent depthWrite={false} depthTest={false} />
        </sprite>
      ))}
      {[0, 1, 2].map((i) => (
        <sprite
          key={`z${i}`}
          ref={(el) => {
            zzz.current[i] = el
          }}
          visible={false}
        >
          <spriteMaterial map={tex.z} transparent depthWrite={false} />
        </sprite>
      ))}
      <mesh ref={cone} geometry={coneGeo} material={coneMat} visible={false} renderOrder={1} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 視線扇形：從客人往外打 N 條射線，碰到牆就停（跟 NightSim.canSee 一樣的規則）
// ---------------------------------------------------------------------------

const CONE_RAYS = 26

function makeFan(n: number) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((n + 2) * 3), 3))
  // 中間實、邊緣透明（RGBA 頂點色）
  const col = new Float32Array((n + 2) * 4)
  for (let i = 0; i < n + 2; i++) col.set(i === 0 ? [1, 1, 1, 1] : [1, 1, 1, 0], i * 4)
  g.setAttribute('color', new THREE.BufferAttribute(col, 4))
  const idx: number[] = []
  for (let i = 1; i <= n; i++) idx.push(0, i, i + 1)
  g.setIndex(idx)
  return g
}

function rayLength(x: number, z: number, dx: number, dz: number) {
  if (clearLine(x, z, x + dx * SIGHT_RANGE, z + dz * SIGHT_RANGE)) return SIGHT_RANGE
  let lo = 0
  let hi = SIGHT_RANGE
  for (let k = 0; k < 7; k++) {
    const mid = (lo + hi) / 2
    if (clearLine(x, z, x + dx * mid, z + dz * mid)) lo = mid
    else hi = mid
  }
  return lo
}

function updateFan(geo: THREE.BufferGeometry, x: number, z: number, heading: number) {
  const pos = geo.attributes.position as THREE.BufferAttribute
  const col = geo.attributes.color as THREE.BufferAttribute
  pos.setXYZ(0, x, 0, z)
  for (let i = 0; i <= CONE_RAYS; i++) {
    const a = heading - SIGHT_HALF + (i / CONE_RAYS) * SIGHT_HALF * 2
    const dx = Math.sin(a)
    const dz = Math.cos(a)
    const r = rayLength(x, z, dx, dz)
    pos.setXYZ(i + 1, x + dx * r, 0, z + dz * r)
    // 越遠越淡（被牆擋短的射線，末端還看得到）
    col.setW(i + 1, 1 - (r / SIGHT_RANGE) * 0.9)
  }
  pos.needsUpdate = true
  col.needsUpdate = true
  geo.computeBoundingSphere()
}

// ---------------------------------------------------------------------------
// 被子：任何一張床都能用；雙人床底下有兩個人
// ---------------------------------------------------------------------------

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

const NX = 22
const NZ = 30

function Quilt({ room, guests }: { room: GuestRoomDef; guests: GuestRT[] }) {
  const tex = useMemo(() => floralFabricTexture(), [])
  const bed = room.bed
  const Q = useMemo(
    () => ({
      halfTop: (bed.w + 0.12) / 2,
      drop: 0.24,
      footDrop: 0.2,
      corner: 0.07,
      baseY: bed.topY + 0.055,
      zFoot: bed.z + bed.l / 2 + 0.05,
      zUntucked: bed.z - 0.35,
      zTucked: room.pillowZ + 0.22,
      tile: 0.6,
    }),
    [bed, room.pillowZ],
  )
  const side = useMemo(() => makeProfile(Q.halfTop, Q.drop, Q.corner), [Q])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const n = (NX + 1) * (NZ + 1)
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    const idx: number[] = []
    for (let j = 0; j < NZ; j++)
      for (let i = 0; i < NX; i++) {
        const a = j * (NX + 1) + i
        const b = a + 1
        const c = a + NX + 1
        const d = c + 1
        idx.push(a, c, b, b, c, d)
      }
    g.setIndex(idx)
    return g
  }, [])
  const hem = useRef<THREE.Mesh>(null)
  const tuckK = useRef(0)
  const count = guests.length

  useFrame(({ clock }, dt) => {
    const time = clock.elapsedTime
    const tucked = guests.some((g) => g.tucked)
    tuckK.current = Math.min(1, tuckK.current + (tucked ? dt / 0.8 : 0))
    const zTop = THREE.MathUtils.lerp(Q.zUntucked, Q.zTucked, ease(tuckK.current))
    const breath = 1 + Math.sin(time * 1.35) * 0.07
    const flatLen = Q.zFoot - zTop
    const footArc = (Math.PI / 2) * Q.corner
    const lenTotal = flatLen + footArc + Q.footDrop
    const bodies = guests
      .filter((g) => g.mode === 'bed')
      .map((g) => ({ x: count > 1 ? (g.slot === 0 ? -0.33 : 0.33) : 0, asleep: !g.awake, small: g.def.type === 'child' }))
    const pos = geo.attributes.position as THREE.BufferAttribute
    const uv = geo.attributes.uv as THREE.BufferAttribute
    for (let j = 0; j <= NZ; j++) {
      const sLen = (j / NZ) * lenTotal
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
      for (let i = 0; i <= NX; i++) {
        const t = i / NX
        const [x, ySide] = side.at(t)
        const onTop = Math.max(0, 1 - Math.abs(x) / Q.halfTop)
        let y = Q.baseY + Math.min(ySide, yLen) + 0.035 * Math.sqrt(onTop) * (yLen === 0 ? 1 : 0.4)
        const dz = z - room.pillowZ
        for (const b of bodies) {
          const bx = x - b.x
          const k = b.small ? 0.7 : 1
          if (b.asleep) {
            const along = THREE.MathUtils.smoothstep(dz, 0.2, 0.42) * (1 - THREE.MathUtils.smoothstep(z, Q.zFoot - 0.2 - (b.small ? 0.5 : 0), Q.zFoot - 0.02 - (b.small ? 0.5 : 0)))
            const chest = Math.exp(-Math.pow((dz - 0.6) / 0.35, 2))
            const amp = ((0.13 + 0.07 * chest * breath) * along) * k
            const sigma = (count > 1 ? 0.16 : 0.22) + 0.06 * chest
            y += amp * Math.exp(-(bx * bx) / (2 * sigma * sigma))
          } else {
            const legs = THREE.MathUtils.smoothstep(dz, 0.35, 0.55) * (1 - THREE.MathUtils.smoothstep(z, Q.zFoot - 0.25 - (b.small ? 0.45 : 0), Q.zFoot - 0.05 - (b.small ? 0.45 : 0)))
            const hip = Math.exp(-Math.pow((dz - 0.45) / 0.22, 2)) * 0.12
            const leg = (xx: number) => Math.exp(-((bx - xx) * (bx - xx)) / (2 * 0.08 * 0.08))
            y += ((leg(-0.12) + leg(0.12)) * 0.08 * legs + hip * Math.exp(-(bx * bx) / (2 * 0.22 * 0.22))) * k
          }
        }
        const kk = j * (NX + 1) + i
        pos.setXYZ(kk, bed.x + x, y, z)
        uv.setXY(kk, (t * side.total) / Q.tile, -sLen / Q.tile)
      }
    }
    pos.needsUpdate = true
    uv.needsUpdate = true
    geo.computeVertexNormals()
    geo.computeBoundingSphere()
    if (hem.current) hem.current.position.set(bed.x, Q.baseY + 0.03, zTop)
  })

  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial map={tex} roughness={0.92} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={hem} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.045, Q.halfTop * 2 - 0.08, 4, 10]} />
        <meshStandardMaterial color="#f4eee2" roughness={0.9} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 廟公巡夜：拿手電筒
// ---------------------------------------------------------------------------

function Miaogong({ outline }: { outline: boolean }) {
  const group = useRef<THREE.Group>(null)
  const drive = useRef<Drive>(newDrive({ pose: 'flashlight', heading: 0 }))
  const spot = useRef<THREE.SpotLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  const cone = useRef<THREE.Mesh>(null)
  const coneMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff0b0', transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }), [])
  const coneGeo = useMemo(() => new THREE.CircleGeometry(7.5, 24, -Math.PI / 2 - 0.73, 1.46).rotateX(-Math.PI / 2), [])
  useFrame(() => {
    const m = night.sim?.miaogong
    const g = group.current
    if (!g) return
    g.visible = !!m?.active
    if (!m?.active) return
    g.position.set(m.x, HOME.floorAt(m.x, m.z), m.z)
    drive.current.heading = m.heading
    drive.current.speed = m.speed
    target.position.set(m.x + Math.sin(m.heading) * 5, 0, m.z + Math.cos(m.heading) * 5)
    target.updateMatrixWorld()
    if (spot.current) spot.current.intensity = 14
    if (cone.current) {
      cone.current.rotation.y = m.heading
      coneMat.color.setRGB(1, 1 - m.suspicion * 0.7, 0.7 - m.suspicion * 0.6)
      coneMat.opacity = 0.08 + m.suspicion * 0.2
    }
  })
  return (
    <>
      <group ref={group} visible={false}>
        <Chibi spec={SPECS.miaogong} drive={drive} outline={outline} />
        <spotLight ref={spot} position={[0, 1.2, 0.2]} angle={0.5} penumbra={0.6} distance={10} decay={1.6} color="#fff2c8" intensity={0} target={target} />
        <mesh ref={cone} geometry={coneGeo} material={coneMat} position={[0, 0.04, 0]} />
      </group>
      <primitive object={target} />
    </>
  )
}

// ---------------------------------------------------------------------------
// 颱風夜：閃電（整片天空一亮）＋ 雷聲晚一點到
// ---------------------------------------------------------------------------

function Storm() {
  const light = useRef<THREE.DirectionalLight>(null)
  const next = useRef(4)
  const flash = useRef(0)
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const hour = useStore.getState().time
    const stormy = hour > 23 && hour < 27.5
    next.current -= dt
    if (stormy && next.current <= 0) {
      next.current = 7 + Math.random() * 11
      flash.current = 1
      const far = Math.random()
      window.setTimeout(() => audio.thunder(), 250 + far * 1600)
    }
    flash.current = Math.max(0, flash.current - dt * 2.6)
    // 兩下閃：亮、暗一點、再亮
    const f = flash.current
    const k = f > 0.75 ? 1 : f > 0.6 ? 0.25 : f > 0.35 ? 0.8 * (f / 0.6) : f * 0.5
    if (light.current) light.current.intensity = k * 5
  })
  return <directionalLight ref={light} position={[-12, 20, 8]} color="#cfe0ff" intensity={0} />
}

// ---------------------------------------------------------------------------
// 阿咪：沒被附身時照模擬在屋裡晃；附身時跟著玩家（DESIGN §25.2）
// ---------------------------------------------------------------------------

function CatActor({ outline }: { outline: boolean }) {
  const possess = useStore((s) => s.possess)
  const group = useRef<THREE.Group>(null)
  const drive = useRef<CatDrive>(newCatDrive({ pose: 'sit' }))
  const turn = useRef<TurnState>({ heading: 0, dir: 1 })
  useFrame((_, rawDt) => {
    const sim = night.sim
    const g = group.current
    if (!sim || !g) return
    const dt = Math.min(rawDt, 0.1)
    const c = sim.cat
    const possessed = useStore.getState().possess === 'cat'
    const x = possessed ? player.x : c.x
    const z = possessed ? player.z : c.z
    g.position.set(x, HOME.floorAt(x, z), z)
    const target = possessed && (player.wantX || player.wantZ) ? Math.atan2(player.wantX, player.wantZ) : c.heading
    turnToward(turn.current, target, dt)
    const d = drive.current
    d.heading = turn.current.heading
    d.speed = possessed ? player.speed : c.speed
    d.pose = possessed ? (c.meowT > 0 ? 'meow' : player.speed > 0.2 ? 'walk' : c.pose === 'rub' ? 'rub' : 'sit') : c.pose
  })
  return (
    <group ref={group}>
      <Cat drive={drive} possessed={possess === 'cat'} outline={outline} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 小黑：每晚睡在大門外；「狗叫」的晚上半夜會叫；可以附身（DESIGN §26.2）
// ---------------------------------------------------------------------------

function DogActor({ outline }: { outline: boolean }) {
  const possess = useStore((s) => s.possess)
  const group = useRef<THREE.Group>(null)
  const drive = useRef<DogDrive>(newDogDrive({ pose: 'lie' }))
  const turn = useRef<TurnState>({ heading: Math.PI, dir: 1 })
  useFrame((_, rawDt) => {
    const d = night.sim?.dog
    const g = group.current
    if (!d || !g) return
    const dt = Math.min(rawDt, 0.1)
    const possessed = useStore.getState().possess === 'dog'
    const x = possessed ? player.x : d.x
    const z = possessed ? player.z : d.z
    g.position.set(x, HOME.floorAt(x, z), z)
    const target = possessed && (player.wantX || player.wantZ) ? Math.atan2(player.wantX, player.wantZ) : d.heading
    turnToward(turn.current, target, dt)
    const dr = drive.current
    dr.heading = turn.current.heading
    dr.speed = possessed ? player.speed : d.speed
    dr.pose = possessed ? (d.woofT > 0 ? 'bark' : player.speed > 0.2 ? 'walk' : 'sit') : d.barking ? 'bark' : d.event && d.calm ? 'wag' : 'lie'
  })
  return (
    <group ref={group}>
      <Dog drive={drive} possessed={possess === 'dog'} outline={outline} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 壁虎：平常趴在神明廳門邊的牆上；附身時在屋裡沿著天花板爬（在屋外就貼著地）
// ---------------------------------------------------------------------------

/** 壁虎太小，放大一點鏡頭才看得到 */
const GECKO_SCALE = 3.2

function GeckoActor({ outline }: { outline: boolean }) {
  const possess = useStore((s) => s.possess)
  const group = useRef<THREE.Group>(null)
  const flip = useRef<THREE.Group>(null)
  const drive = useRef<GeckoDrive>(newGeckoDrive({ pose: 'still' }))
  const turn = useRef<TurnState>({ heading: 0, dir: 1 })
  useFrame((_, rawDt) => {
    const k = night.sim?.gecko
    const g = group.current
    if (!k || !g || !flip.current) return
    const dt = Math.min(rawDt, 0.1)
    const possessed = useStore.getState().possess === 'gecko'
    const x = possessed ? player.x : k.x
    const z = possessed ? player.z : k.z
    // 在屋裡（任何一棟建築的室內範圍）就爬在天花板上，倒過來
    const indoor = HOME.buildings.some((b) => x >= b.inside.x0 && x <= b.inside.x1 && z >= b.inside.z0 && z <= b.inside.z1)
    const ceiling = possessed ? indoor : true
    const target = possessed && (player.wantX || player.wantZ) ? Math.atan2(player.wantX, player.wantZ) : k.heading
    turnToward(turn.current, target, dt)
    g.position.set(x, ceiling ? HOME.floorAt(x, z) + 2.55 : HOME.floorAt(x, z) + 0.02, z)
    flip.current.rotation.set(ceiling ? Math.PI : 0, 0, 0)
    const dr = drive.current
    // 倒過來以後 z 軸反了：要面向 H 就給 π − H
    dr.heading = ceiling ? Math.PI - turn.current.heading : turn.current.heading
    dr.speed = possessed ? player.speed : k.speed
    dr.pose = k.chirpT > 0 ? 'chirp' : dr.speed > 0.1 ? 'crawl' : 'still'
  })
  return (
    <group ref={group}>
      <group ref={flip} scale={GECKO_SCALE}>
        <Gecko drive={drive} possessed={possess === 'gecko'} outline={outline} />
      </group>
    </group>
  )
}
