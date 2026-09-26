import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { useSettings } from '../settings'
import { Chibi, R, TOP_Y, newDrive, type Drive } from '../chars/Chibi'
import { SPECS } from '../chars/specs'
import { toon } from '../chars/toon'
import '../chars/specs.horror'
import { HOME } from '../world/scenes'
import { player } from '../world/player'
import { CLUE_IDS, CLUES, ENVELOPE, GhostWedding, HAUNT, HauntedRoom, PIN_SPOTS, horrorState, horrorTonight, type HorrorKind } from '../world/night/horror'
import { canvasTexture } from './kit'

// 大人的恐怖的畫面（DESIGN §29，成人內容）：
//   傍晚大門外路上的紅包；鬼新娘（陰陽眼才看得清楚，平常只看到一團紅色的影子）；發光的玉簪；
//   客房二的地縛靈（陰陽眼才看得到）、牆裡敲的「咚」、三個發光的線索。
//   恐怖加強：比較暗的長相、頭髮垂下來蓋住臉、慢慢歪頭。
// 角色的材質是共用快取（不能改透明度），出現／離開用縮放和光來表現。

let TEX: { envelope: THREE.Texture; glow: THREE.Texture; wisp: THREE.Texture; dong: THREE.Texture } | null = null
function tex() {
  if (TEX) return TEX
  const envelope = canvasTexture(128, 72, (ctx, w, h) => {
    ctx.fillStyle = '#b3242c'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#d9b25a'
    ctx.lineWidth = 4
    ctx.strokeRect(5, 5, w - 10, h - 10)
    // 封口的三角
    ctx.fillStyle = '#9a1c24'
    ctx.beginPath()
    ctx.moveTo(5, 5)
    ctx.lineTo(w / 2, h * 0.55)
    ctx.lineTo(w - 5, 5)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(230, 196, 110, 0.75)'
    ctx.font = '700 30px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('囍', w / 2, h * 0.62)
  })
  const glow = canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.3, 'rgba(255,255,255,0.5)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
  // 看不見的時候：一團紅色的影子（上窄下寬，像一個人形）
  const wisp = canvasTexture(64, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h * 0.55, 2, w / 2, h * 0.55, h * 0.45)
    g.addColorStop(0, 'rgba(210,40,50,0.9)')
    g.addColorStop(0.5, 'rgba(160,20,30,0.45)')
    g.addColorStop(1, 'rgba(120,10,20,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(w / 2, h * 0.55, w * 0.42, h * 0.45, 0, 0, Math.PI * 2)
    ctx.fill()
  })
  const dong = canvasTexture(96, 64, (ctx, w, h) => {
    ctx.font = '900 44px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 6
    ctx.strokeStyle = 'rgba(20,10,10,0.85)'
    ctx.strokeText('咚', w / 2, h / 2)
    ctx.fillStyle = '#e8e0d0'
    ctx.fillText('咚', w / 2, h / 2)
  })
  TEX = { envelope, glow, wisp, dong }
  return TEX
}

const jadeMat = new THREE.MeshStandardMaterial({ color: '#5fc49a', emissive: '#2f8a64', emissiveIntensity: 0.8, roughness: 0.3 })

export function HorrorLayer() {
  const quality = useStore((s) => s.quality)
  const phase = useStore((s) => s.phase)
  const meta = useStore((s) => s.meta)
  const adult = useSettings((s) => s.adult)
  const strong = useSettings((s) => s.horror === 'strong') && adult
  const [kind, setKind] = useState<HorrorKind | null>(null)
  useFrame(() => {
    const cur = phase === 'night' ? horrorState.current : null
    const k = cur && cur.status !== 'waiting' ? cur.kind : null
    if (k !== kind) setKind(k)
  })
  if (!adult) return null
  const outline = quality === 'high'
  const envelope = phase === 'dusk' && horrorTonight(meta)?.kind === 'wedding'
  return (
    <group userData={{ noMerge: true }}>
      {envelope && <Envelope />}
      {kind === 'wedding' && <BrideActor outline={outline} strong={strong} />}
      {kind === 'wedding' && <PinGlow />}
      {kind === 'haunt' && <SpiritActor outline={outline} strong={strong} />}
      {kind === 'haunt' && <KnockFx />}
      {kind === 'haunt' && <ClueGlows />}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 傍晚：大門外路上的紅包
// ---------------------------------------------------------------------------

function Envelope() {
  const m = useRef<THREE.Mesh>(null)
  const y = HOME.floorAt(ENVELOPE.x, ENVELOPE.z)
  useFrame(({ clock }) => {
    // 晚風吹得一角微微掀起來
    if (m.current) m.current.rotation.x = -Math.PI / 2 + Math.max(0, Math.sin(clock.elapsedTime * 0.9)) * 0.12
  })
  return (
    <mesh ref={m} position={[ENVELOPE.x, y + 0.045, ENVELOPE.z]} rotation={[-Math.PI / 2, 0, 0.5]} receiveShadow>
      <planeGeometry args={[0.3, 0.17]} />
      <meshStandardMaterial map={tex().envelope} roughness={0.7} side={THREE.DoubleSide} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// 恐怖加強：垂下來蓋住臉的頭髮（一束一束的細長條，跟著轉身）
// ---------------------------------------------------------------------------

// 一束一束：中間分開一點點（看得到一條縫的臉），長短不一，有幾束垂到下巴下面
const STRANDS = [-0.17, -0.135, -0.1, -0.07, -0.042, -0.012, 0.028, 0.056, 0.085, 0.115, 0.145, 0.172].map((x, i) => ({
  x,
  w: 0.022 + ((i * 5) % 3) * 0.005,
  len: 0.36 + ((i * 37) % 7) * 0.035,
  tilt: ((i * 13) % 5) * 0.025 - 0.05,
}))
/** 跟角色頭髮同一個材質（鬼的顏色、陰陽眼下的樣子都一樣） */
const veilMat = () => toon('#060508', { ghost: true, glow: 0.06 })

function HairVeil({ scale }: { scale: number }) {
  const headY = (TOP_Y - R) * scale
  const mat = useMemo(veilMat, [])
  return (
    <group position={[0, headY, 0]}>
      {STRANDS.map((s, i) => {
        // 貼著臉的弧面，稍微浮起來
        const x = s.x * scale
        const z = Math.sqrt(Math.max(0, (R * scale) ** 2 - x * x)) + 0.014
        return (
          <mesh key={i} material={mat} position={[x, 0.2 * scale - (s.len * scale) / 2, z]} rotation={[0.1, Math.atan2(x, z) * 0.6, s.tilt]}>
            <boxGeometry args={[s.w * scale, s.len * scale, 0.016]} />
          </mesh>
        )
      })}
    </group>
  )
}

/** 朝向的平滑（跟 Chibi 自己轉身差不多快，頭髮才跟得上臉） */
function turnTo(cur: number, want: number, dt: number) {
  let d = want - cur
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return cur + d * Math.min(1, dt * 6)
}

const FORWARD = new THREE.Vector3()
/** 往旁邊歪（繞著面向的方向轉），支點在胸口 */
function roll(g: THREE.Group, heading: number, angle: number) {
  FORWARD.set(Math.sin(heading), 0, Math.cos(heading))
  g.quaternion.setFromAxisAngle(FORWARD, angle)
}

// ---------------------------------------------------------------------------
// 鬼新娘
// ---------------------------------------------------------------------------

function BrideActor({ outline, strong }: { outline: boolean; strong: boolean }) {
  const group = useRef<THREE.Group>(null)
  const tilt = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const veil = useRef<THREE.Group>(null)
  const wisp = useRef<THREE.Sprite>(null)
  const halo = useRef<THREE.Sprite>(null)
  const drive = useRef<Drive>(newDrive({ pose: 'clasp', expr: 'normal', heading: Math.PI }))
  const face = useRef(Math.PI)
  const [pinned, setPinned] = useState(false)
  const scale = SPECS.ghostbride.scale
  useFrame(({ clock }, dt) => {
    const w = horrorState.current
    const g = group.current
    if (!(w instanceof GhostWedding) || !g) return
    const s = useStore.getState()
    const time = clock.elapsedTime
    const show = w.phase !== 'wait' && w.phase !== 'gone' && w.alpha > 0.01
    g.visible = show
    if (!show) return
    if (w.pinned !== pinned) setPinned(w.pinned)
    const leaving = w.phase === 'leave'
    // 慢慢飄上去、變細；出現時從地上長出來
    const k = leaving ? w.alpha : 0.55 + 0.45 * w.alpha
    g.position.set(w.x, HOME.floorAt(w.x, w.z) + Math.sin(time * 1.3) * 0.04 + (leaving ? (1 - w.alpha) * 0.9 : 0), w.z)
    g.scale.set(k, leaving ? 1 : k, k)
    // 阿嬤在旁邊（陰陽眼）而且她停下來了：轉過來看阿嬤
    let heading = w.heading
    const near = Math.hypot(player.x - w.x, player.z - w.z) < 2.6
    if (s.vision && near && w.phase !== 'walk') heading = Math.atan2(player.x - w.x, player.z - w.z)
    const d = drive.current
    d.heading = heading
    d.speed = w.speed
    d.pose = 'clasp'
    d.expr = w.pinned ? 'happy' : w.wish ? 'sad' : 'normal'
    face.current = turnTo(face.current, heading, dt)
    if (veil.current) {
      veil.current.visible = strong && !w.pinned && s.vision
      veil.current.rotation.y = face.current
    }
    // 恐怖加強：很慢地歪頭（約 10 秒歪過去、停一下、再回來）
    if (tilt.current) roll(tilt.current, face.current, strong && !w.pinned ? 0.2 * Math.max(0, Math.sin(time * 0.32)) ** 0.6 : 0)
    // 陰陽眼：看得清楚她；沒開：只有一團紅色的影子
    if (body.current) body.current.visible = s.vision
    if (wisp.current) {
      wisp.current.visible = !s.vision
      ;(wisp.current.material as THREE.SpriteMaterial).opacity = (0.28 + Math.sin(time * 0.8) * 0.06) * w.alpha
    }
    if (halo.current) {
      halo.current.visible = s.vision
      ;(halo.current.material as THREE.SpriteMaterial).opacity = (w.pinned ? 0.55 : 0.22) * w.alpha
    }
  })
  const t = tex()
  const spec = pinned ? SPECS.ghostbride_pin : strong ? SPECS.ghostbride_dark : SPECS.ghostbride
  return (
    <group ref={group} visible={false}>
      <group ref={tilt} position={[0, 0.95, 0]}>
        <group ref={body} position={[0, -0.95, 0]}>
          <Chibi spec={spec} drive={drive} outline={outline} />
          <group ref={veil} visible={false}>
            <HairVeil scale={scale} />
          </group>
        </group>
      </group>
      <sprite ref={wisp} position={[0, 0.95, 0]} scale={[0.9, 1.7, 1]} renderOrder={3}>
        <spriteMaterial map={t.wisp} transparent depthWrite={false} opacity={0.3} toneMapped={false} />
      </sprite>
      <sprite ref={halo} position={[0, 0.9, 0]} scale={[1.6, 2.1, 1]} renderOrder={2}>
        <spriteMaterial map={t.glow} color={pinned ? '#fff0c8' : '#ff6a6a'} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.2} toneMapped={false} />
      </sprite>
    </group>
  )
}

/** 玉簪：聽了她的心願以後，陰陽眼裡發著青綠色的光 */
function PinGlow() {
  const group = useRef<THREE.Group>(null)
  const glow = useRef<THREE.Sprite>(null)
  useFrame(({ clock }) => {
    const w = horrorState.current
    const g = group.current
    if (!g) return
    const show = w instanceof GhostWedding && w.active && w.wish && !w.pinFound && useStore.getState().vision
    g.visible = show
    if (!show || !(w instanceof GhostWedding)) return
    const p = PIN_SPOTS[w.pinSpot].glow
    const time = clock.elapsedTime
    g.position.set(p.x, HOME.floorAt(p.x, p.z) + p.y + Math.sin(time * 2) * 0.03, p.z)
    g.rotation.y = time * 0.6
    if (glow.current) glow.current.scale.setScalar(0.55 + Math.sin(time * 2.4) * 0.08)
  })
  return (
    <group ref={group} visible={false}>
      <mesh material={jadeMat} rotation={[0, 0, 1.2]}>
        <cylinderGeometry args={[0.008, 0.012, 0.18, 6]} />
      </mesh>
      <mesh material={jadeMat} position={[-0.075, 0.03, 0]}>
        <sphereGeometry args={[0.02, 8, 6]} />
      </mesh>
      <sprite ref={glow} renderOrder={3}>
        <spriteMaterial map={tex().glow} color="#7cffc8" transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.75} toneMapped={false} />
      </sprite>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 凶宅夜
// ---------------------------------------------------------------------------

/** 牆角的地縛靈：只有陰陽眼看得到。平常面對牆角；阿嬤靠近時轉過來 */
function SpiritActor({ outline, strong }: { outline: boolean; strong: boolean }) {
  const group = useRef<THREE.Group>(null)
  const tilt = useRef<THREE.Group>(null)
  const veil = useRef<THREE.Group>(null)
  const halo = useRef<THREE.Sprite>(null)
  const corner = Math.atan2(-1, 0.6)
  const drive = useRef<Drive>(newDrive({ pose: 'idle', expr: 'normal', heading: corner }))
  const face = useRef(corner)
  const [free, setFree] = useState(false)
  const scale = SPECS.jibaoling.scale
  const base = useMemo(() => HOME.floorAt(HAUNT.spirit.x, HAUNT.spirit.z), [])
  useFrame(({ clock }, dt) => {
    const h = horrorState.current
    const g = group.current
    if (!(h instanceof HauntedRoom) || !g) return
    const s = useStore.getState()
    const time = clock.elapsedTime
    const resolved = h.status === 'resolved'
    const show = s.vision && h.alpha > 0.01 && h.status !== 'failed'
    g.visible = show
    if (resolved !== free) setFree(resolved)
    if (!show) return
    const rise = resolved ? (1 - h.alpha) * 0.9 : 0
    g.position.set(HAUNT.spirit.x, base + Math.sin(time * 1.1) * 0.03 + rise, HAUNT.spirit.z)
    const k = resolved ? h.alpha : 0.6 + 0.4 * h.alpha
    g.scale.set(k, resolved ? 1 : k, k)
    const near = Math.hypot(player.x - HAUNT.spirit.x, player.z - HAUNT.spirit.z) < 2.4
    const heading = near && (h.met || h.ready || resolved) ? Math.atan2(player.x - HAUNT.spirit.x, player.z - HAUNT.spirit.z) : corner
    const d = drive.current
    d.heading = heading
    d.pose = 'idle'
    d.expr = resolved ? 'relief' : 'normal'
    face.current = turnTo(face.current, heading, dt)
    if (veil.current) {
      veil.current.visible = strong && !resolved
      veil.current.rotation.y = face.current
    }
    if (tilt.current) roll(tilt.current, face.current, strong && !resolved ? -0.22 * Math.max(0, Math.sin(time * 0.28)) ** 0.6 : 0)
    if (halo.current) (halo.current.material as THREE.SpriteMaterial).opacity = (resolved ? 0.5 : 0.18) * h.alpha
  })
  const spec = !free && strong ? SPECS.jibaoling_dark : SPECS.jibaoling
  return (
    <group ref={group} visible={false}>
      <group ref={tilt} position={[0, 0.95, 0]}>
        <group position={[0, -0.95, 0]}>
          <Chibi spec={spec} drive={drive} outline={outline} />
          <group ref={veil} visible={false}>
            <HairVeil scale={scale} />
          </group>
        </group>
      </group>
      <sprite ref={halo} position={[0, 0.9, 0]} scale={[1.4, 2.0, 1]} renderOrder={2}>
        <spriteMaterial map={tex().glow} color={free ? '#fff0c8' : '#9fb8ff'} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.18} toneMapped={false} />
      </sprite>
    </group>
  )
}

/** 牆裡敲的聲音：床頭那面牆冒出「咚」（一次三下，跟音效的節奏一樣） */
const KNOCK_AT = [0, 0.55, 1.25]
function KnockFx() {
  const refs = useRef<(THREE.Sprite | null)[]>([])
  const y = HOME.floorAt(HAUNT.knock.x + 0.3, HAUNT.knock.z)
  useFrame(() => {
    const h = horrorState.current
    const age = h instanceof HauntedRoom && h.active ? h.knockAge : 99
    refs.current.forEach((sp, i) => {
      if (!sp) return
      const a = age - KNOCK_AT[i]
      sp.visible = a >= 0 && a < 0.7
      if (!sp.visible) return
      const pop = Math.min(1, a / 0.08)
      sp.scale.setScalar(0.3 * (0.7 + 0.3 * pop))
      ;(sp.material as THREE.SpriteMaterial).opacity = 1 - Math.max(0, a - 0.35) / 0.35
    })
  })
  return (
    <group>
      {KNOCK_AT.map((_, i) => (
        <sprite
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          visible={false}
          position={[HAUNT.knock.x + 0.35, y + 1.0 + i * 0.22, HAUNT.knock.z + (i - 1) * 0.28]}
          scale={[0.3, 0.2, 1]}
          renderOrder={4}
        >
          <spriteMaterial map={tex().dong} transparent depthTest={false} depthWrite={false} />
        </sprite>
      ))}
    </group>
  )
}

/** 三個線索：陰陽眼裡發著淡淡的光（找到了就熄掉） */
function ClueGlows() {
  const refs = useRef<(THREE.Sprite | null)[]>([])
  const ys = useMemo(() => CLUE_IDS.map((id) => HOME.floorAt(CLUES[id].glow.x, CLUES[id].glow.z) + CLUES[id].glow.y), [])
  useFrame(({ clock }) => {
    const h = horrorState.current
    const vision = useStore.getState().vision
    const time = clock.elapsedTime
    CLUE_IDS.forEach((id, i) => {
      const sp = refs.current[i]
      if (!sp) return
      sp.visible = vision && h instanceof HauntedRoom && h.active && !h.found.has(id)
      if (!sp.visible) return
      sp.position.y = ys[i] + 0.08 + Math.sin(time * 1.6 + i) * 0.03
      sp.scale.setScalar(0.42 + Math.sin(time * 2.2 + i * 2) * 0.07)
    })
  })
  return (
    <group>
      {CLUE_IDS.map((id, i) => (
        <sprite
          key={id}
          ref={(el) => {
            refs.current[i] = el
          }}
          visible={false}
          position={[CLUES[id].glow.x, 0, CLUES[id].glow.z]}
          renderOrder={3}
        >
          <spriteMaterial map={tex().glow} color="#bfe0ff" transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.8} toneMapped={false} />
        </sprite>
      ))}
    </group>
  )
}
