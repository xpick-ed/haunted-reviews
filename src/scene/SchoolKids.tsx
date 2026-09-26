import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { audio } from '../audio'
import { sfx } from '../audio/sfx'
import { player } from '../world/player'
import { SCHOOL_SCENE, schoolFx } from '../world/sceneSchool'
import { KIDS, clearPlay, kidsGate, playLeft, schoolPlay, stepPlay, type Kid, type PlayEvent, type PlayKind } from '../world/tag'
import { Chibi, newDrive, type Drive } from '../chars/Chibi'
import { SPECS } from '../chars/specs'
import { canvasTexture } from './kit'
import { lanternAt } from './daylight'
import './School.css'

// 廢棄國小的小孩鬼（DESIGN §26.1）：每幀推進 src/world/tag.ts，畫出四個小孩、躲貓貓的提示光、
// 鬼抓人／躲貓貓的 HUD（drei <Html> 蓋在畫面上）、風琴與鐘的聲音。

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
const VOICE: Record<string, 'kid1' | 'kid2'> = { guikid1: 'kid1', guikid2: 'kid2', guikid3: 'kid1', guikid4: 'kid2' }

/** 小孩講話（有配音的兩個用自己的聲音，另外兩個借用） */
function kidBark(kid: string, what: string, quiet = false) {
  const v = VOICE[kid] ?? 'kid1'
  useStore.getState().bark(`school.${v}.${what}`, quiet)
}

let lastBark = 0
function throttled(fn: () => void, gap = 1.6) {
  const now = performance.now() / 1000
  if (now - lastBark < gap) return
  lastBark = now
  fn()
}

interface HudState {
  kind: PlayKind | null
  left: number
  limit: number
  count: number
  total: number
  end: { won: boolean; count: number } | null
}

export function SchoolKids() {
  const quality = useStore((s) => s.quality)
  const rt = schoolPlay.rt
  const [hud, setHud] = useState<HudState>({ kind: null, left: 0, limit: 0, count: 0, total: KIDS.length, end: null })
  const hudT = useRef(0)
  const endAt = useRef(0)

  // 換場景時一局還沒結束：清掉，回到閒晃
  useEffect(() => {
    clearPlay(rt)
    return () => clearPlay(rt)
  }, [rt])

  const onEvent = (e: PlayEvent) => {
    const s = useStore.getState()
    switch (e.t) {
      case 'tagged':
        sfx.play('pickup', { volume: 0.7 })
        throttled(() => kidBark(e.kid, 'tagged'), 1.2)
        break
      case 'found':
        sfx.play('pickup', { volume: 0.7 })
        throttled(() => kidBark(e.kid, 'found'), 1.2)
        break
      case 'giggle':
        throttled(() => kidBark(e.kid, 'giggle', false), 2.5)
        break
      case 'taunt':
        throttled(() => kidBark(e.kid, 'taunt'), 3)
        break
      case 'end': {
        endAt.current = performance.now()
        setHud((h) => ({ ...h, end: { won: e.won, count: e.count } }))
        const flag = e.kind === 'tag' ? 'school_tag_won' : 'school_hide_won'
        const merit = e.won ? 2 : e.count >= 2 ? 1 : 0
        useStore.setState((x) => ({
          flags: e.won ? { ...x.flags, [flag]: true } : x.flags,
          meta: { ...x.meta, merit: x.meta.merit + merit },
        }))
        if (e.won) audio.chime()
        window.setTimeout(() => s.bark(e.won ? (e.kind === 'tag' ? 'school.tag.win' : 'school.hide.win') : e.kind === 'tag' ? 'school.tag.lose' : 'school.hide.lose'), 700)
        break
      }
    }
  }

  const prevKind = useRef<PlayKind | null>(null)
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const s = useStore.getState()
    const frozen = !!s.dialogue || !!s.minigame || s.transitioning
    if (rt.kind !== prevKind.current) {
      // 一局剛開始
      if (rt.kind) {
        sfx.play('whoosh', { volume: 0.5 })
        kidBark('guikid1', rt.kind === 'tag' ? 'tagstart' : 'hidestart')
      }
      prevKind.current = rt.kind
    }
    if (!frozen) for (const e of stepPlay(rt, dt, player)) onEvent(e)
    // 結束卡片停 2.2 秒，之後回到閒晃
    if (rt.over && performance.now() - endAt.current > 2200) {
      clearPlay(rt)
      setHud((h) => ({ ...h, kind: null, end: null }))
    }
    hudT.current -= rawDt
    if (hudT.current <= 0 && (rt.kind || hud.kind)) {
      hudT.current = 0.2
      setHud((h) => ({ ...h, kind: rt.kind, left: playLeft(rt), limit: rt.limit, count: rt.count, total: rt.kids.length }))
    }
  })

  useOrganAndBell()
  usePlayHud(hud)

  return (
    <group>
      {rt.kids.map((k) => (
        <KidActor key={k.id} kid={k} outline={quality === 'high'} />
      ))}
      <HideHints />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 一個小孩鬼
// ---------------------------------------------------------------------------

/** 小孩鬼身上淡淡的青光（跟阿嬤一樣），晚上比較亮 */
const haloTex = canvasTexture(64, 64, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2)
  g.addColorStop(0, 'rgba(170,240,255,0.9)')
  g.addColorStop(0.45, 'rgba(150,230,255,0.3)')
  g.addColorStop(1, 'rgba(150,230,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
})

function KidActor({ kid, outline }: { kid: Kid; outline: boolean }) {
  const group = useRef<THREE.Group>(null)
  const halo = useRef<THREE.SpriteMaterial>(null)
  const drive = useRef<Drive>(newDrive({ pose: 'idle', expr: 'normal', heading: kid.heading }))
  const hop = useRef(0)
  const spec = SPECS[kid.id]
  useFrame(({ clock }, rawDt) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(rawDt, 0.1)
    const show = kidsGate.visible() && kid.mode !== 'hidden'
    g.visible = show
    if (!show) return
    const floor = SCHOOL_SCENE.floorAt(kid.x, kid.z)
    const d = drive.current
    const near = Math.hypot(player.x - kid.x, player.z - kid.z)
    d.speed = kid.speed
    d.heading = kid.heading
    switch (kid.mode) {
      case 'flee':
        d.pose = 'idle'
        d.expr = 'happy'
        break
      case 'tagged':
      case 'found':
        d.pose = 'wave'
        d.expr = 'happy'
        break
      default:
        d.pose = near < 3 ? 'wave' : 'idle'
        d.expr = near < 3 ? 'happy' : 'normal'
    }
    // 被抓到、找到：跳一下；平常偶爾自己蹦蹦跳
    const t = clock.elapsedTime
    if (kid.mode === 'tagged' || kid.mode === 'found') hop.current = Math.max(hop.current - dt * 2, 0)
    const bounce = kid.mode === 'idle' && kid.speed < 0.1 ? Math.max(0, Math.sin(t * 5 + kid.x)) * 0.08 : 0
    d.hop = bounce
    g.position.set(kid.x, floor + 0.05 + Math.sin(t * 2.2 + kid.z) * 0.03, kid.z)
    if (halo.current) halo.current.opacity = 0.2 + lanternAt(useStore.getState().time) * 0.18 + Math.sin(t * 3 + kid.x) * 0.04
  })
  if (!spec) return null
  return (
    <group ref={group} userData={{ noMerge: true }}>
      <Chibi spec={spec} drive={drive} outline={outline} />
      <sprite scale={[1.3, 1.3, 1]} position={[0, 0.45, 0]} renderOrder={1}>
        <spriteMaterial ref={halo} map={haloTex} transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 躲貓貓：阿嬤靠近躲藏點時冒出一點亮光（兩公尺內），越近越亮
// ---------------------------------------------------------------------------

function HideHints() {
  const tex = useMemo(
    () =>
      canvasTexture(64, 64, (ctx, w, h) => {
        const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2)
        g.addColorStop(0, 'rgba(200,250,255,1)')
        g.addColorStop(0.4, 'rgba(160,240,255,0.45)')
        g.addColorStop(1, 'rgba(160,240,255,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }),
    [],
  )
  const refs = useRef<(THREE.Sprite | null)[]>([])
  useFrame(({ clock }) => {
    const rt = schoolPlay.rt
    const t = clock.elapsedTime
    rt.kids.forEach((k, i) => {
      const sp = refs.current[i]
      if (!sp) return
      const d = Math.hypot(player.x - k.x, player.z - k.z)
      const on = rt.kind === 'hide' && k.mode === 'hidden' && d < 2.2 && kidsGate.visible()
      sp.visible = on
      if (!on) return
      const a = THREE.MathUtils.clamp((2.2 - d) / 1.2, 0.15, 1)
      sp.position.set(k.x + Math.sin(t * 3 + i) * 0.15, SCHOOL_SCENE.floorAt(k.x, k.z) + 0.6 + Math.sin(t * 5 + i) * 0.1, k.z)
      sp.scale.setScalar(0.5 + a * 0.4)
      ;(sp.material as THREE.SpriteMaterial).opacity = a * (0.6 + Math.sin(t * 9 + i) * 0.3)
    })
  })
  return (
    <group>
      {KIDS.map((k, i) => (
        <sprite
          key={k.id}
          ref={(el) => {
            refs.current[i] = el
          }}
          visible={false}
        >
          <spriteMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// HUD：遊戲名稱、倒數、抓到／找到幾個；結束卡片
// 畫在 3D 畫面外面：自己開一個 React DOM root 掛在 body 上（不經過 Hud.tsx）
// ---------------------------------------------------------------------------

function usePlayHud(hud: HudState) {
  const root = useRef<Root | null>(null)
  useEffect(() => {
    const el = document.createElement('div')
    el.className = 'school-hud-root'
    document.body.appendChild(el)
    root.current = createRoot(el)
    return () => {
      const r = root.current
      root.current = null
      // 在 R3F 的 render 裡面卸載別的 root 會警告：延到下一輪
      window.setTimeout(() => {
        r?.unmount()
        el.remove()
      }, 0)
    }
  }, [])
  useEffect(() => {
    root.current?.render(hud.kind || hud.end ? <PlayHud hud={hud} /> : null)
  }, [hud])
}

function PlayHud({ hud }: { hud: HudState }) {
  const title = hud.kind === 'hide' ? '躲貓貓' : '鬼抓人'
  const verb = hud.kind === 'hide' ? '找到' : '抓到'
  const k = hud.limit > 0 ? hud.left / hud.limit : 0
  return (
    <div className="school-hud">
      {hud.kind && (
        <div className="school-hud-bar">
          <span className="school-hud-title">{title}</span>
          <span className="school-hud-count">
            {verb} <b>{hud.count}</b> / {hud.total}
          </span>
          <div className="school-hud-time">
            <i style={{ width: `${k * 100}%` }} className={k < 0.25 ? 'low' : ''} />
          </div>
          <span className="school-hud-sec">{Math.ceil(hud.left)}</span>
          {hud.count === 0 && hud.left > hud.limit - 4 && (
            <span className="school-hud-tip">{hud.kind === 'tag' ? '碰到小孩就算抓到！（連點方向鍵可以快飄）' : '靠近躲藏的地方會有亮光、會聽到笑聲'}</span>
          )}
        </div>
      )}
      {hud.end && (
        <div className={`school-hud-end ${hud.end.won ? 'won' : ''}`}>
          <div className="school-hud-end-title">{hud.end.won ? (hud.kind === 'hide' ? '全部找到了！' : '全部抓到了！') : '時間到！'}</div>
          <div className="school-hud-end-sub">
            {verb} {hud.end.count} 個{hud.end.won ? '・功德 +2' : hud.end.count >= 2 ? '・功德 +1' : ''}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 風琴（按幾個音）、鐘（噹噹噹）：用 WebAudio 現場合成
// ---------------------------------------------------------------------------

function useOrganAndBell() {
  const seen = useRef({ organ: schoolFx.organAt, bell: schoolFx.bellAt })
  useFrame(() => {
    if (schoolFx.organAt !== seen.current.organ) {
      seen.current.organ = schoolFx.organAt
      playOrgan()
    }
    if (schoolFx.bellAt !== seen.current.bell) {
      seen.current.bell = schoolFx.bellAt
      playBell()
      // 鐘響了：小孩鬼跑過來
      const rt = schoolPlay.rt
      if (!rt.kind) for (const k of rt.kids) if (k.mode === 'idle') k.wait = 0
      if (kidsGate.visible()) window.setTimeout(() => kidBark(pick(['guikid1', 'guikid2']), 'bell'), 1400)
    }
  })
}

/** 「妹妹背著洋娃娃」開頭幾個音，風琴（簧片）音色、有點走音 */
function playOrgan() {
  const ctx = audio.ctx
  if (!ctx) return
  const notes = [67, 67, 64, 67, 69, 67, 64, 62]
  const t0 = ctx.currentTime + 0.05
  notes.forEach((n, i) => {
    const f = 440 * Math.pow(2, (n - 69) / 12) * (1 + (Math.random() - 0.5) * 0.01)
    const t = t0 + i * 0.32
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.05)
    g.gain.setValueAtTime(0.09, t + 0.24)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1800
    for (const [mul, type] of [
      [1, 'sawtooth'],
      [2, 'square'],
    ] as const) {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = f * mul
      const og = ctx.createGain()
      og.gain.value = mul === 1 ? 0.6 : 0.2
      o.connect(og).connect(lp)
      o.start(t)
      o.stop(t + 0.36)
    }
    lp.connect(g).connect(audio.bus.sfx)
  })
}

/** 學校的鐘：噹、噹、噹（金屬泛音） */
function playBell() {
  const ctx = audio.ctx
  if (!ctx) return
  const t0 = ctx.currentTime + 0.02
  for (let i = 0; i < 3; i++) {
    const t = t0 + i * 0.55
    for (const [f, a] of [
      [880, 0.16],
      [1320, 0.07],
      [2350, 0.04],
    ]) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(a, t + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3)
      o.connect(g).connect(audio.bus.sfx)
      o.start(t)
      o.stop(t + 1.35)
    }
  }
}
