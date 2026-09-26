import { useEffect, useMemo, useRef, useState } from 'react'
import { portraitDataUrl, type PortraitId, type PortraitMood } from '../../art/portraits'
import type { MinigameProps, PhotoResult } from './types'
import { osSfx } from './oldstreet.sound'
import './photo.css'

// 照相館（老街）：老闆看不到阿嬤，但這台老相機拍得到鬼。
// 選姿勢、找一個鬼朋友一起入鏡 → 在毛玻璃上對焦（影像是倒過來的）→ 3、2、1、鎂光燈 → 洗出一張老照片。

type Phase = 'setup' | 'focus' | 'shoot' | 'print'
type Friend = 'ayi' | 'hongyi' | 'jinyubo' | 'none'

const FONT = `"LXGW WenKai TC", "Noto Serif TC", "PingFang TC", serif`

const POSES: { id: PortraitMood; name: string; note: string }[] = [
  { id: 'normal', name: '端端正正', note: '雙手放腿上，跟以前拍大頭照一樣' },
  { id: 'happy', name: '笑一個', note: '笑得眼睛瞇起來' },
  { id: 'surprised', name: '被閃光燈嚇到', note: '一百年沒拍照了，嚇一跳也是正常的' },
]

const FRIENDS: { id: Friend; name: string }[] = [
  { id: 'ayi', name: '阿義' },
  { id: 'hongyi', name: '紅姨' },
  { id: 'jinyubo', name: '金魚伯' },
  { id: 'none', name: '自己一個人' },
]

export default function Photo({ done }: MinigameProps<unknown, PhotoResult>) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [pose, setPose] = useState<PortraitMood>('happy')
  const [friend, setFriend] = useState<Friend>('ayi')
  const [focus, setFocus] = useState(0.1)
  const target = useMemo(() => 0.35 + Math.random() * 0.4, [])
  const [count, setCount] = useState(3)
  const [flash, setFlash] = useState(false)
  const [developed, setDeveloped] = useState(false)
  const taken = useRef(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const off = Math.abs(focus - target)
  const blurPx = Math.min(10, off * 30)
  const sharp = off < 0.05

  const finish = () => done({ taken: taken.current })

  const shoot = () => {
    if (phase !== 'focus') return
    setPhase('shoot')
    setCount(3)
  }

  // 倒數：3、2、1、閃！
  useEffect(() => {
    if (phase !== 'shoot') return
    if (count > 0) {
      osSfx.tick()
      const id = window.setTimeout(() => setCount((c) => c - 1), 750)
      return () => window.clearTimeout(id)
    }
    osSfx.shutter()
    osSfx.flash()
    taken.current = true
    setFlash(true)
    const id = window.setTimeout(() => {
      setFlash(false)
      setPhase('print')
    }, 900)
    return () => window.clearTimeout(id)
  }, [phase, count])

  // 洗照片
  useEffect(() => {
    if (phase !== 'print') return
    const c = canvas.current
    if (!c) return
    let alive = true
    void composePhoto(c, pose, friend, off).then(() => {
      if (alive) window.setTimeout(() => setDeveloped(true), 60)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // 鍵盤
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'escape') {
        e.preventDefault()
        finish()
        return
      }
      if (phase === 'setup') {
        if (k === 'enter' || k === ' ' || k === 'e') {
          e.preventDefault()
          setPhase('focus')
        }
        if (k >= '1' && k <= '3') setPose(POSES[+k - 1].id)
        return
      }
      if (phase === 'focus') {
        if (k === 'arrowleft' || k === 'a') {
          e.preventDefault()
          setFocus((f) => Math.max(0, f - 0.02))
          osSfx.tick()
        }
        if (k === 'arrowright' || k === 'd') {
          e.preventDefault()
          setFocus((f) => Math.min(1, f + 0.02))
          osSfx.tick()
        }
        if (k === 'enter' || k === ' ' || k === 'e') {
          e.preventDefault()
          shoot()
        }
        return
      }
      if (phase === 'print' && (k === 'enter' || k === ' ' || k === 'e')) {
        e.preventDefault()
        finish()
      }
    }
    window.addEventListener('keydown', down, true)
    return () => window.removeEventListener('keydown', down, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const grandma = portraitDataUrl('grandma', pose)
  const buddy = friend === 'none' ? null : portraitDataUrl(friend as PortraitId, 'happy')

  return (
    <div className="ph-card" onPointerDown={(e) => e.stopPropagation()}>
      <div className="ph-head">
        <span className="ph-title">📷 光明照相館</span>
        <button className="ph-close" onClick={finish} aria-label="離開">
          ✕
        </button>
      </div>

      {phase === 'setup' && (
        <div className="ph-setup">
          <p className="ph-say">
            <b>老闆：</b>「門又自己開了……好啦，要拍就坐好喔。」
          </p>
          <div className="ph-label">阿嬤的姿勢</div>
          <div className="ph-poses">
            {POSES.map((p, i) => (
              <button key={p.id} className={`ph-pose ${pose === p.id ? 'on' : ''}`} onClick={() => setPose(p.id)}>
                <img src={portraitDataUrl('grandma', p.id)} alt="" draggable={false} />
                <span>
                  {i + 1}. {p.name}
                </span>
                <small>{p.note}</small>
              </button>
            ))}
          </div>
          <div className="ph-label">找誰一起入鏡（老相機拍得到鬼）</div>
          <div className="ph-friends">
            {FRIENDS.map((f) => (
              <button key={f.id} className={`ph-friend ${friend === f.id ? 'on' : ''}`} onClick={() => setFriend(f.id)}>
                {f.id === 'none' ? <span className="ph-solo">🙂</span> : <img src={portraitDataUrl(f.id as PortraitId, 'happy')} alt="" draggable={false} />}
                <span>{f.name}</span>
              </button>
            ))}
          </div>
          <button className="btn primary big" onClick={() => setPhase('focus')}>
            坐好了，對焦
          </button>
        </div>
      )}

      {(phase === 'focus' || phase === 'shoot') && (
        <div className="ph-focus">
          <div className="ph-hood">
            <div className="ph-glass">
              {/* 老式大相機：毛玻璃上的影像是上下左右顛倒的 */}
              <div className="ph-scene" style={{ filter: `blur(${blurPx}px) sepia(0.4)` }}>
                <div className="ph-backdrop" />
                <img className={`ph-gm ${buddy ? '' : 'solo'}`} src={grandma} alt="" draggable={false} />
                {buddy && <img className="ph-buddy" src={buddy} alt="" draggable={false} />}
              </div>
              <div className="ph-grid" />
            </div>
          </div>
          <p className="ph-say small">
            <b>老闆：</b>
            {phase === 'shoot' ? '「看這裡——笑一個！」' : sharp ? '「咦……鏡頭裡怎麼好像有人？算了，拍！」' : '「毛玻璃上是倒過來的喔，轉旋鈕把它對清楚。」'}
          </p>
          <div className="ph-knob">
            <span>近</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.005}
              value={focus}
              disabled={phase !== 'focus'}
              onChange={(e) => {
                setFocus(+e.target.value)
                if (Math.random() < 0.3) osSfx.tick()
              }}
              aria-label="對焦旋鈕"
            />
            <span>遠</span>
          </div>
          <div className={`ph-status ${sharp ? 'ok' : ''}`}>{sharp ? '焦點對好了！' : off < 0.15 ? '快好了……' : '還很模糊'}</div>
          <button className="btn primary big" onClick={shoot} disabled={phase !== 'focus'}>
            按快門
          </button>
          {phase === 'shoot' && count > 0 && <div className="ph-count">{count}</div>}
          {flash && <div className="ph-flash" />}
        </div>
      )}

      {phase === 'print' && (
        <div className="ph-print">
          <canvas ref={canvas} className={`ph-photo ${developed ? 'dev' : ''}`} />
          <p className="ph-say small">
            <b>老闆：</b>「奇怪……洗出來怎麼{buddy ? '多了兩個人' : '多了一個人'}？」
          </p>
          <button className="btn primary big" onClick={finish}>
            收下照片
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 洗照片：畫在畫布上（照相館的布景、人、老照片的色調、顆粒、暗角、花邊）
// ---------------------------------------------------------------------------

function loadImg(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function composePhoto(c: HTMLCanvasElement, pose: PortraitMood, friend: Friend, off: number) {
  const W = 600
  const H = 760
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  const B = 34
  const cap = 90
  const pw = W - B * 2
  const ph = H - B * 2 - cap
  if (document.fonts) await document.fonts.load(`700 34px ${FONT}`, '光明照相館留念攝於老街')
  const [gm, buddy] = await Promise.all([loadImg(portraitDataUrl('grandma', pose)), friend === 'none' ? Promise.resolve(null) : loadImg(portraitDataUrl(friend as PortraitId, 'happy'))])

  // 照片的底：照相館畫的布景（柱子、布幔、盆栽）
  const photo = document.createElement('canvas')
  photo.width = pw
  photo.height = ph
  const p = photo.getContext('2d')!
  const bg = p.createRadialGradient(pw * 0.5, ph * 0.4, 20, pw * 0.5, ph * 0.5, pw * 0.8)
  bg.addColorStop(0, '#e8e0d0')
  bg.addColorStop(1, '#8a8274')
  p.fillStyle = bg
  p.fillRect(0, 0, pw, ph)
  p.fillStyle = 'rgba(90,80,70,0.35)'
  p.fillRect(pw * 0.06, ph * 0.1, pw * 0.1, ph * 0.72)
  p.fillRect(pw * 0.04, ph * 0.08, pw * 0.14, ph * 0.04)
  p.fillStyle = 'rgba(70,60,55,0.35)'
  p.beginPath()
  p.moveTo(pw * 0.55, 0)
  p.quadraticCurveTo(pw * 0.8, ph * 0.25, pw, ph * 0.18)
  p.lineTo(pw, 0)
  p.closePath()
  p.fill()
  // 盆栽（右邊）
  p.fillStyle = 'rgba(60,70,55,0.45)'
  for (let i = 0; i < 6; i++) {
    p.beginPath()
    p.ellipse(pw * 0.88, ph * 0.55, pw * 0.04, ph * 0.14, -0.9 + i * 0.36, 0, Math.PI * 2)
    p.fill()
  }
  p.fillStyle = 'rgba(80,60,50,0.55)'
  p.fillRect(pw * 0.84, ph * 0.64, pw * 0.08, ph * 0.1)
  // 地板線
  p.fillStyle = 'rgba(70,62,54,0.5)'
  p.fillRect(0, ph * 0.82, pw, ph * 0.18)
  // 人：阿嬤坐在前面，朋友站在後面一點
  const blur = Math.min(8, off * 26)
  if ('filter' in p && blur > 0.4) p.filter = `blur(${blur.toFixed(1)}px)`
  if (buddy) {
    p.drawImage(buddy, pw * 0.44, ph * 0.12, pw * 0.5, pw * 0.5)
    p.drawImage(gm, pw * 0.08, ph * 0.26, pw * 0.5, pw * 0.5)
  } else {
    p.drawImage(gm, pw * 0.2, ph * 0.18, pw * 0.6, pw * 0.6)
  }
  if ('filter' in p) p.filter = 'none'

  // 老照片的色調與顆粒（畫布被污染就算了，至少不當掉）
  try {
    const img = p.getImageData(0, 0, pw, ph)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const y = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11
      const n = (Math.random() - 0.5) * 26
      d[i] = Math.min(255, y * 1.07 + 18 + n)
      d[i + 1] = Math.min(255, y * 0.9 + 8 + n)
      d[i + 2] = Math.min(255, y * 0.7 + n)
    }
    p.putImageData(img, 0, 0)
  } catch {
    c.style.filter = 'sepia(0.9)'
  }
  const vig = p.createRadialGradient(pw / 2, ph / 2, ph * 0.25, pw / 2, ph / 2, pw * 0.75)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(40,25,10,0.55)')
  p.fillStyle = vig
  p.fillRect(0, 0, pw, ph)

  // 相紙：米白色、花邊（一圈小半圓）
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#f2ead8'
  ctx.beginPath()
  const r = 7
  for (let x = r; x < W; x += r * 2) ctx.arc(x, r, r, Math.PI, 0)
  for (let y = r; y < H; y += r * 2) ctx.arc(W - r, y, r, -Math.PI / 2, Math.PI / 2)
  for (let x = W - r; x > 0; x -= r * 2) ctx.arc(x, H - r, r, 0, Math.PI)
  for (let y = H - r; y > 0; y -= r * 2) ctx.arc(r, y, r, Math.PI / 2, (Math.PI * 3) / 2)
  ctx.closePath()
  ctx.fill()
  ctx.drawImage(photo, B, B)
  ctx.strokeStyle = 'rgba(120,100,70,0.4)'
  ctx.lineWidth = 2
  ctx.strokeRect(B, B, pw, ph)
  ctx.fillStyle = '#5a4630'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 34px ${FONT}`
  ctx.fillText('光明照相館　留念', W / 2, H - B - cap / 2 - 6)
  ctx.font = `500 18px ${FONT}`
  ctx.fillStyle = '#8a7050'
  ctx.fillText('攝於老街', W / 2, H - B - cap / 2 + 26)
  // 紅色的店章
  ctx.strokeStyle = 'rgba(180,40,30,0.7)'
  ctx.lineWidth = 3
  ctx.strokeRect(W - B - 70, H - B - cap + 18, 54, 54)
  ctx.fillStyle = 'rgba(180,40,30,0.75)'
  ctx.font = `700 22px ${FONT}`
  ctx.fillText('光明', W - B - 43, H - B - cap + 45)
}
