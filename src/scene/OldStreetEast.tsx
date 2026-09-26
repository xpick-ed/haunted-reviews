import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { player } from '../world/player'
import { OLDSTREET } from '../world/sceneOldStreet'
import { lanternAt } from './daylight'
import { MergeStatic } from './MergeStatic'
import { InteriorCull } from './OldStreetFader'
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
        <ClothInterior />
      </MergeStatic>
      {/* 照相館關著門：低畫質時阿嬤不在附近就不畫裡面（冰果室、布莊的店面整片打開，從街上看得到，一直畫） */}
      <InteriorCull ids={['os_photo']} doors={[{ x: O.photo.doorX, z: A.frontZ }]}>
        <MergeStatic>
          <PhotoInterior />
        </MergeStatic>
        <PhotoLive outline={outline} />
      </InteriorCull>
      <IceNeon />
      <IceLive outline={outline} />
      <ClothLive outline={outline} />
      <ShopLight />
    </group>
  )
}

/**
 * 老街五間店共用一盞點光源（DESIGN §30；光源多一盞，每個像素都要多算一次，手機很吃力）：
 * 阿嬤在哪間店裡就移到那間；在街上時跟著最近的一間，晚上從店面透出暖暖的光。
 * 西邊兩間（理髮廳、中藥行）本來各有一盞整晚亮著的燈，併到這裡。
 */
const SHOP_LIGHTS = [
  { x0: -21.5, x1: -15.2, pos: [-18.3, 2.6, -5.9], color: '#ffdcae' },
  { x0: -15.2, x1: -9.2, pos: [-12.0, 2.5, -6.1], color: '#ffd49a' },
  ...(['ice', 'photo', 'cloth'] as const).map((id) => {
    const l = lot(id)
    return { x0: l.x0, x1: l.x1, pos: [(l.x0 + l.x1) / 2, 2.75, -7.3], color: '#ffe0b0' }
  }),
]
function ShopLight() {
  const ref = useRef<THREE.PointLight>(null)
  const want = useRef(new THREE.Color())
  useFrame((_, dt) => {
    const l = ref.current
    if (!l) return
    const lan = lanternAt(useStore.getState().time)
    let best = SHOP_LIGHTS[0]
    let bd = Infinity
    for (const s of SHOP_LIGHTS) {
      const d = Math.abs((s.x0 + s.x1) / 2 - player.x)
      if (d < bd) {
        bd = d
        best = s
      }
    }
    const inside = player.z < A.frontZ - 0.1 && player.x > best.x0 && player.x < best.x1
    // 換店的時候先暗下來、移過去再亮（不要看到光在牆後面滑過去）
    const far = Math.hypot(best.pos[0] - l.position.x, best.pos[2] - l.position.z) > 0.3
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 8)
    const target = far ? 0 : inside ? 2.0 + lan * 1.4 : bd < 9 ? lan * 1.8 : 0
    l.intensity += (target - l.intensity) * k
    if (far && l.intensity < 0.08) l.position.set(best.pos[0], best.pos[1], best.pos[2])
    l.color.lerp(want.current.set(best.color), k)
  })
  return <pointLight ref={ref} position={[2.3, 2.75, -7.3]} color="#ffe0b0" intensity={0} distance={8} decay={1.8} />
}
