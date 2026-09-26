import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { Chibi, ChibiNpc, R as HEAD_R, TOP_Y, newDrive, type Drive } from '../chars/Chibi'
import { SPECS } from '../chars/specs'
import '../chars/specs.family'
import { HOME } from '../world/scenes'
import { player } from '../world/player'
import { INHERIT_SPOT, auntStaysOver, inheritanceBeat } from '../world/adultStory'
import { ZHIWEI_HEADING, familyState, type Family } from '../world/night/family'
import { FLOOR_Y, GM_BED, GUEST_ROOMS, SEWING, TEA } from './layout'
import { canvasTexture, svgTexture } from './kit'
import { floralFabricTexture } from '../art/fabric'
import { Z_SIZE, zSvg } from '../art/characters'

// 大人的心事的畫面（DESIGN §29）：掛在家裡的場景。
//   第 10 晚傍晚：叔叔、姑姑在神明廳跟小翰吵；吵完姑姑站在阿嬤的裁縫車前面；晚上她睡阿嬤的床
//   福伯的拐杖、頭上的「阿玉？」、志明找爸爸時手機的手電筒
//   志偉：手上發亮的手機、頭上那則沒送出去的訊息（送出去以後換成老婆的回覆）、桌上的熱茶和宵夜、哼歌的音符
// 福伯、志明、志偉本身是模擬裡的客人，由 Guests.tsx 畫。

const YARD_Y = 0.1
const TABLE_Y = YARD_Y + 0.44

let TEX: { ayu: THREE.Texture; heart: THREE.Texture; draft: THREE.Texture; reply: THREE.Texture; note: THREE.Texture; steam: THREE.Texture; z: THREE.Texture } | null = null
function tex() {
  if (TEX) return TEX
  const FONT = '"Noto Sans TC", "PingFang TC", sans-serif'
  /** 想法泡泡：白底圓角、小尾巴 */
  const bubble = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, fill = '#fffaf0', stroke = '#3b2a2a') =>
    canvasTexture(
      w,
      h,
      (ctx) => {
        ctx.fillStyle = fill
        ctx.strokeStyle = stroke
        ctx.lineWidth = 6
        const r = 26
        const bh = h - 26
        ctx.beginPath()
        ctx.moveTo(r + 4, 4)
        ctx.arcTo(w - 4, 4, w - 4, bh, r)
        ctx.arcTo(w - 4, bh, 4, bh, r)
        ctx.lineTo(w / 2 + 16, bh)
        ctx.lineTo(w / 2, h - 4)
        ctx.lineTo(w / 2 - 6, bh)
        ctx.arcTo(4, bh, 4, 4, r)
        ctx.arcTo(4, 4, w - 4, 4, r)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        draw(ctx)
      },
      [{ spec: `700 40px ${FONT}`, text: '阿玉？我被裁員了回家就好老婆草稿' }],
    )
  const ayu = bubble(256, 128, (ctx) => {
    ctx.fillStyle = '#5a3a2a'
    ctx.font = `700 52px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('阿玉？', 128, 52)
  })
  const heart = canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#ff7a9a'
    ctx.font = '48px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('♥', w / 2, h / 2 + 2)
  })
  // 手機上沒送出去的訊息（游標）；送出去以後是老婆的回覆
  const draft = bubble(
    384,
    150,
    (ctx) => {
      ctx.fillStyle = '#8a8f99'
      ctx.font = `600 24px ${FONT}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText('草稿・未傳送', 28, 36)
      ctx.fillStyle = '#20242c'
      ctx.font = `700 42px ${FONT}`
      ctx.fillText('我被裁員了｜', 28, 86)
    },
    '#eef2f7',
    '#4a5568',
  )
  const reply = bubble(
    384,
    150,
    (ctx) => {
      ctx.fillStyle = '#2f6b3a'
      ctx.font = `600 24px ${FONT}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText('老婆', 28, 36)
      ctx.fillStyle = '#153a1c'
      ctx.font = `700 44px ${FONT}`
      ctx.fillText('回家就好', 28, 86)
    },
    '#dff5d8',
    '#2f6b3a',
  )
  const note = canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(255,230,160,0.95)'
    ctx.font = '48px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('♪', w / 2, h / 2)
  })
  const steam = canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(255,255,255,0.55)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
  const z = svgTexture(zSvg(), Z_SIZE.w, Z_SIZE.h, 3)
  TEX = { ayu, heart, draft, reply, note, steam, z }
  return TEX
}

export function FamilyLayer() {
  const phase = useStore((s) => s.phase)
  const stay = useStore((s) => auntStaysOver(s))
  const beat = useStore((s) => inheritanceBeat(s))
  const quality = useStore((s) => s.quality)
  const outline = quality === 'high'
  return (
    <group userData={{ noMerge: true }}>
      {stay && phase === 'dusk' && (beat ? <Argument outline={outline} /> : <AuntAtSewing outline={outline} />)}
      {stay && phase === 'night' && <AuntAsleep outline={outline} />}
      {phase === 'night' && <FamilyNight />}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 分遺產
// ---------------------------------------------------------------------------

const at = (p: { x: number; z: number }): [number, number, number] => [p.x, HOME.floorAt(p.x, p.z), p.z]
const face = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.atan2(b.x - a.x, b.z - a.z)

/** 神明廳：叔叔和姑姑對著小翰，小翰背對門口 */
function Argument({ outline }: { outline: boolean }) {
  const S = INHERIT_SPOT
  return (
    <group>
      <ChibiNpc id="uncle" pose="phone" position={at(S.uncle)} heading={face(S.uncle, S.han)} outline={outline} />
      <ChibiNpc id="aunt" pose="clasp" position={at(S.aunt)} heading={face(S.aunt, S.han)} outline={outline} />
      <ChibiNpc id="xiaohan" pose="clasp" position={at(S.han)} heading={Math.PI} outline={outline} />
    </group>
  )
}

/** 吵完：姑姑一個人站在阿嬤的裁縫車前面 */
function AuntAtSewing({ outline }: { outline: boolean }) {
  const p = INHERIT_SPOT.sewing
  return <ChibiNpc id="aunt" pose="idle" position={at(p)} heading={face(p, SEWING)} outline={outline} />
}

/** 晚上姑姑睡阿嬤的床：攤開的花被、枕頭上的頭、zzz */
function AuntAsleep({ outline }: { outline: boolean }) {
  const drive = useRef<Drive>(newDrive({ expr: 'asleep' }))
  const quilt = useMemo(() => {
    const t = floralFabricTexture().clone()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(1.6, 1.4)
    t.needsUpdate = true
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 })
  }, [])
  const z = useRef<THREE.Sprite>(null)
  const top = FLOOR_Y + 0.58
  const pillowZ = GM_BED.z - 0.7
  const scale = SPECS.aunt?.scale ?? 1
  useFrame(({ clock }) => {
    const s = z.current
    if (!s) return
    const p = (clock.elapsedTime % 2.6) / 2.6
    s.position.set(GM_BED.x + 0.25 + p * 0.25, top + 0.45 + p * 0.7, pillowZ)
    s.scale.setScalar(0.14 + p * 0.1)
    ;(s.material as THREE.SpriteMaterial).opacity = Math.sin(p * Math.PI) * 0.85
  })
  return (
    <group>
      {/* 厚棉被：把阿嬤原本摺好放在床尾的被子蓋過去 */}
      <mesh material={quilt} position={[GM_BED.x, top + 0.11, GM_BED.z + 0.25]} castShadow receiveShadow>
        <boxGeometry args={[GM_BED.w - 0.08, 0.3, 1.3]} />
      </mesh>
      <group position={[GM_BED.x, top + 0.13 + HEAD_R * scale * 0.7, pillowZ + 0.04]} rotation={[-Math.PI / 2 + 0.35, 0, 0]}>
        <Chibi spec={SPECS.aunt} drive={drive} headOnly outline={outline} />
      </group>
      <sprite ref={z} renderOrder={3}>
        <spriteMaterial map={tex().z} transparent depthWrite={false} />
      </sprite>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 深夜：福伯、志明、志偉
// ---------------------------------------------------------------------------

function FamilyNight() {
  const [fam, setFam] = useState<Family | null>(null)
  useFrame(() => {
    if (familyState.current !== fam) setFam(familyState.current)
  })
  if (!fam) return null
  return (
    <group key={String(fam.fuboStart)}>
      {fam.hasFubo && <FuboExtras fam={fam} />}
      {fam.hasFubo && <SonTorch fam={fam} />}
      {fam.hasWei && <ZhiweiExtras fam={fam} />}
    </group>
  )
}

/** 福伯的拐杖（走路時拄著、在床上時靠在床邊）；在外面找太太時頭上有「阿玉？」，跟著阿嬤走時是愛心 */
function FuboExtras({ fam }: { fam: Family }) {
  const cane = useRef<THREE.Group>(null)
  const swing = useRef<THREE.Group>(null)
  const ask = useRef<THREE.Sprite>(null)
  const love = useRef<THREE.Sprite>(null)
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.6 }), [])
  const scale = SPECS.fubo?.scale ?? 1
  useFrame(({ clock }) => {
    const g = fam.guest('fubo')
    const c = cane.current
    const sw = swing.current
    if (!g || !c || !sw) return
    const t = clock.elapsedTime
    const room = GUEST_ROOMS[g.room]
    if (g.mode === 'bed') {
      // 靠在床邊（床頭那一側）
      const side = Math.sign(room.bedside[0] - room.bed.x) || 1
      const x = room.bed.x + side * (room.bed.w / 2 + 0.07)
      const z = room.bed.z - 0.1
      c.position.set(x, HOME.floorAt(x, z), z)
      c.rotation.set(0, 0, side * 0.2)
      sw.rotation.set(0, 0, 0)
    } else {
      c.position.set(g.x, HOME.floorAt(g.x, g.z), g.z)
      c.rotation.set(0, g.heading, 0)
      // 走路時往前點一點
      sw.rotation.set(g.speed > 0.1 ? Math.sin(t * 5.5) * 0.18 + 0.08 : 0.05, 0, 0)
    }
    const head = HOME.floorAt(g.x, g.z) + TOP_Y * scale + 0.5
    const out = fam.fuboOut
    const following = fam.fubo === 'follow' || fam.fubo === 'greet'
    if (ask.current) {
      ask.current.visible = out && !following
      ask.current.position.set(g.x, head + Math.sin(t * 2) * 0.05, g.z)
    }
    if (love.current) {
      love.current.visible = out && following
      love.current.position.set(g.x + 0.2, head - 0.1 + Math.sin(t * 3) * 0.05, g.z)
    }
  })
  return (
    <group>
      <group ref={cane}>
        {/* 拐杖在他右手邊（面向 +z 時的 -x） */}
        <group ref={swing} position={[-0.24, 0, 0.12]}>
          <mesh material={wood} position={[0, 0.21, 0]} castShadow>
            <cylinderGeometry args={[0.016, 0.019, 0.42, 8]} />
          </mesh>
          <mesh material={wood} position={[0, 0.42, 0.05]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.05, 0.016, 6, 12, Math.PI]} />
          </mesh>
        </group>
      </group>
      <sprite ref={ask} scale={[0.84, 0.42, 1]} visible={false} renderOrder={3}>
        <spriteMaterial map={tex().ayu} transparent depthWrite={false} />
      </sprite>
      <sprite ref={love} scale={[0.3, 0.3, 1]} visible={false} renderOrder={3}>
        <spriteMaterial map={tex().heart} transparent depthWrite={false} />
      </sprite>
    </group>
  )
}

/** 志明找爸爸：手機的手電筒照在前面 */
function SonTorch({ fam }: { fam: Family }) {
  const light = useRef<THREE.PointLight>(null)
  useFrame(() => {
    const l = light.current
    const g = fam.guest('zhiming')
    if (!l) return
    const on = !!g && (fam.ming === 'search' || (fam.ming === 'return' && g.mode !== 'bed'))
    l.visible = on
    if (!on || !g) return
    l.position.set(g.x + Math.sin(g.heading) * 0.9, HOME.floorAt(g.x, g.z) + 0.7, g.z + Math.cos(g.heading) * 0.9)
  })
  return <pointLight ref={light} color="#eef4ff" intensity={2.4} distance={4} decay={2} visible={false} />
}

/** 志偉：發亮的手機、頭上的訊息、桌上的熱茶和宵夜、哼歌的音符 */
function ZhiweiExtras({ fam }: { fam: Family }) {
  const phone = useRef<THREE.Group>(null)
  const glow = useRef<THREE.PointLight>(null)
  const msg = useRef<THREE.Sprite>(null)
  const cup = useRef<THREE.Group>(null)
  const bowl = useRef<THREE.Mesh>(null)
  const steam = useRef<(THREE.Sprite | null)[]>([])
  const notes = useRef<(THREE.Sprite | null)[]>([])
  const humAt = useRef(-1)
  const sentAt = useRef(-1)
  const screen = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.45, 1.7), toneMapped: false }), [])
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1b1d22', roughness: 0.4, metalness: 0.4 }), [])
  const ceramic = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f1ece0', roughness: 0.35 }), [])
  const tea = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9a6a2a', roughness: 0.2 }), [])
  const scale = SPECS.zhiwei?.scale ?? 1
  const T = tex()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const g = fam.guest('zhiwei')
    if (!g) return
    const sitting = fam.wei === 'sit' || fam.wei === 'send'
    const floor = HOME.floorAt(g.x, g.z)
    const fx = Math.sin(ZHIWEI_HEADING)
    const fz = Math.cos(ZHIWEI_HEADING)
    if (phone.current) {
      phone.current.visible = sitting
      phone.current.position.set(g.x + fx * 0.3, floor + 0.62 * scale, g.z + fz * 0.3)
      phone.current.rotation.set(-0.9, ZHIWEI_HEADING, 0)
    }
    if (glow.current) {
      glow.current.visible = sitting
      glow.current.position.set(g.x + fx * 0.38, floor + 0.85 * scale, g.z + fz * 0.38)
      glow.current.intensity = 1.1 + Math.sin(t * 1.3) * 0.08
    }
    if (fam.sent && sentAt.current < 0) sentAt.current = t
    // 訊息：走近了才看得到（送出去以後老婆的回覆留 20 秒）
    if (msg.current) {
      const near = Math.hypot(player.x - g.x, player.z - g.z) < 6.5
      const showReply = fam.sent && t - sentAt.current < 20
      msg.current.visible = near && ((sitting && !fam.sent) || showReply)
      const m = msg.current.material as THREE.SpriteMaterial
      const want = fam.sent ? T.reply : T.draft
      if (m.map !== want) {
        m.map = want
        m.needsUpdate = true
      }
      // 草稿的游標一閃一閃：整個泡泡輕輕呼吸
      m.opacity = fam.sent ? 1 : 0.86 + Math.sin(t * 4) * 0.1
      msg.current.position.set(g.x + 0.35, floor + TOP_Y * scale + 1.0 + Math.sin(t * 1.6) * 0.03, g.z)
    }
    // 桌上的熱茶（冒煙）、宵夜
    const hasTea = fam.acts.includes('tea')
    if (cup.current) cup.current.visible = hasTea
    steam.current.forEach((s, i) => {
      if (!s) return
      s.visible = hasTea && !fam.sent
      if (!s.visible) return
      const p = ((t * 0.5 + i / 3) % 1)
      s.position.set(TEA.x + 0.24 + Math.sin(t + i) * 0.02, TABLE_Y + 0.08 + p * 0.3, TEA.z + 0.14)
      s.scale.setScalar(0.06 + p * 0.1)
      ;(s.material as THREE.SpriteMaterial).opacity = Math.sin(p * Math.PI) * 0.6
    })
    if (bowl.current) bowl.current.visible = fam.acts.includes('meal')
    // 哼歌：音符在他身邊飄 8 秒
    if (fam.acts.includes('hum') && humAt.current < 0) humAt.current = t
    const humming = humAt.current >= 0 && t - humAt.current < 8
    notes.current.forEach((n, i) => {
      if (!n) return
      n.visible = humming
      if (!humming) return
      const p = ((t - humAt.current) * 0.4 + i / 4) % 1
      n.position.set(g.x - 0.4 + Math.sin(p * 6 + i) * 0.25, floor + 1.0 + p * 1.0, g.z + 0.2 + i * 0.05)
      n.scale.setScalar(0.16)
      ;(n.material as THREE.SpriteMaterial).opacity = Math.sin(p * Math.PI)
    })
  })
  return (
    <group>
      <group ref={phone} visible={false}>
        <mesh material={body}>
          <boxGeometry args={[0.075, 0.012, 0.14]} />
        </mesh>
        <mesh material={screen} position={[0, 0.007, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.064, 0.125]} />
        </mesh>
      </group>
      <pointLight ref={glow} color="#bcd4ff" intensity={1.1} distance={2.2} decay={2} visible={false} />
      <sprite ref={msg} scale={[1.45, 0.57, 1]} visible={false} renderOrder={4}>
        <spriteMaterial map={T.draft} transparent depthWrite={false} depthTest={false} />
      </sprite>
      <group ref={cup} position={[TEA.x + 0.24, TABLE_Y, TEA.z + 0.14]} visible={false}>
        <mesh material={ceramic} position={[0, 0.025, 0]} castShadow>
          <cylinderGeometry args={[0.032, 0.024, 0.05, 12]} />
        </mesh>
        <mesh material={tea} position={[0, 0.047, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.028, 12]} />
        </mesh>
      </group>
      <mesh ref={bowl} material={ceramic} position={[TEA.x + 0.02, TABLE_Y + 0.068, TEA.z + 0.2]} rotation={[Math.PI, 0, 0]} visible={false} castShadow>
        <sphereGeometry args={[0.07, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <sprite
          key={`s${i}`}
          ref={(el) => {
            steam.current[i] = el
          }}
          visible={false}
        >
          <spriteMaterial map={T.steam} transparent depthWrite={false} />
        </sprite>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <sprite
          key={`n${i}`}
          ref={(el) => {
            notes.current[i] = el
          }}
          visible={false}
          renderOrder={3}
        >
          <spriteMaterial map={T.note} transparent depthWrite={false} />
        </sprite>
      ))}
    </group>
  )
}
