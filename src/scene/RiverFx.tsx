import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { RIVER, inRiver, riverCenter, riverGround, riverHalfWidth, riverKids, riverWater } from '../world/sceneRiver'
import { canvasTexture, seeded } from './kit'
import { lanternAt } from './daylight'
import { Chibi, newDrive, type Drive } from '../chars/Chibi'
import { SPECS } from '../chars/specs'
import { player } from '../world/player'
import '../chars/specs.river'

// 溪邊會動的東西：火金姑（螢火蟲，這個場景的主角）、攔沙壩的小瀑布與水花、玩水的小鬼。

const R = RIVER

// ---------------------------------------------------------------------------
// 火金姑：幾百隻，一閃一閃、慢慢飄。水邊、芒草邊最多，竹林邊也有。
// 用 Points + 自己的 shader：每隻的漂移與閃爍都在 GPU 算，一次 draw call。
// ---------------------------------------------------------------------------

const FIREFLY_VERT = /* glsl */ `
uniform float uTime;
uniform float uScale;
attribute float aPhase;
attribute float aSpeed;
attribute float aBlink;
varying float vGlow;
void main() {
  float t = uTime * aSpeed;
  vec3 p = position;
  p.x += sin(t * 0.7 + aPhase) * 0.55 + sin(t * 1.9 + aPhase * 3.1) * 0.12;
  p.z += cos(t * 0.6 + aPhase * 1.7) * 0.55;
  p.y += sin(t * 1.1 + aPhase * 2.3) * 0.22;
  // 大部分時間暗暗的，偶爾亮起來
  float b = sin(uTime * aBlink + aPhase * 5.0);
  vGlow = 0.15 + 0.85 * smoothstep(0.25, 1.0, b);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uScale * (0.35 + 0.65 * vGlow) / -mv.z;
  gl_Position = projectionMatrix * mv;
}`

const FIREFLY_FRAG = /* glsl */ `
uniform float uFade;
varying float vGlow;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  // 小小的亮核＋一圈大大的柔光（看起來像在發光，不是一顆點）
  float core = 1.0 - smoothstep(0.0, 0.14, d);
  float halo = 1.0 - smoothstep(0.0, 1.0, d);
  float a = (core + pow(halo, 2.2) * 0.75) * vGlow * uFade;
  if (a < 0.01) discard;
  vec3 col = mix(vec3(0.66, 1.0, 0.3), vec3(1.0, 1.0, 0.78), core);
  gl_FragColor = vec4(col * (1.2 + 2.5 * core * vGlow), min(1.0, a));
}`

/** 火金姑的位置：沿著兩岸與水面，偶爾在竹林邊、小路邊 */
function fireflyField(n: number) {
  const r = seeded(2024)
  const pos = new Float32Array(n * 3)
  const phase = new Float32Array(n)
  const speed = new Float32Array(n)
  const blink = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let x = 0
    let z = 0
    const kind = r()
    if (kind < 0.7) {
      // 水邊
      x = -19 + r() * 38
      const side = r() < 0.5 ? -1 : 1
      z = riverCenter(x) + side * (riverHalfWidth(x) + (r() - 0.35) * 2.4)
    } else if (kind < 0.88) {
      // 竹林邊
      const g = R.groves[Math.floor(r() * R.groves.length)]
      x = g.x + (r() - 0.5) * g.rx * 2.4
      z = g.z + 1.2 + r() * 1.8
    } else {
      // 草地上零零星星
      x = -18 + r() * 36
      z = -6 + r() * 16
    }
    const ground = inRiver(x, z) ? riverWater(x) : riverGround(x, z)
    pos[i * 3] = x
    pos[i * 3 + 1] = ground + 0.25 + Math.pow(r(), 1.8) * 1.9
    pos[i * 3 + 2] = z
    phase[i] = r() * Math.PI * 2
    speed[i] = 0.3 + r() * 0.5
    blink[i] = 0.8 + r() * 2.2
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
  g.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1))
  g.setAttribute('aBlink', new THREE.BufferAttribute(blink, 1))
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 40)
  return g
}

export function Fireflies({ count }: { count: number }) {
  const geo = useMemo(() => fireflyField(count), [count])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: FIREFLY_VERT,
        fragmentShader: FIREFLY_FRAG,
        uniforms: { uTime: { value: 0 }, uScale: { value: 400 }, uFade: { value: 1 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )
  const { size, gl, camera } = useThree()
  useFrame(({ clock }) => {
    const t = useStore.getState().time
    mat.uniforms.uTime.value = clock.elapsedTime
    // 傍晚只有零星幾隻，天黑後滿滿的
    mat.uniforms.uFade.value = THREE.MathUtils.clamp(lanternAt(t) * 1.25 - 0.1, 0, 1)
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 36
    // 光暈大約 0.4 公尺大（亮核很小）
    mat.uniforms.uScale.value = (0.4 * size.height * gl.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)))
  })
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={5} />
}

/** 跟著幾群火金姑慢慢飄的綠色小光（只在高畫質；讓草和水面有一點點綠光） */
export function FireflyGlow() {
  const lights = useRef<(THREE.PointLight | null)[]>([])
  const spots = useMemo(() => [-9, -1, 6.5].map((x, i) => ({ x, z: riverCenter(x) + (i % 2 ? 2.6 : -2.4), ph: i * 2.1 })), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const k = THREE.MathUtils.clamp(lanternAt(useStore.getState().time) * 1.2 - 0.15, 0, 1)
    spots.forEach((s, i) => {
      const l = lights.current[i]
      if (!l) return
      l.position.set(s.x + Math.sin(t * 0.21 + s.ph) * 2.2, 0.9 + Math.sin(t * 0.5 + s.ph) * 0.2, s.z + Math.cos(t * 0.17 + s.ph) * 1.2)
      l.intensity = k * (1.1 + 0.4 * Math.sin(t * 1.7 + s.ph))
    })
  })
  return (
    <group>
      {spots.map((_, i) => (
        <pointLight
          key={i}
          ref={(el) => {
            lights.current[i] = el
          }}
          color="#b6ff6a"
          distance={6}
          decay={2}
          intensity={0}
        />
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 攔沙壩：水從壩頂滑下來的一片水簾（往下捲的條紋）、底下的白色水花
// ---------------------------------------------------------------------------

const fallTex = canvasTexture(64, 128, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h)
  const r = seeded(3)
  for (let i = 0; i < 26; i++) {
    const x = r() * w
    const len = 20 + r() * 60
    const y = r() * h
    const g = ctx.createLinearGradient(0, y, 0, y + len)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.5, `rgba(235,245,255,${0.35 + r() * 0.45})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(x, y, 1.5 + r() * 2.5, len)
    // 上下接得起來
    if (y + len > h) ctx.fillRect(x, y - h, 1.5 + r() * 2.5, len)
  }
})
fallTex.wrapS = fallTex.wrapT = THREE.RepeatWrapping

const foamTex = canvasTexture(64, 64, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2)
  g.addColorStop(0, 'rgba(255,255,255,0.85)')
  g.addColorStop(0.5, 'rgba(240,248,255,0.35)')
  g.addColorStop(1, 'rgba(240,248,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
})

export function Waterfall() {
  const c = riverCenter(R.weirX)
  const hw = riverHalfWidth(R.weirX)
  const drop = R.waterUp - R.waterDown
  const sheetTex = useMemo(() => {
    const t = fallTex.clone()
    t.repeat.set(hw * 1.2, 1)
    t.needsUpdate = true
    return t
  }, [hw])
  const sheetMat = useMemo(() => new THREE.MeshBasicMaterial({ map: sheetTex, transparent: true, depthWrite: false, color: '#dfefff', side: THREE.DoubleSide }), [sheetTex])
  const puffs = useRef<(THREE.Sprite | null)[]>([])
  const puffData = useMemo(() => {
    const r = seeded(11)
    return Array.from({ length: 14 }, () => ({ z: c + (r() - 0.5) * hw * 1.8, ph: r() * 3, s: 0.35 + r() * 0.4 }))
  }, [c, hw])
  useFrame(({ clock }, dt) => {
    sheetTex.offset.y += Math.min(dt, 0.1) * 1.6
    const t = clock.elapsedTime
    puffData.forEach((p, i) => {
      const sp = puffs.current[i]
      if (!sp) return
      const k = (t * 0.8 + p.ph) % 1
      sp.position.set(R.weirX + 0.55 + k * 0.9, R.waterDown + 0.06 + Math.sin(k * Math.PI) * 0.12, p.z)
      const s = p.s * (0.6 + k * 0.8)
      sp.scale.set(s, s * 0.6, 1)
      ;(sp.material as THREE.SpriteMaterial).opacity = 0.75 * (1 - k)
    })
  })
  return (
    <group userData={{ noMerge: true }}>
      {/* 水簾：從壩頂斜斜滑下 */}
      <group position={[R.weirX + 0.5, (R.waterUp + R.waterDown) / 2, c]} rotation-z={0.3}>
        <mesh rotation-y={Math.PI / 2} material={sheetMat}>
          <planeGeometry args={[hw * 2, drop + 0.12]} />
        </mesh>
      </group>
      {/* 壩頂一層亮亮的水膜 */}
      <mesh position={[R.weirX, R.waterUp + 0.045, c]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.7, hw * 2]} />
        <meshStandardMaterial color="#9fc8d8" roughness={0.05} metalness={0.2} transparent opacity={0.55} />
      </mesh>
      {puffData.map((_, i) => (
        <sprite
          key={i}
          ref={(el) => {
            puffs.current[i] = el
          }}
        >
          <spriteMaterial map={foamTex} transparent depthWrite={false} />
        </sprite>
      ))}
    </group>
  )
}

/** 水流過石頭的白色小水花（踏腳石、大石頭邊） */
export function Ripples({ spots }: { spots: [number, number][] }) {
  const refs = useRef<(THREE.Sprite | null)[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    spots.forEach(([x, z], i) => {
      const sp = refs.current[i]
      if (!sp) return
      const k = (t * 0.6 + i * 0.37) % 1
      sp.position.set(x + 0.28 + k * 0.5, riverWater(x) + 0.015, z)
      const s = 0.3 + k * 0.35
      sp.scale.set(s, s * 0.45, 1)
      ;(sp.material as THREE.SpriteMaterial).opacity = 0.45 * (1 - k)
    })
  })
  return (
    <group userData={{ noMerge: true }}>
      {spots.map((_, i) => (
        <sprite
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
        >
          <spriteMaterial map={foamTex} transparent depthWrite={false} />
        </sprite>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 玩水的小鬼：阿弟仔在淺水裡繞圈、跳起來潑水；阿妹仔站在水邊看，偶爾揮手。
// 阿嬤靠近時兩個都轉過來看她。晚上才出來（riverKids.visible，之後改成陰陽眼）。
// ---------------------------------------------------------------------------

export function RiverKids({ outline }: { outline: boolean }) {
  const group = useRef<THREE.Group>(null)
  const boy = useRef<THREE.Group>(null)
  const girl = useRef<THREE.Group>(null)
  const boyDrive = useRef<Drive>(newDrive({ pose: 'idle', expr: 'happy' }))
  const girlDrive = useRef<Drive>(newDrive({ pose: 'idle', expr: 'normal', heading: -2 }))
  const drops = useRef<(THREE.Sprite | null)[]>([])
  const dropState = useMemo(() => Array.from({ length: 10 }, () => ({ x: 0, y: -9, z: 0, vx: 0, vy: 0, vz: 0 })), [])
  const lastHop = useRef(0)
  const girlPos = useMemo<[number, number]>(() => [R.kids.x - 1.1, R.kids.z + 1.3], [])

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const s = useStore.getState()
    const g = group.current
    if (!g) return
    g.visible = riverKids.visible(s)
    if (!g.visible) return
    const t = clock.elapsedTime
    const w = riverWater(R.kids.x)
    // 阿弟仔：繞一個小圈，每一圈跳兩下
    const a = t * 0.55
    const bx = R.kids.x + Math.cos(a) * 1.0
    const bz = R.kids.z + Math.sin(a) * 0.6
    const hopPhase = (t * 1.1) % 1
    const hop = hopPhase < 0.3 ? Math.sin((hopPhase / 0.3) * Math.PI) * 0.35 : 0
    const bd = boyDrive.current
    const near = Math.hypot(player.x - bx, player.z - bz) < 4
    bd.heading = near ? Math.atan2(player.x - bx, player.z - bz) : Math.atan2(-Math.sin(a), Math.cos(a))
    bd.speed = near ? 0 : 1.2
    bd.pose = hop > 0.05 ? 'wave' : 'idle'
    bd.hop = hop
    bd.expr = 'happy'
    boy.current?.position.set(bx, w - 0.1, bz)
    // 落水的那一刻：濺起水花
    if (hopPhase > 0.3 && t - lastHop.current > 0.6) {
      lastHop.current = t
      dropState.forEach((d) => {
        const ang = Math.random() * Math.PI * 2
        const v = 0.6 + Math.random() * 0.9
        d.x = bx
        d.z = bz
        d.y = w + 0.05
        d.vx = Math.cos(ang) * v
        d.vz = Math.sin(ang) * v
        d.vy = 1.4 + Math.random() * 1.2
      })
    }
    dropState.forEach((d, i) => {
      d.vy -= 6 * dt
      d.x += d.vx * dt
      d.y += d.vy * dt
      d.z += d.vz * dt
      const sp = drops.current[i]
      if (!sp) return
      sp.visible = d.y > w
      sp.position.set(d.x, d.y, d.z)
    })
    // 阿妹仔：站在水邊，看著哥哥；阿嬤來了就看阿嬤、揮手
    const gd = girlDrive.current
    const gNear = Math.hypot(player.x - girlPos[0], player.z - girlPos[1]) < 4
    gd.heading = gNear ? Math.atan2(player.x - girlPos[0], player.z - girlPos[1]) : Math.atan2(bx - girlPos[0], bz - girlPos[1])
    gd.pose = gNear || Math.sin(t * 0.4) > 0.75 ? 'wave' : 'idle'
    gd.expr = gNear ? 'happy' : 'normal'
    girl.current?.position.set(girlPos[0], riverWater(girlPos[0]) - 0.06, girlPos[1])
  })

  return (
    <group ref={group} userData={{ noMerge: true }} visible={false}>
      <group ref={boy}>
        <Chibi spec={SPECS.guikid1} drive={boyDrive} outline={outline} />
      </group>
      <group ref={girl}>
        <Chibi spec={SPECS.guikid2} drive={girlDrive} outline={outline} />
      </group>
      {dropState.map((_, i) => (
        <sprite
          key={i}
          ref={(el) => {
            drops.current[i] = el
          }}
          scale={[0.09, 0.09, 1]}
        >
          <spriteMaterial map={foamTex} transparent depthWrite={false} color="#e8f6ff" />
        </sprite>
      ))}
    </group>
  )
}
