import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { player } from '../world/player'
import { OLDSTREET } from '../world/sceneOldStreet'
import { lanternAt } from './daylight'
import { MergeStatic } from './MergeStatic'
import { ArcadeColumn, Lot } from './OldStreetFacades'
import { STYLES, useWindowGlowMat } from './oldStreetStyles'
import { ShopFader } from './OldStreetEastKit'
import { IceInterior, IceLive, IceNeon, ShellIce } from './OldStreetEastIce'
import { PhotoInterior, PhotoLive, PhotoWall, ShellPhoto } from './OldStreetEastPhoto'
import { ClothInterior, ClothLive, ShellCloth } from './OldStreetEastCloth'
import '../chars/specs.oseast'

// 老街東邊的三間店（DESIGN §30）：阿桃冰果室、光明照相館、錦繡布莊，都可以走進去。規則在 src/world/osEast.ts。
// 每間店的外殼（立面、二樓、屋頂、店面牆、東邊的隔間牆）包在 ShopFader 裡：走進店裡、或在隔壁店裡擋到鏡頭時淡出；
// 店裡的東西一直看得到。最後一間（沒有室內）也在這裡畫，才能在布莊裡面時淡出。

const O = OLDSTREET
const A = O.arcade
/** 這個檔案畫的店（OldStreet.tsx 就不畫） */
export const EAST_LOTS = ['ice', 'photo', 'cloth', 'end']
const lot = (id: string) => O.lots.find((l) => l.id === id)!

export function OldStreetEast({ outline }: { outline: boolean }) {
  const glowPhoto = useWindowGlowMat('#ffe8c0', 1)
  const glowIce = useWindowGlowMat('#ffe4ec', 0.9)
  // 窗光在淡出的外殼裡：標成 live，ShopFader 才會把顏色抄給材質複本
  glowPhoto.userData.live = true
  glowIce.userData.live = true
  const ice = lot('ice')
  const photo = lot('photo')
  const cloth = lot('cloth')
  const end = lot('end')
  return (
    <group>
      {/* 冰果室的外殼：走進店裡（os_ice），或阿嬤在戲院大廳東邊時擋到鏡頭（os_ice_front） */}
      <ShopFader id={['os_ice_front', 'os_ice']}>
        <MergeStatic>
          <Lot x0={ice.x0} x1={ice.x1} top={ice.top} style={{ ...STYLES.ice, glow: glowIce }} />
          <ArcadeColumn x={ice.x0} />
          <ShellIce />
        </MergeStatic>
        {/* 隔間牆另一面是照相館的照片牆，跟著牆一起淡出 */}
        <PhotoWall />
      </ShopFader>
      <ShopFader id="os_photo">
        <MergeStatic>
          <Lot x0={photo.x0} x1={photo.x1} top={photo.top} style={{ ...STYLES.photo, glow: glowPhoto }} />
          <ShellPhoto />
        </MergeStatic>
      </ShopFader>
      <ShopFader id="os_cloth">
        <MergeStatic>
          <Lot x0={cloth.x0} x1={cloth.x1} top={cloth.top} style={STYLES.cloth} />
          <ShellCloth />
        </MergeStatic>
      </ShopFader>
      <ShopFader id="os_end_front">
        <MergeStatic>
          <Lot x0={end.x0} x1={end.x1} top={end.top} endWall style={STYLES.end} />
        </MergeStatic>
      </ShopFader>
      <MergeStatic>
        <IceInterior />
        <PhotoInterior />
        <ClothInterior />
      </MergeStatic>
      <IceNeon />
      <IceLive outline={outline} />
      <PhotoLive outline={outline} />
      <ClothLive outline={outline} />
      <ShopLight />
    </group>
  )
}

/**
 * 三間店共用一盞點光源（光源數量不變，著色器才不用重新編譯）：
 * 阿嬤在哪間店裡就移到那間；在街上時跟著最近的一間，晚上從店面透出暖暖的光。
 */
function ShopLight() {
  const ref = useRef<THREE.PointLight>(null)
  const shops = [lot('ice'), lot('photo'), lot('cloth')]
  useFrame(() => {
    const l = ref.current
    if (!l) return
    const lan = lanternAt(useStore.getState().time)
    let best = shops[0]
    let bd = Infinity
    for (const s of shops) {
      const d = Math.abs((s.x0 + s.x1) / 2 - player.x)
      if (d < bd) {
        bd = d
        best = s
      }
    }
    const inside = player.z < A.frontZ - 0.1 && player.x > shops[0].x0 && player.x < shops[2].x1
    const tx = (best.x0 + best.x1) / 2
    l.position.x += (tx - l.position.x) * 0.12
    const target = inside ? 2.0 + lan * 1.2 : bd < 9 ? lan * 1.8 : 0
    l.intensity += (target - l.intensity) * 0.1
  })
  return <pointLight ref={ref} position={[2.3, 2.75, -7.3]} color="#ffe0b0" intensity={0} distance={7.5} decay={2} />
}
