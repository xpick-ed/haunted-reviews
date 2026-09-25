import { useState } from 'react'
import { useStore } from '../store'
import { INGREDIENTS, SHOP_GOODS, type Ingredient } from '../world/night/items'
import { PORTRAIT_IDS, portraitDataUrl, type PortraitId } from '../art/portraits'
import { line } from '../world/lines'
import { sfx } from '../audio/sfx'
import './Shop.css'

// 柑仔店（阿嬌）：用民宿的錢買麵線、薑、蚊香、蠟燭（DESIGN §25.3）。
// 錢是小翰的：阿嬌記在他的帳上，月底一起算（就是 meta.money 直接扣）。

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

/** 柑仔店不賣的（後院自己種、自己養的），列在下面讓玩家知道家裡還有多少 */
const HOMEGROWN: Ingredient[] = ['egg', 'leaf', 'sweetpotato', 'radish']

export function ShopPanel() {
  const openPanel = useStore((s) => s.openPanel)
  const money = useStore((s) => s.meta.money)
  const pantry = useStore((s) => s.meta.pantry)
  const night = useStore((s) => s.phase === 'night')
  const bark = useStore((s) => s.bark)
  // 阿嬌的一句話：開店時的招呼，買東西後換成「拿去拿去」
  const [say, setSay] = useState(() => (night ? 'ajiao.night.1' : pick(['ajiao.hi.1', 'ajiao.hi.2'])))
  const [spoke, setSpoke] = useState(false)
  const [bought, setBought] = useState<Ingredient | null>(null)
  const face = (PORTRAIT_IDS as readonly string[]).includes('ajiao') ? portraitDataUrl('ajiao' as PortraitId, bought ? 'happy' : 'normal') : null

  const buy = (id: Ingredient, price: number) => {
    const s = useStore.getState()
    if (s.meta.money < price) {
      sfx.play('ui_cancel', { volume: 0.5 })
      setSay('ajiao.broke')
      if (!spoke) bark('ajiao.broke')
      setSpoke(true)
      return
    }
    useStore.setState({ meta: { ...s.meta, money: s.meta.money - price, pantry: { ...s.meta.pantry, [id]: (s.meta.pantry[id] ?? 0) + 1 } } })
    sfx.play('pickup', { volume: 0.6 })
    setBought(id)
    window.setTimeout(() => setBought((b) => (b === id ? null : b)), 500)
    const l = pick(['ajiao.buy.1', 'ajiao.buy.2', 'ajiao.buy.3'])
    setSay(l)
    // 連續買只講第一次，不然一直「拿去拿去」
    if (!spoke) bark(l)
    setSpoke(true)
  }

  return (
    <div className="screen-backdrop" onClick={() => openPanel(null)}>
      <div className="sheet shop" onClick={(e) => e.stopPropagation()}>
        <div className="shop-sign">
          <span>嬌美商店</span>
          <small>菸酒・雜貨・冷飲</small>
        </div>
        <div className="shop-talk">
          <div className="shop-face">{face ? <img src={face} alt="" draggable={false} /> : <span>嬌</span>}</div>
          <div className="shop-bubble" key={say}>
            <b>阿嬌</b>
            {line(say).text}
          </div>
        </div>

        <div className="shop-goods">
          {SHOP_GOODS.map((g) => {
            const info = INGREDIENTS[g.id]
            const short = money < g.price
            return (
              <button key={g.id} className={`shop-item ${bought === g.id ? 'pop' : ''}`} disabled={short} onClick={() => buy(g.id, g.price)}>
                <span className="shop-icon">{info.icon}</span>
                <span className="shop-name">{info.name}</span>
                <span className="shop-desc">{info.desc}</span>
                <span className="shop-price">${g.price}</span>
                <span className="shop-have">家裡 {pantry[g.id] ?? 0}</span>
              </button>
            )
          })}
        </div>

        <div className="shop-pantry">
          <span className="muted">後院的：</span>
          {HOMEGROWN.map((id) => (
            <span key={id} className="shop-chip" title={INGREDIENTS[id].desc}>
              {INGREDIENTS[id].icon} {INGREDIENTS[id].name} {pantry[id] ?? 0}
            </span>
          ))}
        </div>

        <div className="shop-foot">
          <span className="shop-money">💰 {money.toLocaleString()}</span>
          <span className="muted">記在小翰的帳上</span>
          <button className="btn primary" onClick={() => openPanel(null)}>
            多謝
          </button>
        </div>
      </div>
    </div>
  )
}
