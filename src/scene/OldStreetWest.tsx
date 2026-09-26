import { useEffect } from 'react'
import { useStore } from '../store'
import { MergeStatic } from './MergeStatic'
import { OLDSTREET } from '../world/sceneOldStreet'
import { Lot } from './OldStreetFacades'
import { ShopFader } from './OldStreetWestFader'
import { InteriorCull } from './OldStreetFader'
import { BarberPole } from './OldStreetShops'
import { STYLES, useWindowGlowMat } from './oldStreetStyles'
import { BarberShell, HERB_EAST_X, HerbShell, PARTY_X, SideWall } from './OldStreetWestShell'
import { OSW } from '../world/osWest'
import { BarberInterior, BarberLive } from './OldStreetWestBarber'
import { HerbInterior, HerbLive } from './OldStreetWestHerb'

// 老街西邊的兩間店（DESIGN §30）：新美理髮廳、和春中藥行，都可以走進去。規則在 src/world/osWest.ts。
// 外殼（二樓、屋頂、店面、擋鏡頭的側牆）包在 Fader 裡：阿嬤走進店裡（buildings 的 inside）就淡出、鏡頭拉近；
// 店裡的東西在外殼外面，淡出以後看得到。

const O = OLDSTREET
/** 這個檔案畫的店（OldStreet.tsx 就不畫） */
export const WEST_LOTS = ['barber', 'herb']

/** 走進店裡：每天第一次，店裡的人（或阿嬤）講一句 */
const VISIT: Record<string, { flag: string; dusk: string; night: string }> = {
  os_barber_in: { flag: 'os_barber_visit_today', dusk: 'osw.enter.barber.dusk', night: 'osw.enter.barber.night' },
  os_herb_in: { flag: 'os_herb_visit_today', dusk: 'osw.enter.herb.dusk', night: 'osw.enter.herb.night' },
}

function useVisitBarks() {
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        if (s.building === prev.building || !s.building) return
        const v = VISIT[s.building]
        if (!v || s.flags[v.flag]) return
        useStore.setState({ flags: { ...s.flags, [v.flag]: true } })
        s.bark(s.phase === 'night' ? v.night : v.dusk)
      }),
    [],
  )
}

export function OldStreetWest({ outline }: { outline: boolean }) {
  const glowHerb = useWindowGlowMat('#ffd9a0', 0.8)
  const barber = O.lots.find((l) => l.id === 'barber')!
  const herb = O.lots.find((l) => l.id === 'herb')!
  useVisitBarks()
  return (
    <group>
      {/* 外殼：走進去就淡出 */}
      <ShopFader id="os_barber_in">
        <MergeStatic>
          <Lot x0={barber.x0} x1={barber.x1} top={barber.top} style={STYLES.barber} />
          <BarberShell />
        </MergeStatic>
      </ShopFader>
      {/* 在理髮廳裡時，東邊的中藥行（招牌、二樓）剛好擋在鏡頭前面：一起藏起來 */}
      <ShopFader id={['os_herb_in', 'os_barber_in']}>
        <MergeStatic>
          <Lot x0={herb.x0} x1={herb.x1} top={herb.top} style={{ ...STYLES.herb, glow: glowHerb }} />
          <HerbShell />
        </MergeStatic>
      </ShopFader>
      {/* 店裡（低畫質時，阿嬤不在店裡、門口附近就不畫） */}
      <InteriorCull ids={['os_barber_in', 'os_herb_in']} doors={[{ x: OSW.barber.door.c, z: O.arcade.frontZ }, { x: (OSW.herb.door.x0 + OSW.herb.door.x1) / 2, z: O.arcade.frontZ }]}>
        <MergeStatic>
          <BarberInterior />
          <HerbInterior />
          {/* 側牆的下半（切開的矮牆，一直都在） */}
          <SideWall x={PARTY_X} z0={OSW.backZ} z1={OSW.frontZ0} color="#e3ead9" skirt="#5a7a62" part="lower" />
          <SideWall x={HERB_EAST_X} z0={OSW.backZ} z1={OSW.frontZ0} color="#e8dcc2" part="lower" />
        </MergeStatic>
        <BarberLive outline={outline} />
        <HerbLive outline={outline} />
      </InteriorCull>
      <BarberPole />
    </group>
  )
}
