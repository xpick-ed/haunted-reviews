import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { OLDSTREET } from '../world/sceneOldStreet'
import { OSW } from '../world/osWest'
import { DRAWERS } from '../ui/minigames/herbs.logic'
import { lanternAt } from './daylight'
import { BRUSH_FONT, TILE, WBox, boxGeo, canvasTexture, seeded, useMats } from './kit'
import { Chibi, ChibiNpc, SEAT_Y, newDrive, type Drive } from '../chars/Chibi'
import { SPECS } from '../chars/specs'
import '../chars/specs.oswest'

// 和春中藥行的店裡（DESIGN §30）：外殼淡出以後看得到。規則與座標在 src/world/osWest.ts。
// 整面的百子櫃、「妙手回春」匾、長櫃台（戥子、算盤、包藥的紙）、藥甕架、神農大帝的神龕、藥碾、
// 天花板吊著一把一把的藥草。傍晚和春伯站在櫃台後面；晚上他坐在藤椅上打瞌睡，櫃台前站著睡不著的好兄弟。

const O = OLDSTREET
const A = O.arcade
const FLOOR = 0.14
const H = OSW.herb
const BZ = OSW.backZ
const FZ0 = OSW.frontZ0
const IN_W = H.in.x1 - H.in.x0
const IN_D = FZ0 - BZ
const CX = (H.in.x0 + H.in.x1) / 2
const CZ = (BZ + FZ0) / 2

// ---------------------------------------------------------------------------
// 貼圖
// ---------------------------------------------------------------------------

/** 百子櫃的正面：一格一格的抽屜、白紙黑字的標籤、銅拉環 */
function cabinetTexture(cols: number, rows: number) {
  const names = [...DRAWERS, '人參', '杜仲', '丹參', '沙參', '玉竹', '天麻', '川貝', '杏仁', '羅漢果', '決明子', '金銀花', '蓮子', '芡實', '桑葉', '牛膝', '柴胡', '葛根', '白朮', '五味子', '黃連']
  return canvasTexture(
    cols * 96,
    rows * 72,
    (ctx, w, h) => {
      ctx.fillStyle = '#2e1a10'
      ctx.fillRect(0, 0, w, h)
      const cw = w / cols
      const ch = h / rows
      let k = 0
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const x = c * cw
          const y = r * ch
          const g = ctx.createLinearGradient(x, y, x, y + ch)
          g.addColorStop(0, '#7a4a2a')
          g.addColorStop(1, '#5e3820')
          ctx.fillStyle = g
          ctx.fillRect(x + 3, y + 3, cw - 6, ch - 6)
          // 標籤
          ctx.fillStyle = '#efe0b8'
          ctx.fillRect(x + cw * 0.18, y + 8, cw * 0.64, ch * 0.36)
          ctx.fillStyle = '#2a1608'
          ctx.font = `700 ${names[k % names.length].length > 2 ? 16 : 20}px ${BRUSH_FONT}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(names[k % names.length], x + cw / 2, y + 8 + ch * 0.18)
          k++
          // 銅拉環
          ctx.fillStyle = '#c9a045'
          ctx.beginPath()
          ctx.arc(x + cw / 2, y + ch * 0.72, 7, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#8a6a25'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(x + cw / 2, y + ch * 0.72 + 5, 9, 0.2, Math.PI - 0.2)
          ctx.stroke()
        }
    },
    [{ spec: `700 20px ${BRUSH_FONT}`, text: names.join('') }],
  )
}

/** 橫匾「妙手回春」 */
function plaqueTexture() {
  return canvasTexture(
    512,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#1c1a18'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#b08a3a'
      ctx.lineWidth = 8
      ctx.strokeRect(8, 8, w - 16, h - 16)
      ctx.fillStyle = '#e9c46a'
      ctx.font = `700 76px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('妙 手 回 春', w / 2, h / 2 + 4)
    },
    [{ spec: `700 76px ${BRUSH_FONT}`, text: '妙手回春' }],
  )
}

/** 算盤（俯看） */
function abacusTexture() {
  return canvasTexture(256, 96, (ctx, w, h) => {
    ctx.fillStyle = '#3d271a'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#5a3a24'
    ctx.fillRect(6, 6, w - 12, h - 12)
    ctx.fillStyle = '#2a1a10'
    ctx.fillRect(6, h * 0.3, w - 12, 4)
    for (let i = 0; i < 11; i++) {
      const x = 16 + i * ((w - 32) / 10)
      ctx.fillStyle = '#c8b890'
      ctx.fillRect(x - 1, 8, 2, h - 16)
      ctx.fillStyle = '#1a1210'
      const up = (i * 7) % 3 === 0
      ctx.beginPath()
      ctx.ellipse(x, up ? h * 0.22 : 16, 9, 6, 0, 0, Math.PI * 2)
      ctx.fill()
      for (let j = 0; j < 4; j++) {
        ctx.beginPath()
        ctx.ellipse(x, h * 0.48 + j * 10 + ((i * 3) % 2) * 6, 9, 5, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  })
}

// ---------------------------------------------------------------------------
// 店裡（靜態的放進 MergeStatic）
// ---------------------------------------------------------------------------

export function HerbInterior() {
  const mats = useMats()
  const floor = useMemo(() => {
    const m = mats.tile.clone()
    m.color.set('#a8735a')
    return m
  }, [mats])
  const wall = useMemo(() => {
    const m = mats.plaster.clone()
    m.color.set('#e8dcc2')
    return m
  }, [mats])
  const C = H.cabinet
  const cols = 9
  const rows = 6
  const cab = useMemo(() => new THREE.MeshStandardMaterial({ map: cabinetTexture(cols, rows), roughness: 0.7 }), [])
  const plaque = useMemo(plaqueTexture, [])
  const abacus = useMemo(abacusTexture, [])
  const paperMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#efe4c8', roughness: 0.95 }), [])
  const herbMats = useMemo(() => ['#7a5a3a', '#b89a5a', '#5a3a2a', '#c8b07a', '#8a2a20'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 })), [])
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e8f0ec', roughness: 0.05, transparent: true, opacity: 0.35 }), [])
  const brass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9a045', roughness: 0.3, metalness: 0.7 }), [])
  const wallH = A.ceilY - FLOOR
  const K = H.counter
  const cabH = C.h
  const cabW = C.x1 - C.x0
  // 天花板吊的藥草（固定亂數）
  const bundles = useMemo(() => {
    const r = seeded(77)
    return Array.from({ length: 9 }, (_, i) => ({ x: H.in.x0 + 0.9 + i * 0.6 + (r() - 0.5) * 0.2, z: -5.3 - r() * 0.8, len: 0.35 + r() * 0.25, c: Math.floor(r() * 4) }))
  }, [])
  return (
    <group>
      {/* 地板（紅磚色的地磚） */}
      <mesh geometry={boxGeo(IN_W, 0.02, IN_D, TILE.tile)} material={floor} position={[CX, FLOOR, CZ]} receiveShadow />
      {/* 後牆、西牆（東牆在外殼裡） */}
      <mesh geometry={boxGeo(IN_W, wallH, 0.24, TILE.plaster)} material={wall} position={[CX, FLOOR + wallH / 2, BZ - 0.12]} receiveShadow />
      {/* 西牆就是理髮廳的隔間牆（上半在理髮廳的外殼、下半在 OldStreetWest.tsx） */}

      {/* 百子櫃：櫃身、抽屜面、上面的藥罐、「妙手回春」 */}
      <WBox mat="darkWood" size={[cabW, cabH, C.z1 - C.z0]} position={[(C.x0 + C.x1) / 2, FLOOR + cabH / 2, (C.z0 + C.z1) / 2]} />
      <mesh material={cab} position={[(C.x0 + C.x1) / 2, FLOOR + 0.25 + (cabH - 0.45) / 2, C.z1 + 0.005]}>
        <planeGeometry args={[cabW - 0.16, cabH - 0.45]} />
      </mesh>
      <WBox mat="darkWood" size={[cabW + 0.1, 0.08, C.z1 - C.z0 + 0.08]} position={[(C.x0 + C.x1) / 2, FLOOR + cabH + 0.04, (C.z0 + C.z1) / 2]} castShadow={false} />
      {[-13.9, -13.2, -11.2, -10.5].map((x, i) => (
        <group key={x} position={[x, FLOOR + cabH + 0.08, (C.z0 + C.z1) / 2]}>
          <mesh material={i % 2 ? mats.ceramic : glass} position={[0, 0.16, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.32, 14]} />
          </mesh>
          <mesh material={mats.ceramic} position={[0, 0.34, 0]}>
            <cylinderGeometry args={[0.1, 0.12, 0.05, 12]} />
          </mesh>
        </group>
      ))}
      <mesh position={[(C.x0 + C.x1) / 2, FLOOR + cabH + 0.32, C.z1 - 0.06]}>
        <planeGeometry args={[1.6, 0.4]} />
        <meshStandardMaterial map={plaque} roughness={0.6} />
      </mesh>

      {/* 長櫃台：木頭、檯面、前面的玻璃櫥（裡面是藥材樣品） */}
      <WBox mat="darkWood" size={[K.x1 - K.x0, K.h - 0.05, K.z1 - K.z0]} position={[(K.x0 + K.x1) / 2, FLOOR + (K.h - 0.05) / 2, (K.z0 + K.z1) / 2]} />
      <WBox mat="wood" size={[K.x1 - K.x0 + 0.1, 0.05, K.z1 - K.z0 + 0.1]} position={[(K.x0 + K.x1) / 2, FLOOR + K.h - 0.02, (K.z0 + K.z1) / 2]} castShadow={false} />
      <mesh material={glass} position={[(K.x0 + K.x1) / 2 - 0.9, FLOOR + 0.62, K.z1 + 0.005]}>
        <planeGeometry args={[1.4, 0.5]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} material={herbMats[i]} position={[K.x0 + 0.55 + i * 0.32, FLOOR + 0.48, K.z1 - 0.15]}>
          <sphereGeometry args={[0.1, 8, 6]} />
        </mesh>
      ))}
      {/* 櫃台上：包藥的四張紙（每張一小堆藥）、算盤、茶杯、戥子 */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i} position={[-13.4 + i * 0.38, FLOOR + K.h + 0.01, (K.z0 + K.z1) / 2]}>
          <mesh material={paperMat} rotation={[-Math.PI / 2, 0, 0.2 * (i - 1.5)]}>
            <planeGeometry args={[0.3, 0.3]} />
          </mesh>
          <mesh material={herbMats[i]} position={[0, 0.03, 0]} scale={[1, 0.4, 1]}>
            <sphereGeometry args={[0.08, 8, 6]} />
          </mesh>
        </group>
      ))}
      <mesh position={[-11.3, FLOOR + K.h + 0.02, (K.z0 + K.z1) / 2 + 0.05]} rotation={[-Math.PI / 2, 0, 0.1]}>
        <planeGeometry args={[0.5, 0.2]} />
        <meshStandardMaterial map={abacus} roughness={0.6} />
      </mesh>
      <mesh position={[-10.85, FLOOR + K.h + 0.05, (K.z0 + K.z1) / 2]}>
        <cylinderGeometry args={[0.045, 0.035, 0.08, 12]} />
        <meshStandardMaterial color="#e8e4d8" roughness={0.2} />
      </mesh>
      {/* 戥子：掛在櫃台上方的小秤（桿、秤盤、秤錘） */}
      <group position={[-12.15, FLOOR + K.h + 0.55, (K.z0 + K.z1) / 2]}>
        <mesh material={brass} rotation={[0, 0, Math.PI / 2 - 0.05]}>
          <cylinderGeometry args={[0.008, 0.008, 0.62, 6]} />
        </mesh>
        <mesh material={brass} position={[-0.26, -0.18, 0]}>
          <cylinderGeometry args={[0.08, 0.06, 0.015, 14]} />
        </mesh>
        {[-0.03, 0.03].map((dz) => (
          <mesh key={dz} material={brass} position={[-0.27, -0.09, dz]}>
            <cylinderGeometry args={[0.002, 0.002, 0.18, 4]} />
          </mesh>
        ))}
        <mesh material={mats.metal} position={[0.14, -0.05, 0]}>
          <cylinderGeometry args={[0.018, 0.022, 0.05, 8]} />
        </mesh>
        <mesh material={brass} position={[-0.12, 0.2, 0]}>
          <cylinderGeometry args={[0.003, 0.003, 0.4, 4]} />
        </mesh>
      </group>

      {/* 西牆：三層藥甕架 */}
      <group position={[H.jars.x, FLOOR, (H.jars.z0 + H.jars.z1) / 2]}>
        {[0.35, 0.95, 1.55].map((y) => (
          <WBox key={y} mat="darkWood" size={[0.5, 0.04, H.jars.z1 - H.jars.z0]} position={[0, y, 0]} castShadow={false} />
        ))}
        {[-1, 1].map((s) => (
          <WBox key={s} mat="darkWood" size={[0.5, 1.6, 0.05]} position={[0, 0.8, (s * (H.jars.z1 - H.jars.z0)) / 2]} castShadow={false} />
        ))}
        {[0.35, 0.95, 1.55].flatMap((y, r) =>
          [-1.0, -0.4, 0.2, 0.8].map((dz, i) => (
            <group key={`${r}-${i}`} position={[0, y + 0.02, dz]}>
              <mesh material={(r + i) % 3 === 0 ? glass : mats.ceramic} position={[0, 0.16, 0]}>
                <cylinderGeometry args={[0.12, 0.14, 0.3, 12]} />
              </mesh>
              {(r + i) % 3 === 0 && (
                <mesh material={herbMats[4 - ((r + i) % 2) * 3]} position={[0, 0.1, 0]}>
                  <cylinderGeometry args={[0.1, 0.12, 0.16, 10]} />
                </mesh>
              )}
              <mesh material={mats.redPaper} position={[0.13, 0.18, 0]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[0.1, 0.12]} />
              </mesh>
            </group>
          )),
        )}
      </group>

      {/* 神農大帝的神龕（西牆高處）：紅色的龕、小神像、香爐、紅燈 */}
      <group position={[H.in.x0 + 0.2, FLOOR + 1.95, H.shennong.z]}>
        <WBox mat="redPaint" size={[0.36, 0.05, 0.62]} position={[0, 0, 0]} castShadow={false} />
        <WBox mat="redPaint" size={[0.34, 0.62, 0.05]} position={[-0.02, 0.32, -0.29]} castShadow={false} />
        <WBox mat="redPaint" size={[0.34, 0.62, 0.05]} position={[-0.02, 0.32, 0.29]} castShadow={false} />
        <WBox mat="redPaint" size={[0.38, 0.06, 0.66]} position={[0, 0.64, 0]} castShadow={false} />
        {/* 神像：綠色的臉、披著葉子 */}
        <mesh position={[-0.04, 0.16, 0]}>
          <cylinderGeometry args={[0.07, 0.1, 0.24, 10]} />
          <meshStandardMaterial color="#5a7a3a" roughness={0.8} />
        </mesh>
        <mesh position={[-0.04, 0.33, 0]}>
          <sphereGeometry args={[0.065, 10, 8]} />
          <meshStandardMaterial color="#6a9a5a" roughness={0.6} />
        </mesh>
        <mesh material={brass} position={[0.1, 0.05, 0]}>
          <cylinderGeometry args={[0.05, 0.04, 0.06, 10]} />
        </mesh>
      </group>

      {/* 藥碾（東牆邊的矮凳上）：船形的鐵槽、帶把手的碾輪 */}
      <group position={[H.grinder.x, FLOOR, H.grinder.z]}>
        <WBox mat="darkWood" size={[0.45, 0.28, 0.95]} position={[0, 0.14, 0]} />
        <mesh material={mats.metal} position={[0, 0.36, 0]} scale={[1, 0.6, 1]}>
          <boxGeometry args={[0.24, 0.2, 0.86]} />
        </mesh>
        <mesh material={mats.metal} position={[0, 0.5, 0.1]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.13, 0.13, 0.05, 18]} />
        </mesh>
        <mesh material={mats.darkWood} position={[0, 0.5, 0.1]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.018, 0.018, 0.52, 6]} />
        </mesh>
      </group>

      {/* 天花板吊著的藥草 */}
      {bundles.map((b, i) => (
        <group key={i} position={[b.x, A.ceilY - 0.05, b.z]}>
          <mesh material={mats.cloth} position={[0, -0.12, 0]}>
            <cylinderGeometry args={[0.004, 0.004, 0.24, 4]} />
          </mesh>
          <mesh material={herbMats[b.c]} position={[0, -0.24 - b.len / 2, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.1, b.len, 8]} />
          </mesh>
        </group>
      ))}

      {/* 藤椅（和春伯晚上在這裡打瞌睡） */}
      <group position={[H.nap.x, FLOOR, H.nap.z]} rotation={[0, -0.5, 0]}>
        <WBox mat="bamboo" size={[0.56, 0.08, 0.52]} position={[0, 0.4, 0]} />
        <WBox mat="bamboo" size={[0.56, 0.6, 0.07]} position={[0, 0.72, -0.24]} rotation={[-0.2, 0, 0]} />
        {[-1, 1].map((s) => (
          <WBox key={s} mat="bamboo" size={[0.06, 0.24, 0.5]} position={[s * 0.27, 0.54, 0]} />
        ))}
        {[-1, 1].flatMap((s) => [-1, 1].map((t) => <WBox key={`${s}${t}`} mat="bamboo" size={[0.05, 0.4, 0.05]} position={[s * 0.24, 0.2, t * 0.22]} />))}
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 會動的：吊燈、人
// ---------------------------------------------------------------------------

export function HerbLive({ outline }: { outline: boolean }) {
  const phase = useStore((s) => s.phase)
  const night = phase === 'night'
  const bulb = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffe0a8', toneMapped: false }), [])
  const altar = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff5a3a', toneMapped: false }), [])
  useFrame(({ clock }) => {
    const l = lanternAt(useStore.getState().time)
    bulb.color.setRGB(0.6 + 0.5 * l, 0.5 + 0.4 * l, 0.3 + 0.25 * l)
    const f = 0.75 + 0.25 * Math.sin(clock.elapsedTime * 2.3)
    altar.color.setRGB(1.0 * f, 0.3 * f, 0.18 * f)
  })
  const cx = (H.counter.x0 + H.counter.x1) / 2
  return (
    <group userData={{ noMerge: true }}>
      {/* 櫃台上方的吊燈（綠色琺瑯燈罩） */}
      <mesh position={[cx, A.ceilY - 0.25, -8.0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.5, 4]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[cx, A.ceilY - 0.52, -8.0]}>
        <coneGeometry args={[0.24, 0.14, 16, 1, true]} />
        <meshStandardMaterial color="#2f5a3a" roughness={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh material={bulb} position={[cx, A.ceilY - 0.6, -8.0]}>
        <sphereGeometry args={[0.07, 10, 8]} />
      </mesh>
      {/* 店裡的燈光：老街五間店共用一盞（OldStreetEast.tsx 的 ShopLight） */}
      {/* 神龕的小紅燈 */}
      <mesh material={altar} position={[H.in.x0 + 0.26, FLOOR + 2.47, H.shennong.z]}>
        <sphereGeometry args={[0.04, 8, 6]} />
      </mesh>

      {night ? (
        <>
          <NappingHerbalist outline={outline} />
          <ChibiNpc id="osw_sleepless" pose="clasp" position={[H.ghost.x, FLOOR, H.ghost.z]} heading={Math.PI - 0.5} seesGhosts outline={outline} />
        </>
      ) : (
        <ChibiNpc id="herbalist" pose="shopkeeper" position={[H.herbalist.x, FLOOR, H.herbalist.z]} heading={0} outline={outline} />
      )}
    </group>
  )
}

/** 晚上：和春伯坐在藤椅上打瞌睡，頭一點一點 */
function NappingHerbalist({ outline }: { outline: boolean }) {
  const spec = SPECS.herbalist
  const group = useRef<THREE.Group>(null)
  const drive = useRef<Drive>(newDrive({ pose: 'sit', heading: -0.5, expr: 'asleep' }))
  const y = FLOOR + 0.44 - SEAT_Y * spec.scale + 0.03
  useFrame(({ clock }) => {
    const g = group.current
    if (g) g.rotation.x = Math.sin(clock.elapsedTime * 0.9) * 0.04
  })
  return (
    <group ref={group} position={[H.nap.x, y, H.nap.z]}>
      <Chibi spec={spec} drive={drive} outline={outline} legs={false} />
    </group>
  )
}
