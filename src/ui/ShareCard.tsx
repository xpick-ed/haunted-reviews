import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store'
import { requestSnapshot } from '../scene/Snapshot'
import { SHARE_URL, canvasToBlob, drawShareCard, type ShareData } from './shareCanvas'
import './ShareCard.css'

// 天亮結算的「今日好評」分享卡（DESIGN §31.4）：畫成一張圖，存下來或傳 LINE。
// 按鈕 → 截遊戲畫面、畫卡片 → 預覽 → 手機用系統分享（LINE、IG……），電腦下載圖片；也可以只複製網址。

type Stage = 'idle' | 'making' | 'ready' | 'error'

/** 從結算畫面的資料組出卡片要的東西（截圖另外抓） */
function shareDataNow(snapshot: HTMLCanvasElement | null): ShareData | null {
  const s = useStore.getState()
  const sum = s.summary
  if (!sum) return null
  return {
    night: s.meta.night,
    reviews: sum.reviews.map((r) => ({ id: r.id, name: r.name, stars: r.stars, text: r.text })),
    income: sum.income,
    warmDelta: sum.warmDelta,
    spookyDelta: sum.spookyDelta,
    heartDelta: sum.heartDelta,
    merit: sum.merit,
    snapshot,
  }
}

/** 做一張卡（測試、截圖也用這個）。snap 沒給就現在截一張 */
export async function makeShareCard(snap?: Promise<HTMLCanvasElement | null>): Promise<{ blob: Blob; url: string; night: number } | null> {
  let shot = snap ? await snap : null
  // 先前那張沒截到（手機太忙、分頁在背景）：再試一次
  if (!shot) shot = await requestSnapshot()
  const d = shareDataNow(shot)
  if (!d) return null
  const canvas = await drawShareCard(d)
  const blob = await canvasToBlob(canvas)
  if (!blob) return null
  return { blob, url: URL.createObjectURL(blob), night: d.night }
}

export function ShareButton() {
  const [open, setOpen] = useState(false)
  // 結算畫面一出來就先截一張天亮的畫面（背景做，不擋畫面）；按分享的時候直接用
  const snap = useRef<Promise<HTMLCanvasElement | null> | null>(null)
  useEffect(() => {
    snap.current = requestSnapshot(8000)
  }, [])
  return (
    <>
      <button className="btn share-btn" onClick={() => setOpen(true)}>
        分享今日好評 📷
      </button>
      {open && createPortal(<SharePreview snap={snap.current} onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}

function SharePreview({ snap, onClose }: { snap: Promise<HTMLCanvasElement | null> | null; onClose: () => void }) {
  const [stage, setStage] = useState<Stage>('making')
  const [card, setCard] = useState<{ blob: Blob; url: string; night: number } | null>(null)
  const [note, setNote] = useState('')
  useEffect(() => {
    let alive = true
    let made: string | null = null
    makeShareCard(snap ?? undefined)
      .then((c) => {
        if (!alive) {
          if (c) URL.revokeObjectURL(c.url)
          return
        }
        if (!c) {
          setStage('error')
          return
        }
        made = c.url
        setCard(c)
        setStage('ready')
      })
      .catch(() => alive && setStage('error'))
    return () => {
      alive = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [snap])
  // Esc 關掉
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const fileName = card ? `靈異好評-第${card.night}晚.png` : '靈異好評.png'
  const file = card ? new File([card.blob], fileName, { type: 'image/png' }) : null
  const canShareFile = !!file && typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [file] })

  const share = async () => {
    if (!file) return
    try {
      await navigator.share({ files: [file], title: '靈異好評', text: `阿嬤今晚的好評～一起來當阿嬤：${SHARE_URL}` })
    } catch (e) {
      // 使用者按取消不用說什麼
      if ((e as DOMException)?.name !== 'AbortError') setNote('分享不成功，改用「下載圖片」吧')
    }
  }
  const download = () => {
    if (!card) return
    const a = document.createElement('a')
    a.href = card.url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    setNote('圖片存好了')
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL)
      setNote('網址複製好了，貼給朋友吧')
    } catch {
      window.prompt('複製這個網址：', SHARE_URL)
    }
  }

  return (
    // 鍵盤留給預覽的按鈕（Enter／空白鍵），不要傳到遊戲的動作鍵
    <div className="share-backdrop" onClick={onClose} onKeyDown={(e) => e.stopPropagation()}>
      <div className="share-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="share-close" onClick={onClose} aria-label="關閉">
          ✕
        </button>
        <div className="share-img-wrap">
          {stage === 'ready' && card && <img className="share-img" src={card.url} alt="今日好評分享卡" />}
          {stage === 'making' && <div className="share-wait">阿嬤正在洗照片……</div>}
          {stage === 'error' && <div className="share-wait">照片洗壞了……再試一次看看</div>}
        </div>
        <div className="share-actions">
          {canShareFile && (
            <button className="btn primary" disabled={stage !== 'ready'} onClick={share}>
              傳給朋友
            </button>
          )}
          <button className={`btn ${canShareFile ? '' : 'primary'}`} disabled={stage !== 'ready'} onClick={download}>
            下載圖片
          </button>
          <button className="btn" onClick={copy}>
            複製連結
          </button>
        </div>
        <div className="share-note">{note || (canShareFile ? '可以直接傳到 LINE、IG' : '長按或下載圖片，再傳給朋友')}</div>
      </div>
    </div>
  )
}
