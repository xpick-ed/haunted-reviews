import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { audio } from '../audio'
import { input } from '../world/input'
import { player } from '../world/player'
import { FEED, SUGAR, sugarState } from '../world/sceneSugar'
import { giveGood } from '../world/goodsGive'
import { lanternAt } from './daylight'
import { canvasTexture, planeGeo, seeded, TILE } from './kit'
import { MergeStatic } from './MergeStatic'
import { Fader } from './OldStreetFader'
import { Ground } from './VillageKit'
import { CaneClumps, CaneTrain, Track } from './StationProps'
import { CanePiles, Chimney, Freezer, MillFloor, MillMachines, MillPosts, MillShell, NoticeBoard, WelfareShop, YardProps, useSugarMats } from './SugarProps'
import { Chibi, ChibiNpc, SEAT_Y, newDrive, type Drive } from '../chars/Chibi'
import { SPECS } from '../chars/specs'
import '../chars/specs.station2'

// 糖廠（DESIGN §32.3）：五分車的終點。生鏽的壓榨工場、大煙囪、福利社、甘蔗堆。
// 陰陽眼打開：第二十三期製糖的鬼工人還在上工（滾筒慢慢轉、煙囪冒煙），阿嬤可以幫忙推甘蔗（長按，三捆）。
// 規則、碰撞、熱點在 src/world/sceneSugar.ts；靜態擺設在 SugarProps.tsx。

const S = SUGAR

export function SugarScene() {
  const quality = useStore((s) => s.quality)
  const vision = useStore((s) => s.vision)
  const outline = quality === 'high'
  useFirstVisit()
  return (
    <group>
      <SugarGrounds />
      <CaneAround quality={quality} />
      <MergeStatic>
        <MillFloor />
        <MillMachines />
        <Chimney />
        <NoticeBoard />
        <YardProps />
        <Freezer />
        <Platform />
      </MergeStatic>
      <Fader id="sugar_mill">
        <MergeStatic>
          <MillShell />
          <MillPosts />
        </MergeStatic>
      </Fader>
      <Fader id="sugar_shop">
        <MergeStatic>
          <WelfareShop />
        </MergeStatic>
      </Fader>
      <CanePiles />
      <Track z={S.track.z} x0={S.track.x0} x1={S.track.x1} />
      <SpurTrack />
      <CaneTrain z={S.track.z} locoX={S.train.locoX} wagons={S.train.wagons} />
      <Rollers />
      <FeedLayer />
      <Lights />
      <group visible={vision}>
        <Ghosts outline={outline} />
        <Smoke />
      </group>
    </group>
  )
}

/** 第一次來（每天一次）：阿嬤的感想 */
function useFirstVisit() {
  useEffect(() => {
    const s = useStore.getState()
    if (s.flags.sugar_visit_today) return
    const again = !!s.flags.sugar_been
    useStore.setState({ flags: { ...s.flags, sugar_visit_today: true, sugar_been: true } })
    const id = window.setTimeout(() => {
      const st = useStore.getState()
      st.bark(again ? 'st2.sugar.arrive.again' : st.isNight ? 'st2.sugar.arrive.night' : 'st2.sugar.arrive.dusk')
    }, 1300)
    return () => window.clearTimeout(id)
  }, [])
}

// ---------------------------------------------------------------------------
// 地面：泥土的廠區、月台、鐵軌的碎石道床；四周是甘蔗田
// ---------------------------------------------------------------------------

function SugarGrounds() {
  const sg = useSugarMats()
  return (
    <group>
      <Ground mat="mud" w={60} d={26} position={[0, 0.01, -3.5]} tint="#9a8a70" />
      <Ground mat="grass" w={90} d={60} position={[0, -0.02, -3]} tint="#6a7a4a" />
      <mesh geometry={planeGeo(60, 2.6, TILE.stone)} material={sg.ballast} rotation-x={-Math.PI / 2} position={[-8, 0.03, S.track.z]} receiveShadow />
    </group>
  )
}

function Platform() {
  const sg = useSugarMats()
  const P = S.platform
  return (
    <group>
      <mesh material={sg.concrete} position={[(P.x0 + P.x1) / 2, P.y / 2, (P.z0 + P.z1) / 2]} castShadow receiveShadow>
        <boxGeometry args={[P.x1 - P.x0, P.y, P.z1 - P.z0]} />
      </mesh>
      {/* 月台邊的黃線 */}
      <mesh position={[(P.x0 + P.x1) / 2, P.y + 0.005, P.z1 - 0.12]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[P.x1 - P.x0, 0.08]} />
        <meshStandardMaterial color="#d8b83a" roughness={0.7} />
      </mesh>
      {/* 終點的車擋 */}
      <mesh position={[S.track.x1 + 0.2, 0.4, S.track.z]} castShadow>
        <boxGeometry args={[0.3, 0.7, 1.6]} />
        <meshStandardMaterial color="#8f2a20" roughness={0.6} />
      </mesh>
      <StationSign />
    </group>
  )
}

/** 月台上的站名牌「糖廠」 */
function StationSign() {
  const tex = useMemo(
    () =>
      canvasTexture(512, 200, (ctx, w, h) => {
        ctx.fillStyle = '#f7f4ea'
        ctx.fillRect(0, 0, w, h)
        ctx.strokeStyle = '#1b2f5a'
        ctx.lineWidth = 10
        ctx.strokeRect(8, 8, w - 16, h - 16)
        ctx.fillStyle = '#1b2f5a'
        ctx.font = '700 88px "LXGW WenKai TC", "Noto Serif TC", serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('糖　廠', w / 2, h / 2 - 10)
        ctx.font = '500 28px "LXGW WenKai TC", "Noto Serif TC", serif'
        ctx.fillText('← 後壁厝　　（終點）', w / 2, h - 34)
      }),
    [],
  )
  return (
    <group position={[-8.6, S.platform.y, S.platform.z0 + 0.25]}>
      {[-0.75, 0.75].map((x) => (
        <mesh key={x} position={[x, 0.8, 0]}>
          <boxGeometry args={[0.07, 1.6, 0.07]} />
          <meshStandardMaterial color="#3f3b36" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 1.45, 0.04]}>
        <planeGeometry args={[1.7, 0.66]} />
        <meshStandardMaterial map={tex} roughness={0.7} />
      </mesh>
    </group>
  )
}

/** 廠區的窄軌支線：從月台往北伸進工場（沿 z 的軌道：把 Track 轉 90°） */
function SpurTrack() {
  return (
    <group position={[S.spurWagon.x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
      <Track z={0} x0={-S.platform.z0 + 0.2} x1={-S.mill.z1 - 0.4} />
    </group>
  )
}

/** 四周的甘蔗田（走不到的地方） */
function CaneAround({ quality }: { quality: 'high' | 'low' }) {
  const spots = useMemo(() => {
    const r = seeded(6161)
    const out: [number, number, number][] = []
    const step = quality === 'high' ? 1.2 : 1.7
    const add = (x0: number, x1: number, z0: number, z1: number) => {
      for (let x = x0; x < x1; x += step)
        for (let z = z0; z < z1; z += step) {
          if (r() < 0.15) continue
          out.push([x + (r() - 0.5) * step * 0.8, z + (r() - 0.5) * step * 0.8, 0.8 + r() * 0.4])
        }
    }
    // 只種在北邊與東西兩側的遠處：鏡頭在東南邊，南邊種了會擋住整個廠區
    add(-30, 30, -24, -12)
    add(-32, -18, -12, -1)
    add(18.5, 32, -12, -3)
    return out
  }, [quality])
  return <CaneClumps spots={spots} />
}

// ---------------------------------------------------------------------------
// 會動的：壓榨機的滾筒（陰陽眼開著慢慢轉；推甘蔗時轉快）、推上輸送帶的甘蔗、進度條
// ---------------------------------------------------------------------------

function Rollers() {
  const sg = useSugarMats()
  const refs = useRef<THREE.Mesh[]>([])
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.34, 0.34, 1.8, 18)
    g.rotateX(Math.PI / 2)
    return g
  }, [])
  const speed = useRef(0)
  useFrame((_, dt) => {
    const s = useStore.getState()
    const want = !s.vision ? 0 : sugarState.feed ? 2.6 : 0.5
    speed.current += (want - speed.current) * Math.min(1, dt * 2)
    for (const [i, m] of refs.current.entries()) if (m) m.rotation.z += dt * speed.current * (i % 3 === 0 ? -1 : 1)
  })
  const rollers: [number, number][] = [
    [0, 1.72],
    [-0.4, 1.08],
    [0.4, 1.08],
  ]
  return (
    <group userData={{ noMerge: true }}>
      {S.mills.map((x, mi) =>
        rollers.map(([dx, y], ri) => (
          <mesh
            key={`${mi}${ri}`}
            ref={(el) => {
              if (el) refs.current[mi * 3 + ri] = el
            }}
            geometry={geo}
            material={ri === 0 ? sg.iron : sg.rustDark}
            position={[x + dx, y, S.millZ]}
            castShadow
          />
        )),
      )}
    </group>
  )
}

/** 一捆甘蔗（推的時候跟著進度往輸送帶上走） */
function useBundleGeo() {
  return useMemo(() => {
    const r = seeded(808)
    const list: THREE.BufferGeometry[] = []
    for (let i = 0; i < 9; i++) {
      const c = new THREE.CylinderGeometry(0.04, 0.045, 1.4, 5)
      c.rotateX(Math.PI / 2)
      c.translate((i % 3) * 0.09 - 0.09, Math.floor(i / 3) * 0.08, (r() - 0.5) * 0.1)
      list.push(c)
    }
    const out = new THREE.BufferGeometry()
    // 簡單合併（只要位置與法線）
    let n = 0
    for (const g of list) n += g.attributes.position.count
    const pos = new Float32Array(n * 3)
    const nor = new Float32Array(n * 3)
    const idx: number[] = []
    let off = 0
    for (const g of list) {
      pos.set(g.attributes.position.array as Float32Array, off * 3)
      nor.set(g.attributes.normal.array as Float32Array, off * 3)
      const ix = g.index!
      for (let k = 0; k < ix.count; k++) idx.push(ix.getX(k) + off)
      off += g.attributes.position.count
      g.dispose()
    }
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
    out.setIndex(idx)
    return out
  }, [])
}

function barTexture(color: string) {
  return canvasTexture(64, 16, (ctx, w, h) => {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, w, h)
  })
}

/** 推甘蔗（長按）：每幀推進 sugarState.feed，推完三捆發獎勵 */
function FeedLayer() {
  const sg = useSugarMats()
  const bundleGeo = useBundleGeo()
  const bundle = useRef<THREE.Mesh>(null)
  const bar = useRef<THREE.Group>(null)
  const fill = useRef<THREE.Sprite>(null)
  const dots = useRef<(THREE.Sprite | null)[]>([])
  const up = useRef(1)
  const tex = useMemo(() => ({ bg: barTexture('#1a1410'), fg: barTexture('#f2c14e'), on: barTexture('#f2c14e'), off: barTexture('#5a4a3a') }), [])
  const c = S.carrier
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const s = useStore.getState()
    const f = sugarState.feed
    // 推的進度：站在旁邊、按住動作鍵才會前進；放開太久或走開就不推了
    if (f) {
      const d = Math.hypot(player.x - S.feed.x, player.z - S.feed.z)
      if (s.scene !== 'sugar' || !s.vision || d > FEED.reach + 0.8) sugarState.feed = null
      else if (input.actionHeld && d <= FEED.reach && !s.dialogue) {
        f.progress += dt
        f.idle = 0
        if (f.progress >= FEED.need) {
          f.bundle++
          f.progress = 0
          up.current = 0
          sugarState.pushedAt = performance.now()
          crunch()
          if (f.bundle >= FEED.bundles) {
            sugarState.feed = null
            finishFeeding()
          } else s.bark(f.bundle === 1 ? 'st2.mill.push.1' : 'st2.mill.push.2', true)
        }
      } else {
        f.idle += dt
        if (f.idle > FEED.idleCancel) sugarState.feed = null
      }
    }
    const cur = sugarState.feed
    // 甘蔗：推的時候在輸送帶腳下往前挪；推完一捆就沿著輸送帶往上送
    up.current = Math.min(1, up.current + dt / 1.3)
    const b = bundle.current
    if (b) {
      if (up.current < 1) {
        const k = up.current
        b.visible = true
        b.position.set(c.x, 0.3 + k * (c.top - 0.1), c.z0 - k * (c.z0 - c.z1))
      } else if (cur) {
        const k = cur.progress / FEED.need
        b.visible = true
        b.position.set(c.x, 0.28, S.feed.z - 0.6 - k * 0.55)
      } else b.visible = false
    }
    if (bar.current) bar.current.visible = !!cur
    if (cur && fill.current) fill.current.scale.x = Math.max(0.001, (cur.progress / FEED.need) * 1.2)
    dots.current.forEach((d, i) => {
      if (d) d.material.map = cur && i < cur.bundle ? tex.on : tex.off
    })
  })
  return (
    <group userData={{ noMerge: true }}>
      <mesh ref={bundle} geometry={bundleGeo} material={sg.cane} visible={false} castShadow />
      <group ref={bar} position={[S.feed.x, 2.45, S.feed.z - 0.3]} visible={false}>
        <sprite scale={[1.3, 0.16, 1]} renderOrder={5}>
          <spriteMaterial map={tex.bg} depthTest={false} transparent opacity={0.8} />
        </sprite>
        <sprite ref={fill} center={new THREE.Vector2(0, 0.5)} position={[-0.6, 0, 0]} scale={[0.001, 0.1, 1]} renderOrder={6}>
          <spriteMaterial map={tex.fg} depthTest={false} />
        </sprite>
        {[0, 1, 2].map((i) => (
          <sprite
            key={i}
            ref={(el) => {
              dots.current[i] = el
            }}
            position={[-0.25 + i * 0.25, 0.2, 0]}
            scale={[0.12, 0.12, 1]}
            renderOrder={6}
          >
            <spriteMaterial map={tex.off} depthTest={false} />
          </sprite>
        ))}
      </group>
    </group>
  )
}

/** 推完三捆：功德 +1；第一次推，工頭送一支枝仔冰 */
function finishFeeding() {
  const s = useStore.getState()
  const first = !s.flags.sugar_mill_ever
  useStore.setState({ flags: { ...s.flags, sugar_mill_today: true, sugar_mill_ever: true }, meta: { ...s.meta, merit: s.meta.merit + 1 } })
  s.bark('st2.mill.done')
  if (first) window.setTimeout(() => giveGood('icepop', 1, 'st2.mill.gift'), 3600)
}

/** 甘蔗被捲進滾筒：一聲悶響＋碎裂聲（合成） */
function crunch() {
  const ctx = audio.ctx
  if (!ctx) return
  const t = ctx.currentTime
  const o = ctx.createOscillator()
  o.type = 'triangle'
  o.frequency.setValueAtTime(110, t)
  o.frequency.exponentialRampToValueAtTime(48, t + 0.35)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
  o.connect(g).connect(audio.bus.sfx)
  o.start(t)
  o.stop(t + 0.45)
  const n = ctx.createBuffer(1, ctx.sampleRate * 0.35, ctx.sampleRate)
  const d = n.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2) * (Math.random() < 0.3 ? 1 : 0.3)
  const src = ctx.createBufferSource()
  src.buffer = n
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1800
  const g2 = ctx.createGain()
  g2.gain.value = 0.14
  src.connect(bp).connect(g2).connect(audio.bus.sfx)
  src.start(t)
}

// ---------------------------------------------------------------------------
// 燈：兩根路燈、跟著阿嬤的暖光、福利社窗口（陰陽眼開著才亮：鬼在顧店）
// ---------------------------------------------------------------------------

function Lights() {
  const bulb = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff3d0', emissive: '#ffd98a', emissiveIntensity: 0, roughness: 0.4 }), [])
  const shopGlow = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffd89a', transparent: true, opacity: 0, depthWrite: false }), [])
  const millBulb = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fff3d0', emissive: '#ffcf80', emissiveIntensity: 0, roughness: 0.4 }), [])
  const follow = useRef<THREE.PointLight>(null)
  const shop = useRef<THREE.PointLight>(null)
  const mill = useRef<THREE.PointLight>(null)
  useFrame(() => {
    const s = useStore.getState()
    const k = lanternAt(s.time)
    bulb.emissiveIntensity = k * 2.4
    const inside = s.building === 'sugar_mill'
    if (follow.current) {
      follow.current.intensity = 1.2 + k * (inside ? 6 : 4)
      follow.current.position.set(player.x + 1.2, 3.4, player.z + 1.4)
    }
    // 陰陽眼：鬼工人在上夜班，工場的燈泡、福利社的窗口都亮著
    const on = s.vision ? 1 : 0
    shopGlow.opacity = on * (0.25 + k * 0.45)
    if (shop.current) shop.current.intensity = on * (0.6 + k * 2.4)
    millBulb.emissiveIntensity = 0.15 + on * (0.6 + k * 1.8)
    if (mill.current) mill.current.intensity = on * (1 + k * 5)
  })
  return (
    <group userData={{ noMerge: true }}>
      {S.lamps.map((l) => (
        <group key={l.x} position={[l.x, 0, l.z]}>
          <mesh position={[0, 1.7, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, 3.4, 8]} />
            <meshStandardMaterial color="#4a4640" roughness={0.6} metalness={0.4} />
          </mesh>
          <mesh position={[0, 3.35, 0.25]}>
            <coneGeometry args={[0.24, 0.16, 14, 1, true]} />
            <meshStandardMaterial color="#3a3632" roughness={0.6} side={THREE.DoubleSide} />
          </mesh>
          <mesh material={bulb} position={[0, 3.28, 0.25]}>
            <sphereGeometry args={[0.08, 10, 8]} />
          </mesh>
        </group>
      ))}
      <mesh material={shopGlow} position={[S.shop.window, 1.45, S.shop.z1 - 0.2]}>
        <planeGeometry args={[1.6, 0.95]} />
      </mesh>
      {/* 工場裡吊著的燈泡 */}
      {[-9, -4.5, 0.5].map((x) => (
        <group key={x} position={[x, 0, (S.mill.z0 + S.mill.z1) / 2]}>
          <mesh position={[0, 4.15, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.9, 4]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <mesh position={[0, 3.72, 0]}>
            <coneGeometry args={[0.22, 0.14, 12, 1, true]} />
            <meshStandardMaterial color="#3a4a3a" roughness={0.6} side={THREE.DoubleSide} />
          </mesh>
          <mesh material={millBulb} position={[0, 3.66, 0]}>
            <sphereGeometry args={[0.07, 10, 8]} />
          </mesh>
        </group>
      ))}
      <pointLight ref={mill} position={[-4.5, 3.4, (S.mill.z0 + S.mill.z1) / 2]} color="#ffcf8a" intensity={0} distance={14} decay={1.8} />
      <pointLight ref={follow} color="#ffd9a0" intensity={1} distance={12} decay={2} />
      <pointLight ref={shop} position={[S.shop.window, 1.9, S.shop.z1 + 0.6]} color="#ffd08a" intensity={0} distance={6} decay={2} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 鬼（陰陽眼）：工頭、三個工人、坐在甘蔗堆上休息的工人、福利社阿姨
// ---------------------------------------------------------------------------

const WORKER_SPECS = ['sugar_worker1', 'sugar_worker2', 'sugar_worker3']

function Ghosts({ outline }: { outline: boolean }) {
  return (
    <group>
      <ChibiNpc id="sugar_foreman" pose="clasp" position={[S.foreman.x, 0.02, S.foreman.z]} heading={-0.6} seesGhosts outline={outline} />
      {S.workers.map((w, i) => (
        <Worker key={i} spec={WORKER_SPECS[i]} x={w.x} z={w.z} pose={w.pose} heading={w.heading} phase={i * 1.7} outline={outline} />
      ))}
      <SeatedWorker outline={outline} />
      <ChibiNpc id="sugar_auntie" pose="shopkeeper" position={[S.auntie.x, 0.02, S.auntie.z]} heading={0} seesGhosts outline={outline} />
    </group>
  )
}

/** 一個工人：原地慢慢晃（推甘蔗、搬甘蔗） */
function Worker({ spec, x, z, pose, heading, phase, outline }: { spec: string; x: number; z: number; pose: 'reach' | 'clasp' | 'idle'; heading: number; phase: number; outline: boolean }) {
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!g.current) return
    const t = clock.elapsedTime * 1.6 + phase
    g.current.position.set(x + Math.sin(t) * 0.06, 0.02, z + Math.cos(t) * 0.04)
  })
  return (
    <group ref={g} position={[x, 0.02, z]}>
      <ChibiNpc id={spec} pose={pose} position={[0, 0, 0]} heading={heading} outline={outline} />
    </group>
  )
}

function SeatedWorker({ outline }: { outline: boolean }) {
  const spec = SPECS.sugar_worker3
  const drive = useRef<Drive>(newDrive({ pose: 'sit', heading: 0.5 }))
  const seat = 0.62
  return (
    <group position={[S.resting.x, seat - SEAT_Y * spec.scale + 0.03, S.resting.z]}>
      <Chibi spec={spec} drive={drive} outline={outline} legs={false} />
    </group>
  )
}

/** 煙囪冒的煙（陰陽眼：糖廠又開工了） */
function Smoke() {
  const tex = useMemo(
    () =>
      canvasTexture(64, 64, (ctx, w, h) => {
        const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2)
        g.addColorStop(0, 'rgba(230,236,240,0.9)')
        g.addColorStop(1, 'rgba(230,236,240,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }),
    [],
  )
  const refs = useRef<(THREE.Sprite | null)[]>([])
  const top = 2.6 + S.chimney.h
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((sp, i) => {
      if (!sp) return
      const k = (t * 0.12 + i / 6) % 1
      sp.position.set(S.chimney.x + k * 2.2 + Math.sin(t * 0.7 + i) * 0.2, top + k * 4, S.chimney.z - k * 0.6)
      sp.scale.setScalar(0.8 + k * 2.4)
      ;(sp.material as THREE.SpriteMaterial).opacity = 0.55 * (1 - k) * Math.min(1, k * 6)
    })
  })
  return (
    <group userData={{ noMerge: true }}>
      {Array.from({ length: 6 }, (_, i) => (
        <sprite
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
        >
          <spriteMaterial map={tex} transparent depthWrite={false} opacity={0} />
        </sprite>
      ))}
    </group>
  )
}
