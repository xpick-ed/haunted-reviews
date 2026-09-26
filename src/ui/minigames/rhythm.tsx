import type { MinigameProps } from './types'

// 歌仔戲鑼鼓（暫時的空殼：之後換成真的小遊戲）
export default function Minigame({ done }: MinigameProps) {
  return (
    <div className="mg-stub">
      <h2>歌仔戲鑼鼓</h2>
      <button className="btn primary" onClick={() => done(null)}>
        結束
      </button>
    </div>
  )
}
