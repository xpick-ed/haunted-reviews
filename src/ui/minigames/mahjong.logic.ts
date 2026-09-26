// 簡化版麻將的規則（DESIGN §29）：只有萬、筒、條（1–9 各 4 張，共 108 張），沒有字牌、花牌、吃碰槓。
// 手上 13 張，每巡摸一張打一張；4 組（順子或刻子）＋1 對就胡。純函式，畫面在 mahjong.tsx。

/** 0..26：花色 × 9 ＋（數字 − 1）；花色 0 萬、1 筒、2 條 */
export type Tile = number

export const SUIT_NAMES = ['萬', '筒', '條'] as const
export const NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'] as const

export const suitOf = (t: Tile) => Math.floor(t / 9)
export const rankOf = (t: Tile) => (t % 9) + 1
export const tileName = (t: Tile) => NUMERALS[t % 9] + SUIT_NAMES[suitOf(t)]

export function countsOf(tiles: Tile[]): number[] {
  const c = new Array<number>(27).fill(0)
  for (const t of tiles) c[t]++
  return c
}

export const sortTiles = (tiles: Tile[]) => [...tiles].sort((a, b) => a - b)

/** 剩下的牌能不能全部拆成順子／刻子（會暫時改 c，回來時還原） */
function allMelds(c: number[]): boolean {
  const i = c.findIndex((x) => x > 0)
  if (i < 0) return true
  if (c[i] >= 3) {
    c[i] -= 3
    const ok = allMelds(c)
    c[i] += 3
    if (ok) return true
  }
  if (i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
    c[i]--
    c[i + 1]--
    c[i + 2]--
    const ok = allMelds(c)
    c[i]++
    c[i + 1]++
    c[i + 2]++
    if (ok) return true
  }
  return false
}

/** 胡了沒：3n+2 張拆成一對＋n 組 */
export function isWinCounts(c: number[]): boolean {
  const n = c.reduce((a, b) => a + b, 0)
  if (n % 3 !== 2) return false
  for (let p = 0; p < 27; p++) {
    if (c[p] < 2) continue
    c[p] -= 2
    const ok = allMelds(c)
    c[p] += 2
    if (ok) return true
  }
  return false
}

export const isWin = (tiles: Tile[]) => isWinCounts(countsOf(tiles))

/** 13 張在等哪幾張（聽牌）；手上已經 4 張的不算 */
export function waitsOf(hand13: Tile[]): Tile[] {
  const c = countsOf(hand13)
  const out: Tile[] = []
  for (let t = 0; t < 27; t++) {
    if (c[t] >= 4) continue
    c[t]++
    if (isWinCounts(c)) out.push(t)
    c[t]--
  }
  return out
}

/** 14 張裡打哪幾種牌會聽牌（聽牌提示） */
export function tenpaiDiscards(hand14: Tile[]): Tile[] {
  const out: Tile[] = []
  for (const t of new Set(hand14)) {
    const i = hand14.indexOf(t)
    const rest = [...hand14.slice(0, i), ...hand14.slice(i + 1)]
    if (waitsOf(rest).length) out.push(t)
  }
  return out
}

/** 孤張：沒有對子、前後兩格內也沒有同花色的牌（聽不了牌時的提示：可以先打） */
export function isolatedTiles(hand: Tile[]): Tile[] {
  const c = countsOf(hand)
  return [...new Set(hand)].filter((t) => {
    if (c[t] >= 2) return false
    const s = suitOf(t)
    for (let d = -2; d <= 2; d++) {
      const u = t + d
      if (d === 0 || u < 0 || u >= 27 || suitOf(u) !== s) continue
      if (c[u] > 0) return false
    }
    return true
  })
}

/**
 * 摸牌（偷偷幫一點忙）：有 assist 的機率從牌牆裡找一張「有用的」——聽牌了就找會胡的，
 * 還沒聽就找摸了能聽牌的。找不到就照順序摸。會改 wall。
 */
export function drawTile(hand13: Tile[], wall: Tile[], assist: number, rnd: () => number = Math.random): Tile {
  if (rnd() < assist) {
    const ready = waitsOf(hand13).length > 0
    for (let i = wall.length - 1; i >= 0; i--) {
      const h = [...hand13, wall[i]]
      if (ready ? isWin(h) : tenpaiDiscards(h).length > 0) return wall.splice(i, 1)[0]
    }
  }
  return wall.pop()!
}

export function shuffle<T>(xs: T[], rnd: () => number): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 發牌：先湊一副胡牌（4 組＋1 對），拿掉兩張、補一張隨便的——大多是「差一張聽牌」，
 * 十巡之內有機會胡，但不是送的。剩下的牌洗成牌牆。
 */
export function deal(rnd: () => number = Math.random): {
  hand: Tile[]
  wall: Tile[]
} {
  const pool = new Array<number>(27).fill(4)
  const take = (t: Tile, n = 1) => {
    pool[t] -= n
  }
  const win: Tile[] = []
  let guard = 0
  while (win.length < 12 && guard++ < 200) {
    const t = Math.floor(rnd() * 27)
    if (rnd() < 0.62 && t % 9 <= 6 && pool[t] > 0 && pool[t + 1] > 0 && pool[t + 2] > 0) {
      win.push(t, t + 1, t + 2)
      take(t)
      take(t + 1)
      take(t + 2)
    } else if (pool[t] >= 3) {
      win.push(t, t, t)
      take(t, 3)
    }
  }
  for (;;) {
    const p = Math.floor(rnd() * 27)
    if (pool[p] >= 2) {
      win.push(p, p)
      take(p, 2)
      break
    }
  }
  // 拿掉兩張（放回牌堆），補一張
  let hand = shuffle(win, rnd)
  const removed = hand.slice(0, 2)
  hand = hand.slice(2)
  for (const t of removed) pool[t]++
  for (;;) {
    const t = Math.floor(rnd() * 27)
    if (pool[t] > 0 && !removed.includes(t)) {
      hand.push(t)
      pool[t]--
      break
    }
  }
  const wall: Tile[] = []
  pool.forEach((n, t) => {
    for (let k = 0; k < n; k++) wall.push(t)
  })
  return { hand: sortTiles(hand), wall: shuffle(wall, rnd) }
}

/** 幾巡胡的 → 功德（越快越多） */
export const meritForTurn = (turn: number) => (turn <= 4 ? 3 : turn <= 7 ? 2 : 1)

export const MAX_TURNS = 10
