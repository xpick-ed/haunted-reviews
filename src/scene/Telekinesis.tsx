import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { sfx } from '../audio/sfx'
import { night } from '../world/night/director'
import { player } from '../world/player'
import { HOME } from '../world/scenes'
import { canvasTexture } from './kit'
import { outlineMat, toon } from '../chars/toon'
import { TK_DONE, TK_RANGE, clampFloor, pathPoint, projectRay, rayToPlane, targetStart, tkTargets, type TKTarget, type V3 } from '../world/night/tk'
import type { NightSim } from '../world/night/sim'

// 念力模式（DESIGN §26.2）：深夜在家裡，store.tk 開著時，阿嬤身邊 6 公尺內可以拖的東西會發青光；
// 用手指／滑鼠按住拖：東西慢半拍、晃晃地跟著（鬼的手），只能沿著自己的路徑走（被子往枕頭、窗往關上、
// 掉的東西往床頭櫃、球在地上滾）。拖到底就呼叫 store.tkApply（拖太快的話導演會變成聲音）。
// 規則（有哪些東西、路徑）在 src/world/night/tk.ts。

/** 每個東西這一晚的狀態（跨 React 重畫保留） */
interface RT {
  /** 路徑上的比例（poly）；想去的比例 */
  t: number
  want: number
  /** 球的位置、想去的位置 */
  x: number
  z: number
  wx: number
  wz: number
  pos: V3
  prev: V3
  done: boolean
  doneAt: number
  /** 滾動（球）的旋轉 */
  roll: THREE.Quaternion
  seed: number
}

const rt = new Map<string, RT>()
/** 目前拖著什麼：pointer、螢幕座標（-1..1）、拖的過程最快的速度；forced 是測試用（直接指定位置） */
const drag = { id: null as string | null, pointerId: -1, ndc: [0, 0] as [number, number], maxSpeed: 0, forced: null as number | [number, number] | null }
/** 今晚用掉的（球滾過一次）、門剛甩過在冷卻的房間 */
let used = new Set<string>()
let usedSim: NightSim | null = null
const doorCool = new Map<string, number>()
let lastBark = 0
/** 測試用：最近一次的目標（依 id） */
const lastTargets = new Map<string, TKTarget>()

function getRT(t: TKTarget): RT {
  let r = rt.get(t.id)
  if (!r) {
    const p = targetStart(t)
    r = { t: 0, want: 0, x: p[0], z: p[2], wx: p[0], wz: p[2], pos: [...p], prev: [...p], done: false, doneAt: 0, roll: new THREE.Quaternion(), seed: Math.random() * 10 }
    rt.set(t.id, r)
  }
  return r
}

function release() {
  drag.id = null
  drag.pointerId = -1
  drag.forced = null
}

const BARK: Partial<Record<TKTarget['kind'], string>> = {
  blanket: 'body.tk.blanket',
  ball: 'body.tk.ball',
  window: 'body.tk.window',
  item: 'body.tk.item',
  door: 'body.tk.door',
}

/** 拖到底：交給導演（滿足需求、太快變聲音） */
function complete(t: TKTarget, r: RT) {
  r.done = true
  r.doneAt = performance.now()
  const speed = drag.maxSpeed
  release()
  const s = useStore.getState()
  s.tkApply(t.kind, t.room, speed, [r.pos[0], r.pos[2]])
  if (t.kind === 'ball') used.add(t.id)
  if (t.kind === 'door' && t.room) doorCool.set(t.room, performance.now() + 4000)
  if (t.kind === 'blanket') sfx.play('cloth', { volume: 0.5 })
  else if (t.kind === 'window' || t.kind === 'door') sfx.play(speed > 1.2 ? 'door_close' : 'creak', { volume: speed > 1.2 ? 0.8 : 0.4 })
  else sfx.play('pickup', { volume: 0.5 })
  const line = speed > 1.8 && t.kind === 'door' ? 'body.tk.slam' : BARK[t.kind]
  const now = performance.now()
  if (line && now - lastBark > 6000) {
    lastBark = now
    s.bark(line, t.kind !== 'door')
  }
}

// ---------------------------------------------------------------------------
// 材質、貼圖
// ---------------------------------------------------------------------------

const glowTex = canvasTexture(64, 64, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2)
  g.addColorStop(0, 'rgba(160,250,255,0.9)')
  g.addColorStop(0.4, 'rgba(143,244,255,0.35)')
  g.addColorStop(1, 'rgba(143,244,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
})

const ballTex = canvasTexture(64, 32, (ctx, w, h) => {
  const cols = ['#e94b4b', '#f4d03f', '#4aa3df', '#f4d03f']
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = cols[i]
    ctx.fillRect((i * w) / 4, 0, w / 4, h)
  }
})

const GHOST = new THREE.MeshBasicMaterial({ color: '#8ff4ff', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
const HIT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
const CYAN_LINE = outlineMat(0.006, '#8ff4ff')

// ---------------------------------------------------------------------------
// 圖層
// ---------------------------------------------------------------------------

export function TelekinesisLayer() {
  const on = useStore((s) => s.tk && s.phase === 'night' && s.scene === 'home' && !s.possess && !s.hidden)
  if (!on) return null
  return <TKActive />
}

/** 測試用：念力圖層現在用的相機與畫布（window.__tk.screen 算螢幕座標） */
let devView: { camera: THREE.Camera; canvas: HTMLCanvasElement } | null = null

function TKActive() {
  const { gl, camera } = useThree()
  if (import.meta.env.DEV) devView = { camera, canvas: gl.domElement }
  const [targets, setTargets] = useState<TKTarget[]>([])
  const key = useRef('')
  const refresh = useRef(0)

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return
      const r = gl.domElement.getBoundingClientRect()
      drag.ndc = [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1]
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId === drag.pointerId) release()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      release()
      document.body.style.cursor = ''
    }
  }, [gl])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const s = useStore.getState()
    const sim = night.sim
    if (!sim) return
    // 新的一晚：今晚用掉的清空
    if (usedSim !== sim) {
      usedSim = sim
      used = new Set()
      rt.clear()
      doorCool.clear()
    }
    // 念力很耗陰氣：用完就自動關掉
    s.spendYin(dt * 1.5)
    if (useStore.getState().yin <= 0.1) {
      release()
      s.toggleTK()
      s.bark('body.tk.noyin')
      return
    }
    refresh.current -= dt
    if (refresh.current > 0) return
    refresh.current = 0.25
    const now = performance.now()
    const cool = new Set([...doorCool].filter(([, until]) => until > now).map(([room]) => room))
    const list = tkTargets(sim, s.objects, used, cool).filter((t) => {
      if (drag.id === t.id) return true
      const p = rt.get(t.id)?.pos ?? targetStart(t)
      return Math.hypot(p[0] - player.x, p[2] - player.z) < TK_RANGE
    })
    // 剛完成的東西多留 0.7 秒（淡出、門彈回去）
    for (const t of targets) {
      const r = rt.get(t.id)
      if (r?.done && now - r.doneAt < 700 && !list.some((x) => x.id === t.id)) list.push(t)
    }
    if (import.meta.env.DEV) for (const t of list) lastTargets.set(t.id, t)
    const k = list.map((t) => t.id).join(',')
    if (k !== key.current) {
      key.current = k
      setTargets(list)
    }
  })

  return (
    <group userData={{ noMerge: true }}>
      {targets.map((t) => (
        <TKObject key={t.id} target={t} />
      ))}
      <Thread />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 一個可以拖的東西
// ---------------------------------------------------------------------------

const ray = new THREE.Raycaster()
const ndcV = new THREE.Vector2()
const qTmp = new THREE.Quaternion()
const axisTmp = new THREE.Vector3()

function TKObject({ target }: { target: TKTarget }) {
  const { camera, gl } = useThree()
  const handle = useRef<THREE.Group>(null)
  const glow = useRef<THREE.Sprite>(null)
  const ghost = useRef<THREE.Group>(null)
  const sheet = useRef<THREE.Mesh>(null)
  const ballMesh = useRef<THREE.Mesh>(null)
  const fade = useRef(1)

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const time = clock.elapsedTime
    const r = getRT(target)
    const p = target.path
    const dragging = drag.id === target.id
    if (dragging && Math.hypot(r.pos[0] - player.x, r.pos[2] - player.z) > TK_RANGE + 0.5) release()

    // 手指指到哪
    if (drag.id === target.id) {
      ndcV.set(drag.ndc[0], drag.ndc[1])
      ray.setFromCamera(ndcV, camera)
      const o: V3 = [ray.ray.origin.x, ray.ray.origin.y, ray.ray.origin.z]
      const d: V3 = [ray.ray.direction.x, ray.ray.direction.y, ray.ray.direction.z]
      if (p.type === 'poly') r.want = typeof drag.forced === 'number' ? drag.forced : projectRay(p.pts, o, d)
      else {
        const hit = Array.isArray(drag.forced) ? drag.forced : rayToPlane(o, d, p.y)
        if (hit) [r.wx, r.wz] = clampFloor(p, hit[0], hit[1])
      }
    } else if (!r.done || target.kind === 'door') {
      // 放開：沒拖到底的彈回原位（門甩出去之後也會自己彈回來）；球停在放開的地方
      if (p.type === 'poly') r.want = 0
    }

    // 鬼的手：慢半拍
    const k = 1 - Math.exp(-(dragging ? 7 : 4) * dt)
    r.prev = [...r.pos]
    if (p.type === 'poly') {
      if (!r.done || target.kind === 'door') r.t += (r.want - r.t) * k
      r.pos = pathPoint(p.pts, r.t)
    } else {
      r.x += (r.wx - r.x) * k
      r.z += (r.wz - r.z) * k
      ;[r.x, r.z] = clampFloor(p, r.x, r.z)
      r.pos = [r.x, p.y, r.z]
    }
    // 晃（拖著的時候晃得多）
    const wob = dragging ? 0.018 : 0.006
    const pos: V3 = [
      r.pos[0] + Math.sin(time * 7 + r.seed) * wob,
      r.pos[1] + (target.look === 'ball' ? 0 : Math.sin(time * 5 + r.seed) * wob + (dragging && p.type === 'poly' ? 0.03 : 0)),
      r.pos[2] + Math.cos(time * 6 + r.seed) * wob,
    ]
    const speed = Math.hypot(r.pos[0] - r.prev[0], r.pos[1] - r.prev[1], r.pos[2] - r.prev[2]) / Math.max(dt, 1e-3)
    if (dragging) drag.maxSpeed = Math.max(drag.maxSpeed, speed)

    // 拖到底
    if (dragging && !r.done) {
      const reached = p.type === 'poly' ? r.t >= TK_DONE : Math.hypot(r.x - p.goal[0], r.z - p.goal[1]) < p.goalR
      if (reached) complete(target, r)
    }
    // 完成後淡出（門除外：門會彈回去）
    const wantFade = r.done && target.kind !== 'door' ? 0 : 1
    fade.current += (wantFade - fade.current) * (1 - Math.exp(-6 * dt))

    if (handle.current) {
      handle.current.position.set(pos[0], pos[1], pos[2])
      handle.current.scale.setScalar(Math.max(0.001, fade.current))
    }
    if (glow.current) {
      const pulse = 1 + Math.sin(time * 4 + r.seed) * 0.12
      glow.current.scale.setScalar((dragging ? 0.62 : 0.44) * pulse)
      ;(glow.current.material as THREE.SpriteMaterial).opacity = (dragging ? 0.95 : 0.6) * fade.current
    }
    // 球：照移動的方向滾
    if (ballMesh.current && target.look === 'ball') {
      const dx = r.pos[0] - r.prev[0]
      const dz = r.pos[2] - r.prev[2]
      const dist = Math.hypot(dx, dz)
      if (dist > 1e-5) {
        axisTmp.set(dz, 0, -dx).normalize()
        qTmp.setFromAxisAngle(axisTmp, dist / 0.08)
        r.roll.premultiply(qTmp)
      }
      ballMesh.current.quaternion.copy(r.roll)
    }
    // 窗、門：鬼影板子跟著轉
    if (ghost.current && target.arc) {
      const a = target.arc.a0 + (target.arc.a1 - target.arc.a0) * r.t
      ghost.current.rotation.y = a
      ghost.current.visible = r.t > 0.01 || dragging
    }
    // 被子：從床尾拉出一片鬼影被單到手上
    if (sheet.current && target.bed) {
      const len = Math.max(0.001, target.bed.z0 - r.pos[2])
      sheet.current.visible = r.t > 0.01
      sheet.current.scale.set(target.bed.w - 0.1, len, 1)
      sheet.current.position.set(target.bed.x, target.bed.topY + 0.15, target.bed.z0 - len / 2)
      ;(sheet.current.material as THREE.MeshBasicMaterial).opacity = 0.22 * fade.current
    }
  })

  const down = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    // 不要讓觸控搖桿也接到這一下
    e.nativeEvent.stopPropagation()
    const r = getRT(target)
    if (r.done && target.kind !== 'door') return
    if (Math.hypot(r.pos[0] - player.x, r.pos[2] - player.z) > TK_RANGE) return
    const rect = gl.domElement.getBoundingClientRect()
    drag.id = target.id
    drag.pointerId = e.pointerId
    drag.maxSpeed = 0
    drag.forced = null
    drag.ndc = [((e.nativeEvent.clientX - rect.left) / rect.width) * 2 - 1, -((e.nativeEvent.clientY - rect.top) / rect.height) * 2 + 1]
    if (target.kind === 'door') r.done = false
    try {
      gl.domElement.setPointerCapture(e.pointerId)
    } catch {
      // 有些瀏覽器的觸控不給抓，沒關係：window 還是收得到 pointermove
    }
    sfx.play('whoosh', { volume: 0.18 })
  }

  const arc = target.arc
  return (
    <group>
      {/* 窗、門的鬼影板子（鉸鏈在 arc.hinge） */}
      {arc && (
        <group ref={ghost} position={arc.hinge} visible={false}>
          {target.look === 'shutter' ? (
            <mesh material={GHOST} position={[0, 0, arc.r / 2]}>
              <boxGeometry args={[0.03, 1.0, arc.r]} />
            </mesh>
          ) : (
            <mesh material={GHOST} position={[0, 0, arc.r / 2]}>
              <boxGeometry args={[0.07, 2.2, arc.r]} />
            </mesh>
          )}
        </group>
      )}
      {/* 被子的鬼影被單（一片平躺的長方形） */}
      {target.bed && (
        <mesh ref={sheet} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color="#9ff6ff" transparent opacity={0.22} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      <group ref={handle}>
        <Look look={target.look} ballRef={ballMesh} />
        <sprite ref={glow} scale={0.44} renderOrder={2}>
          <spriteMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.6} />
        </sprite>
        {/* 點擊範圍：比東西大一圈，手機好按 */}
        <mesh
          material={HIT}
          onPointerDown={down}
          onPointerOver={() => {
            document.body.style.cursor = 'grab'
          }}
          onPointerOut={() => {
            document.body.style.cursor = ''
          }}
        >
          <sphereGeometry args={[0.34, 10, 8]} />
        </mesh>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 東西的樣子（都有一圈青色的邊：被念力抓著）
// ---------------------------------------------------------------------------

function Look({ look, ballRef }: { look: TKTarget['look']; ballRef: React.RefObject<THREE.Mesh | null> }) {
  const m = useMemo(
    () => ({
      cloth: toon('#e37b8a'),
      clothIn: toon('#f6e6d2'),
      frame: toon('#2c2a2a'),
      lens: new THREE.MeshBasicMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.35 }),
      phone: toon('#1e1e24'),
      screen: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 1.1, 1.6), toneMapped: false }),
      cup: new THREE.MeshToonMaterial({ color: '#eef4f6', transparent: true, opacity: 0.7 }),
      teeth: toon('#f7f2e6'),
      gum: toon('#e98a96'),
      ball: toon('#ffffff', { map: ballTex, glow: 0.25 }),
    }),
    [],
  )
  switch (look) {
    case 'corner':
      // 被子的一角：摺起來的三角形（外面花布、裡面白）
      return (
        <group rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
          <mesh material={m.cloth} castShadow>
            <circleGeometry args={[0.16, 3]} />
          </mesh>
          <mesh material={m.clothIn} position={[0, 0, -0.004]} rotation={[Math.PI, 0, 0]}>
            <circleGeometry args={[0.16, 3]} />
          </mesh>
          <mesh material={CYAN_LINE}>
            <circleGeometry args={[0.17, 3]} />
          </mesh>
        </group>
      )
    case 'ball':
      return (
        <group>
          <mesh ref={ballRef} material={m.ball} castShadow>
            <sphereGeometry args={[0.08, 18, 12]} />
          </mesh>
          <mesh material={CYAN_LINE}>
            <sphereGeometry args={[0.08, 18, 12]} />
          </mesh>
        </group>
      )
    case 'glasses':
      return (
        <group rotation={[0, 0.4, 0]}>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.028, 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <mesh material={m.frame}>
                <torusGeometry args={[0.022, 0.004, 6, 16]} />
              </mesh>
              <mesh material={m.lens}>
                <circleGeometry args={[0.021, 16]} />
              </mesh>
            </group>
          ))}
          <mesh material={m.frame} position={[0, 0.012, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.003, 0.003, 0.014, 5]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={`arm${s}`} material={m.frame} position={[s * 0.05, 0.01, -0.04]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.0025, 0.0025, 0.08, 4]} />
            </mesh>
          ))}
          <mesh material={CYAN_LINE} scale={[1.6, 0.6, 1.4]}>
            <sphereGeometry args={[0.04, 10, 8]} />
          </mesh>
        </group>
      )
    case 'phone':
      return (
        <group rotation={[0, 0.5, 0]}>
          <mesh material={m.phone} castShadow>
            <boxGeometry args={[0.07, 0.012, 0.14]} />
          </mesh>
          <mesh material={m.screen} position={[0, 0.0065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.062, 0.12]} />
          </mesh>
          <mesh material={CYAN_LINE}>
            <boxGeometry args={[0.07, 0.012, 0.14]} />
          </mesh>
        </group>
      )
    case 'cup':
      return (
        <group>
          <mesh material={m.cup} position={[0, 0.035, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.03, 0.07, 14, 1, true]} />
          </mesh>
          {/* 杯子裡的假牙（粉紅的牙齦＋一排白牙） */}
          <mesh material={m.gum} position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.018, 0.006, 6, 12, Math.PI]} />
          </mesh>
          <mesh material={m.teeth} position={[0, 0.027, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.018, 0.004, 6, 12, Math.PI]} />
          </mesh>
          <mesh material={CYAN_LINE} position={[0, 0.035, 0]}>
            <cylinderGeometry args={[0.035, 0.03, 0.07, 14]} />
          </mesh>
        </group>
      )
    case 'shutter':
    case 'door':
      // 拉手：一個小小的發光把手（板子本身是鬼影，在 TKObject 裡畫）
      return (
        <group>
          <mesh material={m.frame}>
            <torusGeometry args={[0.04, 0.009, 6, 14]} />
          </mesh>
          <mesh material={CYAN_LINE}>
            <torusGeometry args={[0.04, 0.009, 6, 14]} />
          </mesh>
        </group>
      )
  }
}

// ---------------------------------------------------------------------------
// 阿嬤的手到東西之間的一條青色細線（拖著的時候）
// ---------------------------------------------------------------------------

const THREAD_N = 24

function Thread() {
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(THREAD_N * 3), 3))
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#8ff4ff', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }))
    l.frustumCulled = false
    return l
  }, [])
  const beads = useRef<(THREE.Sprite | null)[]>([])
  useFrame(({ clock }) => {
    const r = drag.id ? rt.get(drag.id) : null
    line.visible = !!r
    beads.current.forEach((b) => b && (b.visible = !!r))
    if (!r) return
    const t = clock.elapsedTime
    const a: V3 = [player.x, HOME.floorAt(player.x, player.z) + 1.25, player.z]
    const b = r.pos
    const mid: V3 = [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + 0.35, (a[2] + b[2]) / 2]
    const pos = line.geometry.attributes.position as THREE.BufferAttribute
    const at = (k: number): V3 => {
      const u = 1 - k
      const wig = Math.sin(k * 9 - t * 8) * 0.03 * Math.sin(k * Math.PI)
      return [u * u * a[0] + 2 * u * k * mid[0] + k * k * b[0] + wig, u * u * a[1] + 2 * u * k * mid[1] + k * k * b[1] + wig, u * u * a[2] + 2 * u * k * mid[2] + k * k * b[2]]
    }
    for (let i = 0; i < THREAD_N; i++) {
      const p = at(i / (THREAD_N - 1))
      pos.setXYZ(i, p[0], p[1], p[2])
    }
    pos.needsUpdate = true
    // 沿線往東西那邊跑的小光點
    beads.current.forEach((sp, i) => {
      if (!sp) return
      const k = (t * 0.9 + i / 4) % 1
      const p = at(k)
      sp.position.set(p[0], p[1], p[2])
      sp.scale.setScalar(0.08 + Math.sin(k * Math.PI) * 0.06)
    })
  })
  return (
    <group>
      <primitive object={line} />
      {[0, 1, 2, 3].map((i) => (
        <sprite
          key={i}
          ref={(el) => {
            beads.current[i] = el
          }}
          visible={false}
          renderOrder={3}
        >
          <spriteMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
    </group>
  )
}

// 開發時：自動化測試可以直接拖（window.__tk.drag('blanket:r1', 1)；球給 [x, z]）
if (import.meta.env.DEV) {
  ;(window as unknown as { __tk: unknown }).__tk = {
    list: () => [...rt.entries()].map(([id, r]) => ({ id, t: +r.t.toFixed(2), want: +r.want.toFixed(2), pos: r.pos.map((v) => +v.toFixed(2)), done: r.done })),
    drag: (id: string, to: number | [number, number]) => {
      drag.id = id
      drag.pointerId = -99
      drag.maxSpeed = 0
      drag.forced = to
    },
    release,
    state: () => ({ ...drag }),
    /** 在螢幕 (clientX, clientY) 按下去的射線，投到東西的路徑上是多少（除錯用） */
    probe: (id: string, cx: number, cy: number) => {
      const tg = lastTargets.get(id)
      if (!tg || !devView || tg.path.type !== 'poly') return null
      const rect = devView.canvas.getBoundingClientRect()
      ndcV.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1)
      ray.setFromCamera(ndcV, devView.camera)
      const o: V3 = [ray.ray.origin.x, ray.ray.origin.y, ray.ray.origin.z]
      const d: V3 = [ray.ray.direction.x, ray.ray.direction.y, ray.ray.direction.z]
      return { t: projectRay(tg.path.pts, o, d), o, d, end: tg.path.pts[tg.path.pts.length - 1] }
    },
    /** 東西現在在螢幕上的哪裡（clientX, clientY），給模擬滑鼠拖曳用；路徑比例 t 可以指定 */
    screen: (id: string, t?: number) => {
      const r = rt.get(id)
      if (!r || !devView) return null
      const tg = [...rt.keys()].includes(id) ? r : null
      let p: V3 = tg ? r.pos : [0, 0, 0]
      if (t !== undefined && lastTargets.has(id)) {
        const path = lastTargets.get(id)!.path
        if (path.type === 'poly') p = pathPoint(path.pts, t)
      }
      const v = new THREE.Vector3(p[0], p[1], p[2]).project(devView.camera)
      const rect = devView.canvas.getBoundingClientRect()
      return [rect.left + ((v.x + 1) / 2) * rect.width, rect.top + ((1 - v.y) / 2) * rect.height]
    },
  }
}
