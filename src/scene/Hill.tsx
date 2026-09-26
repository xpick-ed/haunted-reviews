import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { useStore, type Quality } from '../store'
import { HILL, MOUNDS, TOMBS, terraceY, tombPoint, type TombDef } from '../world/sceneHill'
import { lanternAt } from './daylight'
import { BRUSH_FONT, TILE, WBox, canvasTexture, planeGeo, seeded, svgTexture, useMats } from './kit'
import { MergeStatic } from './MergeStatic'
import { buildGrass } from './Landscape'
import { PORTRAIT_SIZE, portraitSvg } from '../art/portraits'
import { Acacia, GhostWisps, HillGhosts, HuoboBowl, IncenseSmoke, QingmingScene, Silvergrass, Valley } from './HillProps'
import '../chars/specs.hill'
import { NightlifeProps } from './NightlifeProps'

// 山上墓仔埔（DESIGN §26.1）：三層台地的公墓，溫暖又有點寂寞，不是恐怖片。
// 下層是入口和長滿草的老墳，中層住著鬼鄰居（火伯、玉姨），上層是阿公阿嬤並排的墳，
// 山頂再過去往下掉，看得到山谷裡村子的燈。規則與座標在 src/world/sceneHill.ts。

const H = HILL

export function HillScene() {
  const quality = useStore((s) => s.quality)
  const isNight = useStore((s) => s.isNight)
  return (
    <group>
      <Terrain />
      <Valley />
      <Greenery quality={quality} />
      <MergeStatic>
        <Terraces />
        {TOMBS.map((t) => (
          <Tomb key={t.id} t={t} />
        ))}
        {MOUNDS.map((m, i) => (
          <Mound key={i} x={m.x} z={m.z} r={m.r} />
        ))}
        <Gate />
        <Rocks />
        <WeddingPhoto />
      </MergeStatic>
      <Acacia position={[H.acacia.x, H.t2, H.acacia.z]} scale={1.1} />
      <Acacia position={[-16.5, H.t2, -8.8]} scale={0.9} />
      <Acacia position={[23, H.t1, -6]} scale={1.2} />
      <Acacia position={[27, H.t1, 1.5]} scale={1.0} />
      <Acacia position={[-24, H.t1, -1]} scale={1.1} />
      <HuoboBowl />
      <IncenseSmoke />
      <TombLamps />
      <HillGhosts outline={quality === 'high'} />
      <NightlifeProps outline={quality === 'high'} />
      <QingmingScene outline={quality === 'high'} />
      <GhostWisps />
      <group visible={isNight}>
        <Sparkles count={30} scale={[30, 1.6, 18]} position={[0, 1.4, 0]} size={3.2} speed={0.25} color="#e8ff8a" opacity={0.85} noise={1.2} />
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 地形：三層台地、往北掉下去的山坡
// ---------------------------------------------------------------------------

function Terrain() {
  const mats = useMats()
  const grassTop = useMemo(() => {
    const m = mats.grass.clone()
    m.color.setRGB(0.78, 0.8, 0.7)
    return m
  }, [mats])
  const slope = useMemo(() => {
    const m = mats.grass.clone()
    m.color.setRGB(0.5, 0.55, 0.45)
    return m
  }, [mats])
  const dirt = useMemo(() => {
    const m = mats.mud.clone()
    m.color.setRGB(0.72, 0.64, 0.54)
    return m
  }, [mats])
  // 往北的山坡：從山頂邊緣往下掉到山谷
  const drop = useMemo(() => {
    const top = H.t2
    const bottom = -9
    const z0 = H.ridgeZ - 0.5
    const z1 = -26
    const len = Math.hypot(z0 - z1, top - bottom)
    return { len, y: (top + bottom) / 2, z: (z0 + z1) / 2, tilt: Math.atan2(top - bottom, z0 - z1) }
  }, [])
  return (
    <group>
      {/* 下層：入口這邊一直到鏡頭前面 */}
      <mesh geometry={planeGeo(140, 40, TILE.grass)} material={grassTop} rotation-x={-Math.PI / 2} position={[0, 0, H.wall1Z + 20]} receiveShadow />
      {/* 中層、上層的地面（長長的往東西延伸，看不到邊） */}
      <mesh geometry={planeGeo(140, H.wall1Z - H.wall2Z, TILE.grass)} material={grassTop} rotation-x={-Math.PI / 2} position={[0, H.t1, (H.wall1Z + H.wall2Z) / 2]} receiveShadow />
      <mesh geometry={planeGeo(140, H.wall2Z - H.ridgeZ + 0.5, TILE.grass)} material={grassTop} rotation-x={-Math.PI / 2} position={[0, H.t2, (H.wall2Z + H.ridgeZ - 0.5) / 2]} receiveShadow />
      <mesh geometry={planeGeo(140, drop.len, TILE.grass)} material={slope} position={[0, drop.y, drop.z]} rotation-x={-Math.PI / 2 - drop.tilt} receiveShadow />
      {/* 泥土小路：入口 → 石階 → 中層 → 石階 → 阿公阿嬤；中層往東西兩邊分岔 */}
      <mesh geometry={planeGeo(2.0, 11.9 - H.wall1Z - H.stairLen, TILE.mud)} material={dirt} rotation-x={-Math.PI / 2} position={[0, 0.015, (11.9 + H.wall1Z + H.stairLen) / 2]} receiveShadow />
      <mesh geometry={planeGeo(2.0, H.wall1Z - H.wall2Z - H.stairLen, TILE.mud)} material={dirt} rotation-x={-Math.PI / 2} position={[0, H.t1 + 0.012, (H.wall1Z + H.wall2Z + H.stairLen) / 2]} receiveShadow />
      <mesh geometry={planeGeo(24, 1.3, TILE.mud)} material={dirt} rotation-x={-Math.PI / 2} position={[0, H.t1 + 0.01, 1.7]} receiveShadow />
      <mesh geometry={planeGeo(2.0, 2.4, TILE.mud)} material={dirt} rotation-x={-Math.PI / 2} position={[0, H.t2 + 0.012, H.wall2Z - 1.2]} receiveShadow />
      <mesh geometry={planeGeo(14, 1.2, TILE.mud)} material={dirt} rotation-x={-Math.PI / 2} position={[0.5, H.t2 + 0.01, -5.3]} receiveShadow />
    </group>
  )
}

/** 擋土牆、石階、樓梯兩邊的矮牆 */
function Terraces() {
  const lip = 0.14
  const walls: { z: number; base: number; top: number }[] = [
    { z: H.wall1Z, base: 0, top: H.t1 },
    { z: H.wall2Z, base: H.t1, top: H.t2 },
  ]
  return (
    <group>
      {walls.map((w) => {
        const h = w.top - w.base + lip
        const len = 60 - H.stairHalf
        return (
          <group key={w.z}>
            {[-1, 1].map((s) => (
              <WBox key={s} mat="stone" size={[len, h, 0.34]} position={[s * (H.stairHalf + len / 2), w.base + h / 2, w.z]} />
            ))}
            {/* 石階：四階，越往南越低 */}
            {[0, 1, 2, 3].map((i) => {
              const top = w.top - ((w.top - w.base) * i) / 4
              const d = H.stairLen / 4
              return <WBox key={i} mat="stone" size={[H.stairHalf * 2, top - w.base + 0.02, d]} position={[0, w.base + (top - w.base) / 2, w.z + d * (i + 0.5)]} />
            })}
            {/* 樓梯兩邊的矮扶牆 */}
            {[-1, 1].map((s) => (
              <WBox key={`r${s}`} mat="stone" size={[0.24, w.top - w.base + 0.32, H.stairLen]} position={[s * H.stairHalf, w.base + (w.top - w.base + 0.32) / 2, w.z + H.stairLen / 2]} />
            ))}
          </group>
        )
      })}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 墳（椅子墳）：墓埕、墓碑、馬蹄形的墓手、墓龜、后土、香爐、花瓶、墓紙
// ---------------------------------------------------------------------------

/** 馬蹄形的墓手：往前（local +z）開口 */
function horseshoe(ro: number, ri: number, h: number) {
  const a0 = -Math.PI / 6
  const a1 = Math.PI + Math.PI / 6
  const sh = new THREE.Shape()
  sh.absarc(0, 0.3, ro, a0, a1, false)
  sh.absarc(0, 0.3, ri, a1, a0, true)
  sh.closePath()
  const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 28 })
  // 形狀在 xy 平面、往 +z 擠出 → 轉成往上長，形狀的 +y 變成往後（-z）
  g.rotateX(-Math.PI / 2)
  return g
}

let SHARED: ReturnType<typeof makeShared> | null = null
function shared() {
  return (SHARED ??= makeShared())
}
function makeShared() {
  const matOf = (color: string, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness })
  return {
    outer: horseshoe(1.3, 1.04, 0.62),
    inner: horseshoe(1.04, 0.84, 0.4),
    mound: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    cement: { tidy: matOf('#b9b6ae'), new: matOf('#cfcbc2', 0.7), weathered: matOf('#8f8c84'), overgrown: matOf('#6f7266') },
    granite: { tidy: matOf('#6d6f72', 0.45), new: matOf('#3f4245', 0.3), weathered: matOf('#77766f', 0.7), overgrown: matOf('#5f625b', 0.85) },
    moss: matOf('#4d6a3a', 1),
    grassMound: matOf('#56703f', 1),
    brass: new THREE.MeshStandardMaterial({ color: '#b08a3a', roughness: 0.35, metalness: 0.7 }),
    ceramic: matOf('#e8e2d4', 0.4),
    vaseRed: matOf('#a3261e', 0.4),
    stick: matOf('#b8262a', 0.6),
    petals: ['#f2f0ea', '#f5c542', '#e0457a', '#c96ef0'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })),
    stem: matOf('#3d6a2e'),
    paper: ['#e8c85a', '#f2efe4', '#d8453a', '#6aa6d8'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide })),
    paperOld: new THREE.MeshStandardMaterial({ color: '#b8ab88', roughness: 1, side: THREE.DoubleSide }),
  }
}

/** 墓碑正面：直書的字（中間名字、左右生卒年與立碑人） */
function tabletTexture(t: TombDef) {
  const { center, left, right } = t.text
  const faded = t.style === 'overgrown' || t.style === 'weathered'
  const color = t.style === 'new' ? '#e2c26a' : faded ? 'rgba(150,40,34,0.7)' : '#b8322a'
  return canvasTexture(
    256,
    384,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const col = (text: string, x: number, y0: number, y1: number, size: number) => {
        ctx.font = `700 ${size}px ${BRUSH_FONT}`
        const chars = [...text.replace(/\s/g, '')]
        const step = Math.min(size * 1.12, (y1 - y0) / Math.max(1, chars.length))
        chars.forEach((c, i) => ctx.fillText(c, x, y0 + step * (i + 0.5)))
      }
      const top = t.photo ? 150 : 24
      col(center, w / 2, top, h - 18, t.photo ? 30 : 34)
      if (left) col(left, w * 0.2, top + 20, h - 40, 18)
      if (right) col(right, w * 0.8, top + 20, h - 30, 16)
    },
    [{ spec: `700 34px ${BRUSH_FONT}`, text: center + (left ?? '') + (right ?? '') }],
  )
}

let HOUTU: THREE.CanvasTexture | null = null
function houtuTexture() {
  return (HOUTU ??= canvasTexture(
    64,
    128,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#a8322a'
      ctx.font = `700 40px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('后', w / 2, h * 0.3)
      ctx.fillText('土', w / 2, h * 0.72)
    },
    [{ spec: `700 40px ${BRUSH_FONT}`, text: '后土' }],
  ))
}

let PHOTO: THREE.MeshStandardMaterial | null = null
/** 墓碑上的瓷像（阿嬤的照片，橢圓框） */
function photoMat() {
  return (PHOTO ??= new THREE.MeshStandardMaterial({ map: svgTexture(portraitSvg('grandma'), PORTRAIT_SIZE, PORTRAIT_SIZE, 1), roughness: 0.3 }))
}

function Tomb({ t }: { t: TombDef }) {
  const S = shared()
  const y = terraceY(t.z)
  const k = t.w / 2.6
  const tex = useMemo(() => tabletTexture(t), [t])
  const cement = S.cement[t.style]
  const granite = S.granite[t.style]
  const overgrown = t.style === 'overgrown'
  const tidy = t.style === 'tidy' || t.style === 'new'
  const tuft = useMemo(() => {
    const r = seeded(Math.round(t.x * 17 + t.z * 31) + 7)
    return Array.from({ length: overgrown ? 9 : t.style === 'weathered' ? 3 : 0 }, () => ({
      x: (r() - 0.5) * 1.8,
      z: -0.2 - r() * 0.9,
      s: 0.18 + r() * 0.22,
    }))
  }, [t, overgrown])
  const papers = useMemo(() => {
    const r = seeded(Math.round(t.x * 7 - t.z * 13) + 3)
    if (!tidy && r() < 0.5) return []
    return Array.from({ length: tidy ? 6 : 3 }, (_, i) => ({ x: (i / 5 - 0.5) * 1.1 + (r() - 0.5) * 0.12, z: -0.25 - r() * 0.45, rot: (r() - 0.5) * 0.6, c: i % 4 }))
  }, [t, tidy])
  return (
    <group position={[t.x, y, t.z]} rotation-y={t.rot} scale={k}>
      {/* 墓埕（前面的小平台）與前緣的矮石條 */}
      <WBox mat={tidy ? 'tile' : 'stone'} size={[2.3, 0.1, 1.35]} position={[0, 0.05, 0.72]} />
      <WBox mat="stone" size={[2.4, 0.16, 0.12]} position={[0, 0.08, 1.42]} />
      {/* 墓手：外圈高、內圈低 */}
      <mesh geometry={S.outer} material={cement} position={[0, 0, -0.05]} castShadow receiveShadow />
      <mesh geometry={S.inner} material={cement} position={[0, 0, -0.05]} castShadow receiveShadow />
      {/* 墓龜 */}
      <mesh geometry={S.mound} material={overgrown ? S.grassMound : cement} position={[0, 0.02, -0.35]} scale={[0.78, 0.44, 0.52]} castShadow receiveShadow />
      {tuft.map((g, i) => (
        <mesh key={i} material={S.moss} position={[g.x, 0.12 + g.s * 0.4, g.z]} scale={[g.s, g.s * 1.6, g.s]}>
          <coneGeometry args={[0.5, 1, 5]} />
        </mesh>
      ))}
      {/* 墓碑：石碑＋碑帽 */}
      <mesh material={granite} position={[0, 0.58, 0.02]} castShadow>
        <boxGeometry args={[0.72, 1.06, 0.14]} />
      </mesh>
      <mesh material={granite} position={[0, 1.14, 0.02]} castShadow>
        <boxGeometry args={[0.86, 0.08, 0.2]} />
      </mesh>
      <mesh position={[0, 0.56, 0.092]}>
        <planeGeometry args={[0.68, 1.0]} />
        <meshStandardMaterial map={tex} transparent roughness={0.6} />
      </mesh>
      {t.photo && (
        <group position={[0, 0.9, 0.094]}>
          <mesh material={S.brass} scale={[0.122, 0.155, 1]}>
            <circleGeometry args={[1, 28]} />
          </mesh>
          <mesh position={[0, 0, 0.002]} scale={[0.1, 0.13, 1]} material={photoMat()}>
            <circleGeometry args={[1, 28]} />
          </mesh>
        </group>
      )}
      {/* 后土：墳的左後方 */}
      <group position={[-1.55, 0, -0.75]}>
        <mesh material={granite} position={[0, 0.22, 0]} castShadow>
          <boxGeometry args={[0.28, 0.44, 0.1]} />
        </mesh>
        <mesh position={[0, 0.22, 0.052]}>
          <planeGeometry args={[0.24, 0.4]} />
          <meshStandardMaterial map={houtuTexture()} transparent roughness={0.7} />
        </mesh>
      </group>
      {/* 香爐（火伯的香爐是歪的，另外畫）、兩個花瓶 */}
      {t.id !== 'huobo' && (
        <mesh material={t.style === 'overgrown' ? S.cement.weathered : S.brass} position={[0, 0.17, 0.36]} castShadow>
          <cylinderGeometry args={[0.1, 0.08, 0.14, 12]} />
        </mesh>
      )}
      {tidy &&
        [-0.42, 0.42].map((x, i) => (
          <group key={x} position={[x, 0.1, 0.3]}>
            <mesh material={S.vaseRed} position={[0, 0.1, 0]}>
              <cylinderGeometry args={[0.05, 0.06, 0.2, 10]} />
            </mesh>
            {[0, 1, 2].map((j) => (
              <group key={j} position={[(j - 1) * 0.04, 0.2, (j % 2) * 0.03]}>
                <mesh material={S.stem} position={[0, 0.1, 0]}>
                  <cylinderGeometry args={[0.006, 0.006, 0.2, 4]} />
                </mesh>
                <mesh material={S.petals[(i * 2 + j) % S.petals.length]} position={[0, 0.22, 0]}>
                  <icosahedronGeometry args={[0.045, 0]} />
                </mesh>
              </group>
            ))}
          </group>
        ))}
      {/* 墓紙：壓在墓龜上的一疊疊紙 */}
      {papers.map((p, i) => (
        <mesh key={i} material={tidy ? S.paper[p.c] : S.paperOld} position={[p.x, 0.3 + (p.z + 0.5) * 0.3, p.z]} rotation={[-1.1, p.rot, 0]}>
          <planeGeometry args={[0.12, 0.2]} />
        </mesh>
      ))}
    </group>
  )
}

/** 沒有墓手的老土墳（土饅頭）：一個草丘＋一塊小石頭 */
function Mound({ x, z, r }: { x: number; z: number; r: number }) {
  const S = shared()
  const y = terraceY(z)
  return (
    <group position={[x, y, z]} rotation-y={0.5}>
      <mesh geometry={S.mound} material={S.grassMound} scale={[r, r * 0.55, r * 0.85]} castShadow receiveShadow />
      <mesh material={S.granite.weathered} position={[0, 0.25, r * 0.8]} rotation-x={-0.12} castShadow>
        <boxGeometry args={[0.36, 0.5, 0.1]} />
      </mesh>
    </group>
  )
}

/** 入口：兩根石柱，左邊那根刻「第三公墓」 */
function Gate() {
  const sign = useMemo(
    () =>
      canvasTexture(
        64,
        256,
        (ctx, w, h) => {
          ctx.clearRect(0, 0, w, h)
          ctx.fillStyle = '#2e2a26'
          ctx.font = `700 44px ${BRUSH_FONT}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ;[...'第三公墓'].forEach((c, i) => ctx.fillText(c, w / 2, 34 + i * 60))
        },
        [{ spec: `700 44px ${BRUSH_FONT}`, text: '第三公墓' }],
      ),
    [],
  )
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 2.3, 0, H.gateZ]}>
          <WBox mat="stone" size={[0.44, 1.35, 0.44]} position={[0, 0.675, 0]} />
          <WBox mat="stone" size={[0.56, 0.1, 0.56]} position={[0, 1.4, 0]} />
        </group>
      ))}
      <mesh position={[-2.3, 0.72, H.gateZ + 0.225]}>
        <planeGeometry args={[0.26, 1.04]} />
        <meshStandardMaterial map={sign} transparent roughness={0.8} />
      </mesh>
    </group>
  )
}

/** 山頂邊緣的石頭、相思樹下的平石頭 */
function Rocks() {
  const mats = useMats()
  const rocks = useMemo(() => {
    const r = seeded(4411)
    const out: { x: number; y: number; z: number; s: number; ry: number }[] = []
    for (let i = 0; i < 16; i++) {
      const x = -18 + i * 2.4 + (r() - 0.5) * 1.2
      if (Math.abs(x - H.lookout.x) < 1.4) continue
      out.push({ x, y: H.t2, z: H.ridgeZ - 0.2 + (r() - 0.5) * 0.5, s: 0.25 + r() * 0.35, ry: r() * 6 })
    }
    return out
  }, [])
  return (
    <group>
      {rocks.map((k, i) => (
        <mesh key={i} material={mats.stone} position={[k.x, k.y + k.s * 0.35, k.z]} rotation-y={k.ry} scale={[k.s * 1.3, k.s * 0.8, k.s]} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
      {/* 相思樹下的平石頭：阿嬤送完阿公之後常坐在這裡 */}
      <mesh material={mats.stone} position={[H.rock.x, H.t2 + 0.14, H.rock.z]} rotation-y={0.4} scale={[0.62, 0.2, 0.46]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 1]} />
      </mesh>
    </group>
  )
}

/** 阿公墳前、靠在花瓶邊的舊結婚照（回憶碎片的位置） */
function WeddingPhoto() {
  const agong = TOMBS.find((t) => t.id === 'agong')!
  const [x, z] = tombPoint(agong, -0.95, 0.55)
  const tex = useMemo(
    () =>
      canvasTexture(96, 128, (ctx, w, h) => {
        // 泛黃的黑白照片：兩個人並肩站著
        ctx.fillStyle = '#d8c7a0'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = '#b8a47c'
        ctx.fillRect(6, 6, w - 12, h - 12)
        ctx.fillStyle = '#5a4a36'
        for (const [cx, hh] of [
          [34, 64],
          [62, 56],
        ] as const) {
          ctx.beginPath()
          ctx.arc(cx, h - hh - 10, 9, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillRect(cx - 11, h - hh, 22, hh - 10)
        }
        ctx.fillStyle = 'rgba(255,255,255,0.18)'
        ctx.fillRect(0, 0, w, 20)
      }),
    [],
  )
  return (
    <group position={[x, H.t2 + 0.1, z]} rotation-y={agong.rot + 0.3}>
      <mesh position={[0, 0.1, 0]} rotation-x={-0.25} castShadow>
        <boxGeometry args={[0.17, 0.22, 0.015]} />
        <meshStandardMaterial color="#5a3a22" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.1, 0.009]} rotation-x={-0.25}>
        <planeGeometry args={[0.13, 0.17]} />
        <meshStandardMaterial map={tex} roughness={0.8} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 墳上的小燈：阿嬤和玉姨的墳有「長明燈」（紅色小燈泡），晚上亮
// ---------------------------------------------------------------------------

function TombLamps() {
  const lamps = useMemo(
    () =>
      ['ama', 'yuyi', 't2b'].map((id) => {
        const t = TOMBS.find((x) => x.id === id)!
        const [x, z] = tombPoint(t, 0.62, -0.05)
        return { x, y: terraceY(t.z) + 1.2, z, big: id === 'ama' }
      }),
    [],
  )
  const bulb = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.5, 0.35), toneMapped: false }), [])
  const light = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    const l = lanternAt(useStore.getState().time)
    bulb.color.setRGB(0.6 + 1.8 * l, 0.2 + 0.3 * l, 0.15 + 0.2 * l)
    if (light.current) light.current.intensity = (0.4 + 1.6 * l) * (0.95 + Math.sin(clock.elapsedTime * 7) * 0.05)
  })
  const ama = lamps[0]
  return (
    <group>
      {lamps.map((p, i) => (
        <mesh key={i} material={bulb} position={[p.x, p.y, p.z]}>
          <sphereGeometry args={[0.05, 10, 8]} />
        </mesh>
      ))}
      <pointLight ref={light} position={[ama.x, ama.y + 0.2, ama.z + 0.6]} color="#ff7a5a" intensity={1.2} distance={4.5} decay={2} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 草、芒草（三層各自長）
// ---------------------------------------------------------------------------

function groundFor(level: 0 | 1 | 2) {
  return (x: number, z: number): 'grass' | null => {
    const lz = level === 0 ? z >= H.wall1Z + 0.3 : level === 1 ? z < H.wall1Z - 0.2 && z >= H.wall2Z + 0.3 : z < H.wall2Z - 0.2 && z > H.ridgeZ - 0.3
    if (!lz) return null
    if (Math.abs(x) < 1.3) return null // 中間的小路、石階
    if (level === 1 && Math.abs(z - 1.7) < 0.7) return null // 中層東西向的小路
    for (const t of TOMBS) {
      const [cx, cz] = tombPoint(t, 0, 0)
      if (Math.hypot(x - cx, z - cz) < t.w * 0.62) return null
    }
    return 'grass'
  }
}

function Greenery({ quality }: { quality: Quality }) {
  const layers = useMemo(
    () =>
      ([0, 1, 2] as const).map((lv) => ({
        y: lv === 0 ? 0 : lv === 1 ? H.t1 : H.t2,
        g: buildGrass(quality, { ground: groundFor(lv), rMin: 0.5, rSpan: 20, seed: 6100 + lv, scale: 0.32 }),
      })),
    [quality],
  )
  return (
    <group>
      {layers.map((l, i) => (
        <group key={i} position={[0, l.y, 0]}>
          <primitive object={l.g.grass} />
          <primitive object={l.g.flowers} />
        </group>
      ))}
      <Silvergrass />
    </group>
  )
}
