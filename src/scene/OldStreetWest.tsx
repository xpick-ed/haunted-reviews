import { MergeStatic } from './MergeStatic'
import { OLDSTREET } from '../world/sceneOldStreet'
import { Lot } from './OldStreetFacades'
import { BarberFront, BarberPole, HerbFront } from './OldStreetShops'
import { STYLES, useWindowGlowMat } from './oldStreetStyles'

// 老街西邊的兩間店（DESIGN §30）：新美理髮廳、和春中藥行。規則在 src/world/osWest.ts。

const O = OLDSTREET
/** 這個檔案畫的店（OldStreet.tsx 就不畫） */
export const WEST_LOTS = ['barber', 'herb']

export function OldStreetWest({ outline }: { outline: boolean }) {
  void outline
  const glowHerb = useWindowGlowMat('#ffd9a0', 0.8)
  const lots = O.lots.filter((l) => WEST_LOTS.includes(l.id))
  return (
    <group>
      <MergeStatic>
        {lots.map((l) => (
          <Lot key={l.id} x0={l.x0} x1={l.x1} top={l.top} style={{ ...STYLES[l.id], glow: l.id === 'herb' ? glowHerb : undefined }} />
        ))}
        <BarberFront />
        <HerbFront />
      </MergeStatic>
      <BarberPole />
    </group>
  )
}
