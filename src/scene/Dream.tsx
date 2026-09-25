import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { audio } from '../audio'
import { sfx } from '../audio/sfx'
import { player, placePlayer } from '../world/player'
import { BOSS_HALF, BOSS_RANGE, dreamFor, dreamState, startDream, stepDream, warmth, type DreamDef, type DreamEvent, type DreamRT } from '../world/dream'
import { Chibi, newDrive, type Drive, type PoseName } from '../chars/Chibi'
import { SPECS } from '../chars/specs'
import { toon } from '../chars/toon'
import { canvasTexture } from './kit'
import { MergeStatic } from './MergeStatic'
import { DreamIsland, DreamSet, FloatingIslets } from './DreamProps'

// 夢境（DESIGN §25.1）：托夢時整個場景換成客人的夢。規則在 src/world/dream.ts，
// 這裡每幀推進規則、把事件變成台詞與音效，並畫出做夢的人、影子、老闆、要撿的東西。
// 夢的樣子跟真實世界完全不同：浮在空中的島、漸層的天、飄著光點、自己的燈光和霧。

export function DreamScene() {
  const dream = useStore((s) => s.dream)
  const quality = useStore((s) => s.quality)
  const [rt, setRt] = useState<DreamRT | null>(null)
  const startedAt = dream?.startedAt

  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __dream: typeof dreamState }).__dream = dreamState
    const d = useStore.getState().dream
    if (!d) return
    const easy = useStore.getState().meta.skills.includes('deepdream')
    const r = startDream(dreamFor(d.guest, easy), (Math.floor(d.startedAt) % 997) + 1)
    dreamState.rt = r
    placePlayer(r.def.layout.spawn[0], r.def.layout.spawn[1])
    fx.poofs.length = 0
    fx.hints.length = 0
    setRt(r)
    return () => {
      if (dreamState.rt === r) dreamState.rt = null
    }
  }, [startedAt])

  if (!rt) return null
  const def = rt.def
  const outline = quality === 'high'
  return (
    <group key={startedAt}>
      <DreamLook def={def} quality={quality} />
      <MergeStatic>
        <DreamIsland def={def} />
        <DreamSet def={def} />
      </MergeStatic>
      <FloatingIslets def={def} />
      <DreamRunner rt={rt} />
      <Dreamer rt={rt} outline={outline} />
      {rt.shadows.length > 0 && <Shadows rt={rt} />}
      {rt.boss && <Boss rt={rt} />}
      {rt.items.length > 0 && <Items rt={rt} />}
      {def.mode === 'find' && <FindTarget rt={rt} />}
      {def.layout.goal && <GoalBeam rt={rt} />}
      <Poofs color={def.palette.particles} />
      <Hints />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 畫面效果（短暫的）：DreamRunner 收到事件就推進來，元件每幀讀
// ---------------------------------------------------------------------------

const fx = {
  poofs: [] as { x: number; z: number; t0: number }[],
  hints: [] as { x: number; z: number; t0: number; text: string }[],
  /** 找人的提示閃光（阿凱攝影機的紅燈） */
  flashAt: -99,
}

function DreamRunner({ rt }: { rt: DreamRT }) {
  const ended = useRef(false)
  const clock = useThree((s) => s.clock)
  useFrame((_, raw) => {
    const s = useStore.getState()
    // 天亮了還在夢裡：直接醒來
    if (!ended.current && s.phase !== 'night') {
      ended.current = true
      s.endDream(false)
      return
    }
    if (s.transitioning || s.dialogue || s.minigame) return
    const dt = Math.min(raw, 0.1)
    for (const e of stepDream(rt, dt, { x: player.x, z: player.z, speed: player.speed })) handle(e)
  })

  const handle = (e: DreamEvent) => {
    const s = useStore.getState()
    const now = clock.elapsedTime
    switch (e.t) {
      case 'bark':
        s.bark(e.id)
        break
      case 'poof':
        fx.poofs.push({ x: e.x, z: e.z, t0: now })
        if (fx.poofs.length > 8) fx.poofs.shift()
        break
      case 'hint':
        fx.hints.push({ x: e.x, z: e.z, t0: now, text: rt.def.theme === 'studio' ? '嗶嗶' : '嘻嘻' })
        if (fx.hints.length > 3) fx.hints.shift()
        fx.flashAt = now
        break
      case 'sfx':
        if (e.name === 'pickup') sfx.play('pickup', { volume: 0.8 })
        else if (e.name === 'chime' || e.name === 'found') audio.chime()
        else if (e.name === 'whoosh') audio.whoosh()
        else if (e.name === 'caught' || e.name === 'scared') {
          audio.heartbeat(2)
          useStore.setState({ horror: 0.5 })
        } else if (e.name === 'beep') sfx.play('switch', { volume: 0.35 })
        else if (e.name === 'poof') sfx.play('whoosh', { volume: 0.35 })
        break
      case 'end':
        if (!ended.current) {
          ended.current = true
          s.endDream(e.ok)
        }
        break
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// 天空、燈光、霧、光點
// ---------------------------------------------------------------------------

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 top;
  uniform vec3 bottom;
  uniform float time;
  void main() {
    vec3 d = normalize(vDir);
    float t = smoothstep(-0.35, 0.85, d.y);
    vec3 col = mix(bottom, top, t);
    // 慢慢轉的光帶（夢的漩渦）
    float a = atan(d.z, d.x);
    float band = sin(a * 3.0 + d.y * 7.0 + time * 0.12) * 0.5 + 0.5;
    col += vec3(1.0) * pow(band, 10.0) * 0.07 * (1.0 - abs(d.y));
    // 星點（閃爍）
    vec3 p = floor(d * 140.0);
    float h = fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    col += step(0.9972, h) * (0.5 + 0.5 * sin(time * 2.0 + h * 60.0)) * 0.8;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function DreamLook({ def, quality }: { def: DreamDef; quality: 'high' | 'low' }) {
  const p = def.palette
  const { scene } = useThree()
  const uniforms = useMemo(() => ({ top: { value: new THREE.Color(p.skyTop) }, bottom: { value: new THREE.Color(p.skyBottom) }, time: { value: 0 } }), [p])
  const fogColor = useMemo(() => new THREE.Color(p.fog), [p])
  useEffect(() => {
    return () => {
      // 回到真實世界：霧的距離還原（顏色 Daylight 每幀會設）
      const f = scene.fog as THREE.Fog | null
      if (f) {
        f.near = 45
        f.far = 160
      }
    }
  }, [scene])
  useFrame(({ clock }) => {
    uniforms.time.value = clock.elapsedTime
    // Daylight 先跑（比較早掛上），這裡蓋掉它設的霧
    const f = scene.fog as THREE.Fog | null
    if (f) {
      f.color.copy(fogColor)
      f.near = p.fogNear
      f.far = p.fogFar
    }
  })
  const b = def.layout.bounds
  return (
    <group>
      {/* 背景：比天空球（300 公尺）近，而且先畫、寫深度，把真實世界的天空蓋掉 */}
      <mesh scale={[90, 90, 90]} renderOrder={-2}>
        <sphereGeometry args={[1, 32, 16]} />
        <shaderMaterial uniforms={uniforms} vertexShader={SKY_VERT} fragmentShader={SKY_FRAG} side={THREE.BackSide} fog={false} />
      </mesh>
      <ambientLight color={p.fill} intensity={0.1 + p.bright * 0.4} />
      <hemisphereLight args={[p.light, p.groundEdge, 0.12 + p.bright * 0.6]} />
      <directionalLight color={p.light} intensity={0.25 + p.bright * 0.95} position={[9, 16, 7]} />
      <Sparkles
        count={quality === 'high' ? 70 : 35}
        scale={[b.x1 - b.x0 + 4, 5, b.z1 - b.z0 + 4]}
        position={[(b.x0 + b.x1) / 2, 2.4, (b.z0 + b.z1) / 2]}
        size={4}
        speed={0.25}
        color={p.particles}
        opacity={0.8}
        noise={1.2}
      />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 做夢的人
// ---------------------------------------------------------------------------

function Dreamer({ rt, outline }: { rt: DreamRT; outline: boolean }) {
  const def = rt.def
  const g = useRef<THREE.Group>(null)
  const drive = useRef<Drive>(newDrive({ pose: 'idle', expr: 'awake', heading: Math.PI }))
  const wasScared = useRef(false)
  const scaredAt = useRef(0)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const d = drive.current
    const D = rt.dreamer
    const grp = g.current
    if (!grp) return
    const happy = rt.done && rt.ok
    d.expr = D.scaredT > 0 ? 'scared' : happy ? 'happy' : 'awake'
    const scared = D.scaredT > 0
    if (scared && !wasScared.current) scaredAt.current = t
    wasScared.current = scared
    const since = t - scaredAt.current
    d.hop = scared && since < 0.5 ? Math.sin((since / 0.5) * Math.PI) * 0.35 : 0
    let pose: PoseName = 'idle'
    let x = D.x
    let z = D.z
    let visible = true
    if (def.mode === 'escort') {
      pose = scared ? 'scared' : happy ? 'wave' : def.theme === 'oldvillage' ? 'clasp' : 'idle'
      d.speed = D.speed
      d.heading = D.heading
    } else {
      d.speed = 0
      const face = Math.atan2(player.x - x, player.z - z)
      if (def.theme === 'office') {
        // 張經理：拿著電話焦慮地原地踱步
        pose = happy ? 'wave' : 'phone'
        d.heading = happy ? face : Math.PI + Math.sin(t * 1.3) * 1.2
        d.speed = happy ? 0 : Math.abs(Math.cos(t * 1.3)) * 0.6
      } else if (def.theme === 'mountain') {
        pose = happy ? 'eat' : 'sit'
        d.heading = face
      } else if (def.theme === 'studio') {
        pose = happy ? 'film' : 'idle'
        d.heading = happy ? face : Math.PI + Math.sin(t * 0.8) * 1.2
      } else if (def.theme === 'toys' && rt.lastReveal) {
        // 小宇：被找到的那一下從積木後面跳出來
        ;[x, z] = rt.lastReveal
        pose = 'wave'
        d.expr = 'happy'
        d.heading = face
        visible = happy || rt.t - rt.revealT < 1.8
        d.hop = rt.t - rt.revealT < 0.5 ? Math.sin(((rt.t - rt.revealT) / 0.5) * Math.PI) * 0.5 : 0
      } else visible = false
    }
    d.pose = pose
    grp.visible = visible
    grp.position.set(x, 0, z)
  })
  return (
    <group ref={g} userData={{ noMerge: true }}>
      <Chibi spec={SPECS[def.guest]} drive={drive} outline={outline} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 影子（陪走）：黑黑軟軟的一團，兩顆發亮的眼睛
// ---------------------------------------------------------------------------

const shadowMat = new THREE.MeshBasicMaterial({ color: '#12071a', transparent: true, opacity: 0.88 })
/** 影子外圍一圈紫光：暗的夢裡也看得到 */
let haloMat: THREE.SpriteMaterial | null = null
const shadowHalo = () =>
  (haloMat ??= new THREE.SpriteMaterial({ map: dotTexture(), color: new THREE.Color(1.1, 0.35, 1.6), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }))
const shadowEye = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.6, 1.4), toneMapped: false })
const puddleMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false })

function Shadows({ rt }: { rt: DreamRT }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    rt.shadows.forEach((s, i) => {
      const g = refs.current[i]
      if (!g) return
      g.visible = s.alive
      if (!s.alive) return
      const k = Math.min(1, (rt.t - s.born) / 0.8)
      const wob = Math.sin(t * 3 + i) * 0.06
      g.position.set(s.x, 0, s.z)
      g.scale.set(k * (1 + wob), k * (1 - wob), k * (1 + wob))
      g.rotation.y = s.heading
      const body = g.children[0]
      if (body) body.position.y = 0.8 + Math.sin(t * 2 + i) * 0.12
    })
  })
  return (
    <group userData={{ noMerge: true }}>
      {rt.shadows.map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
        >
          <group>
            <sprite material={shadowHalo()} scale={[2.6, 2.8, 1]} renderOrder={-1} />
            <mesh material={shadowMat} scale={[0.7, 0.9, 0.7]}>
              <sphereGeometry args={[1, 16, 12]} />
            </mesh>
            <mesh material={shadowMat} position={[0, -0.45, -0.25]} scale={[0.35, 0.4, 0.35]}>
              <sphereGeometry args={[1, 12, 8]} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} material={shadowEye} position={[s * 0.2, 0.15, 0.6]} scale={[0.09, 0.14, 0.06]}>
                <sphereGeometry args={[1, 8, 6]} />
              </mesh>
            ))}
          </group>
          <mesh material={puddleMat} rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
            <circleGeometry args={[0.8, 20]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 老闆的影子（收集・張經理）：高高瘦瘦、打紅領帶，地上有視線扇形
// ---------------------------------------------------------------------------

function Boss({ rt }: { rt: DreamRT }) {
  const g = useRef<THREE.Group>(null)
  const cone = useRef<THREE.Mesh>(null)
  const easy = rt.def.easy
  const coneGeo = useMemo(() => new THREE.CircleGeometry(BOSS_RANGE(easy), 28, -Math.PI / 2 - BOSS_HALF(easy), BOSS_HALF(easy) * 2).rotateX(-Math.PI / 2), [easy])
  const coneMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffe79a', transparent: true, opacity: 0.18, depthWrite: false, toneMapped: false }), [])
  const body = useMemo(() => toon('#1a1f33', { glow: 0.05 }), [])
  const tie = useMemo(() => toon('#c0182a', { glow: 0.4 }), [])
  const eye = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 2, 2), toneMapped: false }), [])
  useFrame(({ clock }) => {
    const b = rt.boss
    if (!b || !g.current) return
    const t = clock.elapsedTime
    g.current.position.set(b.x, Math.sin(t * 2.2) * 0.05, b.z)
    g.current.rotation.y = b.heading
    if (cone.current) {
      cone.current.position.set(b.x, 0.03, b.z)
      cone.current.rotation.y = b.heading
    }
    const k = Math.min(1, b.seeT / 0.5)
    coneMat.color.setRGB(1, 0.9 - k * 0.7, 0.6 - k * 0.55)
    coneMat.opacity = b.alarm > 0 ? 0.35 + Math.sin(t * 30) * 0.15 : 0.16 + k * 0.25
  })
  return (
    <group userData={{ noMerge: true }}>
      <group ref={g}>
        <mesh material={body} position={[0, 1.25, 0]}>
          <capsuleGeometry args={[0.38, 1.5, 6, 14]} />
        </mesh>
        <mesh material={body} position={[0, 2.55, 0]}>
          <sphereGeometry args={[0.36, 16, 12]} />
        </mesh>
        <mesh material={tie} position={[0, 1.65, 0.36]} rotation={[0.1, 0, 0]}>
          <boxGeometry args={[0.14, 0.7, 0.04]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={eye} position={[s * 0.13, 2.6, 0.32]} scale={[0.07, 0.035, 0.03]}>
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
        ))}
      </group>
      <mesh ref={cone} geometry={coneGeo} material={coneMat} renderOrder={1} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 要撿的東西（收集）：簡報紙、食物；腳下有光圈
// ---------------------------------------------------------------------------

let slideTex: THREE.Texture | null = null
function slideTexture() {
  return (slideTex ??= canvasTexture(128, 96, (ctx, w, h) => {
    ctx.fillStyle = '#fdfdf8'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#1f4e8a'
    ctx.fillRect(0, 0, w, 16)
    const cs = ['#e2533a', '#f0a83a', '#3aa0e2', '#5ac85a']
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = cs[i]
      const bh = 18 + ((i * 23) % 44)
      ctx.fillRect(18 + i * 26, h - 12 - bh, 18, bh)
    }
  }))
}

function Food({ i }: { i: number }) {
  switch (i % 5) {
    case 0: // 便當
      return (
        <group>
          <mesh material={toon('#c8342a', { glow: 0.3 })} position={[0, 0.12, 0]}>
            <boxGeometry args={[0.5, 0.18, 0.36]} />
          </mesh>
          <mesh material={toon('#f4f1ea', { glow: 0.3 })} position={[0, 0.23, 0]}>
            <boxGeometry args={[0.44, 0.04, 0.3]} />
          </mesh>
        </group>
      )
    case 1: // 茶葉蛋
      return (
        <mesh material={toon('#7a4a2a', { glow: 0.3 })} position={[0, 0.2, 0]} scale={[0.17, 0.22, 0.17]}>
          <sphereGeometry args={[1, 14, 10]} />
        </mesh>
      )
    case 2: // 泡麵
      return (
        <mesh material={toon('#f2d24a', { glow: 0.3 })} position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.2, 0.15, 0.36, 14]} />
        </mesh>
      )
    case 3: // 肉粽（會跑）
      return (
        <mesh material={toon('#4f8a3a', { glow: 0.3 })} position={[0, 0.25, 0]} rotation={[0.3, 0, 0]}>
          <tetrahedronGeometry args={[0.3, 0]} />
        </mesh>
      )
    default: // 烤地瓜
      return (
        <mesh material={toon('#8a3a6a', { glow: 0.3 })} position={[0, 0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.12, 0.3, 4, 10]} />
        </mesh>
      )
  }
}

function Items({ rt }: { rt: DreamRT }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  const office = rt.def.theme === 'office'
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(rt.def.palette.accent).multiplyScalar(1.6), transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }), [rt])
  const paper = useMemo(() => new THREE.MeshBasicMaterial({ map: slideTexture(), side: THREE.DoubleSide, toneMapped: false, color: new THREE.Color(1.25, 1.25, 1.25) }), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    ringMat.opacity = 0.4 + Math.sin(t * 4) * 0.2
    rt.items.forEach((it, i) => {
      const g = refs.current[i]
      if (!g) return
      g.visible = !it.got
      g.position.set(it.x, 0, it.z)
      const f = g.children[0]
      if (f) {
        f.position.y = 0.55 + Math.sin(t * 2 + i) * 0.15
        f.rotation.y = t * (office ? 1.4 : 0.9) + i
      }
    })
  })
  return (
    <group userData={{ noMerge: true }}>
      {rt.items.map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
        >
          <group>
            {office ? (
              <mesh material={paper} rotation={[0, 0, 0.15]}>
                <planeGeometry args={[0.62, 0.46]} />
              </mesh>
            ) : (
              <Food i={i} />
            )}
          </group>
          <mesh material={ringMat} rotation-x={-Math.PI / 2} position={[0, 0.04, 0]}>
            <ringGeometry args={[0.38, 0.5, 28]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 找人：離目標越近，躲的地方閃越多光點；阿凱的攝影機紅燈會閃
// ---------------------------------------------------------------------------

function FindTarget({ rt }: { rt: DreamRT }) {
  const sparks = useRef<(THREE.Mesh | null)[]>([])
  const cam = useRef<THREE.Group>(null)
  const rec = useRef<THREE.Mesh>(null)
  const flash = useRef<THREE.PointLight>(null)
  const studio = rt.def.theme === 'studio'
  const sparkMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(rt.def.palette.accent).multiplyScalar(2), toneMapped: false, transparent: true }), [rt])
  const recMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.2), toneMapped: false }), [])
  const clock = useThree((s) => s.clock)
  useFrame(() => {
    const t = clock.elapsedTime
    const s = rt.spots[rt.target]
    if (!s) return
    const w = rt.done ? 0 : warmth(rt, player.x, player.z)
    const hintK = Math.max(0, 1 - (t - fx.flashAt) / 1.4)
    sparks.current.forEach((m, i) => {
      if (!m) return
      const k = Math.max(w, hintK * 0.6)
      m.visible = k > 0.02 && !studio
      const a = t * 1.8 + (i / 6) * Math.PI * 2
      m.position.set(s.x + Math.cos(a) * 0.55, 0.4 + ((t * 0.7 + i * 0.37) % 1.2), s.z + Math.sin(a) * 0.55)
      m.scale.setScalar(0.04 + k * 0.07)
    })
    sparkMat.opacity = Math.min(1, w * 1.5 + hintK)
    if (cam.current) {
      // 攝影機：靠近 5 公尺內才看得到（躲在道具旁邊）
      cam.current.visible = studio && (w > 0 || hintK > 0) && !(rt.done && rt.ok)
      cam.current.position.set(s.x, 0, s.z)
    }
    if (rec.current) rec.current.visible = Math.sin(t * 8) > 0
    if (flash.current) {
      flash.current.position.set(s.x, 1.2, s.z)
      flash.current.intensity = studio ? hintK * 8 : 0
    }
  })
  return (
    <group userData={{ noMerge: true }}>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            sparks.current[i] = el
          }}
          material={sparkMat}
          visible={false}
        >
          <octahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
      <group ref={cam} visible={false}>
        <mesh material={toon('#1a1a1e', { glow: 0.15 })} position={[0, 0.35, 0]} rotation={[0, 0.6, 0.2]}>
          <boxGeometry args={[0.46, 0.3, 0.26]} />
        </mesh>
        <mesh material={toon('#2a2a30', { glow: 0.15 })} position={[0.2, 0.36, 0.14]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.12, 0.2, 12]} />
        </mesh>
        <mesh ref={rec} material={recMat} position={[-0.12, 0.54, 0.1]}>
          <sphereGeometry args={[0.045, 8, 6]} />
        </mesh>
      </group>
      <pointLight ref={flash} color="#ff3a3a" intensity={0} distance={6} decay={2} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 陪走的終點：一道從天上照下來的光柱（遠遠就看得到）；林太太的夢裡，小宇在光裡揮手
// ---------------------------------------------------------------------------

function GoalBeam({ rt }: { rt: DreamRT }) {
  const [gx, gz] = rt.def.layout.goal!
  const beam = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  const beamMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color(rt.def.palette.accent).multiplyScalar(1.3), transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }),
    [rt],
  )
  const kid = useRef<Drive>(newDrive({ pose: 'wave', expr: 'happy', heading: 0.6 }))
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    beamMat.opacity = 0.14 + Math.sin(t * 2) * 0.05
    if (ring.current) ring.current.scale.setScalar(1 + ((t * 0.6) % 1) * 0.6)
    if (beam.current) beam.current.rotation.y = t * 0.3
    kid.current.heading = Math.atan2(rt.dreamer.x - gx, rt.dreamer.z - gz)
  })
  return (
    <group position={[gx, 0, gz]} userData={{ noMerge: true }}>
      <mesh ref={beam} material={beamMat} position={[0, 7, 0]}>
        <cylinderGeometry args={[0.9, 1.3, 14, 20, 1, true]} />
      </mesh>
      <mesh ref={ring} material={beamMat} rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
        <ringGeometry args={[1.2, 1.45, 36]} />
      </mesh>
      {rt.def.theme === 'fog' && (
        <group position={[0, 0, -0.4]}>
          <Chibi spec={SPECS.xiaoyu} drive={kid} />
        </group>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 噗（影子散掉、翻錯地方）與「嘻嘻」提示
// ---------------------------------------------------------------------------

let dotTex: THREE.Texture | null = null
function dotTexture() {
  return (dotTex ??= canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.4, 'rgba(255,255,255,0.5)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }))
}

const POOF_N = 6
const POOF_P = 8

function Poofs({ color }: { color: string }) {
  const refs = useRef<(THREE.Sprite | null)[]>([])
  const mats = useMemo(
    () => Array.from({ length: POOF_N }, () => new THREE.SpriteMaterial({ map: dotTexture(), color: new THREE.Color(color).multiplyScalar(1.4), transparent: true, depthWrite: false, toneMapped: false })),
    [color],
  )
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    for (let b = 0; b < POOF_N; b++) {
      const p = fx.poofs[fx.poofs.length - 1 - b]
      const k = p ? (t - p.t0) / 0.9 : 1
      mats[b].opacity = Math.max(0, 1 - k)
      for (let i = 0; i < POOF_P; i++) {
        const s = refs.current[b * POOF_P + i]
        if (!s) continue
        s.visible = !!p && k < 1
        if (!p || k >= 1) continue
        const a = (i / POOF_P) * Math.PI * 2 + b
        const r = 0.2 + k * 1.1
        s.position.set(p.x + Math.cos(a) * r, 0.6 + k * 0.9 + (i % 2) * 0.3, p.z + Math.sin(a) * r)
        s.scale.setScalar(0.35 + k * 0.4)
      }
    }
  })
  return (
    <group userData={{ noMerge: true }}>
      {Array.from({ length: POOF_N * POOF_P }, (_, i) => (
        <sprite
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          material={mats[Math.floor(i / POOF_P)]}
          visible={false}
        />
      ))}
    </group>
  )
}

const hintTex = new Map<string, THREE.Texture>()
function hintTexture(text: string) {
  let t = hintTex.get(text)
  if (!t) {
    t = canvasTexture(
      192,
      96,
      (ctx, w, h) => {
        ctx.font = '900 56px "Noto Sans TC", sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineWidth = 10
        ctx.strokeStyle = '#3b2a2a'
        ctx.strokeText(text, w / 2, h / 2)
        ctx.fillStyle = '#fff6a8'
        ctx.fillText(text, w / 2, h / 2)
      },
      [{ spec: '900 56px "Noto Sans TC"', text }],
    )
    hintTex.set(text, t)
  }
  return t
}

function Hints() {
  const refs = useRef<(THREE.Sprite | null)[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    for (let i = 0; i < 3; i++) {
      const s = refs.current[i]
      const h = fx.hints[fx.hints.length - 1 - i]
      if (!s) continue
      const k = h ? (t - h.t0) / 2.2 : 1
      s.visible = !!h && k < 1
      if (!h || k >= 1) continue
      const m = s.material as THREE.SpriteMaterial
      const tx = hintTexture(h.text)
      if (m.map !== tx) {
        m.map = tx
        m.needsUpdate = true
      }
      m.opacity = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4)
      s.position.set(h.x, 1.8 + k * 1.2, h.z)
      s.scale.set(1.3, 0.65, 1)
    }
  })
  return (
    <group userData={{ noMerge: true }}>
      {[0, 1, 2].map((i) => (
        <sprite
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          visible={false}
          renderOrder={4}
        >
          <spriteMaterial transparent depthWrite={false} depthTest={false} toneMapped={false} />
        </sprite>
      ))}
    </group>
  )
}
