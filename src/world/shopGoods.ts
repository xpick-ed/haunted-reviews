import type { Hotspot } from './hotspots'
import { OSW } from './osWest'
import { buyGood } from './goodsGive'

// 店裡的東西晚上用得到（DESIGN §31.1）：傍晚在店裡拿到，半夜從灶腳的菜櫥拿出來、放到客人床頭。
//   安神茶　和春中藥行：抓藥抓得好多包一份；或在櫃台放錢拿一包（一天一次）
//   花露水　新美理髮廳：鏡台放錢拿一瓶（一天一次）；晚上幫阿水師遞毛巾溫度剛好也會給
//   彈珠汽水　阿桃冰果室的冰箱（一天兩瓶）　厚棉被　錦繡布莊的裁縫車（傍晚自己縫、晚上幫錦繡姨）
//   老照片　光明照相館拍完照　辦桌菜尾　村子阿財伯家看完八點檔
// 各間店本來的熱點在 osWest.ts、osEast.ts、sceneVillage.ts；這裡是另外加的「放錢拿一個」。
// 這個檔案不能在最上面 import store（用 s.* 或 import('../store')）。

const H = OSW.herb
const B = OSW.barber

/** 價錢（民宿的錢） */
export const GOOD_PRICE = { herbtea: 80, floral: 40 }

export const SHOP_GOODS_HOTSPOTS: Hotspot[] = [
  {
    // 和春伯看不到阿嬤：錢壓在櫃台的算盤下面，自己拿一包安神茶
    id: 'goods_herbtea',
    scene: 'oldstreet',
    x: H.counter.x1 - 0.3,
    z: H.counter.z1 + 0.55,
    r: 0.75,
    icon: { x: H.counter.x1 - 0.35, z: (H.counter.z0 + H.counter.z1) / 2 },
    iconY: 1.6,
    label: (s) => {
      if (s.phase !== 'dusk') return null
      return s.flags.goods_herbtea_today ? '安神茶（今天拿過了）' : `拿一包安神茶（櫃台放 $${GOOD_PRICE.herbtea}）`
    },
    run: (s) => {
      if (s.flags.goods_herbtea_today) {
        s.bark('goods.herbtea.done')
        return
      }
      buyGood('herbtea', GOOD_PRICE.herbtea, 'goods_herbtea_today', 'goods.herbtea.buy')
    },
  },
  {
    // 理髮廳的鏡台：一排花露水，錢放在梳子罐旁邊
    id: 'goods_floral',
    scene: 'oldstreet',
    x: B.sink.x - 0.9,
    z: B.vanity.z1 + 0.5,
    r: 0.7,
    icon: { x: B.sink.x - 0.9, z: B.vanity.z0 + 0.2 },
    iconY: 1.5,
    label: (s) => {
      if (s.phase !== 'dusk') return null
      return s.flags.goods_floral_today ? '花露水（今天拿過了）' : `拿一瓶花露水（鏡台放 $${GOOD_PRICE.floral}）`
    },
    run: (s) => {
      if (s.flags.goods_floral_today) {
        s.bark('goods.floral.done')
        return
      }
      buyGood('floral', GOOD_PRICE.floral, 'goods_floral_today', 'goods.floral.buy')
    },
  },
]
