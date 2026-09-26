import { rect } from './collision'
import { OLDSTREET, isNight, type ShopInterior } from './oldStreetLayout'

// 老街西邊可以走進去的店（DESIGN §30）：新美理髮廳、和春中藥行。
// 規則在這裡；畫面在 src/scene/OldStreetWest.tsx。這個檔案會被 Node 測試載入，不能 import store／audio（用 s.* 或 withStore）。

const O = OLDSTREET

export const OS_WEST: ShopInterior = {
  lots: [],
  rects: [],
  circles: [],
  buildings: [],
  rooms: [
    {
      id: 'os_barber',
      name: '新美理髮廳',
      area: rect(-21.5, -4.4, -15.2, -2.4),
    },
    { id: 'os_herb', name: '和春中藥行', area: rect(-15.2, -4.4, -9.2, -2.4) },
  ],
  hotspots: [
    {
      id: 'os_barber',
      scene: 'oldstreet',
      x: O.barberPole.x + 0.4,
      z: O.barberPole.z + 0.9,
      r: 1.2,
      icon: { x: O.barberPole.x, z: O.barberPole.z },
      iconY: 2.5,
      label: () => '理髮廳的旋轉燈',
      run: (s) => s.bark(isNight(s) ? 'oldstreet.barber.night' : 'oldstreet.barber.1'),
    },
    {
      id: 'os_herb',
      scene: 'oldstreet',
      x: -12.2,
      z: -3.3,
      r: 1.4,
      icon: { x: -12.2, z: O.arcade.frontZ },
      iconY: 2.4,
      label: () => '中藥行',
      run: (s) => s.bark('oldstreet.herb'),
    },
  ],
}
