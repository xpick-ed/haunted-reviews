import { useState } from 'react'
import { useStore } from '../store'
import { MEMORIES, MEMORY_BONUS_AT } from '../world/memories'
import './Album.css'

// 回憶相簿（DESIGN §26.2）：依年代排的阿嬤的一生。沒撿到的只看得到年份和一個問號。

const SCENE_HINT: Record<string, string> = {
  home: '家裡',
  village: '村子',
  garden: '後院',
  temple: '土地公廟',
  river: '溪邊',
  school: '國小',
  hill: '山上',
  market: '鬼夜市',
}

export function AlbumPanel() {
  const got = useStore((s) => s.meta.memories)
  const openPanel = useStore((s) => s.openPanel)
  const list = [...MEMORIES].sort((a, b) => a.year - b.year)
  const [open, setOpen] = useState<string | null>(null)
  const cur = list.find((m) => m.id === open && got.includes(m.id))
  return (
    <div className="screen-backdrop" onClick={() => openPanel(null)}>
      <div className="sheet album" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h2 className="sheet-title">阿嬤的回憶</h2>
          <span className="pts">
            {got.length} / {MEMORIES.length}
          </span>
        </div>
        <p className="muted">開陰陽眼（V）才看得到回憶碎片。撿到 {MEMORY_BONUS_AT} 片多一個技能點。</p>
        {cur ? (
          <div className="memory-open" onClick={() => setOpen(null)}>
            <div className="memory-photo">
              <span className="memory-icon">{cur.icon}</span>
              <span className="memory-year">{cur.year}</span>
            </div>
            <h3>{cur.title}</h3>
            <p className="memory-text">{cur.text}</p>
            <span className="muted">（點一下回到相簿）</span>
          </div>
        ) : (
          <div className="memory-grid">
            {list.map((m) => {
              const has = got.includes(m.id)
              return (
                <button key={m.id} className={`memory-card ${has ? 'has' : ''}`} disabled={!has} onClick={() => setOpen(m.id)}>
                  <span className="memory-icon">{has ? m.icon : '？'}</span>
                  <span className="memory-year">{m.year}</span>
                  <span className="memory-title">{has ? m.title : `（${SCENE_HINT[m.scene] ?? '某個地方'}）`}</span>
                </button>
              )
            })}
          </div>
        )}
        <button className="btn primary" onClick={() => openPanel(null)}>
          闔上相簿
        </button>
      </div>
    </div>
  )
}
