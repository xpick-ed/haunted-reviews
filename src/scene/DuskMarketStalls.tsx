import { useMemo } from 'react'
import * as THREE from 'three'
import { DMARKET } from '../world/sceneDuskMarket'
import { BRUSH_FONT, WBox, canvasTexture, seeded } from './kit'
import { corrugatedTexture } from './VillageKit'

// 黃昏市場的攤子（DESIGN §32.1）：北邊一排浪板屋頂的攤子（雜貨、豬肉、魚、粿）、南邊一排矮的（菜攤、豆花車、阿葉嬸的空位）、北邊的牌樓。
// 不會動的東西都交給外面的 <MergeStatic> 合併；屋頂另外包在 <Fader> 裡（擋到鏡頭會淡掉）。

const M = DMARKET
const N = M.north
type NorthStall = keyof typeof M.stalls

// ---------------------------------------------------------------------------
// 共用的材質（整個市場只建一次）
// ---------------------------------------------------------------------------

const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra })
const MAT = {
  pipe: mat('#6a7a80', { metalness: 0.5, roughness: 0.45 }),
  pork: mat('#e89a98', { roughness: 0.55 }),
  fat: mat('#f6ece0', { roughness: 0.5 }),
  ice: mat('#eef4f6', { roughness: 0.25 }),
  fish: mat('#b8c4cc', { metalness: 0.45, roughness: 0.3 }),
  fishBack: mat('#4a5a6a', { metalness: 0.3, roughness: 0.4 }),
  clam: mat('#b8aa96', { roughness: 0.6 }),
  redBasin: mat('#c8323a', { roughness: 0.4 }),
  blueBasin: mat('#2f6ab0', { roughness: 0.4 }),
  foam: mat('#f4f4f0', { roughness: 0.9 }),
  bambooTray: mat('#c8a468', { roughness: 0.85 }),
  leaf: mat('#3f8a3a', { roughness: 0.7, side: THREE.DoubleSide }),
  redGuo: mat('#d8363a', { roughness: 0.5 }),
  bowl: mat('#f2efe6', { roughness: 0.35 }),
  soy: mat('#3a2010', { roughness: 0.3 }),
  wine: mat('#7aa888', { roughness: 0.2, transparent: true, opacity: 0.85 }),
  label: mat('#e8d8a8'),
  sack: mat('#c8b48a', { roughness: 1 }),
  rice: mat('#f6f2e6', { roughness: 0.9 }),
  cabbage: mat('#b6d68a', { roughness: 0.8, flatShading: true }),
  greens: mat('#3f8a3a', { roughness: 0.8 }),
  tomato: mat('#d8382e', { roughness: 0.45 }),
  gourd: mat('#9ac86a', { roughness: 0.6 }),
  string: mat('#c8323a'),
  tarp: mat('#2f6ab8', { roughness: 0.7, side: THREE.DoubleSide }),
  greenTarp: mat('#3a7a5a', { roughness: 0.8 }),
  card: mat('#faf6ea', { side: THREE.DoubleSide }),
  orange: mat('#f08a1e', { roughness: 0.5 }),
  can: mat('#8a8a86', { metalness: 0.5, roughness: 0.4 }),
  incense: mat('#b8322a'),
  wheel: mat('#2a2a2a', { roughness: 0.6 }),
  cart: mat('#6a8aa0', { roughness: 0.6 }),
  bucket: mat('#b8905a', { roughness: 0.7 }),
  band: mat('#5a5a5a', { metalness: 0.5 }),
  cleaver: mat('#9aa4a8', { metalness: 0.7, roughness: 0.3 }),
  scale: mat('#c8323a', { roughness: 0.4 }),
  hose: mat('#3a8a4a', { roughness: 0.5 }),
}

/** 手寫的招牌 */
function boardTexture(text: string, bg: string, fg: string, sub = '') {
  const spec = `700 84px ${BRUSH_FONT}`
  return canvasTexture(
    512,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)
      const r = seeded(text.length * 131)
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(255,250,235,${r() * 0.06})`
        ctx.fillRect(r() * w, r() * h, 20 + r() * 80, 3 + r() * 10)
      }
      ctx.strokeStyle = fg
      ctx.lineWidth = 5
      ctx.strokeRect(8, 8, w - 16, h - 16)
      ctx.fillStyle = fg
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const size = Math.min(84, (w - 60) / Math.max(1, text.length))
      ctx.font = `700 ${size}px ${BRUSH_FONT}`
      ctx.fillText(text, w / 2, h / 2 + (sub ? -10 : 4))
      if (sub) {
        ctx.font = `500 26px ${BRUSH_FONT}`
        ctx.fillText(sub, w / 2, h - 24)
      }
    },
    [{ spec, text: text + sub }],
  )
}

const SIGN: Record<NorthStall, { bg: string; fg: string; sub: string; tin: string }> = {
  zahuo: { bg: '#f2ead2', fg: '#1e4a7a', sub: '米・醬油・南北貨', tin: '#8a9a9c' },
  pork: { bg: '#c8323a', fg: '#fff4e0', sub: '溫體豬・現切', tin: '#9aa6a8' },
  fish: { bg: '#1e5a8a', fg: '#f4f8ff', sub: '虱目魚・蛤仔・每日鮮', tin: '#86a0a4' },
  guo: { bg: '#f4e6c8', fg: '#b82a2a', sub: '紅龜粿・碗粿・菜頭粿', tin: '#a0a098' },
}

// ---------------------------------------------------------------------------
// 北邊的攤子：後牆、柱子、櫃台（屋頂另外畫）
// ---------------------------------------------------------------------------

function useTin(color: string, w: number) {
  return useMemo(() => {
    const t = corrugatedTexture(color, 0.35).clone()
    t.needsUpdate = true
    t.repeat.set(w / 1.2, 1)
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.35, side: THREE.DoubleSide })
  }, [color, w])
}

function StallFrame({ id }: { id: NorthStall }) {
  const st = M.stalls[id]
  const w = st.x1 - st.x0
  const cx = (st.x0 + st.x1) / 2
  const tin = useTin(SIGN[id].tin, w)
  const tiled = id === 'pork' || id === 'fish'
  const cz = N.front - 0.35
  return (
    <group>
      {/* 後牆（浪板） */}
      <mesh material={tin} position={[cx, N.backY / 2, N.back]} castShadow receiveShadow>
        <boxGeometry args={[w, N.backY, 0.06]} />
      </mesh>
      {/* 前面兩根鐵管柱子 */}
      {[st.x0 + 0.1, st.x1 - 0.1].map((x) => (
        <mesh key={x} material={MAT.pipe} position={[x, N.roofY / 2, N.roofFront + 0.1]} castShadow>
          <cylinderGeometry args={[0.045, 0.045, N.roofY, 8]} />
        </mesh>
      ))}
      {/* 櫃台：木頭台子，豬肉、魚攤貼白磁磚 */}
      <WBox mat="darkWood" size={[w - 0.5, 0.8, 0.7]} position={[cx, 0.4, cz]} />
      <WBox mat={tiled ? 'tile' : 'wood'} size={[w - 0.4, 0.06, 0.78]} position={[cx, 0.83, cz]} />
    </group>
  )
}

/** 浪板屋頂＋招牌＋吊燈泡的電線（擋鏡頭時淡掉，由外面包 Fader） */
export function StallRoof({ id }: { id: NorthStall }) {
  const st = M.stalls[id]
  const w = st.x1 - st.x0 + 0.1
  const cx = (st.x0 + st.x1) / 2
  const tin = useTin(SIGN[id].tin, w)
  const sign = useMemo(() => boardTexture(st.name, SIGN[id].bg, SIGN[id].fg, SIGN[id].sub), [id, st.name])
  const z0 = N.back - 0.15
  const z1 = N.roofFront
  const len = Math.hypot(z1 - z0, N.backY - N.roofY)
  const tilt = Math.atan2(N.backY - N.roofY, z1 - z0)
  return (
    <group>
      <mesh material={tin} position={[cx, (N.backY + N.roofY) / 2 + 0.03, (z0 + z1) / 2]} rotation={[tilt, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.03, len]} />
      </mesh>
      {/* 招牌：立在屋簷前緣上面，面向走道（掛在屋簷下會擋住櫃台後面的攤販） */}
      <mesh position={[cx, N.roofY + 0.38, z1 + 0.02]}>
        <planeGeometry args={[Math.min(3.2, w - 0.6), 0.8]} />
        <meshStandardMaterial map={sign} roughness={0.8} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 各攤的貨
// ---------------------------------------------------------------------------

function Zahuo() {
  const st = M.stalls.zahuo
  const cx = (st.x0 + st.x1) / 2
  const r = seeded(211)
  const bottles: { x: number; y: number; wine: boolean }[] = []
  for (const y of [0.95, 1.55, 2.15]) for (let i = 0; i < 14; i++) bottles.push({ x: st.x0 + 0.5 + i * 0.28 + r() * 0.05, y, wine: r() < 0.35 })
  return (
    <group>
      {/* 後牆的木架子：醬油、米酒 */}
      {[0.9, 1.5, 2.1].map((y) => (
        <WBox key={y} mat="darkWood" size={[st.x1 - st.x0 - 0.6, 0.05, 0.36]} position={[cx, y - 0.02, N.back + 0.25]} />
      ))}
      {bottles.map((b, i) => (
        <group key={i} position={[b.x, b.y, N.back + 0.25]}>
          <mesh material={b.wine ? MAT.wine : MAT.soy} position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.055, 0.06, 0.28, 8]} />
          </mesh>
          <mesh material={MAT.label} position={[0, 0.12, 0.052]}>
            <boxGeometry args={[0.08, 0.1, 0.01]} />
          </mesh>
        </group>
      ))}
      {/* 米袋（麻布袋，開口捲下來）、櫃台上的米桶和磅秤 */}
      {[-0.8, 0.1].map((o, i) => (
        <group key={i} position={[cx + o, 0, N.back + 0.95]}>
          <mesh material={MAT.sack} position={[0, 0.36, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.33, 0.72, 10]} />
          </mesh>
          <mesh material={MAT.rice} position={[0, 0.73, 0]}>
            <cylinderGeometry args={[0.28, 0.28, 0.03, 10]} />
          </mesh>
        </group>
      ))}
      <group position={[cx - 1.2, 0.86, N.front - 0.35]}>
        <mesh material={MAT.bambooTray} position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.24, 0.2, 0.32, 12]} />
        </mesh>
        <mesh material={MAT.rice} position={[0, 0.33, 0]}>
          <sphereGeometry args={[0.22, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      </group>
      <group position={[cx + 1.1, 0.86, N.front - 0.35]}>
        <mesh material={MAT.scale} position={[0, 0.08, 0]}>
          <boxGeometry args={[0.32, 0.16, 0.26]} />
        </mesh>
        <mesh material={MAT.cleaver} position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.02, 14]} />
        </mesh>
      </group>
      {/* 櫃台上一排薑、一綑麵線 */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} material={MAT.bambooTray} position={[cx - 0.3 + i * 0.28, 0.9, N.front - 0.3]} rotation={[0, i * 0.7, 0]}>
          <dodecahedronGeometry args={[0.07, 0]} />
        </mesh>
      ))}
    </group>
  )
}

function Pork() {
  const st = M.stalls.pork
  const cx = (st.x0 + st.x1) / 2
  const top = 0.86
  const z = N.front - 0.38
  return (
    <group>
      {/* 砧板：一大塊樹頭 */}
      <mesh position={[cx + 0.9, top + 0.1, z]} castShadow>
        <cylinderGeometry args={[0.36, 0.38, 0.2, 14]} />
        <meshStandardMaterial color="#8a5a32" roughness={0.9} />
      </mesh>
      <mesh material={MAT.cleaver} position={[cx + 0.9, top + 0.24, z]} rotation={[0, 0.5, 0]}>
        <boxGeometry args={[0.3, 0.02, 0.14]} />
      </mesh>
      {/* 攤在台上的豬肉：三層肉（粉紅＋白色的油花）、排骨 */}
      {[-2.1, -1.5, -0.9, -0.3].map((o, i) => (
        <group key={o} position={[cx + o, top + 0.04, z + (i % 2) * 0.12 - 0.06]} rotation={[0, (i - 1.5) * 0.12, 0]}>
          <mesh material={MAT.pork}>
            <boxGeometry args={[0.46, 0.07, 0.3]} />
          </mesh>
          <mesh material={MAT.fat} position={[0, 0.045, 0]}>
            <boxGeometry args={[0.46, 0.02, 0.3]} />
          </mesh>
        </group>
      ))}
      {/* 屋簷下的鐵桿子（兩條鐵絲吊著），勾著一條一條的肉 */}
      <mesh material={MAT.pipe} position={[cx, 2.0, N.front - 0.15]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, st.x1 - st.x0 - 0.6, 6]} />
      </mesh>
      {[-1, 1].map((k) => (
        <mesh key={k} material={MAT.pipe} position={[cx + k * ((st.x1 - st.x0) / 2 - 0.4), (2.0 + N.roofY + 0.1) / 2, N.front - 0.15]}>
          <boxGeometry args={[0.01, N.roofY + 0.1 - 2.0, 0.01]} />
        </mesh>
      ))}
      {[-1.8, -1.1, -0.4, 0.3, 1.4].map((o, i) => (
        <group key={o} position={[cx + o, 2.0, N.front - 0.15]}>
          <mesh material={MAT.cleaver} position={[0, -0.08, 0]}>
            <torusGeometry args={[0.05, 0.008, 4, 8, Math.PI]} />
          </mesh>
          <mesh material={i % 2 ? MAT.pork : MAT.fat} position={[0, -0.36, 0]} rotation={[0, i, 0]}>
            <boxGeometry args={[0.14, 0.42, 0.1]} />
          </mesh>
        </group>
      ))}
      {/* 地上的紅色塑膠盆 */}
      <mesh material={MAT.redBasin} position={[st.x0 + 0.5, 0.12, N.back + 0.7]}>
        <cylinderGeometry args={[0.32, 0.26, 0.24, 14, 1, true]} />
      </mesh>
    </group>
  )
}

function Fish() {
  const st = M.stalls.fish
  const cx = (st.x0 + st.x1) / 2
  const top = 0.86
  const z = N.front - 0.38
  const fish = useMemo(() => {
    const out: { x: number; z: number; r: number }[] = []
    const r = seeded(509)
    for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) out.push({ x: cx - 1.9 + i * 0.42 + r() * 0.05, z: z - 0.15 + row * 0.26, r: (r() - 0.5) * 0.4 })
    return out
  }, [cx, z])
  const clams = useMemo(() => {
    const out: [number, number][] = []
    const r = seeded(77)
    for (let i = 0; i < 22; i++) {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * 0.26
      out.push([Math.cos(a) * d, Math.sin(a) * d])
    }
    return out
  }, [])
  return (
    <group>
      {/* 碎冰（有點往走道斜）上面排兩排虱目魚 */}
      <mesh material={MAT.ice} position={[cx - 0.6, top + 0.05, z]} rotation={[0.12, 0, 0]}>
        <boxGeometry args={[3.1, 0.1, 0.62]} />
      </mesh>
      {fish.map((f, i) => (
        <group key={i} position={[f.x, top + 0.13, f.z]} rotation={[0.12, f.r, 0]}>
          <mesh material={MAT.fish} scale={[0.19, 0.045, 0.06]}>
            <sphereGeometry args={[1, 10, 6]} />
          </mesh>
          <mesh material={MAT.fishBack} position={[0, 0.03, 0]} scale={[0.16, 0.02, 0.035]}>
            <sphereGeometry args={[1, 8, 4]} />
          </mesh>
          <mesh material={MAT.fish} position={[0.21, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.05, 0.08, 4]} />
          </mesh>
        </group>
      ))}
      {/* 櫃台右邊：藍色塑膠盆裝蛤仔 */}
      <group position={[cx + 1.7, top, z]}>
        <mesh material={MAT.blueBasin} position={[0, 0.09, 0]}>
          <cylinderGeometry args={[0.32, 0.26, 0.18, 14, 1, true]} />
        </mesh>
        {clams.map(([x, zz], i) => (
          <mesh key={i} material={MAT.clam} position={[x, 0.15 + (i % 3) * 0.015, zz]} scale={[0.05, 0.025, 0.04]}>
            <sphereGeometry args={[1, 6, 4]} />
          </mesh>
        ))}
      </group>
      {/* 後面疊起來的保麗龍箱、捲起來的水管 */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} material={MAT.foam} position={[st.x1 - 0.8, 0.2 + i * 0.36, N.back + 0.45]} castShadow>
          <boxGeometry args={[0.7, 0.34, 0.5]} />
        </mesh>
      ))}
      <mesh material={MAT.hose} position={[st.x0 + 0.7, 0.05, N.back + 0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.28, 0.03, 6, 18]} />
      </mesh>
    </group>
  )
}

function Guo() {
  const st = M.stalls.guo
  const cx = (st.x0 + st.x1) / 2
  const top = 0.86
  const z = N.front - 0.38
  return (
    <group>
      {/* 三個竹篩：香蕉葉上的紅龜粿 */}
      {[-1.3, -0.35, 0.6].map((o, i) => (
        <group key={o} position={[cx + o, top, z]}>
          <mesh material={MAT.bambooTray} position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.4, 0.4, 0.05, 16]} />
          </mesh>
          {[0, 1, 2, 3].map((k) => {
            const a = (k / 4) * Math.PI * 2 + i
            return (
              <group key={k} position={[Math.cos(a) * 0.2, 0.07, Math.sin(a) * 0.2]}>
                <mesh material={MAT.leaf} rotation={[-Math.PI / 2, 0, a]}>
                  <circleGeometry args={[0.12, 10]} />
                </mesh>
                <mesh material={MAT.redGuo} position={[0, 0.03, 0]} scale={[0.11, 0.035, 0.085]}>
                  <sphereGeometry args={[1, 12, 6]} />
                </mesh>
              </group>
            )
          })}
        </group>
      ))}
      {/* 碗粿：一排白碗 */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i} position={[cx + 1.35 + (i % 2) * 0.22, top + 0.05, z - 0.15 + Math.floor(i / 2) * 0.26]}>
          <mesh material={MAT.bowl}>
            <cylinderGeometry args={[0.1, 0.06, 0.08, 12]} />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.092, 0.092, 0.01, 12]} />
            <meshStandardMaterial color="#b8864a" roughness={0.6} />
          </mesh>
        </group>
      ))}
      {/* 後面一疊竹蒸籠 */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} material={MAT.bambooTray} position={[st.x1 - 0.9, 0.5 + i * 0.24, N.back + 0.55]} castShadow>
          <cylinderGeometry args={[0.36, 0.36, 0.22, 16]} />
        </mesh>
      ))}
      <mesh position={[st.x1 - 0.9, 0.2, N.back + 0.55]}>
        <cylinderGeometry args={[0.4, 0.42, 0.4, 16]} />
        <meshStandardMaterial color="#5a5a5a" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// 南邊一排（矮的）：菜攤、豆花車、阿葉嬸的空位
// ---------------------------------------------------------------------------

function VegStall() {
  const v = M.veg
  const top = 0.34
  const baskets = [-2.0, -0.7, 0.6, 1.9]
  const r = seeded(4242)
  return (
    <group position={[v.x, 0, v.z]}>
      {/* 矮木台＋綠色帆布 */}
      <WBox mat="wood" size={[v.w, top - 0.02, v.d]} position={[0, (top - 0.02) / 2, 0]} />
      <mesh material={MAT.greenTarp} position={[0, top, 0]}>
        <boxGeometry args={[v.w + 0.1, 0.02, v.d + 0.1]} />
      </mesh>
      {/* 竹籃：高麗菜、番茄、苦瓜 */}
      {baskets.map((x, i) => (
        <group key={x} position={[x, top, (i % 2) * 0.2 - 0.1]}>
          <mesh material={MAT.bambooTray} position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.34, 0.28, 0.2, 14, 1, true]} />
          </mesh>
          {i === 0 || i === 3
            ? [0, 1, 2, 3].map((k) => (
                <mesh key={k} material={MAT.cabbage} position={[Math.cos(k * 1.7) * 0.14, 0.2 + (k === 3 ? 0.12 : 0), Math.sin(k * 1.7) * 0.14]} scale={[1, 0.85, 1]}>
                  <icosahedronGeometry args={[0.15, 1]} />
                </mesh>
              ))
            : i === 1
              ? Array.from({ length: 12 }, (_, k) => (
                  <mesh key={k} material={MAT.tomato} position={[(r() - 0.5) * 0.4, 0.2 + r() * 0.06, (r() - 0.5) * 0.4]}>
                    <sphereGeometry args={[0.065, 8, 6]} />
                  </mesh>
                ))
              : [0, 1, 2, 3, 4].map((k) => (
                  <mesh key={k} material={MAT.gourd} position={[(k - 2) * 0.1, 0.2, 0]} rotation={[Math.PI / 2, 0, (k - 2) * 0.2]} scale={[1, 1.9, 1]}>
                    <sphereGeometry args={[0.06, 8, 6]} />
                  </mesh>
                ))}
          {/* 價錢牌 */}
          <mesh material={MAT.card} position={[0, 0.45, -0.28]}>
            <planeGeometry args={[0.18, 0.12]} />
          </mesh>
          <mesh material={MAT.pipe} position={[0, 0.3, -0.28]}>
            <boxGeometry args={[0.01, 0.3, 0.01]} />
          </mesh>
        </group>
      ))}
      {/* 空心菜一綑一綑（綁紅繩子）擺在帆布前緣 */}
      {[-2.5, -1.35, 0.0, 1.25].map((x, i) => (
        <group key={x} position={[x + 0.35, top + 0.05, -v.d / 2 + 0.2]} rotation={[0, 0.3 * (i % 2 ? 1 : -1), 0]}>
          <mesh material={MAT.greens}>
            <boxGeometry args={[0.5, 0.08, 0.12]} />
          </mesh>
          <mesh material={MAT.string}>
            <boxGeometry args={[0.03, 0.1, 0.14]} />
          </mesh>
        </group>
      ))}
      {/* 菜阿婆的小板凳 */}
      <WBox mat="darkWood" size={[0.34, 0.34, 0.3]} position={[-v.w / 2 + 0.25, 0.17, v.d / 2 + 0.3]} />
    </group>
  )
}

function DouhuaCart() {
  const c = M.douhua
  const flag = useMemo(() => boardTexture('豆花', '#f4efe2', '#1d4f8a'), [])
  return (
    <group position={[c.x, 0, c.z]}>
      {/* 車身、兩個輪子、推把 */}
      <mesh material={MAT.cart} position={[0, 0.62, 0]} castShadow>
        <boxGeometry args={[1.7, 0.5, 0.75]} />
      </mesh>
      <WBox mat="wood" size={[1.76, 0.05, 0.8]} position={[0, 0.89, 0]} />
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} material={MAT.wheel} position={[x, 0.24, 0.4]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.2, 0.05, 6, 14]} />
        </mesh>
      ))}
      <mesh material={MAT.pipe} position={[1.05, 0.85, 0]} rotation={[0, 0, Math.PI / 2 - 0.3]}>
        <cylinderGeometry args={[0.025, 0.025, 0.6, 6]} />
      </mesh>
      {/* 大木桶（豆花）、紅糖水的鍋、一疊碗 */}
      <group position={[-0.35, 0.92, 0]}>
        <mesh material={MAT.bucket} position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.28, 0.25, 0.4, 14]} />
        </mesh>
        {[0.08, 0.32].map((y) => (
          <mesh key={y} material={MAT.band} position={[0, y, 0]}>
            <torusGeometry args={[0.275, 0.012, 4, 16]} />
          </mesh>
        ))}
        <mesh material={MAT.bucket} position={[0, 0.41, 0]}>
          <cylinderGeometry args={[0.29, 0.29, 0.03, 14]} />
        </mesh>
      </group>
      <mesh position={[0.25, 1.02, 0.05]}>
        <cylinderGeometry args={[0.2, 0.18, 0.2, 14]} />
        <meshStandardMaterial color="#8a8a86" metalness={0.5} roughness={0.35} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} material={MAT.bowl} position={[0.62, 0.95 + i * 0.045, -0.1]}>
          <cylinderGeometry args={[0.09, 0.06, 0.05, 12]} />
        </mesh>
      ))}
      {/* 車角插一支小旗「豆花」 */}
      <mesh material={MAT.pipe} position={[-0.8, 1.3, -0.3]}>
        <cylinderGeometry args={[0.012, 0.012, 0.9, 5]} />
      </mesh>
      <mesh position={[-0.8, 1.55, -0.3]} rotation={[0, 0.6, 0]}>
        <planeGeometry args={[0.5, 0.2]} />
        <meshStandardMaterial map={flag} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/** 阿葉嬸的老位置：大家都不擺這裡，放一顆橘子、插一支香 */
function GhostSpot() {
  const g = M.ghost
  return (
    <group position={[g.x, 0, g.z]}>
      <WBox mat="darkWood" size={[0.9, 0.42, 0.55]} position={[0, 0.21, 0]} />
      <mesh material={MAT.orange} position={[-0.15, 0.49, 0]}>
        <sphereGeometry args={[0.07, 10, 8]} />
      </mesh>
      <mesh material={MAT.can} position={[0.18, 0.5, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.12, 10]} />
      </mesh>
      <mesh material={MAT.incense} position={[0.18, 0.66, 0]} rotation={[0.1, 0, 0.08]}>
        <cylinderGeometry args={[0.006, 0.006, 0.28, 4]} />
      </mesh>
      {/* 空的小板凳 */}
      <WBox mat="darkWood" size={[0.32, 0.32, 0.28]} position={[0.05, 0.16, 0.55]} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// 牌樓（北邊入口）、兩頭的雜物
// ---------------------------------------------------------------------------

function Gate() {
  const g = M.gate
  const sign = useMemo(() => boardTexture('後壁厝黃昏市場', '#b8322a', '#fbe9b0', '傍晚五點半開到收攤'), [])
  const h = 3.5
  return (
    <group>
      {[g.x0 + 0.12, g.x1 - 0.12].map((x) => (
        <WBox key={x} mat="redPaint" size={[0.24, h, 0.24]} position={[x, h / 2, g.z + 0.5]} />
      ))}
      <WBox mat="redPaint" size={[g.x1 - g.x0 + 0.4, 0.14, 0.26]} position={[0, h - 0.05, g.z + 0.5]} />
      <mesh position={[0, h - 0.62, g.z + 0.66]}>
        <planeGeometry args={[g.x1 - g.x0 + 0.2, 0.9]} />
        <meshStandardMaterial map={sign} roughness={0.75} />
      </mesh>
    </group>
  )
}

function EndCaps() {
  const x = M.ends.x
  return (
    <group>
      {/* 西頭：疊起來的藍色菜籃、竹簍 */}
      {[-0.9, 0, 0.9].map((z, i) => (
        <group key={z}>
          {Array.from({ length: 3 - (i % 2) }, (_, k) => (
            <mesh key={k} position={[-x, 0.18 + k * 0.34, 0.2 + z]} castShadow>
              <boxGeometry args={[0.55, 0.32, 0.75]} />
              <meshStandardMaterial color={k % 2 ? '#2f6ab0' : '#3a8a5a'} roughness={0.5} />
            </mesh>
          ))}
        </group>
      ))}
      {/* 東頭：保麗龍箱、一台手推車 */}
      {[-0.8, 0.0, 0.8].map((z, i) => (
        <mesh key={z} material={MAT.foam} position={[x, 0.2 + (i === 1 ? 0.35 : 0), -0.4 + z]} castShadow>
          <boxGeometry args={[0.7, i === 1 ? 0.75 : 0.36, 0.55]} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 晚上收攤：藍色帆布蓋住櫃台
// ---------------------------------------------------------------------------

export function NightTarps() {
  return (
    <group>
      {(Object.keys(M.stalls) as NorthStall[]).map((id) => {
        const st = M.stalls[id]
        const cx = (st.x0 + st.x1) / 2
        return (
          <mesh key={id} material={MAT.tarp} position={[cx, 1.25, N.front + 0.02]} rotation={[-0.08, 0, 0]}>
            <planeGeometry args={[st.x1 - st.x0 - 0.3, 2.3]} />
          </mesh>
        )
      })}
      <mesh material={MAT.tarp} position={[M.veg.x, 0.62, M.veg.z]} rotation={[0, 0, 0]}>
        <boxGeometry args={[M.veg.w + 0.1, 0.5, M.veg.d + 0.1]} />
      </mesh>
    </group>
  )
}

/** 全部不會動的攤子（北邊的架子、貨、南邊一排、牌樓、兩頭） */
export function MarketStatic() {
  return (
    <group>
      {(Object.keys(M.stalls) as NorthStall[]).map((id) => (
        <StallFrame key={id} id={id} />
      ))}
      <Zahuo />
      <Pork />
      <Fish />
      <Guo />
      <VegStall />
      <DouhuaCart />
      <GhostSpot />
      <Gate />
      <EndCaps />
    </group>
  )
}

/** 今日特價的黑板（A 字架）：字會換，不合併 */
export function SpecialBoard({ text }: { text: string }) {
  const b = M.board
  const tex = useMemo(
    () =>
      canvasTexture(
        256,
        200,
        (ctx, w, h) => {
          ctx.fillStyle = '#2a3a30'
          ctx.fillRect(0, 0, w, h)
          ctx.strokeStyle = '#8a6a3a'
          ctx.lineWidth = 10
          ctx.strokeRect(5, 5, w - 10, h - 10)
          ctx.fillStyle = '#f4f0e0'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.font = `700 40px ${BRUSH_FONT}`
          ctx.fillText('今日特價', w / 2, 52)
          ctx.fillStyle = '#ffd86a'
          ctx.font = `700 ${text.length > 3 ? 46 : 56}px ${BRUSH_FONT}`
          ctx.fillText(text, w / 2, 118)
          ctx.fillStyle = '#f4f0e0'
          ctx.font = `500 30px ${BRUSH_FONT}`
          ctx.fillText('七折！', w / 2, 170)
        },
        [{ spec: `700 56px ${BRUSH_FONT}`, text: `今日特價${text}七折！` }],
      ),
    [text],
  )
  return (
    <group position={[b.x, 0, b.z]} rotation={[0, -0.35, 0]} userData={{ noMerge: true }}>
      <mesh position={[0, 0.62, 0.09]} rotation={[-0.2, 0, 0]}>
        <boxGeometry args={[0.62, 0.92, 0.03]} />
        <meshStandardMaterial color="#6a4a2a" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.64, 0.112]} rotation={[-0.2, 0, 0]}>
        <planeGeometry args={[0.54, 0.84]} />
        <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.6, -0.1]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.62, 0.92, 0.03]} />
        <meshStandardMaterial color="#6a4a2a" roughness={0.8} />
      </mesh>
    </group>
  )
}

/** 吊在屋簷下的燈泡（每攤兩顆）：傍晚開著、晚上收攤關掉 */
export const BULBS: [number, number, number][] = (Object.keys(M.stalls) as NorthStall[]).flatMap((id) => {
  const st = M.stalls[id]
  const cx = (st.x0 + st.x1) / 2
  const w = st.x1 - st.x0
  return [
    [cx - w * 0.22, 2.2, N.front + 0.15],
    [cx + w * 0.22, 2.2, N.front + 0.15],
  ] as [number, number, number][]
})
export { MAT as DM_MAT }
