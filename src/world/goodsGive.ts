import { GOOD_MAX, INGREDIENTS, type GoodId } from './night/items'

// 拿到店裡的好東西（DESIGN §31.1）：各間店的熱點（osWest.ts、osEast.ts、sceneVillage.ts、shopGoods.ts）共用。
// 這個檔案不能在最上面 import store（Node 測試會載入），改狀態時才動態載入。

function withStore(fn: (st: typeof import('../store').useStore) => void) {
  void import('../store').then(({ useStore }) => fn(useStore))
}

/** 家裡的菜櫥多了 n 個；字幕提示半夜去哪裡拿 */
export function giveGood(id: GoodId, n = 1, line?: string) {
  withStore((st) => {
    const x = st.getState()
    const have = x.meta.pantry[id] ?? 0
    const g = INGREDIENTS[id]
    if (have >= GOOD_MAX) {
      x.say(`菜櫥裡的${g.name}已經有 ${GOOD_MAX} 個了，放不下了。`)
      return
    }
    n = Math.min(n, GOOD_MAX - have)
    const pantry = { ...x.meta.pantry, [id]: have + n }
    st.setState({ meta: { ...x.meta, pantry } })
    if (line) x.bark(line)
    window.setTimeout(() => st.getState().say(`拿到 ${g.icon} ${g.name}${n > 1 ? ` ×${n}` : ''}：放在灶腳的菜櫥，半夜拿去客人床頭`), line ? 2600 : 0)
  })
}

/** 用民宿的錢買一個（錢不夠就說一句）；flag：一天一次的旗標 */
export function buyGood(id: GoodId, price: number, flag: string, line?: string) {
  withStore((st) => {
    const x = st.getState()
    if (x.meta.money < price) {
      x.bark('goods.nomoney')
      return
    }
    if ((x.meta.pantry[id] ?? 0) >= GOOD_MAX) {
      x.say(`菜櫥裡的${INGREDIENTS[id].name}已經有 ${GOOD_MAX} 個了，先用掉再買。`)
      return
    }
    st.setState({ meta: { ...x.meta, money: x.meta.money - price }, flags: { ...x.flags, [flag]: true } })
    giveGood(id, 1, line)
  })
}
