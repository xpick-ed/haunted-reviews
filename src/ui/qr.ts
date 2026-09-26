// 最小的 QR Code 產生器（分享卡角落那一格；DESIGN §31.4）。
// 只做需要的：位元組模式、錯誤更正 L、版本 1–5（都只有一個區塊，不用交錯），網址長度 ≤ 106 bytes。
// 照 ISO/IEC 18004 與 Nayuki 的 QR Code generator 寫法。純函式，Node 也能跑。

/** 版本 1–5、錯誤更正 L：總碼字數、錯誤更正碼字數 */
const TOTAL = [0, 26, 44, 70, 100, 134]
const EC_L = [0, 7, 10, 15, 20, 26]

/** GF(256) 乘法（本原多項式 0x11d） */
function mul(x: number, y: number) {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z & 0xff
}

function rsDivisor(degree: number) {
  const out = new Array<number>(degree).fill(0)
  out[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      out[j] = mul(out[j], root)
      if (j + 1 < degree) out[j] ^= out[j + 1]
    }
    root = mul(root, 0x02)
  }
  return out
}

function rsRemainder(data: number[], divisor: number[]) {
  const out = divisor.map(() => 0)
  for (const b of data) {
    const factor = b ^ (out.shift() as number)
    out.push(0)
    divisor.forEach((c, i) => (out[i] ^= mul(c, factor)))
  }
  return out
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
]

/**
 * 產生 QR Code 的模組矩陣（[列][行]，true＝黑）。文字太長回傳 null。
 * mask 不給就自動挑扣分最少的。
 */
export function qrMatrix(text: string, forceMask?: number): boolean[][] | null {
  const bytes = [...new TextEncoder().encode(text)]
  let ver = 0
  for (let v = 1; v <= 5; v++) {
    if (4 + 8 + bytes.length * 8 <= (TOTAL[v] - EC_L[v]) * 8) {
      ver = v
      break
    }
  }
  if (!ver) return null
  const dataCw = TOTAL[ver] - EC_L[ver]

  // 資料位元：模式 0100、長度 8 位元、內容、結尾、補齊
  const bits: number[] = []
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1)
  }
  push(0b0100, 4)
  push(bytes.length, 8)
  for (const b of bytes) push(b, 8)
  const cap = dataCw * 8
  push(0, Math.min(4, cap - bits.length))
  push(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) push(pad, 8)
  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0))
  const codewords = [...data, ...rsRemainder(data, rsDivisor(EC_L[ver]))]

  const size = ver * 4 + 17
  const mods = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const fn = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const set = (x: number, y: number, dark: boolean) => {
    mods[y][x] = dark
    fn[y][x] = true
  }

  // 計時線
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0)
    set(i, 6, i % 2 === 0)
  }
  // 三個定位方塊（含白邊）
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ]) {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx
        const y = cy + dy
        if (x < 0 || y < 0 || x >= size || y >= size) continue
        const d = Math.max(Math.abs(dx), Math.abs(dy))
        set(x, y, d !== 2 && d !== 4)
      }
  }
  // 對齊方塊（版本 2–5 只有右下角一個）
  if (ver >= 2) {
    const c = size - 7
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(c + dx, c + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
  }

  const drawFormat = (mask: number) => {
    const d = (1 << 3) | mask // 錯誤更正 L 的格式碼是 01
    let rem = d
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const b = ((d << 10) | rem) ^ 0x5412
    const bit = (i: number) => ((b >>> i) & 1) === 1
    for (let i = 0; i <= 5; i++) set(8, i, bit(i))
    set(8, 7, bit(6))
    set(8, 8, bit(7))
    set(7, 8, bit(8))
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i))
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i))
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i))
    set(8, size - 8, true) // 固定的黑點
  }
  drawFormat(0) // 先佔位

  // 資料：從右下角開始，兩行一組蛇行（跳過第 6 行的計時線）
  let k = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let v = 0; v < size; v++)
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const up = ((right + 1) & 2) === 0
        const y = up ? size - 1 - v : v
        if (fn[y][x] || k >= codewords.length * 8) continue
        mods[y][x] = ((codewords[k >>> 3] >>> (7 - (k & 7))) & 1) === 1
        k++
      }
  }

  const applyMask = (m: number) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[m](x, y)) mods[y][x] = !mods[y][x]
  }

  let best = forceMask ?? 0
  if (forceMask === undefined) {
    let bestScore = Infinity
    for (let m = 0; m < 8; m++) {
      applyMask(m)
      drawFormat(m)
      const sc = penalty(mods)
      if (sc < bestScore) {
        bestScore = sc
        best = m
      }
      applyMask(m) // 還原（XOR 兩次）
    }
  }
  applyMask(best)
  drawFormat(best)
  return mods
}

/** 簡化的扣分（連續同色、2×2 方塊、黑白比例），只用來挑遮罩 */
function penalty(m: boolean[][]) {
  const n = m.length
  let s = 0
  for (let y = 0; y < n; y++) {
    let runX = 1
    let runY = 1
    for (let x = 1; x < n; x++) {
      if (m[y][x] === m[y][x - 1]) runX++
      else {
        if (runX >= 5) s += runX - 2
        runX = 1
      }
      if (m[x][y] === m[x - 1][y]) runY++
      else {
        if (runY >= 5) s += runY - 2
        runY = 1
      }
    }
    if (runX >= 5) s += runX - 2
    if (runY >= 5) s += runY - 2
  }
  let dark = 0
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (m[y][x]) dark++
      if (x < n - 1 && y < n - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) s += 3
    }
  s += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10
  return s
}
