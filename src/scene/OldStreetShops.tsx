import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { OLDSTREET } from '../world/sceneOldStreet'
import { lanternAt } from './daylight'
import { BRUSH_FONT, TILE, WBox, boxGeo, canvasTexture, useMats } from './kit'
import { FZ, shutterTexture, signTexture } from './OldStreetFacades'
import { Fader } from './OldStreetFader'
import { ChibiNpc } from '../chars/Chibi'

// 老街的店面：一樓的牆與門（在亭仔腳裡面）、冰果室、戲院大廳、照相館、理髮廳、中藥行、布莊。
// 立面（二樓以上）在 OldStreetFacades.tsx；組合在 OldStreet.tsx。

const O = OLDSTREET
const A = O.arcade
const FLOOR = 0.14
const glassMat = new THREE.MeshStandardMaterial({ color: '#dfeff2', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false })

/** 一樓的店面牆（z = A.frontZ），openings 是門窗（y 從亭仔腳的地面算） */
export function StoreWall({ x0, x1, openings = [], mat = 'plaster', color }: { x0: number; x1: number; openings?: { c: number; w: number; y0: number; y1: number }[]; mat?: 'plaster' | 'brick'; color?: string }) {
  const mats = useMats()
  const m = useMemo(() => {
    if (!color) return mats[mat]
    const c = mats[mat].clone()
    c.color.set(color)
    return c
  }, [mats, mat, color])
  const H = A.ceilY - FLOOR
  const pieces = useMemo(() => {
    const out: { c: [number, number, number]; s: [number, number, number] }[] = []
    const ops = [...openings].sort((a, b) => a.c - b.c)
    const z = A.frontZ - 0.12
    let cur = x0
    for (const o of ops) {
      const a = o.c - o.w / 2
      const b = o.c + o.w / 2
      if (a > cur) out.push({ c: [(cur + a) / 2, FLOOR + H / 2, z], s: [a - cur, H, 0.24] })
      if (o.y0 > 0.01) out.push({ c: [o.c, FLOOR + o.y0 / 2, z], s: [o.w, o.y0, 0.24] })
      if (o.y1 < H - 0.01) out.push({ c: [o.c, FLOOR + (o.y1 + H) / 2, z], s: [o.w, H - o.y1, 0.24] })
      cur = b
    }
    if (x1 > cur) out.push({ c: [(cur + x1) / 2, FLOOR + H / 2, z], s: [x1 - cur, H, 0.24] })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x0, x1])
  return (
    <group>
      {pieces.map((p, i) => (
        <mesh key={i} geometry={boxGeo(p.s[0], p.s[1], p.s[2], TILE[mat])} material={m} position={p.c} castShadow receiveShadow />
      ))}
      {/* 牆裙（洗石子） */}
      <WBox mat="stone" size={[x1 - x0, 0.5, 0.05]} position={[(x0 + x1) / 2, FLOOR + 0.25, A.frontZ + 0.02]} castShadow={false} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 貼圖：戲院的手繪看板、片名、冰果室價目表、照相館櫥窗、理髮廳燈柱
// ---------------------------------------------------------------------------

type PosterKind = 'butterfly' | 'comedy' | 'ducks'

/** 手繪電影看板（老戲院的招牌風格：大色塊、粗筆的片名） */
export function posterTexture(kind: PosterKind) {
  const titles: Record<PosterKind, { title: string; sub: string; cast: string }> = {
    butterfly: { title: '梁山伯與祝英台', sub: '黃梅調巨片', cast: '凌波　樂蒂　主演' },
    comedy: { title: '王哥柳哥遊台灣', sub: '台語爆笑喜劇', cast: '李冠章　矮仔財　主演' },
    ducks: { title: '養鴨人家', sub: '健康寫實鉅片', cast: '唐寶雲　葛香亭　主演' },
  }
  const t = titles[kind]
  return canvasTexture(
    420,
    640,
    (ctx, w, h) => {
      // 底色
      const g = ctx.createLinearGradient(0, 0, 0, h)
      if (kind === 'butterfly') {
        g.addColorStop(0, '#f6c9d6')
        g.addColorStop(0.55, '#c7b6e6')
        g.addColorStop(1, '#6f86c6')
      } else if (kind === 'comedy') {
        g.addColorStop(0, '#ffe36a')
        g.addColorStop(1, '#ff9a3a')
      } else {
        g.addColorStop(0, '#9fd3f0')
        g.addColorStop(0.5, '#e8f2d8')
        g.addColorStop(0.52, '#6aa84a')
        g.addColorStop(1, '#2f6a3a')
      }
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      // 人物（剪影＋幾個色塊）
      const person = (x: number, y: number, s: number, robe: string, hair: string, fat = 1) => {
        ctx.fillStyle = robe
        ctx.beginPath()
        ctx.moveTo(x - 38 * s * fat, y + 200 * s)
        ctx.lineTo(x - 22 * s * fat, y + 40 * s)
        ctx.lineTo(x + 22 * s * fat, y + 40 * s)
        ctx.lineTo(x + 38 * s * fat, y + 200 * s)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#f4d2b4'
        ctx.beginPath()
        ctx.arc(x, y + 18 * s, 24 * s, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = hair
        ctx.beginPath()
        ctx.arc(x, y + 8 * s, 25 * s, Math.PI, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#2a1a14'
        ctx.fillRect(x - 10 * s, y + 18 * s, 5 * s, 3 * s)
        ctx.fillRect(x + 5 * s, y + 18 * s, 5 * s, 3 * s)
      }
      if (kind === 'butterfly') {
        person(150, 250, 1.3, '#3f6fb0', '#1a1a22')
        person(265, 270, 1.2, '#e46a9a', '#1a1a22')
        for (const [bx, by, c] of [
          [320, 170, '#ffcf4a'],
          [360, 205, '#ffffff'],
        ] as const) {
          ctx.fillStyle = c
          ctx.beginPath()
          ctx.ellipse(bx - 12, by, 14, 9, -0.5, 0, Math.PI * 2)
          ctx.ellipse(bx + 12, by, 14, 9, 0.5, 0, Math.PI * 2)
          ctx.fill()
        }
      } else if (kind === 'comedy') {
        person(140, 240, 1.2, '#2e6fb5', '#1a1a1a', 2.0)
        person(285, 205, 1.45, '#d8342b', '#1a1a1a', 0.7)
        ctx.fillStyle = '#1a1a1a'
        ctx.font = `700 60px ${BRUSH_FONT}`
        ctx.fillText('哈', 300, 150)
        ctx.fillText('哈', 340, 210)
      } else {
        person(210, 250, 1.25, '#e8e2d4', '#1a1a1a')
        ctx.strokeStyle = '#6a4a2a'
        ctx.lineWidth = 6
        ctx.beginPath()
        ctx.moveTo(120, 300)
        ctx.lineTo(320, 250)
        ctx.stroke()
        for (let i = 0; i < 14; i++) {
          const x = 40 + ((i * 97) % 340)
          const y = 470 + ((i * 53) % 110)
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.ellipse(x, y, 16, 10, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.arc(x + 12, y - 9, 7, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#f0a020'
          ctx.fillRect(x + 17, y - 10, 7, 3)
        }
      }
      // 筆刷的質感
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`
        ctx.fillRect(Math.random() * w, Math.random() * h, 6 + Math.random() * 30, 2 + Math.random() * 4)
      }
      // 片名（直書，白底描邊）
      ctx.font = `900 58px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const chars = [...t.title]
      const x = kind === 'butterfly' ? 52 : w - 52
      chars.forEach((ch, i) => {
        const y = 60 + i * 62
        ctx.lineWidth = 10
        ctx.strokeStyle = '#ffffff'
        ctx.strokeText(ch, x, y)
        ctx.fillStyle = kind === 'ducks' ? '#1d4f2a' : '#c0201a'
        ctx.fillText(ch, x, y)
      })
      ctx.font = `700 30px ${BRUSH_FONT}`
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'
      ctx.lineWidth = 4
      ctx.strokeText(t.sub, w / 2, h - 90)
      ctx.fillText(t.sub, w / 2, h - 90)
      ctx.font = `500 24px ${BRUSH_FONT}`
      ctx.strokeText(t.cast, w / 2, h - 44)
      ctx.fillText(t.cast, w / 2, h - 44)
      // 褪色
      ctx.fillStyle = 'rgba(240,230,210,0.12)'
      ctx.fillRect(0, 0, w, h)
    },
    [{ spec: `900 58px ${BRUSH_FONT}`, text: t.title + t.sub + t.cast + '哈' }],
  )
}

function cinemaTitleTexture() {
  return canvasTexture(
    1024,
    160,
    (ctx, w, h) => {
      ctx.fillStyle = '#7a1612'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#e9c46a'
      ctx.lineWidth = 8
      ctx.strokeRect(10, 10, w - 20, h - 20)
      ctx.fillStyle = '#f4d27a'
      ctx.font = `900 118px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('光 華 戲 院', w / 2, h / 2 + 8)
    },
    [{ spec: `900 118px ${BRUSH_FONT}`, text: '光華戲院' }],
  )
}

function barberTexture() {
  const t = canvasTexture(64, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f4f1ea'
    ctx.fillRect(0, 0, w, h)
    const bands = ['#d8262a', '#f4f1ea', '#1d4f9a', '#f4f1ea']
    for (let i = -4; i < 12; i++) {
      ctx.fillStyle = bands[((i % 4) + 4) % 4]
      ctx.beginPath()
      const y = i * 16
      ctx.moveTo(0, y)
      ctx.lineTo(w, y + 32)
      ctx.lineTo(w, y + 48)
      ctx.lineTo(0, y + 16)
      ctx.closePath()
      ctx.fill()
    }
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

// ---------------------------------------------------------------------------
// 新美理髮廳：玻璃門、大櫥窗（裡面一張理髮椅）、旋轉燈柱
// ---------------------------------------------------------------------------

/** 旋轉燈柱（晚上亮著、一直轉） */
export function BarberPole() {
  const tex = useMemo(barberTexture, [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.2, roughness: 0.3 }), [tex])
  useFrame((_, dt) => {
    tex.offset.y -= Math.min(dt, 0.1) * 0.35
    mat.emissiveIntensity = 0.15 + 0.85 * lanternAt(useStore.getState().time)
  })
  const P = O.barberPole
  return (
    <group position={[P.x, 1.65, P.z]}>
      <mesh material={mat}>
        <cylinderGeometry args={[0.1, 0.1, 0.8, 18]} />
      </mesh>
      <mesh material={glassMat}>
        <cylinderGeometry args={[0.13, 0.13, 0.82, 18]} />
      </mesh>
      {[0.46, -0.46].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <sphereGeometry args={[0.14, 14, 10]} />
          <meshStandardMaterial color="#d8d8d8" metalness={0.8} roughness={0.25} />
        </mesh>
      ))}
      <mesh position={[0.12, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 0.24, 6]} />
        <meshStandardMaterial color="#8a8a8a" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 和春中藥行：一片一片的木門板（關著）、藥甕
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 光華戲院：外殼（進大廳時淡出）——一樓的牆、門、售票口、看板、片名、跑馬燈
// ---------------------------------------------------------------------------

export function CinemaShell() {
  const C = O.cinema
  const lot = O.lots[2]
  const posters = useMemo(() => (['butterfly', 'comedy', 'ducks'] as PosterKind[]).map(posterTexture), [])
  const title = useMemo(cinemaTitleTexture, [])
  const cx = (lot.x0 + lot.x1) / 2
  return (
    <group>
      <StoreWall
        x0={lot.x0}
        x1={lot.x1}
        color="#e3d6ba"
        openings={[
          { c: (C.doorX0 + C.doorX1) / 2, w: C.doorX1 - C.doorX0, y0: 0, y1: 2.6 },
          { c: C.ticketX, w: 0.8, y0: 0.95, y1: 1.65 },
        ]}
      />
      {/* 手繪看板（三張） */}
      {posters.map((t, i) => (
        <group key={i} position={[lot.x0 + 1.4 + i * 2.8, 5.6, FZ + 0.06]}>
          <mesh geometry={boxGeo(2.46, 3.6, 0.08, 1)}>
            <meshStandardMaterial color="#3a2a20" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0, 0.045]}>
            <planeGeometry args={[2.34, 3.48]} />
            <meshStandardMaterial map={t} roughness={0.75} />
          </mesh>
        </group>
      ))}
      {/* 片名 */}
      <group position={[cx, 8.3, FZ + 0.06]}>
        <mesh geometry={boxGeo(6.8, 1.0, 0.1, 1)}>
          <meshStandardMaterial color="#4a1010" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.055]}>
          <planeGeometry args={[6.6, 0.9]} />
          <meshStandardMaterial map={title} roughness={0.5} />
        </mesh>
      </group>
      {/* 售票口的小窗框 */}
      <WBox mat="darkWood" size={[0.9, 0.08, 0.3]} position={[C.ticketX, FLOOR + 0.93, A.frontZ + 0.1]} />
      {/* 敞開的兩扇玻璃門 */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s < 0 ? C.doorX0 : C.doorX1, FLOOR, A.frontZ - 0.1]} rotation={[0, s * 1.2, 0]}>
          <WBox mat="darkWood" size={[0.06, 2.58, 0.06]} position={[s * -0.04, 1.29, 0]} />
          <WBox mat="darkWood" size={[0.06, 2.58, 0.06]} position={[s * -0.76, 1.29, 0]} />
          <WBox mat="darkWood" size={[0.78, 0.08, 0.06]} position={[s * -0.4, 2.56, 0]} />
          <WBox mat="darkWood" size={[0.78, 0.5, 0.05]} position={[s * -0.4, 0.25, 0]} />
          <mesh material={glassMat} position={[s * -0.4, 1.5, 0]}>
            <planeGeometry args={[0.72, 1.9]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** 跑馬燈：亭仔腳樑上的「今日放映」牌子，四周一圈燈泡（晚上跑起來） */
export function Marquee() {
  const lot = O.lots[2]
  const W = lot.x1 - lot.x0 - 0.6
  const sign = useMemo(() => signTexture('今日放映 梁山伯與祝英台', '#f4efe2', '#b3261e', '#b3261e'), [])
  const bulbs = useRef<THREE.InstancedMesh>(null)
  const pts = useMemo(() => {
    const out: [number, number][] = []
    const h = 0.72
    const n = Math.floor(W / 0.2)
    for (let i = 0; i <= n; i++) out.push([-W / 2 + (i * W) / n, h / 2], [-W / 2 + (i * W) / n, -h / 2])
    for (let j = 1; j < 4; j++) out.push([-W / 2, -h / 2 + (j * h) / 4], [W / 2, -h / 2 + (j * h) / 4])
    return out
  }, [W])
  const col = useMemo(() => new THREE.Color(), [])
  useFrame(({ clock }) => {
    const m = bulbs.current
    if (!m) return
    const l = lanternAt(useStore.getState().time)
    const t = clock.elapsedTime
    pts.forEach((_, i) => {
      // 一顆一顆往前跑；天亮時只剩暗暗的燈泡
      const on = Math.sin(i * 0.9 - t * 6) > 0.2
      const k = 0.18 + l * (on ? 1.6 : 0.35)
      m.setColorAt(i, col.setRGB(1.0 * k, 0.78 * k, 0.4 * k))
    })
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })
  useEffect(() => {
    const m = bulbs.current
    if (!m) return
    const mat4 = new THREE.Matrix4()
    pts.forEach(([x, y], i) => {
      mat4.makeTranslation(x, y, 0.07)
      m.setMatrixAt(i, mat4)
      m.setColorAt(i, col.setRGB(0.2, 0.15, 0.08))
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [pts, col])
  return (
    <group position={[(lot.x0 + lot.x1) / 2, 3.72, FZ + 0.06]} userData={{ noMerge: true }}>
      <mesh geometry={boxGeo(W + 0.2, 0.9, 0.08, 1)}>
        <meshStandardMaterial color="#2a1a14" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <planeGeometry args={[W - 0.2, 0.56]} />
        <meshStandardMaterial map={sign} roughness={0.55} />
      </mesh>
      <instancedMesh ref={bulbs} args={[undefined, undefined, pts.length]} frustumCulled={false}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

/** 戲院大廳（外殼淡出時看得到）：磨石子地、紅色牆裙、賣零食的櫃台、長椅、紅絲絨布簾、樓梯、放映室的窗 */
export function CinemaLobby({ outline }: { outline: boolean }) {
  const mats = useMats()
  const C = O.cinema
  const cx = (C.x0 + C.x1) / 2
  const floor = useMemo(() => {
    const m = mats.tile.clone()
    m.color.set('#b8a58a')
    return m
  }, [mats])
  const velvet = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7a1414', roughness: 0.9 }), [])
  const cream = useMemo(() => {
    const m = mats.plaster.clone()
    m.color.set('#e8dcc2')
    return m
  }, [mats])
  const booth = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff1c8', toneMapped: false }), [])
  const lamp = useRef<THREE.PointLight>(null)
  const posters = useMemo(() => (['comedy', 'ducks'] as PosterKind[]).map(posterTexture), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // 放映室的窗：投影機的光一閃一閃（沒有片子，只有空轉）
    const f = 0.55 + 0.25 * Math.sin(t * 23) * Math.sin(t * 7.1) + (Math.sin(t * 1.3) > 0.97 ? 0.3 : 0)
    booth.color.setRGB(1.0 * f, 0.92 * f, 0.72 * f)
    if (lamp.current) lamp.current.intensity = 1.6 + 0.2 * Math.sin(t * 2.1)
  })
  const depth = A.frontZ - C.z0
  return (
    <group>
      <mesh geometry={boxGeo(C.x1 - C.x0, 0.02, depth, TILE.tile)} material={floor} position={[cx, FLOOR, (A.frontZ + C.z0) / 2]} receiveShadow />
      {/* 裡面的牆：後牆、兩側（淡出後看得到） */}
      <mesh geometry={boxGeo(C.x1 - C.x0, A.ceilY, 0.1, TILE.plaster)} material={cream} position={[cx, A.ceilY / 2, C.z0 + 0.05]} receiveShadow />
      <mesh geometry={boxGeo(0.1, A.ceilY, depth, TILE.plaster)} material={cream} position={[C.x0 + 0.05, A.ceilY / 2, (A.frontZ + C.z0) / 2]} receiveShadow />
      {/* 牆裙（深紅木板） */}
      <WBox mat="redPaint" size={[C.x1 - C.x0 - 0.2, 1.1, 0.04]} position={[cx, FLOOR + 0.55, C.z0 + 0.12]} castShadow={false} />
      <WBox mat="redPaint" size={[0.04, 1.1, depth - 0.2]} position={[C.x0 + 0.12, FLOOR + 0.55, (A.frontZ + C.z0) / 2]} castShadow={false} />
      {/* 東牆靠鏡頭那一側：阿嬤在大廳裡時淡掉，才看得到放映師 */}
      <Fader id="os_lobby_side">
        <mesh geometry={boxGeo(0.1, A.ceilY, depth, TILE.plaster)} material={cream} position={[C.x1 - 0.05, A.ceilY / 2, (A.frontZ + C.z0) / 2]} receiveShadow />
        <WBox mat="redPaint" size={[0.04, 1.1, depth - 0.2]} position={[C.x1 - 0.12, FLOOR + 0.55, (A.frontZ + C.z0) / 2]} castShadow={false} />
      </Fader>
      {/* 通往放映廳的紅絲絨布簾（金色的簾頭） */}
      <group position={[cx, FLOOR, C.z0 + 0.2]}>
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} material={velvet} position={[-1.2 + i * 0.3, 1.3, Math.sin(i * 1.7) * 0.03]} castShadow>
            <cylinderGeometry args={[0.16, 0.16, 2.6, 8]} />
          </mesh>
        ))}
        <WBox mat="gold" size={[2.8, 0.22, 0.12]} position={[0, 2.68, 0.06]} />
        <mesh material={booth} position={[0, 3.0 - FLOOR, -0.08]}>
          <planeGeometry args={[0.9, 0.18]} />
        </mesh>
      </group>
      {/* 賣零食的玻璃櫃台 */}
      <group position={[-7.9, FLOOR, -7.2]}>
        <WBox mat="darkWood" size={[0.7, 0.6, 2.4]} position={[0, 0.3, 0]} />
        <mesh material={glassMat} position={[0, 0.8, 0]}>
          <boxGeometry args={[0.66, 0.4, 2.36]} />
        </mesh>
        {[-0.8, -0.3, 0.2, 0.7].map((z, i) => (
          <mesh key={z} position={[0, 0.72, z]}>
            <boxGeometry args={[0.4, 0.2, 0.3]} />
            <meshStandardMaterial color={['#e8423a', '#f2c230', '#58b36a', '#e46aa4'][i]} roughness={0.5} />
          </mesh>
        ))}
        <WBox mat="wood" size={[0.76, 0.05, 2.44]} position={[0, 1.02, 0]} />
      </group>
      {/* 長椅 */}
      <group position={[-2.2, FLOOR, -6.2]}>
        <WBox mat="darkWood" size={[0.45, 0.06, 1.6]} position={[0, 0.44, 0]} />
        <WBox mat="darkWood" size={[0.06, 0.5, 1.6]} position={[0.2, 0.7, 0]} />
        {[-0.7, 0.7].map((z) => (
          <WBox key={z} mat="darkWood" size={[0.4, 0.44, 0.06]} position={[0, 0.22, z]} />
        ))}
      </group>
      {/* 往放映室的木樓梯（東北角） */}
      {Array.from({ length: 7 }, (_, i) => (
        <WBox key={i} mat="wood" size={[0.8, 0.18, 0.28]} position={[C.x1 - 0.55, FLOOR + 0.09 + i * 0.18, C.z0 + 1.9 - i * 0.26]} castShadow={false} />
      ))}
      {/* 牆上的舊海報 */}
      {posters.map((t, i) => (
        <mesh key={i} position={[C.x0 + 0.13, 1.95, -6.2 - i * 1.5]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.8, 1.2]} />
          <meshStandardMaterial map={t} roughness={0.8} />
        </mesh>
      ))}
      {/* 吊燈 */}
      <mesh position={[cx, A.ceilY - 0.25, -7.0]}>
        <sphereGeometry args={[0.16, 12, 10]} />
        <meshBasicMaterial color="#ffe0a8" toneMapped={false} />
      </mesh>
      <WBox mat="gold" size={[0.2, 0.05, 0.2]} position={[cx, A.ceilY - 0.08, -7.0]} castShadow={false} />
      <pointLight ref={lamp} position={[cx, 2.7, -7.0]} color="#ffcf8a" intensity={1.6} distance={7} decay={2} />
      <ChibiNpc id="projectionist" pose="clasp" position={[O.projectionist.x, FLOOR, O.projectionist.z]} heading={0.3} seesGhosts outline={outline} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 阿桃冰果室：店面整片打開、櫃台上的剉冰機與配料罐、價目表、亭仔腳的小圓桌、冰旗
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 光明照相館：櫥窗裡的老照片、玻璃門、門口的老相機；傍晚老闆站在門口
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 錦繡布莊（鐵捲門拉起一半，看得到一匹一匹的布）、最後一間（鐵捲門關著）
// ---------------------------------------------------------------------------

export function EndFront() {
  const lot = O.lots[6]
  const shutter = useMemo(() => {
    const t = shutterTexture(4)
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, metalness: 0.5 })
  }, [])
  return (
    <group>
      <StoreWall x0={lot.x0} x1={lot.x1} color="#cfcbc2" openings={[{ c: 19.6, w: 3.6, y0: 0, y1: 2.8 }]} />
      <mesh material={shutter} position={[19.6, FLOOR + 1.4, A.frontZ - 0.06]}>
        <planeGeometry args={[3.6, 2.8]} />
      </mesh>
    </group>
  )
}
