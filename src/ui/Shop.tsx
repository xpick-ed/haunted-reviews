import { useStore } from '../store'

// 柑仔店（阿嬌）：用民宿的錢買麵線、薑、蚊香、蠟燭（暫時的空殼）。
export function ShopPanel() {
  const openPanel = useStore((s) => s.openPanel)
  return (
    <div className="screen-backdrop" onClick={() => openPanel(null)}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="sheet-title">柑仔店</h2>
        <button className="btn primary" onClick={() => openPanel(null)}>
          離開
        </button>
      </div>
    </div>
  )
}
