import type { MinigameProps } from './types'

// 包粽子（暫時的空殼：之後換成真的小遊戲）
export default function Minigame({ done }: MinigameProps) {
  return (
    <div className="mg-stub">
      <h2>包粽子</h2>
      <button className="btn primary" onClick={() => done(null)}>
        結束
      </button>
    </div>
  )
}
