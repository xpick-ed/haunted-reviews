import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { OLDSTREET } from '../world/sceneOldStreet'
import { lanternAt } from './daylight'
import { BRUSH_FONT, boxGeo, canvasTexture } from './kit'
import { MergeStatic } from './MergeStatic'
import { Fader } from './OldStreetFader'
import { ArcadeColumn, FZ, Lot } from './OldStreetFacades'
import { ClothFront, IceShop, PhotoStudio } from './OldStreetShops'
import { STYLES, useWindowGlowMat } from './oldStreetStyles'

// 老街東邊的三間店（DESIGN §30）：阿桃冰果室、光明照相館、錦繡布莊。規則在 src/world/osEast.ts。

const O = OLDSTREET
/** 這個檔案畫的店（OldStreet.tsx 就不畫） */
export const EAST_LOTS = ['ice', 'photo', 'cloth']

export function OldStreetEast({ outline }: { outline: boolean }) {
  const glowPhoto = useWindowGlowMat('#ffe8c0', 1)
  const glowIce = useWindowGlowMat('#ffe4ec', 0.9)
  const iceLot = O.lots.find((l) => l.id === 'ice')!
  const lots = O.lots.filter((l) => l.id === 'photo' || l.id === 'cloth')
  return (
    <group>
      <MergeStatic>
        {lots.map((l) => (
          <Lot key={l.id} x0={l.x0} x1={l.x1} top={l.top} style={{ ...STYLES[l.id], glow: l.id === 'photo' ? glowPhoto : undefined }} />
        ))}
        <ClothFront />
      </MergeStatic>
      {/* 冰果室的二樓立面＋轉角柱：阿嬤在戲院大廳東邊時會擋到鏡頭 */}
      <Fader id="os_ice_front">
        <MergeStatic>
          <Lot x0={iceLot.x0} x1={iceLot.x1} top={iceLot.top} style={{ ...STYLES.ice, glow: glowIce }} />
          <ArcadeColumn x={iceLot.x0} />
        </MergeStatic>
      </Fader>
      <IceShop outline={outline} />
      <PhotoStudio outline={outline} />
      <IceNeon />
    </group>
  )
}

/** 冰果室門口的霓虹招牌（直立、從立面伸出來，晚上亮粉紅色） */
function IceNeon() {
  const tex = useMemo(
    () =>
      canvasTexture(
        96,
        300,
        (ctx, w, h) => {
          ctx.fillStyle = '#1a0e14'
          ctx.fillRect(0, 0, w, h)
          ctx.strokeStyle = '#ff7ab8'
          ctx.lineWidth = 4
          ctx.strokeRect(8, 8, w - 16, h - 16)
          ctx.fillStyle = '#ffd0e8'
          ctx.shadowColor = '#ff4fa0'
          ctx.shadowBlur = 12
          ctx.font = `900 64px ${BRUSH_FONT}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ;['冰', '果', '室'].forEach((ch, i) => ctx.fillText(ch, w / 2, 58 + i * 92))
        },
        [{ spec: `900 64px ${BRUSH_FONT}`, text: '冰果室' }],
      ),
    [],
  )
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: '#555555' }), [tex])
  useFrame(({ clock }) => {
    const l = lanternAt(useStore.getState().time)
    const t = clock.elapsedTime
    // 老霓虹管：偶爾閃爍
    const f = Math.sin(t * 1.7) > 0.96 && Math.sin(t * 41) > 0 ? 0.35 : 1
    const k = (0.35 + 1.1 * l) * f
    mat.color.setRGB(k, k, k)
  })
  const x = O.lots[3].x1 - 0.55
  return (
    <group position={[x, 5.0, FZ + 0.45]} userData={{ noMerge: true }}>
      <mesh geometry={boxGeo(0.05, 0.05, 0.6, 1)} position={[0, 1.0, -0.2]}>
        <meshStandardMaterial color="#5b5f66" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh geometry={boxGeo(0.08, 1.9, 0.62, 1)}>
        <meshStandardMaterial color="#1a1418" roughness={0.6} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={mat} position={[s * 0.045, 0, 0]} rotation={[0, (s * Math.PI) / 2, 0]}>
          <planeGeometry args={[0.58, 1.82]} />
        </mesh>
      ))}
    </group>
  )
}

