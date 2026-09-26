import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { Chibi, newDrive, type Drive } from '../chars/Chibi'
import { SPECS } from '../chars/specs'
import '../chars/specs.incidents'
import { HOME } from '../world/scenes'
import { player } from '../world/player'
import { night } from '../world/night/director'
import { Drunk, FUSE_BOX, Fuse, LostChild, Thief, incidentState, type IncidentKind } from '../world/night/incidents'
import { canvasTexture } from './kit'

// 半夜突發事件的畫面（DESIGN §27.2）：左護龍前面牆上的電箱（一直都在，燒掉時冒火花）、
// 小偷（翻牆、試門、被嚇跑）、他掉的袋子、門口唱歌的醉漢、躲起來的小宇旁邊的小亮光。
// 夢遊的客人、走失的小宇本身由 Guests.tsx 畫（他們是模擬裡的客人）。

let TEX: { note: THREE.Texture; spark: THREE.Texture; glow: THREE.Texture; sticker: THREE.Texture; alert: THREE.Texture } | null = null
function tex() {
  if (TEX) return TEX
  const note = canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(255,230,160,0.95)'
    ctx.font = '48px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('♪', w / 2, h / 2)
  })
  const spark = canvasTexture(32, 32, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(255,255,230,1)')
    g.addColorStop(0.35, 'rgba(255,200,90,0.8)')
    g.addColorStop(1, 'rgba(255,140,40,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
  const glow = canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(255,245,200,0.9)')
    g.addColorStop(1, 'rgba(255,220,140,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
  const sticker = canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#f2c230'
    ctx.beginPath()
    ctx.moveTo(w / 2, 4)
    ctx.lineTo(w - 4, h - 6)
    ctx.lineTo(4, h - 6)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#1a1a1a'
    ctx.font = '900 34px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('⚡', w / 2, h / 2 + 8)
  })
  // 小偷頭上的紅色「！」：穿一身黑，晚上不標出來根本找不到
  const alert = canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#e8413a'
    ctx.strokeStyle = '#2a1010'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, 26, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.font = '900 40px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('!', w / 2, h / 2 + 2)
  })
  TEX = { note, spark, glow, sticker, alert }
  return TEX
}

export function IncidentsLayer() {
  const quality = useStore((s) => s.quality)
  const phase = useStore((s) => s.phase)
  const [kind, setKind] = useState<IncidentKind | null>(null)
  useFrame(() => {
    const cur = phase === 'night' ? incidentState.current : null
    const k = cur && cur.status !== 'waiting' && cur.status !== 'cancelled' ? cur.kind : null
    if (k !== kind) setKind(k)
  })
  const outline = quality === 'high'
  return (
    <group userData={{ noMerge: true }}>
      <FuseBox />
      {kind === 'thief' && <ThiefActor outline={outline} />}
      {kind === 'thief' && <BagActor />}
      {kind === 'drunk' && <DrunkActor outline={outline} />}
      {kind === 'lost' && <LostHint />}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 電箱：左護龍前面牆上的老鐵箱。保險絲燒掉時門縫冒火花、有一點橘光
// ---------------------------------------------------------------------------

function FuseBox() {
  const t = tex()
  const sparks = useRef<(THREE.Sprite | null)[]>([])
  const light = useRef<THREE.PointLight>(null)
  const door = useRef<THREE.Group>(null)
  const metal = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7d8680', roughness: 0.55, metalness: 0.5 }), [])
  const rust = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6a5a4c', roughness: 0.8, metalness: 0.3 }), [])
  const pipe = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a4f52', roughness: 0.6, metalness: 0.4 }), [])
  const y0 = HOME.floorAt(FUSE_BOX.x, FUSE_BOX.z - 0.3)
  useFrame(({ clock }) => {
    const cur = incidentState.current
    const blown = cur instanceof Fuse && cur.blown
    const time = clock.elapsedTime
    sparks.current.forEach((sp, i) => {
      if (!sp) return
      // 一陣一陣地冒：大部分時間是暗的
      const burst = blown && Math.sin(time * 7.3 + i * 2.1) > 0.55 && Math.random() < 0.7
      sp.visible = burst
      if (!burst) return
      sp.position.set((Math.random() - 0.5) * 0.3, -0.05 + (Math.random() - 0.5) * 0.35, 0.1 + Math.random() * 0.12)
      sp.scale.setScalar(0.06 + Math.random() * 0.1)
    })
    if (light.current) light.current.intensity = blown ? (Math.sin(time * 23) > 0.2 ? 1.6 : 0.2) : 0
    // 燒掉時門半開
    if (door.current) door.current.rotation.y += ((blown ? -0.6 : 0) - door.current.rotation.y) * 0.1
  })
  return (
    <group position={[FUSE_BOX.x, y0 + 1.25, FUSE_BOX.z]}>
      {/* 箱子本體：門朝 +z（朝南，面向鏡頭） */}
      <mesh material={metal} castShadow>
        <boxGeometry args={[0.46, 0.56, 0.14]} />
      </mesh>
      <group ref={door} position={[-0.23, 0, 0.075]}>
        <mesh material={rust} position={[0.23, 0, 0.005]} castShadow>
          <boxGeometry args={[0.44, 0.54, 0.02]} />
        </mesh>
        <mesh position={[0.23, 0.12, 0.018]}>
          <planeGeometry args={[0.12, 0.12]} />
          <meshBasicMaterial map={t.sticker} transparent />
        </mesh>
        <mesh material={pipe} position={[0.4, -0.02, 0.025]}>
          <boxGeometry args={[0.03, 0.08, 0.02]} />
        </mesh>
      </group>
      {/* 往上走的電線管 */}
      <mesh material={pipe} position={[0.12, 0.9, -0.03]}>
        <cylinderGeometry args={[0.022, 0.022, 1.25, 8]} />
      </mesh>
      <mesh material={pipe} position={[-0.12, -0.55, -0.03]}>
        <cylinderGeometry args={[0.018, 0.018, 0.55, 8]} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <sprite
          key={i}
          ref={(el) => {
            sparks.current[i] = el
          }}
          visible={false}
          renderOrder={3}
        >
          <spriteMaterial map={t.spark} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      ))}
      <pointLight ref={light} position={[0, 0, 0.4]} color="#ffb060" intensity={0} distance={3} decay={2} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 小偷
// ---------------------------------------------------------------------------

function ThiefActor({ outline }: { outline: boolean }) {
  const group = useRef<THREE.Group>(null)
  const sack = useRef<THREE.Group>(null)
  const mark = useRef<THREE.Sprite>(null)
  const drive = useRef<Drive>(newDrive({ pose: 'idle', expr: 'normal', heading: Math.PI }))
  const cloth = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 0.95 }), [])
  useFrame(() => {
    const t = incidentState.current
    const g = group.current
    if (!(t instanceof Thief) || !g) return
    g.visible = t.phase !== 'gone'
    const floor = HOME.floorAt(t.x, t.z)
    g.position.set(t.x, floor + t.climb * 1.35, t.z)
    const d = drive.current
    d.heading = t.heading
    d.speed = t.speed
    d.pose = t.phase === 'flee' ? 'scared' : t.phase === 'try' || t.phase === 'steal' ? 'reach' : t.phase === 'climbIn' || t.phase === 'climbOut' ? 'reach' : 'idle'
    d.expr = t.phase === 'flee' ? 'scared' : 'normal'
    if (sack.current) sack.current.visible = t.loot
    if (mark.current) {
      mark.current.visible = t.status === 'active' && t.phase !== 'flee'
      mark.current.position.y = 2.15 + Math.sin(performance.now() / 180) * 0.05
    }
  })
  return (
    <group ref={group} visible={false}>
      <Chibi spec={SPECS.thief} drive={drive} outline={outline} />
      <sprite ref={mark} scale={[0.34, 0.34, 1]} position={[0, 2.15, 0]} renderOrder={4}>
        <spriteMaterial map={tex().alert} transparent depthTest={false} depthWrite={false} />
      </sprite>
      {/* 背在背上的布袋（偷到東西才有） */}
      <group ref={sack} visible={false} position={[0.12, 0.95, -0.28]}>
        <mesh material={cloth} scale={[1, 0.85, 0.8]} castShadow>
          <sphereGeometry args={[0.2, 12, 10]} />
        </mesh>
        <mesh material={cloth} position={[0, 0.2, 0]}>
          <coneGeometry args={[0.07, 0.12, 8]} />
        </mesh>
      </group>
    </group>
  )
}

/** 小偷嚇跑時掉在埕上的袋子：撿起來還給客人 */
function BagActor() {
  const group = useRef<THREE.Group>(null)
  const glow = useRef<THREE.Sprite>(null)
  const cloth = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 0.95 }), [])
  useFrame(({ clock }) => {
    const t = incidentState.current
    const g = group.current
    if (!g) return
    const bag = t instanceof Thief ? t.bag : null
    g.visible = !!bag && !bag.returned
    if (!bag || bag.returned) return
    g.position.set(bag.x, HOME.floorAt(bag.x, bag.z), bag.z)
    if (glow.current) glow.current.scale.setScalar(0.7 + Math.sin(clock.elapsedTime * 3) * 0.12)
  })
  const t = tex()
  return (
    <group ref={group} visible={false}>
      <mesh material={cloth} position={[0, 0.13, 0]} scale={[1.15, 0.7, 0.9]} rotation={[0, 0.6, 0.2]} castShadow>
        <sphereGeometry args={[0.2, 12, 10]} />
      </mesh>
      <mesh material={cloth} position={[0.08, 0.26, 0.02]} rotation={[0, 0, -0.5]}>
        <coneGeometry args={[0.06, 0.14, 8]} />
      </mesh>
      <sprite ref={glow} position={[0, 0.25, 0]} renderOrder={3}>
        <spriteMaterial map={t.glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.6} toneMapped={false} />
      </sprite>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 醉漢：站在門口搖搖晃晃，拿著酒瓶唱歌（唱的時候冒音符）
// ---------------------------------------------------------------------------

function DrunkActor({ outline }: { outline: boolean }) {
  const group = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const notes = useRef<(THREE.Sprite | null)[]>([])
  const drive = useRef<Drive>(newDrive({ pose: 'drink', expr: 'normal', heading: Math.PI }))
  useFrame(({ clock }) => {
    const d = incidentState.current
    const g = group.current
    if (!(d instanceof Drunk) || !g) return
    const time = clock.elapsedTime
    g.visible = d.mode !== 'gone' && d.mode !== 'wait'
    g.position.set(d.x, HOME.floorAt(d.x, d.z), d.z)
    const dr = drive.current
    dr.heading = d.heading
    dr.speed = d.speed
    dr.pose = d.mode === 'flee' ? 'scared' : d.mode === 'talk' ? 'idle' : 'drink'
    dr.expr = d.mode === 'flee' ? 'scared' : 'normal'
    // 醉醺醺地左右晃
    if (body.current) body.current.rotation.z = Math.sin(time * 1.3) * (d.mode === 'talk' ? 0.03 : 0.09)
    notes.current.forEach((sp, i) => {
      if (!sp) return
      sp.visible = d.singFlash > 0
      if (!sp.visible) return
      const k = (1.4 - d.singFlash + i * 0.3) % 1.4
      sp.position.set(0.25 + Math.sin(k * 5 + i) * 0.2, 1.9 + k * 0.8, 0)
      ;(sp.material as THREE.SpriteMaterial).opacity = Math.sin((k / 1.4) * Math.PI)
    })
  })
  const t = tex()
  return (
    <group ref={group} visible={false}>
      <group ref={body}>
        <Chibi spec={SPECS.drunk} drive={drive} outline={outline} />
      </group>
      {[0, 1, 2].map((i) => (
        <sprite
          key={i}
          ref={(el) => {
            notes.current[i] = el
          }}
          scale={[0.24, 0.24, 1]}
          visible={false}
          renderOrder={3}
        >
          <spriteMaterial map={t.note} transparent depthWrite={false} />
        </sprite>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 小宇躲起來：阿嬤靠近（3 公尺內）時，他旁邊冒一點點亮光（「嘻嘻」）
// ---------------------------------------------------------------------------

function LostHint() {
  const sp = useRef<THREE.Sprite>(null)
  useFrame(({ clock }) => {
    const l = incidentState.current
    const s = sp.current
    if (!s) return
    const kid = night.sim?.guests.find((g) => g.id === 'xiaoyu')
    const show = l instanceof LostChild && l.mode === 'hide' && !!kid && Math.hypot(player.x - kid.x, player.z - kid.z) < 3
    s.visible = show
    if (!show || !kid) return
    const time = clock.elapsedTime
    s.position.set(kid.x + Math.sin(time * 2) * 0.25, HOME.floorAt(kid.x, kid.z) + 1.1 + Math.sin(time * 3) * 0.1, kid.z)
    s.scale.setScalar(0.45 + Math.sin(time * 5) * 0.08)
  })
  const t = tex()
  return (
    <sprite ref={sp} visible={false} renderOrder={3}>
      <spriteMaterial map={t.glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.8} toneMapped={false} />
    </sprite>
  )
}
