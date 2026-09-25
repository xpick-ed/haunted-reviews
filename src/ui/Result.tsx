import { useStore } from '../store'

// 清晨結算：模仿 Google 評論的卡片（DESIGN §12）。
export function Result() {
  const result = useStore((s) => s.result)
  const resetNight = useStore((s) => s.resetNight)
  if (!result) return null
  return (
    <div className="result-backdrop">
      <div className="review">
        <div className="review-head">
          <div className="review-avatar">美</div>
          <div>
            <div className="review-name">小美</div>
            <div className="review-meta">在地嚮導 · 12 則評論</div>
          </div>
        </div>
        <div className="review-stars">
          {[1, 2, 3, 4, 5].map((i) => (
            <span key={i} className={`star ${i <= result.stars ? 'on' : ''} ${result.scared && i === result.stars + 1 ? 'broken' : ''}`} style={{ animationDelay: `${i * 0.18}s` }}>
              ★
            </span>
          ))}
          <span className="review-date">農曆二月</span>
        </div>
        <p className="review-text">{result.review}</p>
        <div className="review-actions">
          <span>👍 有幫助</span>
          <span>分享</span>
        </div>
        <div className="review-reply">
          <div className="review-reply-head">
            <span className="owner">小翰（店家）</span> 的回覆
          </div>
          <p>{result.reply}</p>
        </div>
        <button className="btn primary big" onClick={resetNight}>
          再來一晚
        </button>
      </div>
    </div>
  )
}
