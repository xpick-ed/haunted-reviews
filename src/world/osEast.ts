import { box, rect } from './collision'
import { OLDSTREET, isNight, pick, withStore, type ShopInterior } from './oldStreetLayout'
import type { PhotoResult, ShaveIceResult } from '../ui/minigames/types'

// 老街東邊可以走進去的店（DESIGN §30）：阿桃冰果室、光明照相館、錦繡布莊。
// 規則在這裡；畫面在 src/scene/OldStreetEast.tsx。這個檔案會被 Node 測試載入，不能 import store／audio（用 s.* 或 withStore）。

const O = OLDSTREET

export const OS_EAST: ShopInterior = {
  lots: [],
  rects: [
    // 冰果室的櫃台（凸出店面一點點）
    box(O.ice.counterX, O.ice.counterZ + 0.12, O.ice.counterW, 0.5),
  ],
  circles: [...O.ice.tables.map((x) => ({ x, z: O.ice.tableZ, r: 0.42 })), { x: O.tripod.x, z: O.tripod.z, r: 0.34 }],
  buildings: [],
  rooms: [
    { id: 'os_ice', name: '阿桃冰果室', area: rect(-0.8, -4.4, 5.4, -2.4) },
    { id: 'os_photo', name: '光明照相館', area: rect(5.4, -4.4, 11.2, -2.4) },
    { id: 'os_cloth', name: '錦繡布莊', area: rect(11.2, -4.4, 17, -2.4) },
  ],
  npcs: (phase) => [{ x: O.ice.bingmom.x, z: O.ice.bingmom.z, r: 0.3 }, ...(phase === 'dusk' ? [{ x: O.photo.photographer.x, z: O.photo.photographer.z, r: 0.3 }] : [])],
  hotspots: [
    {
      // 冰果室阿桃：第一次先聊天，之後一天幫她剉一次冰（晚上的客人都是好兄弟）
      id: 'os_bingmom',
      scene: 'oldstreet',
      x: O.ice.counterX,
      z: O.arcade.frontZ + 1.05,
      r: 1.5,
      icon: { x: O.ice.bingmom.x, z: O.ice.bingmom.z },
      iconY: 2.25,
      label: (s) => {
        if (!s.flags.bingmom_met) return '跟冰果室阿桃打招呼'
        return s.flags.os_ice_today ? '冰果室（今天幫過忙了）' : '幫阿桃剉冰'
      },
      run: (s) => {
        const play = () =>
          s.startMinigame('shaveice', {}, (r) => {
            const res = (r as ShaveIceResult | null) ?? { served: 0, merit: 0 }
            withStore((st) => {
              const x = st.getState()
              st.setState({
                flags: { ...x.flags, os_ice_today: true },
                meta: { ...x.meta, merit: x.meta.merit + res.merit },
              })
              x.bark(res.merit >= 2 ? 'bingmom.win' : res.served > 0 ? 'bingmom.ok' : 'bingmom.lose')
            })
          })
        if (!s.flags.bingmom_met) {
          s.startDialogue('bingmom_first', play)
          return
        }
        if (s.flags.os_ice_today) {
          s.bark(pick(['bingmom.done.1', 'bingmom.done.2']))
          return
        }
        s.bark(isNight(s) ? pick(['bingmom.night.1', 'bingmom.night.2']) : pick(['bingmom.hi.1', 'bingmom.hi.2']))
        window.setTimeout(play, 900)
      },
    },
    {
      // 照相館：老闆看不到阿嬤，但是老相機拍得到鬼。傍晚才開，一天拍一次
      id: 'os_photo',
      scene: 'oldstreet',
      x: O.photo.photographer.x + 0.9,
      z: O.photo.photographer.z + 0.7,
      r: 1.5,
      icon: { x: O.photo.doorX, z: O.arcade.frontZ },
      iconY: 2.4,
      label: (s) => {
        if (isNight(s)) return '照相館（關門了）'
        return s.flags.os_photo_today ? '照相館（今天拍過了）' : '到照相館拍照'
      },
      run: (s) => {
        if (isNight(s)) {
          s.bark('photographer.closed')
          return
        }
        if (s.flags.os_photo_today) {
          s.bark('photographer.again')
          return
        }
        const play = () =>
          s.startMinigame('photo', {}, (r) => {
            const res = (r as PhotoResult | null) ?? { taken: false }
            if (!res.taken) return
            withStore((st) => {
              const x = st.getState()
              st.setState({
                flags: { ...x.flags, os_photo_today: true },
                meta: { ...x.meta, merit: x.meta.merit + 1 },
              })
              x.bark(pick(['photographer.after.1', 'photographer.after.2']))
            })
          })
        if (!s.flags.photographer_met) {
          s.startDialogue('photographer_first', play)
          return
        }
        s.bark('photographer.hi.1')
        window.setTimeout(play, 900)
      },
    },
  ],
}
