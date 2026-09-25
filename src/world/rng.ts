/** 固定亂數（同一個種子每次結果一樣）。純函式，不依賴畫面，Node 的模擬測試也能用。 */
export function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
