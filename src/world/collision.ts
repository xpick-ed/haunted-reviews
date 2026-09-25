// 2D 碰撞（x, z 平面）。阿嬤是一個圓，牆和家具是軸對齊矩形或圓。
// 阿嬤是鬼，飄在空中，所以沒有高度與台階的問題，只擋水平方向。

export interface Rect {
  x0: number
  z0: number
  x1: number
  z1: number
}
export interface Circle {
  x: number
  z: number
  r: number
}
export interface Colliders {
  rects: Rect[]
  circles: Circle[]
  bounds: Rect
}

export const rect = (x0: number, z0: number, x1: number, z1: number): Rect => ({
  x0: Math.min(x0, x1),
  z0: Math.min(z0, z1),
  x1: Math.max(x0, x1),
  z1: Math.max(z0, z1),
})

/** 以中心與尺寸建矩形 */
export const box = (cx: number, cz: number, w: number, d: number): Rect => rect(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2)

export const inRect = (r: Rect, x: number, z: number, pad = 0) => x >= r.x0 - pad && x <= r.x1 + pad && z >= r.z0 - pad && z <= r.z1 + pad

/**
 * 一面沿 x 或 z 的牆，扣掉門洞（窗戶不算洞，照樣擋）。
 * gaps：門洞中心與寬度（沿牆方向）。
 */
export function wallRects(axis: 'x' | 'z', from: number, to: number, at: number, thick: number, gaps: { c: number; w: number }[] = []): Rect[] {
  const out: Rect[] = []
  const sorted = [...gaps].sort((a, b) => a.c - b.c)
  let cur = from
  const push = (a: number, b: number) => {
    if (b - a < 0.01) return
    out.push(axis === 'x' ? rect(a, at - thick / 2, b, at + thick / 2) : rect(at - thick / 2, a, at + thick / 2, b))
  }
  for (const g of sorted) {
    push(cur, g.c - g.w / 2)
    cur = g.c + g.w / 2
  }
  push(cur, to)
  return out
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

/** 把圓心 p 推出所有障礙物（原地修改） */
export function resolve(p: { x: number; z: number }, r: number, c: Colliders) {
  for (let it = 0; it < 3; it++) {
    let moved = false
    for (const b of c.rects) {
      if (p.x < b.x0 - r || p.x > b.x1 + r || p.z < b.z0 - r || p.z > b.z1 + r) continue
      const cx = clamp(p.x, b.x0, b.x1)
      const cz = clamp(p.z, b.z0, b.z1)
      const dx = p.x - cx
      const dz = p.z - cz
      const d2 = dx * dx + dz * dz
      if (d2 >= r * r) continue
      moved = true
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2)
        p.x += (dx / d) * (r - d)
        p.z += (dz / d) * (r - d)
      } else {
        // 圓心在矩形裡：往穿透最淺的方向推出去
        const l = p.x - b.x0
        const rr = b.x1 - p.x
        const t = p.z - b.z0
        const bb = b.z1 - p.z
        const m = Math.min(l, rr, t, bb)
        if (m === l) p.x = b.x0 - r
        else if (m === rr) p.x = b.x1 + r
        else if (m === t) p.z = b.z0 - r
        else p.z = b.z1 + r
      }
    }
    for (const o of c.circles) {
      const dx = p.x - o.x
      const dz = p.z - o.z
      const min = r + o.r
      const d2 = dx * dx + dz * dz
      if (d2 >= min * min) continue
      moved = true
      const d = Math.sqrt(d2) || 1e-5
      p.x = o.x + (dx / d) * min
      p.z = o.z + (dz / d) * min
    }
    if (!moved) break
  }
  p.x = clamp(p.x, c.bounds.x0 + r, c.bounds.x1 - r)
  p.z = clamp(p.z, c.bounds.z0 + r, c.bounds.z1 - r)
}

/** 線段 (a→b) 是否穿過軸對齊盒子（3D，slab 法） */
export function segmentHitsBox(
  a: [number, number, number],
  b: [number, number, number],
  min: [number, number, number],
  max: [number, number, number],
): boolean {
  let t0 = 0
  let t1 = 1
  for (let i = 0; i < 3; i++) {
    const d = b[i] - a[i]
    if (Math.abs(d) < 1e-9) {
      if (a[i] < min[i] || a[i] > max[i]) return false
      continue
    }
    let ta = (min[i] - a[i]) / d
    let tb = (max[i] - a[i]) / d
    if (ta > tb) [ta, tb] = [tb, ta]
    t0 = Math.max(t0, ta)
    t1 = Math.min(t1, tb)
    if (t0 > t1) return false
  }
  return true
}
