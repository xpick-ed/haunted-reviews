// 輸入：鍵盤、觸控搖桿、手把，全部匯成同一組狀態。
// 移動方向是「畫面座標」：x 往右、y 往上（離鏡頭遠的方向），由 player.ts 轉成世界方向。

type Listener = () => void

class Input {
  /** 觸控搖桿（Joystick.tsx 寫入），長度 0..1 */
  joy = { x: 0, y: 0 }
  private keys = new Set<string>()
  private actionListeners = new Set<Listener>()
  private padAction = false
  private attached = false

  attach() {
    if (this.attached) return
    this.attached = true
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return
      const k = e.key.toLowerCase()
      this.keys.add(k)
      if (k === 'e' || k === ' ' || k === 'enter') {
        e.preventDefault()
        this.fireAction()
      }
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()))
    window.addEventListener('blur', () => this.keys.clear())
  }

  /** 動作鍵（E／空白／Enter／手把 A／畫面上的動作按鈕） */
  onAction(fn: Listener) {
    this.actionListeners.add(fn)
    return () => {
      this.actionListeners.delete(fn)
    }
  }

  fireAction() {
    for (const fn of this.actionListeners) fn()
  }

  /** 每幀呼叫：回傳畫面座標的移動向量（長度 ≤ 1）與是否衝刺 */
  read(): { x: number; y: number; dash: boolean } {
    let x = 0
    let y = 0
    const k = this.keys
    if (k.has('a') || k.has('arrowleft')) x -= 1
    if (k.has('d') || k.has('arrowright')) x += 1
    if (k.has('w') || k.has('arrowup')) y += 1
    if (k.has('s') || k.has('arrowdown')) y -= 1
    let dash = k.has('shift')

    x += this.joy.x
    y += this.joy.y
    // 搖桿推到底也算衝刺
    if (Math.hypot(this.joy.x, this.joy.y) > 0.95) dash = true

    const pads = navigator.getGamepads?.() ?? []
    for (const p of pads) {
      if (!p) continue
      const ax = p.axes[0] ?? 0
      const ay = p.axes[1] ?? 0
      if (Math.hypot(ax, ay) > 0.18) {
        x += ax
        y -= ay
      }
      if (p.buttons[7]?.pressed || p.buttons[1]?.pressed) dash = true
      const a = !!p.buttons[0]?.pressed
      if (a && !this.padAction) this.fireAction()
      this.padAction = a
    }

    const len = Math.hypot(x, y)
    if (len > 1) {
      x /= len
      y /= len
    }
    return { x, y, dash }
  }

  get usingKeyboard() {
    return this.keys.size > 0
  }
}

export const input = new Input()
