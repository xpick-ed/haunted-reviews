import { useMemo } from 'react'
import * as THREE from 'three'
import { SUGAR } from '../world/sceneSugar'
import { BRUSH_FONT, TILE, WBox, canvasTexture, planeGeo, seeded, useMats } from './kit'
import { mergeGeos, nameTexture, useStationMats } from './StationProps'

// 糖廠的靜態擺設（DESIGN §32.3）：壓榨工場的外殼（磚牆＋生鏽的浪板）、裡面的機器、煙囪、福利社、公佈欄、甘蔗堆、地磅。
// 組合與會動的東西在 src/scene/Sugar.tsx；座標在 src/world/sceneSugar.ts。

const S = SUGAR
const M = S.mill

/** 生鏽的浪板：直條紋＋鏽斑 */
function corrugatedTexture(seed: number, base = '#8a7a66') {
  const t = canvasTexture(256, 256, (ctx, w, h) => {
    const r = seeded(seed)
    ctx.fillStyle = base
    ctx.fillRect(0, 0, w, h)
    for (let x = 0; x < w; x += 16) {
      const g = ctx.createLinearGradient(x, 0, x + 16, 0)
      g.addColorStop(0, 'rgba(255,255,255,0.12)')
      g.addColorStop(0.5, 'rgba(0,0,0,0.18)')
      g.addColorStop(1, 'rgba(255,255,255,0.12)')
      ctx.fillStyle = g
      ctx.fillRect(x, 0, 16, h)
    }
    for (let i = 0; i < 38; i++) {
      ctx.fillStyle = `rgba(${120 + r() * 60},${50 + r() * 30},${20 + r() * 20},${0.2 + r() * 0.35})`
      const x = r() * w
      const y = r() * h
      ctx.beginPath()
      ctx.ellipse(x, y, 6 + r() * 26, 10 + r() * 50, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    // 雨水流下來的鏽痕
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(110,55,25,${0.15 + r() * 0.2})`
      ctx.fillRect(r() * w, 0, 3 + r() * 4, h * (0.3 + r() * 0.7))
    }
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

export function useSugarMats() {
  const mats = useMats()
  const sm = useStationMats()
  return useMemo(() => {
    const tin = new THREE.MeshStandardMaterial({ map: corrugatedTexture(11), roughness: 0.75, metalness: 0.35, side: THREE.DoubleSide })
    const tinRoof = new THREE.MeshStandardMaterial({ map: corrugatedTexture(23, '#7a6a58'), roughness: 0.8, metalness: 0.3, side: THREE.DoubleSide })
    const rust = new THREE.MeshStandardMaterial({ color: '#7a4a30', roughness: 0.8, metalness: 0.45 })
    const rustDark = new THREE.MeshStandardMaterial({ color: '#4a3428', roughness: 0.75, metalness: 0.5 })
    const iron = new THREE.MeshStandardMaterial({ color: '#3e3c3a', roughness: 0.6, metalness: 0.55 })
    const green = new THREE.MeshStandardMaterial({ color: '#4d6a58', roughness: 0.65, metalness: 0.3 })
    const floor = mats.yard.clone()
    floor.color.set('#9a958c')
    const brick = mats.brick
    const wood = mats.wood.clone()
    wood.color.set('#b8966a')
    const paper = new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 0.95 })
    return { tin, tinRoof, rust, rustDark, iron, green, floor, brick, wood, paper, cane: sm.cane, concrete: sm.concrete, ballast: sm.ballast }
  }, [mats, sm])
}

// ---------------------------------------------------------------------------
// 壓榨工場的外殼（Sugar.tsx 包在 Fader 裡：走進去就淡掉）
// ---------------------------------------------------------------------------

const BRICK_H = 1.4

/** 一面牆：下半磚、上半浪板（axis x：沿 x 的牆；z：沿 z 的牆） */
function MillWall({ axis, at, from, to }: { axis: 'x' | 'z'; at: number; from: number; to: number }) {
  const sg = useSugarMats()
  const len = to - from
  const c = (from + to) / 2
  const up = M.wallH - BRICK_H
  const pos = (y: number): [number, number, number] => (axis === 'x' ? [c, y, at] : [at, y, c])
  const rot: [number, number, number] = axis === 'x' ? [0, 0, 0] : [0, Math.PI / 2, 0]
  return (
    <group>
      <WBox mat="brick" size={axis === 'x' ? [len, BRICK_H, 0.3] : [0.3, BRICK_H, len]} position={pos(BRICK_H / 2)} />
      <mesh geometry={planeGeo(len, up, 2.2)} material={sg.tin} position={pos(BRICK_H + up / 2)} rotation={rot} castShadow receiveShadow />
    </group>
  )
}

export function MillShell() {
  const sg = useSugarMats()
  const midZ = (M.z0 + M.z1) / 2
  const halfD = (M.z1 - M.z0) / 2 + 0.5
  const rise = M.ridgeY - M.wallH
  const slope = Math.hypot(halfD, rise)
  const ang = Math.atan2(rise, halfD)
  // 山牆（東西兩頭的三角形）
  const gable = useMemo(() => {
    const sh = new THREE.Shape()
    sh.moveTo(-halfD + 0.5, 0)
    sh.lineTo(halfD - 0.5, 0)
    sh.lineTo(0, rise)
    sh.closePath()
    return new THREE.ShapeGeometry(sh)
  }, [halfD, rise])
  return (
    <group>
      <MillWall axis="x" at={M.z0} from={M.x0} to={M.x1} />
      <MillWall axis="z" at={M.x0} from={M.z0} to={M.z1} />
      <MillWall axis="z" at={M.x1} from={M.z0} to={M.z1} />
      {/* 南面：兩頭的短牆、開口上面的浪板橫帶 */}
      <MillWall axis="x" at={M.z1} from={M.x0} to={M.x0 + 0.9} />
      <MillWall axis="x" at={M.z1} from={M.x1 - 0.9} to={M.x1} />
      <mesh geometry={planeGeo(M.x1 - M.x0, 1.1, 2.2)} material={sg.tin} position={[(M.x0 + M.x1) / 2, M.wallH - 0.55, M.z1]} castShadow />
      {[M.x0, M.x1].map((x) => (
        <mesh key={x} geometry={gable} material={sg.tin} position={[x, M.wallH, midZ]} rotation={[0, Math.PI / 2, 0]} />
      ))}
      {/* 屋頂：兩片斜的浪板（屋脊沿 x） */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          geometry={planeGeo(M.x1 - M.x0 + 0.8, slope, 2.6)}
          material={sg.tinRoof}
          position={[(M.x0 + M.x1) / 2, M.wallH + rise / 2, midZ + (s * halfD) / 2]}
          rotation={[-Math.PI / 2 + s * ang, 0, 0]}
          castShadow
          receiveShadow
        />
      ))}
      {/* 屋脊上的通風氣窗 */}
      <mesh material={sg.rustDark} position={[(M.x0 + M.x1) / 2, M.ridgeY + 0.25, midZ]} castShadow>
        <boxGeometry args={[M.x1 - M.x0 - 4, 0.5, 1.2]} />
      </mesh>
    </group>
  )
}

/** 南面開口之間的磚柱（不淡：站在外面也看得到哪裡可以走進去） */
export function MillPosts() {
  return (
    <group>
      {S.millPosts.map((x) => (
        <WBox key={x} mat="brick" size={[0.55, M.wallH - 1.1, 0.55]} position={[x, (M.wallH - 1.1) / 2, M.z1 - 0.1]} />
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 工場裡的機器：地板、三座壓榨機的架子（滾筒在 Sugar.tsx 會轉）、輸送帶、鍋爐、管子
// ---------------------------------------------------------------------------

export function MillFloor() {
  const sg = useSugarMats()
  return <mesh geometry={planeGeo(M.x1 - M.x0, M.z1 - M.z0, TILE.yard)} material={sg.floor} rotation-x={-Math.PI / 2} position={[(M.x0 + M.x1) / 2, 0.1, (M.z0 + M.z1) / 2]} receiveShadow />
}

export function MillMachines() {
  const sg = useSugarMats()
  const c = S.carrier
  const len = Math.hypot(c.z0 - c.z1, c.top - 0.2)
  const tilt = Math.atan2(c.top - 0.2, c.z0 - c.z1)
  const slats = useMemo(() => {
    const g: THREE.BufferGeometry[] = []
    for (let i = 0; i < 16; i++) {
      const b = new THREE.BoxGeometry(c.w - 0.12, 0.05, 0.08)
      b.translate(0, 0.08, -len / 2 + 0.2 + i * ((len - 0.4) / 15))
      g.push(b)
    }
    return mergeGeos(g)
  }, [c.w, len])
  return (
    <group>
      {/* 壓榨機的架子：底座＋兩片側板 */}
      {S.mills.map((x) => (
        <group key={x} position={[x, 0.1, S.millZ]}>
          <mesh material={sg.rustDark} position={[0, 0.3, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.0, 0.6, 2.2]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} material={sg.rust} position={[0, 1.3, s * 1.0]} castShadow>
              <boxGeometry args={[1.7, 1.6, 0.16]} />
            </mesh>
          ))}
          {/* 榨出來的汁流進的槽 */}
          <mesh material={sg.iron} position={[0, 0.66, 0]}>
            <boxGeometry args={[1.5, 0.1, 1.8]} />
          </mesh>
        </group>
      ))}
      {/* 第一座壓榨機旁邊的大飛輪 */}
      <mesh material={sg.iron} position={[S.mills[0] + 1.18, 1.25, S.millZ]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[1.0, 1.0, 0.14, 28]} />
      </mesh>
      {/* 輸送帶：從地上斜斜往北升到壓榨機那一排 */}
      <group position={[c.x, 0.2 + (c.top - 0.2) / 2, (c.z0 + c.z1) / 2]} rotation={[tilt, 0, 0]}>
        <mesh material={sg.rustDark} castShadow receiveShadow>
          <boxGeometry args={[c.w, 0.12, len]} />
        </mesh>
        <mesh geometry={slats} material={sg.iron} />
        {[-1, 1].map((s) => (
          <mesh key={s} material={sg.rust} position={[(s * c.w) / 2, 0.14, 0]}>
            <boxGeometry args={[0.06, 0.28, len]} />
          </mesh>
        ))}
      </group>
      {/* 輸送帶的腳 */}
      {[0.35, 0.7].map((k) => (
        <mesh key={k} material={sg.iron} position={[c.x, (0.2 + k * (c.top - 0.2)) / 2, c.z0 - k * (c.z0 - c.z1)]}>
          <boxGeometry args={[c.w - 0.2, 0.2 + k * (c.top - 0.2), 0.1]} />
        </mesh>
      ))}
      {/* 輸送帶頂上的橫槽：把甘蔗送到第一座壓榨機 */}
      <mesh material={sg.rustDark} position={[(c.x + S.mills[0]) / 2 + 0.3, c.top + 0.05, c.z1 + 0.1]} castShadow>
        <boxGeometry args={[c.x - S.mills[0] - 0.4, 0.3, 0.9]} />
      </mesh>
      {/* 鍋爐：磚砌的爐座＋兩個橫躺的鐵筒，煙道從東牆通到煙囪 */}
      <WBox mat="brick" size={[S.boiler.x1 - S.boiler.x0, 0.9, S.boiler.z1 - S.boiler.z0]} position={[(S.boiler.x0 + S.boiler.x1) / 2, 0.55, (S.boiler.z0 + S.boiler.z1) / 2]} />
      {[S.boiler.x0 + 0.8, S.boiler.x1 - 0.8].map((x) => (
        <mesh key={x} material={sg.green} position={[x, 1.65, (S.boiler.z0 + S.boiler.z1) / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.66, 0.66, S.boiler.z1 - S.boiler.z0 - 0.2, 18]} />
        </mesh>
      ))}
      <mesh material={sg.rustDark} position={[(S.boiler.x1 + S.chimney.x) / 2, 3.1, S.chimney.z]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, S.chimney.x - S.boiler.x1 + 0.4, 12]} />
      </mesh>
      {/* 牆上的管子 */}
      {[0.9, 1.3].map((dy, i) => (
        <mesh key={i} material={i ? sg.iron : sg.rust} position={[(M.x0 + M.x1) / 2 - 2, M.wallH - dy, M.z0 + 0.35]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, M.x1 - M.x0 - 5, 8]} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 大煙囪
// ---------------------------------------------------------------------------

export function Chimney() {
  const mats = useMats()
  const sg = useSugarMats()
  const C = S.chimney
  const brick = useMemo(() => {
    const m = mats.brick.clone()
    m.color.set('#b88a74')
    return m
  }, [mats])
  return (
    <group position={[C.x, 0, C.z]}>
      <WBox mat="brick" size={[2.3, 2.6, 2.3]} position={[0, 1.3, 0]} />
      <mesh material={brick} position={[0, 2.6 + C.h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.62, 0.98, C.h, 20, 1, true]} />
      </mesh>
      <mesh material={sg.rustDark} position={[0, 2.6 + C.h - 0.4, 0]}>
        <cylinderGeometry args={[0.7, 0.68, 0.5, 20]} />
      </mesh>
      <mesh material={sg.iron} position={[0, 2.6 + C.h * 0.55, 0]}>
        <cylinderGeometry args={[0.83, 0.85, 0.14, 20]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 福利社：木頭小屋，南面一個窗口；門口一台冰櫃
// ---------------------------------------------------------------------------

function freezerTexture() {
  return canvasTexture(
    512,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#f4f1e8'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#c8322a'
      ctx.fillRect(0, h * 0.28, w, h * 0.44)
      ctx.fillStyle = '#fff6e2'
      ctx.font = `900 96px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('枝 仔 冰', w / 2, h / 2 + 4)
      ctx.fillStyle = '#2e5a9a'
      ctx.font = `700 30px ${BRUSH_FONT}`
      ctx.fillText('紅豆　鳳梨　清冰', w / 2, h * 0.87)
    },
    [{ spec: `900 96px ${BRUSH_FONT}`, text: '枝仔冰紅豆鳳梨清' }],
  )
}

export function WelfareShop() {
  const sg = useSugarMats()
  const H = S.shop
  const cx = (H.x0 + H.x1) / 2
  const cz = (H.z0 + H.z1) / 2
  const sign = useMemo(() => nameTexture('福利社', '台糖後壁厝糖廠', '#2e5a3a', '#f4efe2'), [])
  const wall = 2.6
  const win = { x0: H.window - 0.85, x1: H.window + 0.85, y0: 0.95, y1: 1.95 }
  return (
    <group>
      {/* 牆：北、東、西整面，南面窗口的上下左右 */}
      <mesh material={sg.wood} position={[cx, wall / 2, H.z0 + 0.06]} castShadow receiveShadow>
        <boxGeometry args={[H.x1 - H.x0, wall, 0.12]} />
      </mesh>
      {[H.x0 + 0.06, H.x1 - 0.06].map((x) => (
        <mesh key={x} material={sg.wood} position={[x, wall / 2, cz]} castShadow receiveShadow>
          <boxGeometry args={[0.12, wall, H.z1 - H.z0]} />
        </mesh>
      ))}
      <mesh material={sg.wood} position={[(H.x0 + win.x0) / 2, wall / 2, H.z1 - 0.06]} castShadow>
        <boxGeometry args={[win.x0 - H.x0, wall, 0.12]} />
      </mesh>
      <mesh material={sg.wood} position={[(win.x1 + H.x1) / 2, wall / 2, H.z1 - 0.06]} castShadow>
        <boxGeometry args={[H.x1 - win.x1, wall, 0.12]} />
      </mesh>
      <mesh material={sg.wood} position={[H.window, win.y0 / 2, H.z1 - 0.06]}>
        <boxGeometry args={[win.x1 - win.x0, win.y0, 0.12]} />
      </mesh>
      <mesh material={sg.wood} position={[H.window, (win.y1 + wall) / 2, H.z1 - 0.06]}>
        <boxGeometry args={[win.x1 - win.x0, wall - win.y1, 0.12]} />
      </mesh>
      {/* 窗口的木檯子 */}
      <mesh material={sg.wood} position={[H.window, win.y0 + 0.03, H.z1 + 0.12]} castShadow>
        <boxGeometry args={[win.x1 - win.x0 + 0.2, 0.06, 0.4]} />
      </mesh>
      {/* 屋頂（往南斜）、招牌 */}
      <mesh material={sg.tinRoof} position={[cx, wall + 0.3, cz + 0.15]} rotation={[0.16, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[H.x1 - H.x0 + 0.6, 0.06, H.z1 - H.z0 + 1.1]} />
      </mesh>
      <mesh position={[H.window, wall - 0.3, H.z1 + 0.02]}>
        <planeGeometry args={[2.2, 0.55]} />
        <meshStandardMaterial map={sign} roughness={0.7} />
      </mesh>
    </group>
  )
}

export function Freezer() {
  const f = useMemo(freezerTexture, [])
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f4f1e8', roughness: 0.5 }), [])
  return (
    <group position={[S.freezer.x, 0, S.freezer.z]}>
      <mesh material={body} position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.8, 0.62]} />
      </mesh>
      <mesh position={[0, 0.47, 0.312]}>
        <planeGeometry args={[1.14, 0.56]} />
        <meshStandardMaterial map={f} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.88, 0]} castShadow>
        <boxGeometry args={[1.22, 0.07, 0.64]} />
        <meshStandardMaterial color="#2e5a9a" roughness={0.45} />
      </mesh>
      {/* 誠實箱 */}
      <mesh position={[0.42, 1.0, 0.1]} castShadow>
        <boxGeometry args={[0.24, 0.18, 0.18]} />
        <meshStandardMaterial color="#8a5a2a" roughness={0.7} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.5, 0.04, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.08, 10]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 公佈欄：一九六一年的全體員工合照（一排一排的小人）＋幾張公告
// ---------------------------------------------------------------------------

function staffPhotoTexture() {
  return canvasTexture(
    512,
    320,
    (ctx, w, h) => {
      const r = seeded(1961)
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#d8c8a2')
      g.addColorStop(1, '#b8a47c')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      // 背景：工場的屋頂
      ctx.fillStyle = 'rgba(70,55,40,0.35)'
      ctx.fillRect(0, 30, w, 70)
      // 四排人：頭＋肩膀
      for (let row = 0; row < 4; row++) {
        const n = 11 + row
        const y = 120 + row * 44
        for (let i = 0; i < n; i++) {
          const x = 30 + (i + 0.5) * ((w - 60) / n) + (r() - 0.5) * 6
          ctx.fillStyle = `rgba(40,30,22,${0.72 + r() * 0.2})`
          ctx.beginPath()
          ctx.arc(x, y, 9, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = `rgba(${200 + r() * 30},${190 + r() * 25},${160 + r() * 20},0.9)`
          ctx.beginPath()
          ctx.ellipse(x, y + 22, 14, 13, 0, Math.PI, 0)
          ctx.fill()
          ctx.fillRect(x - 14, y + 22, 28, 12)
        }
      }
      ctx.fillStyle = '#3a2a1e'
      ctx.font = `700 22px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.fillText('後壁厝糖廠　第二十三期製糖　全體員工　一九六一', w / 2, 22)
      ctx.strokeStyle = '#f4ecd8'
      ctx.lineWidth = 10
      ctx.strokeRect(5, 5, w - 10, h - 10)
    },
    [{ spec: `700 22px ${BRUSH_FONT}`, text: '後壁厝糖廠第二十三期製糖全體員工一九六一' }],
  )
}

export function NoticeBoard() {
  const sg = useSugarMats()
  const photo = useMemo(staffPhotoTexture, [])
  const B = S.board
  return (
    <group position={[B.x, 0, B.z]}>
      {[-0.9, 0.9].map((x) => (
        <mesh key={x} material={sg.wood} position={[x, 0.95, 0]} castShadow>
          <boxGeometry args={[0.1, 1.9, 0.1]} />
        </mesh>
      ))}
      <mesh material={sg.wood} position={[0, 1.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 1.1, 0.06]} />
      </mesh>
      <mesh material={sg.rustDark} position={[0, 1.98, 0.05]} castShadow>
        <boxGeometry args={[2.1, 0.08, 0.3]} />
      </mesh>
      <mesh position={[-0.2, 1.38, 0.035]}>
        <planeGeometry args={[0.95, 0.6]} />
        <meshStandardMaterial map={photo} roughness={0.8} />
      </mesh>
      {[
        [0.62, 1.55, 0.36, 0.44],
        [0.62, 1.08, 0.4, 0.32],
        [-0.62, 0.98, 0.3, 0.22],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} material={sg.paper} position={[x, y, 0.035]} rotation={[0, 0, (i - 1) * 0.05]}>
          <planeGeometry args={[w, h]} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 甘蔗堆（一根一根橫躺的甘蔗疊成小山）、地磅、過磅亭、窄軌上的空台車
// ---------------------------------------------------------------------------

export function CanePiles() {
  const sg = useSugarMats()
  const mesh = useMemo(() => {
    const r = seeded(5150)
    const geo = new THREE.CylinderGeometry(0.04, 0.045, 2.4, 5)
    geo.rotateZ(Math.PI / 2)
    const list: THREE.Matrix4[] = []
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    for (const p of S.piles) {
      const n = Math.round(p.r * p.r * 55)
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2
        const d = Math.sqrt(r()) * p.r * 0.9
        const x = p.x + Math.cos(a) * d
        const z = p.z + Math.sin(a) * d
        const top = (1 - (d / p.r) ** 2) * p.r * 0.75
        const y = 0.05 + r() * top
        e.set((r() - 0.5) * 0.15, (r() - 0.5) * 0.7 + (i % 2 ? 0.2 : -0.1), (r() - 0.5) * 0.12)
        q.setFromEuler(e)
        list.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)))
      }
    }
    const im = new THREE.InstancedMesh(geo, sg.cane, list.length)
    list.forEach((m, i) => im.setMatrixAt(i, m))
    im.castShadow = true
    im.receiveShadow = true
    return im
  }, [sg.cane])
  return <primitive object={mesh} />
}

export function YardProps() {
  const sg = useSugarMats()
  const W = S.scale
  return (
    <group>
      {/* 地磅：鐵板＋框 */}
      <mesh material={sg.iron} position={[(W.x0 + W.x1) / 2, 0.04, (W.z0 + W.z1) / 2]} receiveShadow>
        <boxGeometry args={[W.x1 - W.x0, 0.06, W.z1 - W.z0]} />
      </mesh>
      {/* 過磅亭 */}
      <group position={[S.booth.x, 0, S.booth.z]}>
        <mesh material={sg.concrete} position={[0, 1.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.25, 2.1, 1.25]} />
        </mesh>
        <mesh position={[0.1, 1.35, 0.63]}>
          <planeGeometry args={[0.7, 0.5]} />
          <meshStandardMaterial color="#1c2430" roughness={0.2} />
        </mesh>
        <mesh material={sg.rustDark} position={[0, 2.18, 0.1]} castShadow>
          <boxGeometry args={[1.5, 0.08, 1.6]} />
        </mesh>
      </group>
      {/* 窄軌支線上的空台車（生鏽） */}
      <group position={[S.spurWagon.x, 0.22, S.spurWagon.z]}>
        <mesh material={sg.rust} position={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[1.0, 0.1, 2.2]} />
        </mesh>
        {[-0.8, 0, 0.8].map((z) =>
          [-1, 1].map((s) => (
            <mesh key={`${z}${s}`} material={sg.rust} position={[s * 0.46, 0.55, z]}>
              <boxGeometry args={[0.05, 0.7, 0.05]} />
            </mesh>
          )),
        )}
        {[-0.7, 0.7].map((z) =>
          [-1, 1].map((s) => (
            <mesh key={`w${z}${s}`} material={sg.iron} position={[s * 0.45, 0.04, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.17, 0.17, 0.06, 12]} />
            </mesh>
          )),
        )}
      </group>
    </group>
  )
}
