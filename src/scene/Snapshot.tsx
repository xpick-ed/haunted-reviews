import { useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

// 截圖（DESIGN §31.4）：分享卡要一張遊戲畫面。掛在 Canvas 裡，ShareCard.tsx 呼叫 requestSnapshot()。
// 不開 preserveDrawingBuffer（會拖慢每一幀）：要截圖時才掛一個很晚執行的 useFrame，
// 在同一幀、畫面還沒送出去之前把 WebGL 畫布畫到 2D 畫布上。後製（EffectComposer）也在這之前畫完了。

type Resolve = (c: HTMLCanvasElement | null) => void

let waiting: Resolve[] = []
let startCapture: (() => void) | null = null

function flush(c: HTMLCanvasElement | null) {
  const ws = waiting
  waiting = []
  for (const w of ws) w(c)
}

/** 下一幀的遊戲畫面（2D 畫布複本）；Canvas 不在或 timeoutMs 內截不到時給 null */
export function requestSnapshot(timeoutMs = 5000): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    if (!startCapture) {
      resolve(null)
      return
    }
    let settled = false
    const once: Resolve = (c) => {
      if (settled) return
      settled = true
      resolve(c)
    }
    waiting.push(once)
    startCapture()
    // 畫面停住（小遊戲）或分頁在背景：不要一直等（慢的手機讀回畫面要一兩秒）
    window.setTimeout(() => {
      waiting = waiting.filter((w) => w !== once)
      once(null)
    }, timeoutMs)
  })
}

export function Snapshot() {
  const [capturing, setCapturing] = useState(false)
  useEffect(() => {
    startCapture = () => setCapturing(true)
    return () => {
      startCapture = null
      flush(null)
    }
  }, [])
  return capturing ? <Capture done={() => setCapturing(false)} /> : null
}

function Capture({ done }: { done: () => void }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => invalidate(), [invalidate])
  // priority 很大：在後製（priority 1）畫完之後才跑
  useFrame((state) => {
    const { gl, scene, camera, internal } = state
    // 只有這個 useFrame 接管畫面（沒有後製）時，r3f 不會自己畫，要自己畫一次
    if (internal.priority <= 1) gl.render(scene, camera)
    const src = gl.domElement
    let out: HTMLCanvasElement | null = null
    try {
      out = document.createElement('canvas')
      out.width = src.width
      out.height = src.height
      out.getContext('2d', { willReadFrequently: true })?.drawImage(src, 0, 0)
    } catch {
      out = null
    }
    flush(out)
    done()
  }, 100)
  return null
}
