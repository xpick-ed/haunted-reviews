import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { Chibi, ChibiNpc, R as HEAD_R, SEAT_Y, newDrive, type Drive } from '../chars/Chibi'
import { SPECS } from '../chars/specs'
import { HOME } from '../world/scenes'
import { BOWL_SEAT, KNEEL, LEDGER, MIRROR_TEXT, MIRROR_WINDOW, RADIO, doneOn, duskReactions, hanFx, ledgerMistake, mirrorTonight, speakSeq, type MirrorMsg } from '../world/han'
import { bowlBeat, hanAtHome, kneelBeat } from '../world/storyBeats'
import { hanNoteSource } from '../world/requests'
import { FLOOR_Y, HAN_BED, SINK, STOVE, TEA } from './layout'
import { canvasTexture } from './kit'
import { RADIO_SONG_SEC, playRadioSong } from './HanSound'

// 跟小翰的陰陽溝通的畫面（DESIGN §31.2，規則在 src/world/han.ts）：掛在家的場景。
//   深夜：小翰睡在自己床上；浴廁的鏡子起霧（22:00–00:00），寫了字就留著；書桌上的帳本（算錯的那晚微微發光，翻過就攤開）
//   傍晚：第 3、9、11 晚他在神明廳擲筊；到了「阿嬤，是妳嗎」那天他坐在茶桌、擺兩副碗筷（之後每天傍晚都多一副）；
//         煎菜脯蛋那天灶腳冒煙；小翰房門口的收音機（轉開會放歌、飄音符）
// 隔天傍晚他說起昨晚的事：這裡在傍晚開始、他在家的時候播一次（duskReactions）。

const YARD_Y = 0.1
const TABLE_Y = YARD_Y + 0.44
const FONT = '"LXGW WenKai TC", "Noto Sans TC", "PingFang TC", sans-serif'

export function HanLayer() {
  const outline = useStore((s) => s.quality === 'high')
  useDuskReactions()
  // 小翰的紙條的附註要讀 meta（requests.ts 不能 import store）
  useEffect(() => {
    hanNoteSource.meta = () => useStore.getState().meta
  }, [])
  return (
    <group>
      <SleepingHan outline={outline} />
      <MirrorFog />
      <Ledger />
      <KneelingHan outline={outline} />
      <BowlTable outline={outline} />
      <Radio />
      <KitchenSmoke />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 隔天傍晚的反應
// ---------------------------------------------------------------------------

function useDuskReactions() {
  useEffect(() => {
    let readyAt = 0
    const id = window.setInterval(() => {
      const s = useStore.getState()
      const calm = s.started && s.phase === 'dusk' && !s.intro && s.scene === 'home' && !s.dialogue && !s.transitioning && !s.minigame && !s.summary && !s.ending
      if (!calm || hanFx.reactedNight === s.meta.night) {
        readyAt = 0
        return
      }
      // 進傍晚幾秒後再說（開場的台詞先講完）
      if (!readyAt) {
        readyAt = performance.now() + 6500
        return
      }
      if (performance.now() < readyAt) return
      hanFx.reactedNight = s.meta.night
      // 他今天不在家（清明、陳董、分遺產）：留到下次
      if (!(hanAtHome(s) || kneelBeat(s) || bowlBeat(s))) return
      const r = duskReactions(s)
      if (!r) return
      useStore.setState({ meta: r.meta, flags: r.flags })
      if (r.smoke) hanFx.smokeNight = s.meta.night
      void speakSeq(useStore, r.lines).then((t) => r.notes.forEach((n, i) => window.setTimeout(() => useStore.getState().say(n), t + i * 2200)))
    }, 500)
    return () => window.clearInterval(id)
  }, [])
}

// ---------------------------------------------------------------------------
// 深夜：小翰睡在床上（只露出頭）
// ---------------------------------------------------------------------------

function SleepingHan({ outline }: { outline: boolean }) {
  const night = useStore((s) => s.phase === 'night')
  const drive = useRef<Drive>(newDrive({ expr: 'asleep' }))
  const spec = SPECS.xiaohan
  if (!night || !spec) return null
  const topY = FLOOR_Y + 0.48
  const pillowZ = HAN_BED.z - HAN_BED.l / 2 + 0.3
  return (
    <group position={[HAN_BED.x, topY + 0.13 + HEAD_R * spec.scale * 0.7, pillowZ + 0.02]} rotation={[-Math.PI / 2 + 0.35, 0, 0]}>
      <Chibi spec={spec} drive={drive} headOnly outline={outline} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 浴廁的鏡子：起霧、手指寫的字（字的地方霧被擦掉，看得到後面的鏡子）
// ---------------------------------------------------------------------------

/** backed：浮在鏡子前面的小卡（自己畫深色的鏡面當底，字的地方露出鏡面） */
function fogTexture(msg: MirrorMsg | null, backed = false) {
  const text = msg ? MIRROR_TEXT[msg] : ''
  return canvasTexture(
    256,
    340,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      const mirror = '#2c3a47'
      if (backed) {
        ctx.fillStyle = '#8a8f96'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = mirror
        ctx.fillRect(8, 8, w - 16, h - 16)
      }
      const g = ctx.createRadialGradient(w / 2, h * 0.45, 20, w / 2, h / 2, w * 0.75)
      g.addColorStop(0, 'rgba(236,241,246,0.86)')
      g.addColorStop(1, 'rgba(220,228,236,0.62)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      // 水氣的斑
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.08})`
        ctx.beginPath()
        ctx.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 18, 0, Math.PI * 2)
        ctx.fill()
      }
      if (!text) return
      // 手指擦出來的字：直的，一個字一行（小卡：字的地方畫回鏡面的顏色）
      ctx.globalCompositeOperation = backed ? 'source-over' : 'destination-out'
      const chars = [...text]
      const size = chars.length > 2 ? 78 : 96
      ctx.font = `700 ${size}px ${FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const top = h / 2 - ((chars.length - 1) * size * 1.02) / 2
      chars.forEach((ch, i) => {
        const x = w / 2 + (i % 2 ? 4 : -3)
        const y = top + i * size * 1.02
        ctx.fillStyle = backed ? mirror : 'rgba(0,0,0,0.92)'
        ctx.fillText(ch, x, y)
        // 往下流的水痕
        ctx.fillStyle = backed ? 'rgba(44,58,71,0.8)' : 'rgba(0,0,0,0.55)'
        const dx = x - size * 0.25 + ((i * 37) % 40)
        ctx.fillRect(dx, y + size * 0.35, 3, 20 + ((i * 53) % 34))
      })
      ctx.globalCompositeOperation = 'source-over'
    },
    [{ spec: `700 96px ${FONT}`, text: '吃飯別太累阿嬤在' }],
  )
}

function MirrorFog() {
  const msg = useStore((s) => (s.phase === 'night' ? mirrorTonight(s.meta) : null))
  const tex = useMemo(() => fogTexture(msg), [msg])
  const cardTex = useMemo(() => fogTexture(msg, true), [msg])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0, toneMapped: false }), [])
  useEffect(() => {
    mat.map = tex
    mat.needsUpdate = true
    return () => tex.dispose()
  }, [mat, tex])
  const mesh = useRef<THREE.Mesh>(null)
  // 鏡子面向西，鏡頭從南邊看過去幾乎是側面：阿嬤在浴廁裡的時候，字另外浮一張小卡在鏡子前面（面向鏡頭）
  const card = useRef<THREE.Sprite>(null)
  const cardMat = useMemo(() => new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false, opacity: 0 }), [])
  useEffect(() => {
    cardMat.map = cardTex
    cardMat.needsUpdate = true
    return () => cardTex.dispose()
  }, [cardMat, cardTex])
  useFrame(() => {
    const s = useStore.getState()
    const m = mesh.current
    if (card.current) {
      const show = !!msg && s.phase === 'night' && s.room === 'bath'
      cardMat.opacity += ((show ? 0.95 : 0) - cardMat.opacity) * 0.12
      card.current.visible = cardMat.opacity > 0.02
    }
    if (!m) return
    let k = 0
    if (s.phase === 'night') {
      if (s.time >= MIRROR_WINDOW.from && s.time < MIRROR_WINDOW.to) k = 1
      // 過了半夜霧慢慢散；寫了字的話字的痕跡還留著一點
      else if (s.time >= MIRROR_WINDOW.to) k = msg ? Math.max(0.45, 1 - (s.time - MIRROR_WINDOW.to) * 1.5) : Math.max(0, 1 - (s.time - MIRROR_WINDOW.to) * 2)
    }
    m.visible = k > 0.01
    mat.opacity = k * 0.9
  })
  // 鏡子在洗手台上方、面向西（跟 Interior.tsx 的鏡子同一個位置，往前一點點）
  return (
    <group>
      <mesh ref={mesh} material={mat} position={[SINK.x + 0.229, FLOOR_Y + 1.55, SINK.z]} rotation={[0, -Math.PI / 2, 0]} renderOrder={2} visible={false}>
        <planeGeometry args={[0.45, 0.6]} />
      </mesh>
      <sprite ref={card} material={cardMat} position={[SINK.x - 0.05, FLOOR_Y + 2.05, SINK.z]} scale={[0.5, 0.66, 1]} renderOrder={4} visible={false} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 書桌上的帳本
// ---------------------------------------------------------------------------

function Ledger() {
  const state = useStore((s) => {
    if (s.phase !== 'night') return 'closed'
    if (doneOn(s.meta, 'ledger', s.meta.night)) return 'open'
    return ledgerMistake(s.meta.night) !== null ? 'glow' : 'closed'
  })
  const glow = useRef<THREE.Mesh>(null)
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffe7a8', transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), [])
  useFrame(({ clock }) => {
    if (glow.current) glowMat.opacity = 0.18 + 0.14 * Math.sin(clock.elapsedTime * 2.2)
  })
  const deskY = FLOOR_Y + 0.765
  const page = useMemo(
    () =>
      canvasTexture(
        128,
        160,
        (ctx, w, h) => {
          ctx.fillStyle = '#f6f0de'
          ctx.fillRect(0, 0, w, h)
          ctx.strokeStyle = 'rgba(80,110,160,0.5)'
          ctx.lineWidth = 2
          for (let y = 18; y < h; y += 14) {
            ctx.beginPath()
            ctx.moveTo(6, y)
            ctx.lineTo(w - 6, y)
            ctx.stroke()
          }
          ctx.fillStyle = '#3a3a48'
          for (let y = 14; y < h - 10; y += 14) ctx.fillRect(10, y - 6, 30 + ((y * 7) % 60), 3)
          // 算錯的地方：紅筆圈起來
          ctx.strokeStyle = '#c62828'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.ellipse(70, 88, 34, 11, -0.1, 0, Math.PI * 2)
          ctx.stroke()
        },
        [],
      ),
    [],
  )
  return (
    <group position={[LEDGER.x, deskY, LEDGER.z]}>
      {state !== 'open' ? (
        <mesh position={[0, 0.02, 0]} rotation={[0, 0.25, 0]} castShadow>
          <boxGeometry args={[0.2, 0.035, 0.28]} />
          <meshStandardMaterial color="#7a2a24" roughness={0.8} />
        </mesh>
      ) : (
        <group rotation={[0, 0.2, 0]}>
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[0, 0.012, sd * 0.135]} rotation={[-Math.PI / 2, 0, sd * 0.05]}>
              <planeGeometry args={[0.2, 0.26]} />
              <meshStandardMaterial map={page} roughness={0.9} side={THREE.DoubleSide} />
            </mesh>
          ))}
          <mesh position={[0, 0.004, 0]}>
            <boxGeometry args={[0.22, 0.008, 0.56]} />
            <meshStandardMaterial color="#7a2a24" roughness={0.8} />
          </mesh>
        </group>
      )}
      {state === 'glow' && (
        <mesh ref={glow} material={glowMat} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.18, 24]} />
        </mesh>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 傍晚：小翰在神明廳擲筊
// ---------------------------------------------------------------------------

function KneelingHan({ outline }: { outline: boolean }) {
  const on = useStore((s) => kneelBeat(s))
  if (!on) return null
  const y = HOME.floorAt(KNEEL.x, KNEEL.z)
  return (
    <group>
      <ChibiNpc id="xiaohan" pose="bow" position={[KNEEL.x, y, KNEEL.z]} heading={Math.PI} outline={outline} />
      {/* 地上的一對筊（紅色、半月形） */}
      {[
        [-0.14, 0.2],
        [0.12, -0.35],
      ].map(([dx, rot], i) => (
        <mesh key={i} position={[KNEEL.x + dx, y + 0.02, KNEEL.z - 0.5]} rotation={[-Math.PI / 2, 0, rot]} castShadow>
          <circleGeometry args={[0.07, 12, 0, Math.PI]} />
          <meshStandardMaterial color="#b3261e" roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 茶桌：多擺一副碗筷
// ---------------------------------------------------------------------------

function Bowl({ position, rice = true }: { position: [number, number, number]; rice?: boolean }) {
  const geo = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          [0, 0],
          [0.035, 0],
          [0.04, 0.008],
          [0.07, 0.045],
          [0.074, 0.06],
          [0.068, 0.06],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        18,
      ),
    [],
  )
  return (
    <group position={position}>
      <mesh geometry={geo} castShadow>
        <meshStandardMaterial color="#f3efe6" roughness={0.35} side={THREE.DoubleSide} />
      </mesh>
      {rice && (
        <mesh position={[0, 0.048, 0]} scale={[1, 0.45, 1]}>
          <sphereGeometry args={[0.062, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#fbfaf5" roughness={0.9} />
        </mesh>
      )}
      {/* 筷子橫放在碗上 */}
      <mesh position={[0, 0.075, 0.03]} rotation={[0, 0.3, Math.PI / 2]}>
        <cylinderGeometry args={[0.004, 0.005, 0.22, 5]} />
        <meshStandardMaterial color="#8a5a32" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.075, 0.045]} rotation={[0, 0.26, Math.PI / 2]}>
        <cylinderGeometry args={[0.004, 0.005, 0.22, 5]} />
        <meshStandardMaterial color="#8a5a32" roughness={0.7} />
      </mesh>
    </group>
  )
}

function BowlTable({ outline }: { outline: boolean }) {
  const scene = useStore((s) => (bowlBeat(s) ? 'scene' : s.phase === 'dusk' && s.flags.hs_bowl ? 'after' : null))
  const drive = useRef<Drive>(newDrive({ pose: 'eat', heading: BOWL_SEAT.heading }))
  const spec = SPECS.xiaohan
  if (!scene) return null
  const hers: [number, number, number] = [TEA.x - 0.26, TABLE_Y, TEA.z - 0.02]
  return (
    <group>
      <Bowl position={hers} />
      {scene === 'scene' && spec && (
        <>
          <Bowl position={[TEA.x + 0.22, TABLE_Y, TEA.z + 0.12]} />
          <group position={[BOWL_SEAT.x, YARD_Y + 0.42 - SEAT_Y * spec.scale + 0.03, BOWL_SEAT.z]} userData={{ noMerge: true }}>
            <Chibi spec={spec} drive={drive} legs={false} outline={outline} />
          </group>
        </>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 小翰房門口的收音機
// ---------------------------------------------------------------------------

function noteTexture() {
  return canvasTexture(
    64,
    64,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#fff2c8'
      ctx.shadowColor = '#ffcf6a'
      ctx.shadowBlur = 8
      ctx.font = `700 46px ${FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('♪', w / 2, h / 2)
    },
    [],
  )
}

function Radio() {
  const y = HOME.floorAt(RADIO.x, RADIO.z)
  const tex = useMemo(() => noteTexture(), [])
  const notes = useRef<(THREE.Sprite | null)[]>([])
  const dial = useRef<THREE.MeshStandardMaterial>(null)
  const played = useRef(0)
  const stop = useRef<(() => void) | null>(null)
  useEffect(() => () => stop.current?.(), [])
  useFrame(({ clock }) => {
    // 收音機剛轉開：放歌
    if (hanFx.radioAt && hanFx.radioAt !== played.current) {
      played.current = hanFx.radioAt
      stop.current?.()
      stop.current = playRadioSong()
    }
    const since = (performance.now() - hanFx.radioAt) / 1000
    const on = hanFx.radioAt > 0 && since < RADIO_SONG_SEC
    if (dial.current) dial.current.emissiveIntensity = on ? 1.4 : 0.15
    const t = clock.elapsedTime
    notes.current.forEach((sp, i) => {
      if (!sp) return
      sp.visible = on
      if (!on) return
      const p = (t * 0.35 + i / 3) % 1
      sp.position.set(RADIO.x + Math.sin(t * 1.3 + i * 2) * 0.18 + (i - 1) * 0.12, y + 0.75 + p * 1.1, RADIO.z)
      sp.material.opacity = Math.sin(p * Math.PI) * 0.95
    })
  })
  return (
    <group>
      <group position={[RADIO.x, y, RADIO.z]}>
        {/* 矮凳 */}
        <mesh position={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[0.34, 0.04, 0.26]} />
          <meshStandardMaterial color="#8a5a32" roughness={0.8} />
        </mesh>
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([a, b], i) => (
          <mesh key={i} position={[a * 0.14, 0.09, b * 0.1]}>
            <boxGeometry args={[0.03, 0.18, 0.03]} />
            <meshStandardMaterial color="#6b4426" roughness={0.8} />
          </mesh>
        ))}
        {/* 木殼真空管收音機 */}
        <group position={[0, 0.3, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.28, 0.16, 0.13]} />
            <meshStandardMaterial color="#5b3a22" roughness={0.55} />
          </mesh>
          {/* 喇叭布（朝南、朝鏡頭） */}
          <mesh position={[-0.05, 0, 0.066]}>
            <planeGeometry args={[0.14, 0.11]} />
            <meshStandardMaterial color="#d8c8a0" roughness={1} />
          </mesh>
          {/* 刻度盤：轉開會亮 */}
          <mesh position={[0.08, 0.02, 0.066]}>
            <planeGeometry args={[0.08, 0.05]} />
            <meshStandardMaterial ref={dial} color="#f0d890" emissive="#ffb84a" emissiveIntensity={0.15} roughness={0.6} />
          </mesh>
          <mesh position={[0.08, -0.045, 0.07]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 0.014, 10]} />
            <meshStandardMaterial color="#2a1a10" roughness={0.5} />
          </mesh>
        </group>
      </group>
      {[0, 1, 2].map((i) => (
        <sprite
          key={i}
          ref={(el) => {
            notes.current[i] = el
          }}
          scale={[0.22, 0.22, 0.22]}
          visible={false}
          renderOrder={3}
        >
          <spriteMaterial map={tex} transparent depthWrite={false} />
        </sprite>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 煎菜脯蛋那天：灶腳冒煙
// ---------------------------------------------------------------------------

function KitchenSmoke() {
  const puffs = useRef<(THREE.Mesh | null)[]>([])
  const grp = useRef<THREE.Group>(null)
  const mats = useMemo(() => Array.from({ length: 6 }, () => new THREE.MeshBasicMaterial({ color: '#e8e4dc', transparent: true, opacity: 0, depthWrite: false })), [])
  useFrame(({ clock }) => {
    const s = useStore.getState()
    const on = s.phase === 'dusk' && hanFx.smokeNight === s.meta.night
    if (grp.current) grp.current.visible = on
    if (!on) return
    const t = clock.elapsedTime
    puffs.current.forEach((m, i) => {
      if (!m) return
      const p = (t * 0.18 + i / 6) % 1
      m.position.set(STOVE.x + Math.sin(t * 0.7 + i) * 0.25 * p, 3.7 + p * 2.6, STOVE.z + Math.cos(t * 0.5 + i) * 0.15 * p)
      m.scale.setScalar(0.18 + p * 0.55)
      mats[i].opacity = Math.sin(p * Math.PI) * 0.5
    })
  })
  return (
    <group ref={grp} visible={false}>
      {mats.map((mat, i) => (
        <mesh
          key={i}
          material={mat}
          ref={(el) => {
            puffs.current[i] = el
          }}
        >
          <sphereGeometry args={[1, 10, 8]} />
        </mesh>
      ))}
    </group>
  )
}

