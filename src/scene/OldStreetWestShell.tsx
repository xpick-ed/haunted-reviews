import { useMemo } from 'react'
import * as THREE from 'three'
import { OLDSTREET } from '../world/sceneOldStreet'
import { OSW } from '../world/osWest'
import { BRUSH_FONT, TILE, WBox, boxGeo, canvasTexture, useMats } from './kit'
import { signTexture } from './OldStreetFacades'
import { StoreWall } from './OldStreetShops'

// 老街西邊兩間店的外殼（走進店裡時跟二樓、屋頂一起淡出）：一樓的店面、擋住鏡頭的那面側牆。
// 從 OldStreetShops.tsx 的 BarberFront／HerbFront 改來：門真的開著、看得到店裡。

const O = OLDSTREET
const A = O.arcade
const FLOOR = 0.14
const B = OSW.barber
const H = OSW.herb
const glassMat = new THREE.MeshStandardMaterial({ color: '#dfeff2', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false })
const H_WALL = A.ceilY - FLOOR

/** 切開的高度：店裡的人看出去，側牆只剩下這麼高（像娃娃屋） */
export const CUT_Y = 0.95

/**
 * 室內的側牆＋兩面的牆裙。part：upper 放在外殼裡（走進店裡就藏起來），lower 一直都在（切開的矮牆）。
 */
export function SideWall({ x, z0, z1, color, skirt, part }: { x: number; z0: number; z1: number; color: string; skirt?: string; part: 'upper' | 'lower' }) {
  const mats = useMats()
  const m = useMemo(() => {
    const c = mats.plaster.clone()
    c.color.set(color)
    return c
  }, [mats, color])
  const sk = useMemo(() => new THREE.MeshStandardMaterial({ color: skirt ?? '#3d271a', roughness: 0.7 }), [skirt])
  const d = z1 - z0
  if (part === 'upper') {
    const h = H_WALL - CUT_Y
    return <mesh geometry={boxGeo(0.24, h, d, TILE.plaster)} material={m} position={[x, FLOOR + CUT_Y + h / 2, (z0 + z1) / 2]} receiveShadow />
  }
  return (
    <group>
      <mesh geometry={boxGeo(0.24, CUT_Y, d, TILE.plaster)} material={m} position={[x, FLOOR + CUT_Y / 2, (z0 + z1) / 2]} receiveShadow />
      {/* 牆裙兩面都有（隔壁店裡也看得到）；切口上面壓一條木條 */}
      <mesh geometry={boxGeo(0.28, CUT_Y - 0.05, d - 0.1, 1)} material={sk} position={[x, FLOOR + (CUT_Y - 0.05) / 2, (z0 + z1) / 2]} />
      <WBox mat="darkWood" size={[0.3, 0.05, d]} position={[x, FLOOR + CUT_Y, (z0 + z1) / 2]} castShadow={false} />
    </group>
  )
}

/** 隔間牆的位置（理髮廳／中藥行之間、中藥行／戲院之間） */
export const PARTY_X = (B.in.x1 + H.in.x0) / 2
export const HERB_EAST_X = (H.in.x1 + H.x1) / 2

// ---------------------------------------------------------------------------
// 新美理髮廳：大櫥窗＋開著的玻璃門；東邊（跟中藥行之間）的隔間牆
// ---------------------------------------------------------------------------

export function BarberShell() {
  const door = B.door
  const win = B.window
  return (
    <group>
      <StoreWall
        x0={B.x0}
        x1={B.x1}
        color="#d9e4d2"
        openings={[
          { c: win.c, w: win.w, y0: win.y0, y1: win.y1 },
          { c: door.c, w: door.w, y0: 0, y1: 2.35 },
        ]}
      />
      {/* 櫥窗玻璃、窗框、貼在玻璃上的紅字「理髮・修面・洗頭」 */}
      <mesh material={glassMat} position={[win.c, FLOOR + (win.y0 + win.y1) / 2, A.frontZ - 0.1]}>
        <planeGeometry args={[win.w, win.y1 - win.y0]} />
      </mesh>
      <WBox mat="darkWood" size={[win.w + 0.1, 0.08, 0.3]} position={[win.c, FLOOR + win.y0, A.frontZ - 0.1]} castShadow={false} />
      <WBox mat="darkWood" size={[0.06, win.y1 - win.y0, 0.08]} position={[win.c, FLOOR + (win.y0 + win.y1) / 2, A.frontZ - 0.1]} castShadow={false} />
      <WindowLetters />
      {/* 玻璃門：往裡面推開（門框、門把） */}
      <WBox mat="darkWood" size={[door.w + 0.12, 0.1, 0.26]} position={[door.c, FLOOR + 2.4, A.frontZ - 0.12]} castShadow={false} />
      <group position={[door.c + door.w / 2 - 0.04, FLOOR, A.frontZ - 0.2]} rotation={[0, -1.25, 0]}>
        <WBox mat="darkWood" size={[0.05, 2.3, 0.05]} position={[-0.02, 1.15, 0]} castShadow={false} />
        <WBox mat="darkWood" size={[0.05, 2.3, 0.05]} position={[-door.w + 0.1, 1.15, 0]} castShadow={false} />
        <WBox mat="darkWood" size={[door.w - 0.08, 0.06, 0.05]} position={[-door.w / 2 + 0.04, 2.27, 0]} castShadow={false} />
        <WBox mat="darkWood" size={[door.w - 0.08, 0.35, 0.04]} position={[-door.w / 2 + 0.04, 0.18, 0]} castShadow={false} />
        <mesh material={glassMat} position={[-door.w / 2 + 0.04, 1.25, 0]}>
          <planeGeometry args={[door.w - 0.1, 1.8]} />
        </mesh>
        <WBox mat="gold" size={[0.14, 0.03, 0.03]} position={[-door.w + 0.2, 1.05, 0.04]} castShadow={false} />
      </group>
      {/* 東邊的隔間牆（上半）：在理髮廳裡會擋住鏡頭（在中藥行裡看是西牆，所以放在理髮廳的外殼）；下半在 OldStreetWest.tsx */}
      <SideWall x={PARTY_X} z0={OSW.backZ} z1={OSW.frontZ0} color="#e3ead9" skirt="#5a7a62" part="upper" />
    </group>
  )
}

/** 櫥窗玻璃上的紅字 */
function WindowLetters() {
  const tex = useMemo(
    () =>
      canvasTexture(
        512,
        96,
        (ctx, w, h) => {
          ctx.clearRect(0, 0, w, h)
          ctx.fillStyle = '#c62828'
          ctx.font = `700 64px ${BRUSH_FONT}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('理髮・修面・洗頭', w / 2, h / 2 + 4)
        },
        [{ spec: `700 64px ${BRUSH_FONT}`, text: '理髮・修面・洗頭' }],
      ),
    [],
  )
  return (
    <mesh position={[B.window.c, FLOOR + B.window.y0 + 0.28, A.frontZ - 0.08]}>
      <planeGeometry args={[1.9, 0.33]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// 和春中藥行：一片一片的木門板，中間拆掉四片當門；東牆（隔壁是戲院）
// ---------------------------------------------------------------------------

export function HerbShell() {
  const mats = useMats()
  const paper = useMemo(() => signTexture('藥', '#c3302a', '#fff2d8', '#c3302a'), [])
  const boards = useMemo(() => {
    const out: number[] = []
    for (let i = 0; i < 10; i++) {
      const x = -14.1 + 0.19 + i * 0.38
      if (x > H.door.x0 && x < H.door.x1) continue
      out.push(x)
    }
    return out
  }, [])
  return (
    <group>
      <StoreWall x0={H.x0} x1={H.x1} mat="brick" openings={[{ c: -12.2, w: 3.8, y0: 0, y1: 2.7 }]} />
      {boards.map((x) => (
        <WBox key={x} mat="darkWood" size={[0.37, 2.66, 0.06]} position={[x, FLOOR + 1.33, A.frontZ - 0.08]} castShadow={false} />
      ))}
      {/* 門楣上的橫木 */}
      <WBox mat="darkWood" size={[3.9, 0.1, 0.2]} position={[-12.2, FLOOR + 2.72, A.frontZ - 0.1]} castShadow={false} />
      {/* 門板上貼的紅紙「藥」 */}
      {[-13.15, -10.87].map((x) => (
        <mesh key={x} position={[x, FLOOR + 1.9, A.frontZ - 0.04]}>
          <planeGeometry args={[0.34, 0.34]} />
          <meshStandardMaterial map={paper} roughness={0.8} />
        </mesh>
      ))}
      {/* 門口兩邊的藥甕 */}
      {[-14.6, -9.7].map((x) => (
        <group key={x} position={[x, FLOOR, A.frontZ + 0.45]}>
          <mesh material={mats.ceramic} position={[0, 0.3, 0]} castShadow>
            <sphereGeometry args={[0.28, 14, 10]} />
          </mesh>
          <mesh material={mats.ceramic} position={[0, 0.58, 0]}>
            <cylinderGeometry args={[0.12, 0.16, 0.12, 12]} />
          </mesh>
        </group>
      ))}
      {/* 東牆（上半）：在店裡會擋住鏡頭 */}
      <SideWall x={HERB_EAST_X} z0={OSW.backZ} z1={OSW.frontZ0} color="#e8dcc2" part="upper" />
    </group>
  )
}
