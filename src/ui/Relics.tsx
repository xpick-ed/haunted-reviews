import { useState } from 'react'
import { useStore } from '../store'
import { RELICS, type RelicId } from '../world/night/items'
import { PORTRAIT_IDS, portraitDataUrl, type PortraitId } from '../art/portraits'
import { sfx } from '../audio/sfx'
import './Relics.css'

// 鬼夜市・紅姨的法器攤：用功德買法器（永久有效，DESIGN §25.3）。

const BUY_LINES = ['hongyi.buy.1', 'hongyi.buy.2']

export function RelicPanel() {
  const openPanel = useStore((s) => s.openPanel)
  const merit = useStore((s) => s.meta.merit)
  const owned = useStore((s) => s.meta.items)
  const [fresh, setFresh] = useState<RelicId | null>(null)
  // 紅姨三顆心：每樣法器便宜 1 功德（最少 1）
  const discount = useStore((s) => (s.flags.hongyi_discount ? 1 : 0))
  const price = (r: { merit: number }) => Math.max(1, r.merit - discount)
  const hasPortrait = (PORTRAIT_IDS as readonly string[]).includes('hongyi')

  const buy = (id: RelicId) => {
    const s = useStore.getState()
    const r = RELICS.find((x) => x.id === id)
    if (!r || s.meta.items.includes(id)) return
    if (s.meta.merit < price(r)) {
      sfx.play('ui_cancel', { volume: 0.6 })
      s.bark('hongyi.poor')
      return
    }
    useStore.setState({ meta: { ...s.meta, merit: s.meta.merit - price(r), items: [...s.meta.items, id] } })
    sfx.play('temple_bell', { volume: 0.5 })
    s.bark(BUY_LINES[Math.floor(Math.random() * BUY_LINES.length)])
    setFresh(id)
  }

  return (
    <div className="screen-backdrop" onClick={() => openPanel(null)}>
      <div className="sheet relic-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="relic-head">
          <div className="relic-face">{hasPortrait ? <img src={portraitDataUrl('hongyi' as PortraitId)} alt="" draggable={false} /> : <span>紅</span>}</div>
          <div className="relic-title">
            <div className="sheet-kicker">鬼夜市</div>
            <h2 className="sheet-title">紅姨的法器攤</h2>
          </div>
          <div className="merit-badge" title="功德">
            <span className="merit-icon">🪷</span>
            <b>{merit}</b>
            <small>功德</small>
          </div>
        </div>
        <p className="relic-hint">滿足客人的需要、拿到五星評論、在夜市玩遊戲，都會得到功德。法器買了就一直有效。</p>
        <div className="relic-grid">
          {RELICS.map((r) => {
            const has = owned.includes(r.id)
            const poor = !has && merit < price(r)
            return (
              <button key={r.id} className={`relic ${has ? 'owned' : ''} ${poor ? 'poor' : ''} ${fresh === r.id ? 'fresh' : ''}`} disabled={has} onClick={() => buy(r.id)}>
                <span className="relic-icon">{r.icon}</span>
                <span className="relic-body">
                  <b>{r.name}</b>
                  <span className="relic-desc">{r.desc}</span>
                </span>
                <span className="relic-cost">{has ? '已擁有' : `🪷 ${price(r)}`}</span>
              </button>
            )
          })}
        </div>
        <button className="btn primary" onClick={() => openPanel(null)}>
          離開
        </button>
      </div>
    </div>
  )
}
