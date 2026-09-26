import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { VILLAGE } from '../world/sceneVillage'
import { BRUSH_FONT, WBox, canvasTexture, seeded, useMats } from './kit'

// 柑仔店裡（DESIGN §30）：阿嬤可以走進去。後牆的貨架（右邊留後門，掛花布門簾通阿嬌家）、兩側貨架、
// 米桶、醬油米酒、糖果玻璃櫃、磅秤、王子麵紙箱、角落架子上的黑白電視（傍晚演布袋戲，半夜收播只剩雪花）。
// 規則與座標在 src/world/sceneVillage.ts（VILLAGE.shopIn）；會動的東西（電視）另外畫，不合併。

const V = VILLAGE
const S = V.shop
const I = V.shopIn
/** 店裡的地板比路高一階 */
const FY = 0.14

/** 小紙盒上的字（王子麵、蚊香、肥皂……） */
function labelTexture(text: string, bg: string, fg: string, sub = '') {
  return canvasTexture(
    128,
    96,
    (ctx, w, h) => {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = fg
      ctx.lineWidth = 4
      ctx.strokeRect(5, 5, w - 10, h - 10)
      ctx.fillStyle = fg
      ctx.font = `700 ${text.length > 2 ? 34 : 44}px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, w / 2, sub ? h / 2 - 8 : h / 2 + 2)
      if (sub) {
        ctx.font = `500 16px ${BRUSH_FONT}`
        ctx.fillText(sub, w / 2, h - 18)
      }
    },
    [{ spec: `700 44px ${BRUSH_FONT}`, text: text + sub }],
  )
}

/** 花布門簾（紅底白花） */
function curtainTexture() {
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b8323a'
    ctx.fillRect(0, 0, w, h)
    const r = seeded(77)
    for (let i = 0; i < 26; i++) {
      const x = r() * w
      const y = r() * h
      ctx.fillStyle = i % 3 ? '#f4efe2' : '#f2c230'
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2
        ctx.beginPath()
        ctx.arc(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 4.5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#3e9a52'
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}

/** 月曆（公賣局的，大大的月份） */
function calendarTexture() {
  return canvasTexture(
    128,
    176,
    (ctx, w, h) => {
      ctx.fillStyle = '#f7f2e6'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#c0332a'
      ctx.fillRect(0, 0, w, 40)
      ctx.fillStyle = '#fff6e2'
      ctx.font = `700 24px ${BRUSH_FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('公賣局', w / 2, 21)
      ctx.fillStyle = '#2a2a2a'
      ctx.font = `700 56px ${BRUSH_FONT}`
      ctx.fillText('九月', w / 2, 76)
      ctx.font = '500 11px sans-serif'
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 7; c++) {
          const n = r * 7 + c + 1
          if (n > 30) continue
          ctx.fillStyle = c === 0 ? '#c0332a' : '#3a3a3a'
          ctx.fillText(String(n), 12 + c * 17, 112 + r * 13)
        }
    },
    [{ spec: `700 56px ${BRUSH_FONT}`, text: '公賣局九月' }],
  )
}

/** 靜態的擺設（合併） */
export function ShopInterior() {
  const mats = useMats()
  const goods = useMemo(() => {
    const r = seeded(2024)
    const COLORS = ['#d8342b', '#f2c230', '#2e6fb5', '#3e9a52', '#f4efe2', '#e87a2a', '#8a4fb5', '#e05a8a']
    const items: { p: [number, number, number]; s: [number, number, number]; c: string }[] = []
    const row = (u0: number, u1: number, w0: number, y: number, along: 'x' | 'z') => {
      let u = u0
      while (u < u1 - 0.12) {
        const w = 0.1 + r() * 0.18
        const h = 0.12 + r() * 0.24
        const d = 0.12 + r() * 0.16
        const c = COLORS[Math.floor(r() * COLORS.length)]
        const p: [number, number, number] = along === 'x' ? [u + w / 2, y + h / 2, w0] : [w0, y + h / 2, u + w / 2]
        items.push({ p, s: along === 'x' ? [w, h, d] : [d, h, w], c })
        u += w + 0.02
      }
    }
    for (const y of [0.62, 1.22, 1.82]) {
      row(S.x0 + 0.4, 1.55, S.z0 + 0.4, y, 'x')
      row(S.z0 + 0.8, S.z1 - 0.8, S.x0 + 0.42, y, 'z')
      row(S.z0 + 0.8, S.z1 - 0.8, S.x1 - 0.42, y, 'z')
    }
    return items
  }, [])
  const goodMats = useMemo(() => {
    const m = new Map<string, THREE.MeshStandardMaterial>()
    for (const g of goods) if (!m.has(g.c)) m.set(g.c, new THREE.MeshStandardMaterial({ color: g.c, roughness: 0.6 }))
    return m
  }, [goods])
  const labels = useMemo(
    () => ({
      noodle: new THREE.MeshStandardMaterial({ map: labelTexture('王子麵', '#f2c230', '#c0332a', '一箱三十包'), roughness: 0.8 }),
      coil: new THREE.MeshStandardMaterial({ map: labelTexture('蚊香', '#3e9a52', '#fff6e2', '十捲裝'), roughness: 0.7 }),
      soap: new THREE.MeshStandardMaterial({ map: labelTexture('肥皂', '#f4efe2', '#2e6fb5'), roughness: 0.6 }),
      rice: new THREE.MeshStandardMaterial({ map: labelTexture('米酒', '#f4efe2', '#c0332a'), roughness: 0.4 }),
      soy: new THREE.MeshStandardMaterial({ map: labelTexture('醬油', '#e9c46a', '#3a1a10'), roughness: 0.4 }),
      calendar: new THREE.MeshStandardMaterial({ map: calendarTexture(), roughness: 0.9 }),
      fortune: new THREE.MeshStandardMaterial({ map: labelTexture('生意興隆', '#c0332a', '#f4d27a'), roughness: 0.8 }),
      curtain: new THREE.MeshStandardMaterial({ map: curtainTexture(), roughness: 0.9, side: THREE.DoubleSide }),
    }),
    [],
  )
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#dfeff2', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.25, depthWrite: false }), [])
  const soyGlass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a1a10', roughness: 0.15 }), [])
  const riceGlass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#cfe3d4', roughness: 0.1, transparent: true, opacity: 0.7 }), [])
  const riceMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f1ece0', roughness: 0.95 }), [])
  const candyMats = useMemo(() => ['#e8423a', '#f2c230', '#58b36a', '#f08a2a', '#e46aa4', '#8fd3ff'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35 })), [])
  const backW = 1.65 - (S.x0 + 0.4)
  const backC = (1.65 + S.x0 + 0.4) / 2
  const C = I.candy
  return (
    <group>
      {/* 後牆的貨架（右邊留給後門）、兩側貨架 */}
      {[0.6, 1.2, 1.8, 2.4].map((y) => (
        <group key={y}>
          <WBox mat="darkWood" size={[backW, 0.04, 0.5]} position={[backC, FY + y - 0.14, S.z0 + 0.42]} castShadow={false} />
          {[S.x0 + 0.42, S.x1 - 0.42].map((x) => (
            <WBox key={x} mat="darkWood" size={[0.5, 0.04, S.z1 - S.z0 - 1.4]} position={[x, FY + y - 0.14, (S.z0 + S.z1) / 2]} castShadow={false} />
          ))}
        </group>
      ))}
      <WBox mat="darkWood" size={[0.05, 2.3, 0.5]} position={[1.65, FY + 1.15, S.z0 + 0.42]} castShadow={false} />
      {goods.map((g, i) => (
        <mesh key={i} material={goodMats.get(g.c)} position={[g.p[0], g.p[1], g.p[2]]}>
          <boxGeometry args={g.s} />
        </mesh>
      ))}
      {/* 側邊貨架前面掛一排蚊香、肥皂（有字的盒子） */}
      {[-7.9, -7.35, -6.8].map((z) => (
        <mesh key={z} material={labels.coil} position={[S.x0 + 0.7, FY + 0.95, z]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.36, 0.27]} />
        </mesh>
      ))}
      {[-6.1, -5.6].map((z) => (
        <mesh key={z} material={labels.soap} position={[S.x0 + 0.7, FY + 1.55, z]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.3, 0.22]} />
        </mesh>
      ))}
      {/* 後門：花布門簾（兩片），後面是阿嬌家暗暗的灶腳 */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={labels.curtain} position={[I.backDoor.x + s * 0.235, FY + 1.25, S.z0 + 0.17]} rotation={[0.02 * s, 0, 0]}>
          <planeGeometry args={[0.44, 1.5]} />
        </mesh>
      ))}
      <WBox mat="darkWood" size={[I.backDoor.w + 0.1, 0.05, 0.05]} position={[I.backDoor.x, FY + 2.02, S.z0 + 0.17]} castShadow={false} />
      <mesh position={[I.backDoor.x, 1.1, S.z0 - 0.2]}>
        <planeGeometry args={[I.backDoor.w + 0.2, 2.3]} />
        <meshBasicMaterial color="#1c140e" />
      </mesh>
      {/* 後牆上：月曆、「生意興隆」紅紙 */}
      <mesh material={labels.calendar} position={[-0.6, FY + 2.95, S.z0 + 0.16]}>
        <planeGeometry args={[0.46, 0.63]} />
      </mesh>
      <mesh material={labels.fortune} position={[0.6, FY + 2.95, S.z0 + 0.16]}>
        <planeGeometry args={[0.7, 0.5]} />
      </mesh>
      {/* 米桶（木桶，上面一個量米的升斗） */}
      <group position={[I.rice.x, FY, I.rice.z]}>
        <mesh material={mats.wood} position={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.27, 0.6, 16]} />
        </mesh>
        {[0.1, 0.5].map((y) => (
          <mesh key={y} material={mats.metal} position={[0, y, 0]}>
            <torusGeometry args={[0.29, 0.012, 4, 20]} />
          </mesh>
        ))}
        <mesh material={riceMat} position={[0, 0.58, 0]} scale={[1, 0.25, 1]}>
          <sphereGeometry args={[0.27, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <WBox mat="wood" size={[0.16, 0.08, 0.16]} position={[0.08, 0.66, 0.05]} rotation={[0, 0.4, 0.2]} />
      </group>
      {/* 醬油、米酒：矮木架上一箱一箱 */}
      <group position={[I.bottles.x, FY, I.bottles.z]}>
        <WBox mat="wood" size={[1.0, 0.05, 0.5]} position={[0, 0.3, 0]} />
        {[-0.45, 0.45].map((x) => (
          <WBox key={x} mat="wood" size={[0.05, 0.3, 0.45]} position={[x, 0.15, 0]} />
        ))}
        {Array.from({ length: 10 }, (_, i) => {
          const soy = i < 6
          const x = -0.4 + (i % 5) * 0.2
          const z = i < 5 ? -0.1 : 0.1
          return (
            <group key={i} position={[x, 0.33, z]}>
              <mesh material={soy ? soyGlass : riceGlass} position={[0, 0.14, 0]} castShadow>
                <cylinderGeometry args={[0.045, 0.05, 0.28, 10]} />
              </mesh>
              <mesh material={soy ? soyGlass : riceGlass} position={[0, 0.31, 0]}>
                <cylinderGeometry args={[0.016, 0.03, 0.08, 8]} />
              </mesh>
              {z > 0 && (
                <mesh material={soy ? labels.soy : labels.rice} position={[0, 0.13, 0.052]}>
                  <planeGeometry args={[0.08, 0.07]} />
                </mesh>
              )}
            </group>
          )
        })}
      </group>
      {/* 糖果玻璃櫃：木頭底座＋玻璃櫃（裡面一格一格的糖）＋上面一排糖果罐 */}
      <group position={[C.x, FY, C.z]}>
        <WBox mat="darkWood" size={[C.w, 0.5, C.d]} position={[0, 0.25, 0]} />
        <mesh material={glass} position={[0, 0.72, 0]}>
          <boxGeometry args={[C.w - 0.04, 0.44, C.d - 0.04]} />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} material={candyMats[i % candyMats.length]} position={[-0.52 + (i % 4) * 0.35, 0.56 + Math.floor(i / 4) * 0.2, 0]}>
            <boxGeometry args={[0.28, 0.1, 0.4]} />
          </mesh>
        ))}
        <WBox mat="wood" size={[C.w + 0.06, 0.04, C.d + 0.06]} position={[0, 0.96, 0]} />
        {Array.from({ length: 5 }, (_, i) => (
          <group key={i} position={[-0.5 + i * 0.25, 0.98, 0]}>
            <mesh material={candyMats[(i + 2) % candyMats.length]} position={[0, 0.08, 0]}>
              <cylinderGeometry args={[0.07, 0.07, 0.14, 12]} />
            </mesh>
            <mesh material={glass} position={[0, 0.11, 0]}>
              <cylinderGeometry args={[0.09, 0.09, 0.22, 14]} />
            </mesh>
            <mesh material={mats.redPaint} position={[0, 0.235, 0]}>
              <cylinderGeometry args={[0.065, 0.075, 0.04, 12]} />
            </mesh>
          </group>
        ))}
      </group>
      {/* 磅秤：鐵板＋柱子＋圓錶面 */}
      <group position={[I.scale.x, FY, I.scale.z]} rotation={[0, 0.5, 0]}>
        <mesh material={mats.metal} position={[0, 0.05, 0]} castShadow>
          <boxGeometry args={[0.5, 0.1, 0.4]} />
        </mesh>
        <mesh material={mats.metal} position={[0, 0.45, -0.17]}>
          <boxGeometry args={[0.08, 0.7, 0.06]} />
        </mesh>
        <mesh material={mats.metal} position={[0, 0.85, -0.17]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.06, 20]} />
        </mesh>
        <mesh position={[0, 0.85, -0.135]}>
          <circleGeometry args={[0.12, 20]} />
          <meshStandardMaterial color="#f7f2e6" roughness={0.4} />
        </mesh>
      </group>
      {/* 王子麵的紙箱（疊三箱） */}
      <group position={[I.noodles.x, FY, I.noodles.z]}>
        {[0, 1, 2].map((k) => (
          <group key={k} position={[k === 2 ? 0.04 : 0, 0.17 + k * 0.33, 0]} rotation={[0, k === 1 ? 0.08 : -0.05, 0]}>
            <mesh position={[0, 0, 0]} castShadow>
              <boxGeometry args={[0.62, 0.32, 0.5]} />
              <meshStandardMaterial color="#c9a36a" roughness={0.9} />
            </mesh>
            <mesh material={labels.noodle} position={[0, 0, 0.252]}>
              <planeGeometry args={[0.36, 0.26]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 黑白電視：畫面用小 canvas 每秒畫幾次（傍晚布袋戲的剪影，半夜收播的雪花）
// ---------------------------------------------------------------------------

export function ShopTV() {
  const mats = useMats()
  const { tex, draw } = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 96
    c.height = 72
    const ctx = c.getContext('2d')!
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.magFilter = THREE.NearestFilter
    const draw = (time: number, night: boolean) => {
      const w = c.width
      const h = c.height
      if (night) {
        const img = ctx.createImageData(w, h)
        for (let i = 0; i < img.data.length; i += 4) {
          const v = Math.random() * 200 + 30
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v
          img.data[i + 3] = 255
        }
        ctx.putImageData(img, 0, 0)
      } else {
        // 布袋戲：兩個戲偶的剪影在布景前面打來打去
        const g = ctx.createLinearGradient(0, 0, 0, h)
        g.addColorStop(0, '#9a9a9a')
        g.addColorStop(1, '#5a5a5a')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = '#3a3a3a'
        ctx.fillRect(0, h * 0.72, w, h)
        const a = Math.sin(time * 2.2)
        const b = Math.sin(time * 1.7 + 1)
        for (const [x, s] of [
          [w * 0.32 + a * 8, 1],
          [w * 0.66 + b * 8, -1],
        ] as [number, number][]) {
          const y = h * 0.44 + Math.abs(Math.sin(time * 5 + x)) * -5
          ctx.fillStyle = '#1e1e1e'
          ctx.beginPath()
          ctx.arc(x, y - 12, 7, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillRect(x - 8, y - 5, 16, 24)
          ctx.fillRect(x + s * 6, y - 2 + Math.sin(time * 9) * 3, s * 12, 3)
          ctx.fillStyle = '#d8d8d8'
          ctx.fillRect(x - 9, y - 22, 18, 4)
        }
        // 掃描線
        ctx.fillStyle = 'rgba(0,0,0,0.18)'
        for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1)
      }
      t.needsUpdate = true
    }
    return { tex: t, draw }
  }, [])
  const screen = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: '#d8d8d8' }), [tex])
  const acc = useRef(0)
  useFrame(({ clock }, dt) => {
    acc.current += dt
    if (acc.current < 0.12) return
    acc.current = 0
    const s = useStore.getState()
    if (s.scene !== 'village') return
    draw(clock.elapsedTime, s.phase === 'night')
  })
  const I2 = I.tv
  return (
    <group position={[I2.x + 0.05, FY + I2.y, I2.z + 0.05]} rotation={[0, 0.72, 0]} userData={{ noMerge: true }}>
      {/* 木頭外殼、螢幕、旋鈕、兔耳天線 */}
      <mesh material={mats.darkWood} castShadow>
        <boxGeometry args={[0.56, 0.44, 0.42]} />
      </mesh>
      <mesh material={screen} position={[-0.06, 0.01, 0.212]}>
        <planeGeometry args={[0.36, 0.28]} />
      </mesh>
      {[0.08, -0.06].map((y) => (
        <mesh key={y} material={mats.metal} position={[0.2, y, 0.215]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.02, 10]} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} material={mats.metal} position={[s * 0.08, 0.36, -0.05]} rotation={[0, 0, s * -0.45]}>
          <cylinderGeometry args={[0.006, 0.006, 0.32, 4]} />
        </mesh>
      ))}
    </group>
  )
}
