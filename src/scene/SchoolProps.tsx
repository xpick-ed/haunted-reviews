import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SCHOOL, schoolFx } from '../world/sceneSchool'
import { BRUSH_FONT, WBox, canvasTexture, seeded } from './kit'

// 廢棄國小的擺設：圍牆與校門、司令台、升旗台、銅像台座、遊樂器材、飲水台、鐘、地上的跳房子。
// 座標都在 src/world/sceneSchool.ts 的 SCHOOL。

const S = SCHOOL

/** 一種材質的純色網格（小東西用） */
function useFlat(color: string, rough = 0.85, metal = 0) {
  return useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }), [color, rough, metal])
}

// ---------------------------------------------------------------------------
// 圍牆與校門
// ---------------------------------------------------------------------------

function plaqueTex() {
  return canvasTexture(
    1024,
    160,
    (ctx, w, h) => {
      ctx.fillStyle = '#e8e2d2'
      ctx.fillRect(0, 0, w, h)
      // 水漬、斑駁
      const r = seeded(31)
      for (let i = 0; i < 120; i++) {
        ctx.fillStyle = `rgba(${90 + r() * 40},${80 + r() * 30},${60 + r() * 20},${r() * 0.12})`
        ctx.fillRect(r() * w, r() * h, 20 + r() * 90, 4 + r() * 30)
      }
      ctx.fillStyle = '#7a1f18'
      ctx.font = `700 104px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('後壁厝國民學校', w / 2, h / 2 + 6)
      // 掉了一個字的漆
      ctx.fillStyle = 'rgba(232,226,210,0.7)'
      ctx.fillRect(w * 0.56, 22, 70, 70)
    },
    [{ spec: `700 104px ${BRUSH_FONT}`, text: '後壁厝國民學校' }],
  )
}

export function SchoolWalls() {
  const tex = useMemo(plaqueTex, [])
  const rust = useFlat('#6a4a36', 0.75, 0.4)
  const W = S.wall
  const g = S.gate
  const gx0 = g.x - g.w / 2
  const gx1 = g.x + g.w / 2
  // 北邊（遠）高一點，南邊（鏡頭這一側）矮，免得擋住畫面
  const segs: { a: [number, number]; b: [number, number]; h: number }[] = [
    { a: [W.x0, W.z0], b: [gx0 - 0.6, W.z0], h: 1.7 },
    { a: [gx1 + 0.6, W.z0], b: [W.x1, W.z0], h: 1.7 },
    { a: [W.x0, W.z0], b: [W.x0, W.z1], h: 1.3 },
    { a: [W.x1, W.z0], b: [W.x1, W.z1], h: 1.3 },
    { a: [W.x0, W.z1], b: [W.x1, W.z1], h: 0.7 },
  ]
  return (
    <group>
      {segs.map((s, i) => {
        const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1])
        const cx = (s.a[0] + s.b[0]) / 2
        const cz = (s.a[1] + s.b[1]) / 2
        const alongX = s.a[1] === s.b[1]
        const size: [number, number, number] = alongX ? [len, s.h, 0.26] : [0.26, s.h, len]
        const cap: [number, number, number] = alongX ? [len, 0.08, 0.34] : [0.34, 0.08, len]
        return (
          <group key={i}>
            <WBox mat="brick" size={size} position={[cx, s.h / 2, cz]} />
            <WBox mat="trim" size={cap} position={[cx, s.h + 0.04, cz]} />
          </group>
        )
      })}
      {/* 校門：兩根方柱、鐵拱上的校名 */}
      {[gx0 - 0.25, gx1 + 0.25].map((x) => (
        <group key={x} position={[x, 0, W.z0]}>
          <WBox mat="plaster" size={[0.7, 2.7, 0.7]} position={[0, 1.35, 0]} />
          <WBox mat="stone" size={[0.84, 0.18, 0.84]} position={[0, 2.79, 0]} />
          <WBox mat="stone" size={[0.8, 0.5, 0.8]} position={[0, 0.25, 0]} />
        </group>
      ))}
      <group position={[g.x, 3.25, W.z0]}>
        <mesh material={rust} castShadow>
          <boxGeometry args={[g.w + 1.2, 0.07, 0.07]} />
        </mesh>
        <mesh material={rust} position={[0, -0.55, 0]}>
          <boxGeometry args={[g.w + 1.2, 0.05, 0.05]} />
        </mesh>
        <mesh position={[0, -0.27, 0.03]}>
          <planeGeometry args={[g.w + 0.6, 0.44]} />
          <meshStandardMaterial map={tex} roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* 生鏽的鐵門，往裡面開到一半 */}
      {[-1, 1].map((s) => (
        <group key={s} position={[g.x + s * (g.w / 2), 0, W.z0]} rotation={[0, s * 1.15, 0]}>
          {Array.from({ length: 7 }, (_, i) => (
            <mesh key={i} material={rust} position={[-s * (0.12 + i * 0.22), 0.85, 0]}>
              <boxGeometry args={[0.03, 1.5, 0.03]} />
            </mesh>
          ))}
          {[0.2, 1.55].map((y) => (
            <mesh key={y} material={rust} position={[-s * 0.78, y, 0]}>
              <boxGeometry args={[1.56, 0.05, 0.04]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 司令台（背板寫校訓）、升旗台、銅像台座
// ---------------------------------------------------------------------------

function mottoTex() {
  return canvasTexture(
    1024,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#e6dfcf'
      ctx.fillRect(0, 0, w, h)
      const r = seeded(77)
      for (let i = 0; i < 160; i++) {
        ctx.fillStyle = `rgba(80,70,55,${r() * 0.1})`
        ctx.fillRect(r() * w, r() * h, 10 + r() * 120, 2 + r() * 40)
      }
      ctx.fillStyle = 'rgba(160,40,32,0.78)'
      ctx.font = `700 150px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('禮 義 廉 恥', w / 2, h / 2 + 10)
      // 雨水往下流的痕跡
      for (let i = 0; i < 26; i++) {
        const x = r() * w
        const g = ctx.createLinearGradient(0, 0, 0, h)
        g.addColorStop(0, 'rgba(60,55,45,0.18)')
        g.addColorStop(1, 'rgba(60,55,45,0)')
        ctx.fillStyle = g
        ctx.fillRect(x, 0, 3 + r() * 6, h * (0.4 + r() * 0.6))
      }
    },
    [{ spec: `700 150px ${BRUSH_FONT}`, text: '禮義廉恥' }],
  )
}

export function SchoolStage() {
  const tex = useMemo(mottoTex, [])
  const st = S.stage
  const cx = (st.x0 + st.x1) / 2
  const cz = (st.z0 + st.z1) / 2
  const w = st.x1 - st.x0
  const d = st.z1 - st.z0
  return (
    <group>
      <WBox mat="stone" size={[w, st.h, d]} position={[cx, st.h / 2, cz]} />
      <WBox mat="trim" size={[w + 0.1, 0.08, d + 0.1]} position={[cx, st.h + 0.04, cz]} />
      {/* 前面的三階樓梯 */}
      {[0, 1, 2].map((i) => (
        <WBox key={i} mat="stone" size={[1.6, (st.h / 3) * (3 - i), 0.3]} position={[cx, ((st.h / 3) * (3 - i)) / 2, st.z1 + 0.15 + (2 - i) * 0.3 - 0.6]} />
      ))}
      {/* 背板 */}
      <WBox mat="plaster" size={[w, 2.3, 0.22]} position={[cx, st.h + 1.15, st.z0 + 0.12]} />
      <mesh position={[cx, st.h + 1.3, st.z0 + 0.24]}>
        <planeGeometry args={[w - 0.6, (w - 0.6) / 4]} />
        <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
      {/* 平屋頂與四根柱子 */}
      {[st.x0 + 0.2, st.x1 - 0.2].flatMap((x) =>
        [st.z0 + 0.2, st.z1 - 0.2].map((z) => <WBox key={`${x}${z}`} mat="plaster" size={[0.24, 2.5, 0.24]} position={[x, st.h + 1.25, z]} />),
      )}
      <WBox mat="yard" size={[w + 0.6, 0.16, d + 0.5]} position={[cx, st.h + 2.58, cz]} />
    </group>
  )
}

export function FlagPole() {
  const metal = useFlat('#9aa0a8', 0.4, 0.7)
  const f = S.flag
  return (
    <group position={[f.x, 0, f.z]}>
      <WBox mat="stone" size={[1.4, 0.5, 1.4]} position={[0, 0.25, 0]} />
      <WBox mat="stone" size={[0.9, 0.3, 0.9]} position={[0, 0.65, 0]} />
      <mesh material={metal} position={[0, 4.3, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.07, 7.3, 10]} />
      </mesh>
      <mesh material={metal} position={[0, 8.0, 0]}>
        <sphereGeometry args={[0.1, 10, 8]} />
      </mesh>
      {/* 鬆掉的升旗繩 */}
      <mesh position={[0.08, 4.3, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 7.2, 4]} />
        <meshStandardMaterial color="#d8d0bc" roughness={1} />
      </mesh>
    </group>
  )
}

export function StatueBase() {
  const s = S.statue
  return (
    <group position={[s.x, 0, s.z]}>
      <WBox mat="stone" size={[1.3, 0.35, 1.3]} position={[0, 0.175, 0]} />
      <WBox mat="plaster" size={[0.95, 1.1, 0.95]} position={[0, 0.9, 0]} />
      <WBox mat="stone" size={[1.1, 0.12, 1.1]} position={[0, 1.5, 0]} />
      {/* 銅像不在了，只剩兩個鏽掉的螺栓 */}
      {[-0.18, 0.18].map((x) => (
        <mesh key={x} position={[x, 1.6, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.08, 6]} />
          <meshStandardMaterial color="#5a3a26" roughness={0.6} metalness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 遊樂器材：單槓、溜滑梯、蹺蹺板（油漆掉得差不多了）
// ---------------------------------------------------------------------------

export function Playground() {
  const red = useFlat('#a4453a', 0.6, 0.35)
  const blue = useFlat('#3d6a8a', 0.6, 0.35)
  const yellow = useFlat('#c9a13c', 0.6, 0.35)
  const steel = useFlat('#8d9096', 0.45, 0.7)
  const b = S.bars
  const sl = S.slide
  const ss = S.seesaw
  return (
    <group>
      {/* 單槓：三根高低不同 */}
      {[
        [-0.8, 1.1],
        [0, 1.45],
        [0.8, 1.8],
      ].map(([dx, h], i) => (
        <group key={i} position={[b.x + dx, 0, b.z]}>
          <mesh material={steel} position={[0, h, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.8, 8]} />
          </mesh>
          {[-0.4, 0.4].map((x) => (
            <mesh key={`p${x}`} material={i === 1 ? blue : red} position={[x, h / 2, 0]} castShadow>
              <cylinderGeometry args={[0.04, 0.04, h, 8]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* 溜滑梯：梯子在北邊，滑道往南 */}
      <group position={[sl.x, 0, sl.z]}>
        {[-0.35, 0.35].map((x) => (
          <group key={x}>
            <mesh material={blue} position={[x, 0.95, -1.15]} castShadow>
              <boxGeometry args={[0.06, 1.9, 0.06]} />
            </mesh>
            <mesh material={blue} position={[x, 0.95, -0.55]} castShadow>
              <boxGeometry args={[0.06, 1.9, 0.06]} />
            </mesh>
          </group>
        ))}
        {[0.3, 0.7, 1.1, 1.5].map((y) => (
          <mesh key={y} material={steel} position={[0, y, -1.15]}>
            <boxGeometry args={[0.7, 0.04, 0.04]} />
          </mesh>
        ))}
        <mesh material={yellow} position={[0, 1.9, -0.85]} castShadow receiveShadow>
          <boxGeometry args={[0.76, 0.06, 0.66]} />
        </mesh>
        <mesh material={steel} position={[0, 1.02, 0.35]} rotation={[-0.84, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.6, 0.04, 2.3]} />
        </mesh>
        {[-0.3, 0.3].map((x) => (
          <mesh key={x} material={yellow} position={[x, 1.1, 0.35]} rotation={[-0.84, 0, 0]}>
            <boxGeometry args={[0.04, 0.14, 2.3]} />
          </mesh>
        ))}
      </group>
      {/* 蹺蹺板：一端著地 */}
      <group position={[ss.x, 0, ss.z]}>
        <mesh material={red} position={[0, 0.25, 0]} castShadow>
          <boxGeometry args={[0.18, 0.5, 0.3]} />
        </mesh>
        <mesh position={[0, 0.34, 0]} rotation={[0, 0, 0.17]} castShadow receiveShadow>
          <boxGeometry args={[2.8, 0.07, 0.26]} />
          <meshStandardMaterial color="#8a6a44" roughness={0.9} />
        </mesh>
        {[-1.2, 1.2].map((x) => (
          <mesh key={x} material={steel} position={[x, 0.34 + x * 0.17 + 0.14, 0]} rotation={[0, 0, 0.17]}>
            <torusGeometry args={[0.08, 0.015, 6, 12, Math.PI]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 飲水台（一排水龍頭）、走廊盡頭的鐘（敲的時候會晃）
// ---------------------------------------------------------------------------

export function Trough() {
  const steel = useFlat('#9ca2a8', 0.35, 0.8)
  const t = S.trough
  return (
    <group position={[t.x, 0, t.z]}>
      <WBox mat="stone" size={[1.7, 0.75, 0.5]} position={[0, 0.375, 0]} />
      <mesh position={[0, 0.74, 0.02]}>
        <boxGeometry args={[1.5, 0.04, 0.34]} />
        <meshStandardMaterial color="#3a4046" roughness={0.3} />
      </mesh>
      <WBox mat="stone" size={[1.7, 0.4, 0.12]} position={[0, 0.95, -0.2]} />
      {[-0.55, -0.18, 0.18, 0.55].map((x) => (
        <group key={x} position={[x, 0.98, -0.1]}>
          <mesh material={steel} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.14, 6]} />
          </mesh>
          <mesh material={steel} position={[0, -0.05, 0.07]}>
            <cylinderGeometry args={[0.018, 0.018, 0.08, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** 鐘：掛在走廊東邊的柱子上；敲了會晃幾秒 */
export function Bell() {
  const bell = useRef<THREE.Group>(null)
  const bronze = useFlat('#7a5a2e', 0.4, 0.8)
  const b = S.bell
  const geo = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          [0, 0.2],
          [0.06, 0.2],
          [0.1, 0.14],
          [0.12, 0.02],
          [0.15, -0.06],
          [0.14, -0.08],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        16,
      ),
    [],
  )
  useFrame(() => {
    const g = bell.current
    if (!g) return
    const t = (performance.now() - schoolFx.bellAt) / 1000
    g.rotation.z = t < 3 ? Math.sin(t * 14) * 0.35 * Math.exp(-t * 1.4) : 0
  })
  return (
    <group position={[b.x, 0, b.z]} userData={{ noMerge: true }}>
      <WBox mat="darkWood" size={[0.12, 2.9, 0.12]} position={[0, 1.45, 0]} />
      <WBox mat="darkWood" size={[0.5, 0.08, 0.08]} position={[0.2, 2.75, 0]} />
      <group ref={bell} position={[0.38, 2.7, 0]}>
        <mesh geometry={geo} material={bronze} position={[0, -0.25, 0]} castShadow />
        <mesh position={[0, -0.36, 0]}>
          <cylinderGeometry args={[0.004, 0.004, 0.26, 4]} />
          <meshStandardMaterial color="#c9b98a" />
        </mesh>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 地上的跳房子（粉筆畫在走廊前的水泥地上，沿 x 排）
// ---------------------------------------------------------------------------

/** 跳房子的格子（1、2、3、4|5、6、7|8、天），沿 +x 方向 */
function hopTex() {
  return canvasTexture(
    1024,
    256,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(245,240,228,0.85)'
      ctx.fillStyle = 'rgba(245,240,228,0.85)'
      ctx.lineWidth = 7
      ctx.lineCap = 'round'
      const cell = 120
      const x0 = 30
      const rows: (number[] | number)[] = [1, 2, 3, [4, 5], 6, [7, 8]]
      ctx.font = `700 64px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      rows.forEach((r, i) => {
        const x = x0 + i * cell
        if (Array.isArray(r)) {
          ctx.strokeRect(x, 20, cell, (h - 40) / 2)
          ctx.strokeRect(x, 20 + (h - 40) / 2, cell, (h - 40) / 2)
          ctx.fillText(String(r[0]), x + cell / 2, 20 + (h - 40) / 4)
          ctx.fillText(String(r[1]), x + cell / 2, 20 + ((h - 40) * 3) / 4)
        } else {
          ctx.strokeRect(x, 20 + (h - 40) / 4, cell, (h - 40) / 2)
          ctx.fillText(String(r), x + cell / 2, h / 2)
        }
      })
      // 天（半圓）
      const xe = x0 + rows.length * cell
      ctx.beginPath()
      ctx.arc(xe, h / 2, (h - 40) / 2, -Math.PI / 2, Math.PI / 2)
      ctx.stroke()
      ctx.fillText('天', xe + 50, h / 2)
      // 小孩鬼用粉筆畫的小人
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.arc(xe + 170, h / 2 - 50, 22, 0, Math.PI * 2)
      ctx.moveTo(xe + 170, h / 2 - 28)
      ctx.lineTo(xe + 170, h / 2 + 30)
      ctx.moveTo(xe + 140, h / 2)
      ctx.lineTo(xe + 200, h / 2)
      ctx.moveTo(xe + 170, h / 2 + 30)
      ctx.lineTo(xe + 150, h / 2 + 70)
      ctx.moveTo(xe + 170, h / 2 + 30)
      ctx.lineTo(xe + 190, h / 2 + 70)
      ctx.stroke()
    },
    [{ spec: `700 64px ${BRUSH_FONT}`, text: '12345678天' }],
  )
}

export function HopscotchChalk() {
  const tex = useMemo(hopTex, [])
  const p = S.hopscotch
  return (
    <mesh rotation-x={-Math.PI / 2} position={[p.x + 0.4, 0.035, p.z]} renderOrder={1}>
      <planeGeometry args={[4.4, 1.1]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} opacity={0.8} />
    </mesh>
  )
}
