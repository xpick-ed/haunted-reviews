import { useEffect } from 'react'
import { useStore } from '../store'
import { DECOR_ITEMS, decorSummary, itemById, isPlaced } from '../world/decorCatalog'
import { decorActions, useDecor } from '../world/decor'
import { sfx } from '../audio/sfx'
import './DecorHud.css'

// 裝修民宿（DESIGN §27.2）的 HUD：目錄（買／擺）、擺放模式的按鈕列。
// 只在傍晚能用：天黑了就自動收起來（晚上搬家具會吵醒客人）。

export function DecorHud() {
  const open = useDecor((s) => s.open)
  const placing = useDecor((s) => s.placing)
  const phase = useStore((s) => s.phase)
  const scene = useStore((s) => s.scene)

  // 天黑、離開家：收起來（拿著的東西放回去）
  useEffect(() => {
    if ((open || placing) && (phase !== 'dusk' || scene !== 'home')) decorActions.close()
  }, [open, placing, phase, scene])

  // 擺放模式的鍵盤：R 轉、E／空白／Enter 放下、Esc 取消。先攔下來，不要讓動作鍵去觸發熱點
  useEffect(() => {
    if (!placing) return
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      const u = useDecor.getState()
      if (k === 'r') {
        decorActions.rotate()
        sfx.play('ui_select', { volume: 0.3 })
      } else if (k === 'e' || k === ' ' || k === 'enter') {
        if (u.held) decorActions.place()
      } else if (k === 'escape') {
        if (u.held) decorActions.cancelHeld()
        else decorActions.finish()
      } else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [placing])

  if (placing) return <PlaceBar />
  if (open) return <Catalog />
  return null
}

// ---------------------------------------------------------------------------
// 目錄
// ---------------------------------------------------------------------------

function Catalog() {
  const tab = useDecor((s) => s.tab)
  const money = useStore((s) => s.meta.money)
  const decor = useStore((s) => s.meta.decor)
  const summary = decorSummary(decor)
  const setTab = (t: 'buy' | 'place') => {
    sfx.play('ui_select', { volume: 0.4 })
    useDecor.setState({ tab: t })
  }
  const owned = (id: string) => decor.filter((d) => d.item === id).length
  const unplaced = (id: string) => decor.filter((d) => d.item === id && !isPlaced(d)).length
  const placedCount = decor.filter(isPlaced).length
  return (
    <div className="screen-backdrop" onClick={() => decorActions.close()}>
      <div className="sheet decor-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h2 className="sheet-title">整理民宿</h2>
          <span className="pts">💰 {money.toLocaleString()}</span>
        </div>
        <div className="decor-tabs">
          <button className={`chip ${tab === 'buy' ? 'on' : ''}`} onClick={() => setTab('buy')}>
            買家具擺飾
          </button>
          <button className={`chip ${tab === 'place' ? 'on' : ''}`} onClick={() => setTab('place')}>
            擺出來
          </button>
        </div>

        {tab === 'buy' ? (
          <div className="decor-grid">
            {DECOR_ITEMS.map((it) => {
              const n = owned(it.id)
              const short = money < it.price
              return (
                <div key={it.id} className="decor-card">
                  <div className="row between">
                    <span className="decor-icon">{it.icon}</span>
                    <span className="decor-price">${it.price.toLocaleString()}</span>
                  </div>
                  <b className="decor-name">{it.name}</b>
                  <span className="decor-desc">{it.desc}</span>
                  <div className="row between decor-foot">
                    <span className="muted">{n ? `有 ${n} 個` : ''}</span>
                    <button
                      className="btn small primary"
                      disabled={short}
                      onClick={() => {
                        if (decorActions.buy(it.id)) sfx.play('ui_confirm', { volume: 0.5 })
                      }}
                    >
                      {short ? '錢不夠' : '買'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="decor-place">
            {DECOR_ITEMS.filter((it) => unplaced(it.id) > 0).length === 0 && <p className="muted">倉庫是空的。先去「買家具擺飾」。</p>}
            <div className="decor-grid">
              {DECOR_ITEMS.filter((it) => unplaced(it.id) > 0).map((it) => (
                <button key={it.id} className="decor-card pick" onClick={() => decorActions.startPlacing(it.id)}>
                  <div className="row between">
                    <span className="decor-icon">{it.icon}</span>
                    <span className="muted">× {unplaced(it.id)}</span>
                  </div>
                  <b className="decor-name">{it.name}</b>
                  <span className="decor-desc">{kindHint(it.id)}</span>
                  <span className="decor-go">拿去擺 →</span>
                </button>
              ))}
            </div>
            {placedCount > 0 && (
              <button className="btn" onClick={() => decorActions.startPlacing(null)}>
                移動／收起擺好的東西（{placedCount} 件）
              </button>
            )}
          </div>
        )}

        <div className="decor-summary">
          <h3>現在的效果</h3>
          {summary.map((r) => (
            <div key={r.room} className="row between">
              <span>{r.room}</span>
              <span className="decor-effect">{r.text}</span>
            </div>
          ))}
          <p className="muted">客房裡的東西只影響那間房；擺在埕、神明廳、走廊的東西兩間客房都有一點效果。</p>
        </div>

        <button className="btn primary" onClick={() => decorActions.close()}>
          好了
        </button>
      </div>
    </div>
  )
}

function kindHint(id: string) {
  const it = itemById(id)
  if (!it) return ''
  if (it.kind === 'wall') return it.guestRoomOnly ? '掛在客房的牆上' : '掛在屋子裡的牆上'
  if (it.kind === 'bed') return '罩在客房的床上'
  if (it.kind === 'yard') return '只能擺在埕'
  return it.guestRoomOnly ? '擺在客房裡' : '擺在屋裡或埕上'
}

// ---------------------------------------------------------------------------
// 擺放模式的按鈕列
// ---------------------------------------------------------------------------

function PlaceBar() {
  const held = useDecor((s) => s.held)
  const heldFrom = useDecor((s) => s.heldFrom)
  const p = useDecor((s) => s.preview)
  const it = held ? itemById(held) : null
  const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
  return (
    <div className="decor-bar">
      <div className="decor-bar-info">
        {it ? (
          <>
            <b>
              {it.icon} {it.name}
            </b>
            <span className={p?.ok ? 'ok' : 'bad'}>{p ? (p.ok ? (p.room ? `可以擺（${p.room === 'r1' ? '客房一' : '客房二'}）` : '可以擺（公共空間）') : p.why) : '指地板選位置'}</span>
          </>
        ) : (
          <>
            <b>整理模式</b>
            <span>點擺好的東西（腳下有青色圈）把它拿起來</span>
          </>
        )}
        <span className="decor-keys">{touch ? '點地板選位置，再點一次或按「放下」' : '滑鼠指地板、點一下擺；R 轉向；Esc 取消'}</span>
      </div>
      <div className="decor-bar-btns">
        {it && it.kind !== 'wall' && it.kind !== 'bed' && (
          <button className="btn" onClick={() => decorActions.rotate()}>
            ↻ 轉
          </button>
        )}
        {it && (
          <button className="btn primary" disabled={!p?.ok} onClick={() => decorActions.place()}>
            放下
          </button>
        )}
        {it && heldFrom && (
          <button className="btn" onClick={() => decorActions.store()}>
            收進倉庫
          </button>
        )}
        {it && (
          <button className="btn" onClick={() => decorActions.cancelHeld()}>
            {heldFrom ? '放回原位' : '先不擺'}
          </button>
        )}
        <button className="btn" onClick={() => decorActions.finish()}>
          完成
        </button>
      </div>
    </div>
  )
}
