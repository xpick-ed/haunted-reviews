import * as THREE from 'three'

// 程式產生的貼圖（DESIGN §16.2 的佔位版）。全部是 canvas 畫的，不需要載入圖片。

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

function finish(c: HTMLCanvasElement, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeatX, repeatY)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a)

export function brickTexture(repeatX = 1, repeatY = 1) {
  const [c, ctx] = canvas(128, 128)
  ctx.fillStyle = '#6b3a2e'
  ctx.fillRect(0, 0, 128, 128)
  const bw = 32
  const bh = 16
  for (let y = 0; y < 128; y += bh) {
    const off = (y / bh) % 2 ? bw / 2 : 0
    for (let x = -bw; x < 128 + bw; x += bw) {
      const l = rnd(-8, 8)
      ctx.fillStyle = `hsl(${rnd(8, 16)}, ${rnd(40, 52)}%, ${34 + l}%)`
      ctx.fillRect(x + off + 1, y + 1, bw - 2, bh - 2)
    }
  }
  return finish(c, repeatX, repeatY)
}

export function roofTexture(repeatX = 1, repeatY = 1) {
  const [c, ctx] = canvas(128, 128)
  ctx.fillStyle = '#464a53'
  ctx.fillRect(0, 0, 128, 128)
  for (let y = 0; y < 128; y += 10) {
    ctx.fillStyle = '#33363d'
    ctx.fillRect(0, y, 128, 3)
    const off = (y / 10) % 2 ? 8 : 0
    for (let x = off; x < 128; x += 16) {
      ctx.fillStyle = `hsl(220, 8%, ${rnd(26, 34)}%)`
      ctx.fillRect(x, y + 3, 14, 7)
      ctx.fillStyle = '#5a5f6a'
      ctx.fillRect(x, y + 3, 14, 1)
    }
  }
  return finish(c, repeatX, repeatY)
}

export function groundTexture(repeat = 1) {
  const [c, ctx] = canvas(256, 256)
  ctx.fillStyle = '#3a4a2f'
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? '#45573a' : '#2f3d27'
    ctx.fillRect(rnd(0, 256), rnd(0, 256), rnd(1, 4), rnd(1, 3))
  }
  return finish(c, repeat, repeat)
}

export function concreteTexture(repeatX = 1, repeatY = 1) {
  const [c, ctx] = canvas(128, 128)
  ctx.fillStyle = '#8d8578'
  ctx.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? '#968e80' : '#807869'
    ctx.fillRect(rnd(0, 128), rnd(0, 128), 2, 2)
  }
  ctx.fillStyle = '#767063'
  ctx.fillRect(0, 63, 128, 2)
  ctx.fillRect(63, 0, 2, 128)
  return finish(c, repeatX, repeatY)
}

export function plankTexture(repeatX = 1, repeatY = 1) {
  const [c, ctx] = canvas(128, 128)
  ctx.fillStyle = '#8a5a3a'
  ctx.fillRect(0, 0, 128, 128)
  for (let y = 0; y < 128; y += 16) {
    ctx.fillStyle = `hsl(24, 40%, ${rnd(32, 40)}%)`
    ctx.fillRect(0, y + 1, 128, 14)
    ctx.fillStyle = '#5d3a22'
    ctx.fillRect(0, y, 128, 1)
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = 'rgba(60, 35, 18, 0.35)'
      ctx.fillRect(rnd(0, 128), y + rnd(2, 13), rnd(10, 40), 1)
    }
  }
  return finish(c, repeatX, repeatY)
}

export function haloTexture(hex: string) {
  const [c, ctx] = canvas(128, 128)
  const col = new THREE.Color(hex)
  const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64)
  g.addColorStop(0, `rgba(${rgb},1)`)
  g.addColorStop(0.35, `rgba(${rgb},0.45)`)
  g.addColorStop(1, `rgba(${rgb},0)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function textTexture(text: string, color: string, size = 56) {
  const [c, ctx] = canvas(256, 128)
  ctx.font = `900 ${size}px "Noto Sans TC", "PingFang TC", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 8
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'
  ctx.strokeText(text, 128, 64)
  ctx.fillStyle = color
  ctx.fillText(text, 128, 64)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
