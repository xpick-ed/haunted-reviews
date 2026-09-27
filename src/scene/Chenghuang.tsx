import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { CH, MY_TICKET, stepCh, useCh } from '../world/sceneChenghuang'
import { BRUSH_FONT, TILE, WBox, canvasTexture, planeGeo, useMats } from './kit'
import { MergeStatic } from './MergeStatic'
import { Lantern } from './House'
import { Chibi, SEAT_Y, TOP_Y, newDrive, type PoseName } from '../chars/Chibi'
import { SPECS } from '../chars/specs'
import { chDing } from './ChenghuangSound'
import '../chars/specs.chenghuang'

// 城隍廟的畫面（DESIGN §32.2）：規則在 src/world/sceneChenghuang.ts。
// 陰間的戶政事務所：暗紅的牆、金色的字、紅燈籠、香煙；號碼顯示板、號碼牌機、判官的大桌子和功德簿。
// 跟土地公廟一樣不畫神像：神龕的紅布簾是拉上的（DESIGN §1.2）。
// 鏡頭在東南方：北牆、西牆是背景（畫高），東邊、南邊只畫矮牆，才不會擋住阿嬤。

const R = CH.room
const WALL_H = 5.2
const LOW_H = 0.95

export function ChenghuangScene() {
  const quality = useStore((s) => s.quality)
  const outline = quality === 'high'
  const report = useCh((s) => s.report)

  // 半夜從鬼夜市走進來：阿嬤的感想（每晚一次）
  useEffect(() => {
    if (useCh.getState().report) return
    const s = useStore.getState()
    if (s.flags.ch_visit_today) return
    useStore.setState({ flags: { ...s.flags, ch_visit_today: true } })
    const id = window.setTimeout(() => useStore.getState().bark('ch.night.arrive'), 1400)
    return () => window.clearTimeout(id)
  }, [])

  // 號碼顯示板跳號；叫到阿嬤的號碼時八爺喊人
  useFrame((_, rawDt) => {
    const s = useStore.getState()
    if (s.scene !== 'chenghuang') return
    const ev = stepCh(Math.min(rawDt, 0.1), !!s.dialogue || s.transitioning || !!s.minigame)
    if (ev.includes('tick')) chDing(ev.includes('call'))
    if (ev.includes('call')) window.setTimeout(() => useStore.getState().bark('ch.baye.call'), 700)
  })

  return (
    <group>
      <Atmosphere report={report} />
      <MergeStatic>
        <Hall />
        <Shrine />
        <Desk />
        <CallWindow />
        <Benches />
        <TicketMachine />
      </MergeStatic>
      <Signs />
      <NumberBoard />
      <Burner />
      <Candles />
      {[-4.6, -1.6, 1.6, 4.6].map((x) => (
        <Lantern key={x} position={[x, 3.9, -3.2]} drop={0.9} scale={1.15} />
      ))}
      {[-4.6, 1.6].map((x) => (
        <Lantern key={`s${x}`} position={[x, 3.9, 1.4]} drop={0.9} scale={1.0} />
      ))}
      <FlyingForms />
      {report ? <Office outline={outline} /> : <NightShift outline={outline} />}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 燈與霧：陰間永遠是半夜，燈籠的紅光＋香煙的琥珀色＋一點鬼火青
// ---------------------------------------------------------------------------

const FOG = new THREE.Color('#1a0a0a')

function Atmosphere({ report }: { report: boolean }) {
  const { scene } = useThree()
  const lamp = useRef<THREE.PointLight>(null)
  useEffect(() => {
    const f = scene.fog as THREE.Fog | null
    if (!f) return
    const near = f.near
    const far = f.far
    f.near = 18
    f.far = 60
    return () => {
      f.near = near
      f.far = far
    }
  }, [scene])
  useFrame(({ clock }) => {
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(FOG)
    const t = clock.elapsedTime
    if (lamp.current) lamp.current.intensity = (report ? 7 : 4) * (0.9 + Math.sin(t * 2.1) * 0.05 + Math.sin(t * 6.7) * 0.03)
  })
  return (
    <group>
      <hemisphereLight args={['#c07a5a', '#1a0c0c', report ? 0.55 : 0.35]} />
      {/* 神龕前的紅光（跟著燈籠微微晃） */}
      <pointLight ref={lamp} position={[0, 3.0, -3.6]} color="#ff6a3a" intensity={7} distance={13} decay={1.6} />
      {/* 判官桌上的檯燈（下班了就關） */}
      {report && <pointLight position={[CH.desk.x, 2.2, CH.desk.z + 0.4]} color="#ffc070" intensity={4} distance={7} decay={1.8} />}
      {/* 長椅那邊一點青色的鬼火光 */}
      <pointLight position={[-3.4, 2.4, 1.2]} color="#5fd8c8" intensity={report ? 2.2 : 3} distance={8} decay={1.8} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 廳：地板、牆、柱子
// ---------------------------------------------------------------------------

function useTinted(base: 'plaster' | 'tile' | 'stone' | 'wood', color: string) {
  const mats = useMats()
  return useMemo(() => {
    const m = mats[base].clone()
    m.color.set(color)
    return m
  }, [mats, base, color])
}

function Hall() {
  const mats = useMats()
  const wall = useTinted('plaster', '#7a2a22')
  const floor = useTinted('tile', '#8a4a3a')
  const ground = useTinted('stone', '#2a2224')
  const W = R.x1 - R.x0
  const D = R.z1 - R.z0
  const cx = (R.x0 + R.x1) / 2
  const cz = (R.z0 + R.z1) / 2
  return (
    <group>
      {/* 廟外：黑黑的石板地 */}
      <mesh geometry={planeGeo(60, 50, TILE.stone)} material={ground} rotation-x={-Math.PI / 2} position={[0, -0.02, 4]} receiveShadow />
      <mesh geometry={planeGeo(W, D, TILE.tile)} material={floor} rotation-x={-Math.PI / 2} position={[cx, 0.01, cz]} receiveShadow />
      {/* 北牆、西牆（高）：牆裙是深色木頭 */}
      <mesh position={[cx, WALL_H / 2, R.z0 - 0.15]} material={wall} castShadow receiveShadow>
        <boxGeometry args={[W + 0.6, WALL_H, 0.3]} />
      </mesh>
      <WBox mat="darkWood" size={[W, 1.0, 0.08]} position={[cx, 0.5, R.z0 + 0.04]} />
      <mesh position={[R.x0 - 0.15, WALL_H / 2, cz]} material={wall} castShadow receiveShadow>
        <boxGeometry args={[0.3, WALL_H, D + 0.3]} />
      </mesh>
      <WBox mat="darkWood" size={[0.08, 1.0, D]} position={[R.x0 + 0.04, 0.5, cz]} />
      {/* 北牆上緣的金色收邊 */}
      <WBox mat="gold" size={[W + 0.6, 0.12, 0.34]} position={[cx, WALL_H - 0.06, R.z0 - 0.15]} />
      <WBox mat="gold" size={[0.34, 0.12, D + 0.3]} position={[R.x0 - 0.15, WALL_H - 0.06, cz]} />
      {/* 東邊、南邊：矮牆＋紅欄杆 */}
      <WBox mat="redPaint" size={[0.25, LOW_H, D]} position={[R.x1 + 0.12, LOW_H / 2, cz]} />
      <WBox mat="redPaint" size={[CH.door.x - 1.1 - R.x0, LOW_H, 0.25]} position={[(R.x0 + CH.door.x - 1.1) / 2, LOW_H / 2, R.z1 + 0.12]} />
      <WBox mat="redPaint" size={[R.x1 - CH.door.x - 1.1, LOW_H, 0.25]} position={[(R.x1 + CH.door.x + 1.1) / 2, LOW_H / 2, R.z1 + 0.12]} />
      {/* 門口兩根門柱＋門檻 */}
      {[-1, 1].map((sgn) => (
        <WBox key={sgn} mat="redPaint" size={[0.3, 1.6, 0.3]} position={[CH.door.x + sgn * 1.15, 0.8, R.z1 + 0.12]} />
      ))}
      <WBox mat="stone" size={[2.2, 0.12, 0.3]} position={[CH.door.x, 0.06, R.z1 + 0.12]} />
      {/* 大紅柱子（東邊、南邊不放：會擋住鏡頭） */}
      {CH.pillars.map((p) => (
        <group key={`${p.x}${p.z}`} position={[p.x, 0, p.z]}>
          <mesh position={[0, 2.5, 0]} material={mats.redPaint} castShadow>
            <cylinderGeometry args={[0.24, 0.26, 5.0, 16]} />
          </mesh>
          <WBox mat="stone" size={[0.62, 0.3, 0.62]} position={[0, 0.15, 0]} />
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 神龕：紅布簾拉上（不畫神像），神桌上有燭台、供品；上面「爾來了」
// ---------------------------------------------------------------------------

function Shrine() {
  const A = CH.altar
  return (
    <group>
      {/* 高一階的石台 */}
      <WBox mat="stone" size={[A.w + 1.2, 0.2, 1.8]} position={[A.x, 0.1, R.z0 + 0.9]} />
      {/* 神龕：金框、紅布簾 */}
      <WBox mat="darkWood" size={[A.w, 3.0, 0.5]} position={[A.x, 1.7, R.z0 + 0.3]} />
      <WBox mat="gold" size={[A.w - 0.2, 2.6, 0.05]} position={[A.x, 1.75, R.z0 + 0.56]} />
      <WBox mat="redPaper" size={[A.w - 0.5, 2.3, 0.06]} position={[A.x, 1.7, R.z0 + 0.6]} />
      {/* 簾子的皺摺 */}
      {[-1.1, -0.55, 0, 0.55, 1.1].map((x) => (
        <WBox key={x} mat="redPaper" size={[0.12, 2.3, 0.08]} position={[A.x + x, 1.7, R.z0 + 0.64]} />
      ))}
      <WBox mat="gold" size={[A.w - 0.2, 0.2, 0.2]} position={[A.x, 3.0, R.z0 + 0.62]} />
      {/* 神桌 */}
      <WBox mat="redPaint" size={[A.w, 1.0, A.d]} position={[A.x, 0.5 + 0.2, A.z + 0.25]} />
      <WBox mat="gold" size={[A.w + 0.08, 0.06, A.d + 0.08]} position={[A.x, 1.23, A.z + 0.25]} />
      {/* 供品：水果盤、發粿 */}
      {[-1.0, 1.0].map((x) => (
        <group key={x} position={[A.x + x, 1.27, A.z + 0.35]}>
          <WBox mat="ceramic" size={[0.4, 0.05, 0.4]} position={[0, 0.03, 0]} />
          <WBox mat="terracotta" size={[0.26, 0.18, 0.26]} position={[0, 0.14, 0]} />
        </group>
      ))}
    </group>
  )
}

/** 燭台（火光跳動） */
function Candles() {
  const flame = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffcf6a', toneMapped: false }), [])
  const refs = useRef<(THREE.Mesh | null)[]>([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((m, i) => {
      if (m) m.scale.y = 1 + Math.sin(t * 11 + i * 2) * 0.15 + Math.sin(t * 23 + i) * 0.08
    })
  })
  const A = CH.altar
  return (
    <group>
      {[-0.45, 0.45].map((x, i) => (
        <group key={x} position={[A.x + x, 1.27, A.z + 0.45]}>
          <WBox mat="gold" size={[0.14, 0.05, 0.14]} position={[0, 0.03, 0]} />
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.34, 8]} />
            <meshStandardMaterial color="#c62828" />
          </mesh>
          <mesh
            ref={(el) => {
              refs.current[i] = el
            }}
            material={flame}
            position={[0, 0.44, 0]}
          >
            <coneGeometry args={[0.03, 0.09, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 判官的桌子：功德簿、算盤、筆架、大印
// ---------------------------------------------------------------------------

const bookTex = () =>
  canvasTexture(
    512,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#efe4c8'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(160,40,30,0.55)'
      ctx.lineWidth = 2
      for (let x = 20; x < w; x += 26) {
        ctx.beginPath()
        ctx.moveTo(x, 14)
        ctx.lineTo(x, h - 14)
        ctx.stroke()
      }
      ctx.fillStyle = '#2a1a14'
      ctx.font = `600 18px ${BRUSH_FONT}`
      const words = '陳春功德照顧客人蓋被倒水煮粥陪小孩搖籃曲延長居留准善'
      for (let x = 26; x < w - 10; x += 26)
        for (let y = 30; y < h - 16; y += 22) if ((x * 7 + y * 3) % 5 !== 0) ctx.fillText(words[(x + y) % words.length], x, y)
      // 中間的書縫
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fillRect(w / 2 - 3, 0, 6, h)
    },
    [{ spec: `600 18px ${BRUSH_FONT}`, text: '陳春功德照顧客人' }],
  )

function Desk() {
  const D = CH.desk
  const mats = useMats()
  const book = useMemo(() => new THREE.MeshStandardMaterial({ map: bookTex(), roughness: 0.9 }), [])
  const nameplate = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: canvasTexture(
          256,
          64,
          (ctx, w, h) => {
            ctx.fillStyle = '#1c1210'
            ctx.fillRect(0, 0, w, h)
            ctx.fillStyle = '#e9c46a'
            ctx.font = `700 40px ${BRUSH_FONT}`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('判　官', w / 2, h / 2 + 2)
          },
          [{ spec: `700 40px ${BRUSH_FONT}`, text: '判官' }],
        ),
      }),
    [],
  )
  return (
    <group position={[D.x, 0, D.z]}>
      <WBox mat="darkWood" size={[D.w, 0.08, D.d]} position={[0, 0.9, 0]} />
      <WBox mat="darkWood" size={[D.w - 0.1, 0.82, D.d - 0.1]} position={[0, 0.45, 0]} />
      <WBox mat="gold" size={[D.w - 0.3, 0.05, 0.02]} position={[0, 0.8, D.d / 2 - 0.04]} />
      {/* 桌前的名牌 */}
      <mesh position={[0, 0.55, D.d / 2 - 0.03]} material={nameplate}>
        <planeGeometry args={[0.9, 0.22]} />
      </mesh>
      {/* 攤開的功德簿（很大本） */}
      <WBox mat="redPaint" size={[1.0, 0.08, 0.66]} position={[-0.2, 0.98, 0.05]} />
      <mesh material={book} position={[-0.2, 1.03, 0.05]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.96, 0.6]} />
      </mesh>
      {/* 算盤 */}
      <group position={[0.85, 0.96, 0.15]} rotation-y={-0.25}>
        <WBox mat="darkWood" size={[0.56, 0.04, 0.24]} position={[0, 0, 0]} />
        {[-0.07, 0.03, 0.08].map((z) => (
          <group key={z}>
            {Array.from({ length: 7 }, (_, i) => (
              <mesh key={i} material={mats.black} position={[-0.21 + i * 0.07, 0.035, z]}>
                <sphereGeometry args={[0.022, 6, 5]} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      {/* 筆筒、大印、一疊表格 */}
      <mesh material={mats.ceramic} position={[-1.05, 1.05, -0.2]}>
        <cylinderGeometry args={[0.07, 0.07, 0.2, 10]} />
      </mesh>
      {[-0.02, 0.03].map((x, i) => (
        <mesh key={i} material={mats.darkWood} position={[-1.05 + x, 1.22, -0.2]} rotation-z={x * 3}>
          <cylinderGeometry args={[0.008, 0.008, 0.3, 5]} />
        </mesh>
      ))}
      <WBox mat="redPaint" size={[0.16, 0.16, 0.16]} position={[0.55, 1.02, -0.22]} />
      <WBox mat="gold" size={[0.06, 0.1, 0.06]} position={[0.55, 1.15, -0.22]} />
      {[0, 1, 2].map((i) => (
        <WBox key={i} mat="cloth" size={[0.32, 0.012, 0.44]} position={[-0.95, 0.95 + i * 0.013, 0.18]} rotation-y={i * 0.08} />
      ))}
      {/* 判官的椅子 */}
      <WBox mat="darkWood" size={[0.6, 0.08, 0.6]} position={[0, 0.5, -0.95]} />
      <WBox mat="darkWood" size={[0.6, 1.1, 0.08]} position={[0, 1.0, -1.25]} />
    </group>
  )
}

/** 八爺的叫號窗口 */
function CallWindow() {
  const W = CH.window
  return (
    <group position={[W.x, 0, W.z]}>
      <WBox mat="darkWood" size={[W.w, 1.05, W.d]} position={[0, 0.52, 0]} />
      <WBox mat="gold" size={[W.w + 0.06, 0.05, W.d + 0.06]} position={[0, 1.07, 0]} />
      {/* 窗口的木框 */}
      {[-1, 1].map((s) => (
        <WBox key={s} mat="darkWood" size={[0.1, 1.2, 0.1]} position={[s * (W.w / 2 - 0.05), 1.65, -0.3]} />
      ))}
      <WBox mat="darkWood" size={[W.w, 0.12, 0.12]} position={[0, 2.25, -0.3]} />
      {/* 叫人鈴 */}
      <mesh position={[0.7, 1.15, 0.1]}>
        <sphereGeometry args={[0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#c9a25a" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  )
}

function Benches() {
  return (
    <group>
      {CH.benches.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]}>
          <WBox mat="darkWood" size={[b.w, 0.07, 0.46]} position={[0, 0.45, 0]} />
          {/* 靠背（北邊：排隊的鬼面向窗口） */}
          <WBox mat="darkWood" size={[b.w, 0.4, 0.05]} position={[0, 0.72, 0.21]} />
          {[-b.w / 2 + 0.2, 0, b.w / 2 - 0.2].map((x) => (
            <WBox key={x} mat="darkWood" size={[0.08, 0.42, 0.4]} position={[x, 0.21, 0]} />
          ))}
        </group>
      ))}
    </group>
  )
}

function TicketMachine() {
  const T = CH.ticket
  const mats = useMats()
  const label = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: canvasTexture(
          128,
          256,
          (ctx, w, h) => {
            ctx.fillStyle = '#b3261e'
            ctx.fillRect(0, 0, w, h)
            ctx.fillStyle = '#fff3d8'
            ctx.font = `700 34px ${BRUSH_FONT}`
            ctx.textAlign = 'center'
            ;['抽', '號', '碼', '牌'].forEach((c, i) => ctx.fillText(c, w / 2, 52 + i * 48))
          },
          [{ spec: `700 34px ${BRUSH_FONT}`, text: '抽號碼牌' }],
        ),
      }),
    [],
  )
  return (
    <group position={[T.x, 0, T.z]} rotation-y={0.5}>
      <WBox mat="redPaint" size={[0.5, 1.2, 0.4]} position={[0, 0.6, 0]} />
      <mesh position={[0, 0.72, 0.205]} material={label}>
        <planeGeometry args={[0.3, 0.6]} />
      </mesh>
      {/* 吐出來一半的號碼牌 */}
      <WBox mat="cloth" size={[0.12, 0.012, 0.1]} position={[0, 1.02, 0.24]} />
      <mesh material={mats.black} position={[0, 1.25, 0]}>
        <boxGeometry args={[0.52, 0.1, 0.42]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 字：「爾來了」匾額、北牆的窗口招牌、下班了
// ---------------------------------------------------------------------------

function plaque(text: string, w: number, h: number, bg = '#2a1410', fg = '#e9c46a', size = 88) {
  return new THREE.MeshStandardMaterial({
    map: canvasTexture(
      w,
      h,
      (ctx, cw, ch) => {
        const g = ctx.createLinearGradient(0, 0, 0, ch)
        g.addColorStop(0, bg)
        g.addColorStop(1, '#140a08')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, cw, ch)
        ctx.strokeStyle = fg
        ctx.lineWidth = 8
        ctx.strokeRect(10, 10, cw - 20, ch - 20)
        ctx.fillStyle = fg
        ctx.font = `700 ${size}px ${BRUSH_FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, cw / 2, ch / 2 + 4)
      },
      [{ spec: `700 ${size}px ${BRUSH_FONT}`, text }],
    ),
    roughness: 0.6,
  })
}

function Signs() {
  const report = useCh((s) => s.report)
  const big = useMemo(() => plaque('爾　來　了', 768, 192, '#1c0e0c', '#f0c75a', 110), [])
  const windows = useMemo(
    () => [plaque('一　延長居留', 384, 96, '#3a1410', '#f2e2b8', 50), plaque('二　託夢許可', 384, 96, '#3a1410', '#f2e2b8', 50), plaque('三　陽間遺失物', 384, 96, '#3a1410', '#f2e2b8', 46)],
    [],
  )
  const call = useMemo(() => plaque('叫號．收件', 320, 96, '#f2e2b8', '#7a1c1c', 52), [])
  const closed = useMemo(() => plaque('下 班 了', 256, 96, '#f2e2b8', '#7a1c1c', 56), [])
  return (
    <group>
      <mesh material={big} position={[CH.plaque.x, CH.plaque.y, R.z0 + 0.02]}>
        <planeGeometry args={[3.6, 0.9]} />
      </mesh>
      {windows.map((m, i) => (
        <mesh key={i} material={m} position={[3.0 + i * 1.75, 3.3, R.z0 + 0.02]}>
          <planeGeometry args={[1.6, 0.4]} />
        </mesh>
      ))}
      <mesh material={call} position={[CH.window.x, 2.55, CH.window.z - 0.24]}>
        <planeGeometry args={[1.4, 0.42]} />
      </mesh>
      {!report && (
        <mesh material={closed} position={[CH.desk.x, 1.25, CH.desk.z + 0.46]} rotation-x={-0.25}>
          <planeGeometry args={[0.9, 0.34]} />
        </mesh>
      )}
    </group>
  )
}

/** 西牆的號碼顯示板：紅色的七段數字，跳號時重畫 */
function NumberBoard() {
  const now = useCh((s) => s.now)
  const report = useCh((s) => s.report)
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 256
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  useEffect(() => {
    const c = tex.image as HTMLCanvasElement
    const ctx = c.getContext('2d')!
    const draw = () => {
      ctx.fillStyle = '#120606'
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.strokeStyle = '#6a4a2a'
      ctx.lineWidth = 10
      ctx.strokeRect(5, 5, c.width - 10, c.height - 10)
      ctx.fillStyle = '#f2e2b8'
      ctx.font = `700 44px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.fillText(report ? '現在號碼' : '本日已下班', c.width / 2, 62)
      ctx.fillStyle = '#ff3a2a'
      ctx.shadowColor = '#ff2a1a'
      ctx.shadowBlur = 18
      ctx.font = `700 130px "Courier New", monospace`
      ctx.fillText(report ? String(now).padStart(4, '0') : '----', c.width / 2, 205)
      ctx.shadowBlur = 0
      tex.needsUpdate = true
    }
    draw()
    document.fonts?.load(`700 44px ${BRUSH_FONT}`, '現在號碼本日已下班').then(draw, () => {})
  }, [now, report, tex])
  const B = CH.board
  return (
    <group position={[R.x0 + 0.05, B.y, B.z]} rotation-y={Math.PI / 2}>
      <WBox mat="darkWood" size={[2.3, 1.25, 0.1]} position={[0, 0, -0.03]} />
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[2.1, 1.05]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 香爐與香煙
// ---------------------------------------------------------------------------

const smokeTex = () =>
  canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(235,225,215,0.5)')
    g.addColorStop(1, 'rgba(235,225,215,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })

function Burner() {
  const bronze = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a6a3a', roughness: 0.35, metalness: 0.85 }), [])
  const geo = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          [0, 0],
          [0.32, 0],
          [0.42, 0.08],
          [0.5, 0.26],
          [0.48, 0.4],
          [0.54, 0.46],
          [0.42, 0.48],
          [0, 0.46],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        28,
      ),
    [],
  )
  const tex = useMemo(smokeTex, [])
  const puffs = useRef<THREE.Sprite[]>([])
  const b = CH.burner
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    puffs.current.forEach((p, i) => {
      if (!p) return
      const k = (t * 0.1 + i / 8) % 1
      p.position.set(Math.sin(k * 5 + i) * 0.15, 1.2 + k * 3.2, Math.cos(k * 3 + i) * 0.1)
      const sc = 0.3 + k * 1.1
      p.scale.set(sc, sc, 1)
      ;(p.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.28
    })
  })
  return (
    <group position={[b.x, 0, b.z]}>
      <WBox mat="stone" size={[0.9, 0.55, 0.9]} position={[0, 0.27, 0]} />
      <mesh geometry={geo} material={bronze} position={[0, 0.55, 0]} castShadow />
      {/* 插著的香 */}
      {[-0.08, 0, 0.08].map((x) => (
        <mesh key={x} position={[x, 1.2, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.36, 4]} />
          <meshStandardMaterial color="#b3261e" emissive="#ff6a2a" emissiveIntensity={0.3} />
        </mesh>
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <sprite
          key={i}
          ref={(el) => {
            if (el) puffs.current[i] = el
          }}
        >
          <spriteMaterial map={tex} transparent depthWrite={false} opacity={0} />
        </sprite>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 飄來飄去的表格（陰間的公文，永遠辦不完）
// ---------------------------------------------------------------------------

function FlyingForms() {
  const refs = useRef<(THREE.Mesh | null)[]>([])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#efe4c8', side: THREE.DoubleSide, roughness: 0.9, emissive: '#3a2a1a', emissiveIntensity: 0.4 }), [])
  const seeds = useMemo(() => Array.from({ length: 7 }, (_, i) => ({ x: -6 + i * 1.9, z: -3 + ((i * 37) % 7) - 1, s: 0.6 + ((i * 13) % 5) * 0.12, p: i * 1.7 })), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((m, i) => {
      if (!m) return
      const d = seeds[i]
      m.position.set(d.x + Math.sin(t * 0.3 * d.s + d.p) * 1.2, 2.6 + Math.sin(t * 0.7 * d.s + d.p) * 0.5, d.z + Math.cos(t * 0.25 * d.s + d.p) * 1.0)
      m.rotation.set(Math.sin(t * 1.1 + d.p) * 0.8, t * 0.6 * d.s + d.p, Math.cos(t * 0.9 + d.p) * 0.6)
    })
  })
  return (
    <group>
      {seeds.map((_, i) => (
        <mesh
          key={i}
          material={mat}
          ref={(el) => {
            refs.current[i] = el
          }}
        >
          <planeGeometry args={[0.26, 0.36]} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 人：判官、七爺、八爺、排隊的鬼（帽子另外畫）
// ---------------------------------------------------------------------------

function Npc({ id, x, z, heading, pose = 'idle', expr = 'normal', seatY, children }: { id: string; x: number; z: number; heading: number; pose?: PoseName; expr?: string; seatY?: number; children?: ReactNode }) {
  const drive = useRef(newDrive({ pose, heading, expr }))
  drive.current.pose = pose
  drive.current.expr = expr
  drive.current.heading = heading
  const spec = SPECS[id]
  const y = seatY !== undefined ? seatY - SEAT_Y * spec.scale + 0.03 : 0
  const outline = useStore((s) => s.quality === 'high')
  return (
    <group position={[x, y, z]} userData={{ noMerge: true }}>
      <Chibi spec={spec} drive={drive} outline={outline} legs={seatY === undefined} />
      {/* 帽子：跟著面向轉 */}
      <group position={[0, TOP_Y * spec.scale, 0]} rotation-y={heading}>
        {children}
      </group>
    </group>
  )
}

/** 判官的烏紗帽：黑色帽身＋兩邊的帽翅 */
function Wusha() {
  const mats = useMats()
  return (
    <group position={[0, -0.05, 0]}>
      <mesh material={mats.black} position={[0, 0.06, -0.02]}>
        <cylinderGeometry args={[0.2, 0.22, 0.16, 16]} />
      </mesh>
      <mesh material={mats.black} position={[0, 0.16, -0.08]}>
        <boxGeometry args={[0.34, 0.14, 0.14]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={mats.black} position={[s * 0.34, 0.14, -0.08]} rotation-z={s * 0.1}>
          <boxGeometry args={[0.36, 0.05, 0.02]} />
        </mesh>
      ))}
    </group>
  )
}

/** 七爺、八爺的高帽（帽上的字） */
function TallHat({ text, color, fg, h }: { text: string; color: string; fg: string; h: number }) {
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        map: canvasTexture(
          128,
          256,
          (ctx, w, cv) => {
            ctx.fillStyle = color
            ctx.fillRect(0, 0, w, cv)
            ctx.fillStyle = fg
            ctx.font = `700 44px ${BRUSH_FONT}`
            ctx.textAlign = 'center'
            ;[...text].forEach((c, i) => ctx.fillText(c, w / 2, 58 + i * 52))
          },
          [{ spec: `700 44px ${BRUSH_FONT}`, text }],
        ),
      }),
    [text, color, fg],
  )
  return (
    <mesh material={mat} position={[0, h / 2 - 0.06, 0]}>
      <cylinderGeometry args={[0.13, 0.2, h, 12, 1, false, -Math.PI / 2, Math.PI * 2]} />
    </mesh>
  )
}

function Office({ outline }: { outline: boolean }) {
  void outline
  return (
    <group>
      <Npc id="panguan" x={CH.panguan.x} z={CH.panguan.z} heading={0.15} pose="shopkeeper">
        <Wusha />
      </Npc>
      <Npc id="qiye" x={CH.qiye.x} z={CH.qiye.z} heading={-0.55} pose="clasp">
        <TallHat text="一見大吉" color="#f4f1ea" fg="#1a1a1e" h={0.62} />
      </Npc>
      <Npc id="baye" x={CH.baye.x} z={CH.baye.z} heading={0.25} pose="shopkeeper">
        <TallHat text="天下太平" color="#1c1c20" fg="#f4f1ea" h={0.5} />
      </Npc>
      {/* 排隊的鬼：坐在長椅上，呂伯跟西裝阿伯面對面聊，阿姨轉過來看手上的申請書 */}
      <Npc id="ch_lu" x={CH.queue[0].x} z={CH.queue[0].z} heading={Math.PI / 2 + 0.3} pose="sit" seatY={0.49} />
      <Npc id="ch_suit" x={CH.queue[1].x} z={CH.queue[1].z} heading={-Math.PI / 2 - 0.3} pose="sit" seatY={0.49} />
      <Npc id="ch_auntie" x={CH.queue[2].x} z={CH.queue[2].z} heading={0.45} pose="sit" seatY={0.49} />
      <HeldTicket />
    </group>
  )
}

/** 阿姨手上的申請書（一張紙） */
function HeldTicket() {
  const q = CH.queue[2]
  return <WBox mat="cloth" size={[0.24, 0.01, 0.32]} position={[q.x + 0.12, 0.72, q.z + 0.28]} rotation={[-0.9, 0.45, 0]} castShadow={false} />
}

/** 半夜：只剩值夜班的八爺，趴在窗口打瞌睡 */
function NightShift({ outline }: { outline: boolean }) {
  void outline
  return (
    <group>
      <Npc id="baye" x={CH.baye.x} z={CH.baye.z} heading={0.25} pose="shopkeeper" expr="asleep">
        <TallHat text="天下太平" color="#1c1c20" fg="#f4f1ea" h={0.5} />
      </Npc>
      <Zzz x={CH.baye.x + 0.3} z={CH.baye.z} y={1.7} />
    </group>
  )
}

function Zzz({ x, y, z }: { x: number; y: number; z: number }) {
  const ref = useRef<THREE.Group>(null)
  const mat = useMemo(
    () =>
      new THREE.SpriteMaterial({
        transparent: true,
        depthWrite: false,
        map: canvasTexture(64, 64, (ctx, w, h) => {
          ctx.fillStyle = '#e8f4ff'
          ctx.font = '700 44px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('z', w / 2, h / 2)
        }),
      }),
    [],
  )
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime
    g.children.forEach((c, i) => {
      const k = (t * 0.35 + i / 3) % 1
      c.position.set(Math.sin(k * 4) * 0.1 + k * 0.25, k * 0.8, 0)
      c.scale.setScalar(0.12 + k * 0.16)
      ;((c as THREE.Sprite).material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI)
    })
  })
  return (
    <group ref={ref} position={[x, y, z]}>
      {[0, 1, 2].map((i) => (
        <sprite key={i} material={mat.clone()} />
      ))}
    </group>
  )
}

// 開發時：號碼牌的狀態掛到 window（自動化測試用）
if (import.meta.env.DEV) (window as unknown as { __ch: unknown }).__ch = { useCh, MY_TICKET }
