// 輸入：鍵盤、觸控搖桿、手把，全部匯成同一組狀態。
// 移動方向是「畫面座標」：x 往右、y 往上（離鏡頭遠的方向），由 player.ts 轉成世界方向。

type Listener = () => void
type Dir = 'left' | 'right' | 'up' | 'down'

/** 兩次按下的間隔在這之內算「連點」 */
const DOUBLE_TAP_MS = 300
const DIR_KEYS: Record<Dir, string[]> = { left: ['a', 'arrowleft'], right: ['d', 'arrowright'], up: ['w', 'arrowup'], down: ['s', 'arrowdown'] }
const DIR_OF: Record<string, Dir> = Object.fromEntries(Object.entries(DIR_KEYS).flatMap(([d, ks]) => ks.map((k) => [k, d as Dir])))

class Input {
  /** 觸控搖桿（Joystick.tsx 寫入），長度 0..1 */
  joy = { x: 0, y: 0 }
  private keys = new Set<string>()
  private actionListeners = new Set<Listener>()
  private padAction = false
  private attached = false
  /** 動作鍵正被按住（長按動作用：鍵盤 E／空白、畫面上的動作鈕、手把 A） */
  private heldKeys = new Set<string>()
  private heldTouch = false
  /** 連點方向鍵兩次＝往那個方向跑（按住第二下的期間） */
  private lastTap: { dir: Dir; t: number } | null = null
  private runDir: Dir | null = null

  attach() {
    if (this.attached) return
    this.attached = true
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return
      const k = e.key.toLowerCase()
      this.keys.add(k)
      const dir = DIR_OF[k]
      if (dir) {
        // 用事件本身的時間（按下的那一刻），畫面卡的時候也判得準
        const now = e.timeStamp
        if (this.lastTap && this.lastTap.dir === dir && now - this.lastTap.t < DOUBLE_TAP_MS) this.runDir = dir
        this.lastTap = { dir, t: now }
      }
      if (k === 'e' || k === ' ' || k === 'enter') {
        e.preventDefault()
        this.heldKeys.add(k)
        this.fireAction()
      }
    })
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase()
      this.keys.delete(k)
      this.heldKeys.delete(k)
      // 放開跑步的方向就停下來（同方向的另一個鍵還按著的話繼續跑）
      if (this.runDir && !this.dirHeld(this.runDir)) this.runDir = null
    })
    window.addEventListener('blur', () => {
      this.runDir = null
      this.keys.clear()
      this.heldKeys.clear()
      this.heldTouch = false
    })
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

  /** 畫面上的動作鈕按下／放開（按下同時觸發一次動作） */
  pressAction() {
    this.heldTouch = true
    this.fireAction()
  }
  releaseAction() {
    this.heldTouch = false
  }

  private dirHeld(d: Dir) {
    return DIR_KEYS[d].some((key) => this.keys.has(key))
  }

  /** 動作鍵是不是正被按住 */
  get actionHeld() {
    return this.heldKeys.size > 0 || this.heldTouch || this.padAction
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
    let dash = k.has('shift') || (this.runDir !== null && this.dirHeld(this.runDir))

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

// 開發時掛到 window，自動化測試可以直接看輸入狀態
if (import.meta.env.DEV) (window as unknown as { __input: Input }).__input = input
