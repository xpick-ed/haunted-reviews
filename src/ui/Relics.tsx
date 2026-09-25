import { useStore } from '../store'

// 鬼夜市・紅姨的法器攤：用功德買法器（暫時的空殼）。
export function RelicPanel() {
  const openPanel = useStore((s) => s.openPanel)
  return (
    <div className="screen-backdrop" onClick={() => openPanel(null)}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2 className="sheet-title">紅姨的法器攤</h2>
        <button className="btn primary" onClick={() => openPanel(null)}>
          離開
        </button>
      </div>
    </div>
  )
}
