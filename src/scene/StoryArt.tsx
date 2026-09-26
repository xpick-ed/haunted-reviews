import { portraitDataUrl } from '../art/portraits'

// 結局的插畫（DESIGN §28.4）：每張卡片一幅 SVG 小畫，老照片／夜色的調子。
// 人臉用現成的頭像（portraitDataUrl），車掌、年輕的阿公、陳董沒有頭像，畫剪影。

export type ArtId =
  | 'tear'
  | 'dawnhouse'
  | 'nighttrain'
  | 'lastwalk'
  | 'hansleep'
  | 'window'
  | 'window2'
  | 'shoe'
  | 'canetrain'
  | 'canetrain2'
  | 'dawnlights'
  | 'stayplatform'
  | 'contract'
  | 'bulldozer'
  | 'emptyroom'
  | 'heightmarks'
  | 'taipei'

const W = 800
const H = 500

/** 三合院的屋頂剪影（燕尾、正身＋兩邊護龍） */
function Sanheyuan({ y, color, lit }: { y: number; color: string; lit?: string }) {
  return (
    <g>
      <path d={`M140 ${y} L140 ${y - 70} L400 ${y - 120} L660 ${y - 70} L660 ${y} Z`} fill={color} />
      <path d={`M120 ${y - 70} Q260 ${y - 128} 400 ${y - 132} Q540 ${y - 128} 680 ${y - 70} L700 ${y - 84} L660 ${y - 64} L140 ${y - 64} L100 ${y - 84} Z`} fill={color} />
      <rect x="60" y={y - 60} width="120" height="60" fill={color} />
      <rect x="620" y={y - 60} width="120" height="60" fill={color} />
      <path d={`M50 ${y - 58} L120 ${y - 86} L190 ${y - 58} Z`} fill={color} />
      <path d={`M610 ${y - 58} L680 ${y - 86} L750 ${y - 58} Z`} fill={color} />
      {lit && (
        <g fill={lit}>
          {[250, 330, 470, 550].map((x) => (
            <rect key={x} x={x} y={y - 52} width="26" height="22" rx="2" />
          ))}
          <rect x="95" y={y - 44} width="22" height="18" rx="2" />
          <rect x="683" y={y - 44} width="22" height="18" rx="2" />
          <rect x="384" y={y - 58} width="32" height="58" rx="2" />
        </g>
      )}
    </g>
  )
}

function Stars({ n = 40, seed = 3 }: { n?: number; seed?: number }) {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = Math.sin((i + 1) * 12.9898 * seed) * 43758.5453
    const b = Math.sin((i + 1) * 78.233 * seed) * 12543.123
    return [(a - Math.floor(a)) * W, (b - Math.floor(b)) * 230, 0.6 + ((a * 7) % 1) * 1.4]
  })
  return (
    <g fill="#fff6d8">
      {pts.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={Math.abs(r)} opacity={0.5 + (i % 3) * 0.2} />
      ))}
    </g>
  )
}

/** 甘蔗田：一排排細葉子 */
function Cane({ y, color, h = 70 }: { y: number; color: string; h?: number }) {
  const blades = []
  for (let x = -10; x < W + 20; x += 14) {
    const t = Math.sin(x * 0.37) * 8
    blades.push(<path key={x} d={`M${x} ${y} Q${x + 6 + t} ${y - h * 0.6} ${x + 14 + t} ${y - h - (x % 3) * 6}`} stroke={color} strokeWidth="3" fill="none" />)
  }
  return <g>{blades}</g>
}

/** 鬼火車：青綠色、半透明，窗戶亮著 */
function GhostTrain({ x, y, len = 3, glow = '#8ff4ff' }: { x: number; y: number; len?: number; glow?: string }) {
  return (
    <g opacity="0.92">
      {Array.from({ length: len }, (_, i) => (
        <g key={i} transform={`translate(${x + i * 190} ${y})`}>
          <rect x="0" y="-70" width="180" height="70" rx="10" fill="#2c6b73" opacity="0.75" />
          <rect x="0" y="-74" width="180" height="8" rx="4" fill="#4fa7ad" opacity="0.8" />
          {[14, 58, 102, 146].map((wx) => (
            <rect key={wx} x={wx} y="-56" width="28" height="24" rx="3" fill={glow} opacity="0.85" />
          ))}
          <circle cx="36" cy="4" r="10" fill="#1d3a3f" />
          <circle cx="144" cy="4" r="10" fill="#1d3a3f" />
        </g>
      ))}
      <ellipse cx={x + len * 95} cy={y - 30} rx={len * 110} ry="70" fill={glow} opacity="0.12" />
    </g>
  )
}

/** 月台 */
function Platform({ y }: { y: number }) {
  return (
    <g>
      <rect x="0" y={y} width={W} height={H - y} fill="#1a1512" />
      <rect x="0" y={y} width={W} height="10" fill="#6b5a45" />
      <rect x="0" y={y + 4} width={W} height="3" fill="#c9a24a" opacity="0.8" />
      <rect x="560" y={y - 150} width="10" height="150" fill="#2a221c" />
      <rect x="520" y={y - 170} width="90" height="26" rx="3" fill="#e8dcc0" />
      <text x="565" y={y - 152} textAnchor="middle" fontSize="15" fill="#3a2a18" fontFamily="'Noto Serif TC', serif">
        後壁厝
      </text>
    </g>
  )
}

/** 車掌的剪影（戴帽子、制服） */
function Conductor({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#233b44">
      <circle cx="0" cy="-118" r="22" fill="#9fd9dd" opacity="0.75" />
      <rect x="-24" y="-146" width="48" height="12" rx="3" fill="#1b2d34" />
      <rect x="-16" y="-156" width="32" height="12" rx="4" fill="#1b2d34" />
      <path d="M-34 -94 Q0 -104 34 -94 L40 0 L-40 0 Z" opacity="0.9" />
      <circle cx="-8" cy="-70" r="3" fill="#e5c86a" />
      <circle cx="-8" cy="-54" r="3" fill="#e5c86a" />
    </g>
  )
}

/** 年輕的阿公：短頭髮、白汗衫 */
function YoungAgong({ x, y, s = 1, shoe }: { x: number; y: number; s?: number; shoe?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-36 0 L-30 -90 Q0 -102 30 -90 L36 0 Z" fill="#efe6d2" />
      <circle cx="0" cy="-122" r="30" fill="#e8c29c" />
      <path d="M-30 -128 Q-26 -158 0 -156 Q26 -158 30 -128 Q18 -140 0 -140 Q-18 -140 -30 -128 Z" fill="#221a14" />
      <path d="M-11 -120 q3 -4 6 0 M5 -120 q3 -4 6 0" stroke="#2a1d14" strokeWidth="2.5" fill="none" />
      <path d="M-9 -106 Q0 -99 9 -106" stroke="#8a4a38" strokeWidth="2.5" fill="none" />
      {shoe && (
        <g transform="translate(-6 -58) rotate(-8)">
          <path d="M-26 0 Q-24 -16 -6 -18 L14 -18 Q30 -16 32 0 Z" fill="#f4f1e8" stroke="#8b8574" strokeWidth="2" />
          <rect x="-28" y="-2" width="62" height="7" rx="3" fill="#6c6a60" />
        </g>
      )}
    </g>
  )
}

function Face({ id, mood = 'normal', x, y, r }: { id: 'grandma' | 'xiaohan' | 'xiaomei'; mood?: 'normal' | 'happy' | 'surprised'; x: number; y: number; r: number }) {
  const clip = `clip-${id}-${x}-${y}`
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <circle cx={x} cy={y} r={r} />
        </clipPath>
      </defs>
      <image href={portraitDataUrl(id, mood)} x={x - r} y={y - r} width={r * 2} height={r * 2} clipPath={`url(#${clip})`} />
      <circle cx={x} cy={y} r={r} fill="none" stroke="#f4e6c6" strokeWidth="4" opacity="0.8" />
    </g>
  )
}

function Moon({ x, y, r = 34 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r * 2.4} fill="#fff4d0" opacity="0.08" />
      <circle cx={x} cy={y} r={r} fill="#fff4d6" />
    </g>
  )
}

const NIGHT = (
  <linearGradient id="sky-night" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stopColor="#0c1330" />
    <stop offset="0.7" stopColor="#1f2a4a" />
    <stop offset="1" stopColor="#3a3350" />
  </linearGradient>
)
const DAWN = (
  <linearGradient id="sky-dawn" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stopColor="#5a78a8" />
    <stop offset="0.55" stopColor="#f0b98a" />
    <stop offset="1" stopColor="#f7d9a8" />
  </linearGradient>
)

function Scene({ id }: { id: ArtId }) {
  switch (id) {
    case 'tear':
      return (
        <g>
          <rect width={W} height={H} fill="#e7d4ae" />
          <rect x="0" y="330" width={W} height="170" fill="#9b7650" />
          <rect x="0" y="322" width={W} height="12" fill="#7a5a3a" />
          <rect x="70" y="60" width="220" height="170" rx="6" fill="#f4e7c8" stroke="#8b6a44" strokeWidth="6" />
          <path d="M70 145 L290 145 M180 60 L180 230" stroke="#8b6a44" strokeWidth="5" />
          <Face id="xiaohan" mood="happy" x={520} y={210} r={120} />
          {[
            [410, 360, -18],
            [470, 395, 22],
            [560, 372, -6],
            [640, 410, 35],
          ].map(([x, y, r], i) => (
            <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
              <rect x="-34" y="-20" width="68" height="40" fill="#fbf7ee" stroke="#b6a07a" />
              <text x="0" y="6" textAnchor="middle" fontSize="13" fill="#6a5238">
                {['陳董', '建設', '０９１２', '董事長'][i]}
              </text>
            </g>
          ))}
        </g>
      )
    case 'dawnhouse':
      return (
        <g>
          <rect width={W} height={H} fill="url(#sky-dawn)" />
          <circle cx="620" cy="310" r="60" fill="#fff0c8" opacity="0.9" />
          <Sanheyuan y={400} color="#5a3a2a" />
          <rect x="0" y="400" width={W} height="100" fill="#7e5a3e" />
          <g transform="translate(400 330)">
            <rect x="-70" y="-24" width="140" height="44" rx="4" fill="#b52f2a" />
            <text x="0" y="8" textAnchor="middle" fontSize="24" fill="#ffe4a8" fontFamily="'Noto Serif TC', serif">
              阿春民宿
            </text>
          </g>
          <Face id="xiaohan" mood="happy" x={170} y={420} r={52} />
        </g>
      )
    case 'nighttrain':
      return (
        <g>
          <rect width={W} height={H} fill="url(#sky-night)" />
          <Stars />
          <Moon x={140} y={90} />
          <Cane y={330} color="#1d2a24" h={90} />
          <GhostTrain x={180} y={352} len={3} />
          <Platform y={360} />
          <g opacity="0.8">
            {[0, 1, 2].map((i) => (
              <circle key={i} cx={150 + i * 26} cy={250 - i * 30} r={14 + i * 8} fill="#dff" opacity={0.18 - i * 0.04} />
            ))}
          </g>
        </g>
      )
    case 'lastwalk':
      return (
        <g>
          <rect width={W} height={H} fill="#1b1a26" />
          <rect x="60" y="80" width="300" height="360" fill="#2a2536" />
          <rect x="440" y="80" width="300" height="360" fill="#2a2536" />
          {[110, 150, 190, 230, 270].map((x) => (
            <rect key={x} x={x} y="120" width="8" height="120" fill="#5a4c3a" />
          ))}
          <rect x="100" y="112" width="190" height="8" fill="#5a4c3a" />
          <rect x="100" y="240" width="190" height="8" fill="#5a4c3a" />
          <path d="M470 380 Q520 330 600 336 Q680 330 720 380 Z" fill="#8a3a4a" />
          <circle cx="520" cy="350" r="22" fill="#e8c29c" />
          <path d="M506 346 q5 3 10 0 M526 346 q5 3 10 0" stroke="#3a2a20" strokeWidth="2" fill="none" />
          <g transform="translate(250 380)">
            <path d="M-50 0 L-40 -40 L40 -40 L50 0 Z" fill="#8b6a44" />
            <ellipse cx="0" cy="-50" rx="34" ry="18" fill="#e89a45" />
            <circle cx="-26" cy="-58" r="12" fill="#e89a45" />
            <path d="M-34 -66 L-32 -76 L-24 -68 M-22 -66 L-18 -76 L-14 -66" fill="#e89a45" />
            <text x="16" y="-72" fontSize="16" fill="#fff4d0">z z</text>
          </g>
          <circle cx="400" cy="290" r="90" fill="#8ff4ff" opacity="0.1" />
          <Face id="grandma" mood="normal" x={400} y={270} r={48} />
        </g>
      )
    case 'hansleep':
      return (
        <g>
          <rect width={W} height={H} fill="#141a2c" />
          <rect x="560" y="60" width="160" height="200" fill="#1f2a44" />
          <Moon x={640} y={140} r={26} />
          <rect x="120" y="300" width="560" height="140" rx="16" fill="#3b4f72" />
          <path d="M120 330 Q400 280 680 330 L680 440 L120 440 Z" fill="#5a6f94" />
          <Face id="xiaohan" mood="normal" x={250} y={300} r={70} />
          {/* 頭像的眼睛是張開的：蓋一塊皮膚，畫閉著的眼睛 */}
          <ellipse cx="232" cy="312" rx="13" ry="11" fill="#f2cfac" />
          <ellipse cx="274" cy="312" rx="13" ry="11" fill="#f2cfac" />
          <path d="M222 310 q10 8 20 0 M264 310 q10 8 20 0" stroke="#2a1d14" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          {/* 被子拉到肩膀 */}
          <path d="M150 338 Q250 318 360 340 L380 380 L130 380 Z" fill="#6d82a8" />
          <path d="M150 338 Q250 318 360 340" stroke="#8fa3c6" strokeWidth="6" fill="none" />
          <text x="330" y="240" fontSize="26" fill="#cfe4ff" opacity="0.8">z z z</text>
          <g opacity="0.55">
            <circle cx="470" cy="330" r="60" fill="#8ff4ff" opacity="0.25" />
            <path d="M430 340 Q460 300 510 320 Q520 340 500 356 Q470 366 430 340 Z" fill="#bff8ff" />
          </g>
        </g>
      )
    case 'window':
    case 'window2':
      return (
        <g>
          <rect width={W} height={H} fill="#21303a" />
          <rect x="220" y="60" width="360" height="230" rx="30" fill="#0e1830" stroke="#4f7d86" strokeWidth="10" />
          <Stars n={20} seed={7} />
          <Cane y={290} color="#1c2b25" h={80} />
          <Moon x={500} y={120} r={20} />
          <rect x="0" y="300" width={W} height="200" fill="#2e4550" />
          <rect x="180" y="330" width="440" height="120" rx="14" fill="#6f3a3a" />
          <Face id="grandma" mood="happy" x={id === 'window' ? 400 : 330} y={300} r={62} />
          {id === 'window2' ? <YoungAgong x={500} y={460} s={0.95} /> : <Conductor x={660} y={470} s={1.1} />}
        </g>
      )
    case 'shoe':
      return (
        <g>
          <rect width={W} height={H} fill="#e3cfa4" />
          <circle cx="400" cy="250" r="200" fill="#f0e0b8" />
          <g transform="translate(400 280) scale(3.4)">
            <path d="M-26 0 Q-24 -16 -6 -18 L14 -18 Q30 -16 32 0 Z" fill="#f7f4ec" stroke="#8b8574" strokeWidth="1.2" />
            <rect x="-28" y="-2" width="62" height="7" rx="3" fill="#6c6a60" />
            <path d="M-4 -14 L-4 -6 M4 -15 L4 -6 M12 -15 L12 -6" stroke="#b9b39f" strokeWidth="1" />
          </g>
          <path d="M150 420 Q260 340 300 330" stroke="#e8c29c" strokeWidth="44" strokeLinecap="round" fill="none" />
          <path d="M650 420 Q540 340 500 330" stroke="#e8c29c" strokeWidth="44" strokeLinecap="round" fill="none" />
        </g>
      )
    case 'canetrain':
    case 'canetrain2':
      return (
        <g>
          <rect width={W} height={H} fill="url(#sky-night)" />
          <Stars n={60} seed={11} />
          <Moon x={660} y={80} r={30} />
          <path d="M0 330 Q200 300 400 318 Q600 336 800 310 L800 500 L0 500 Z" fill="#141f1a" />
          <GhostTrain x={60} y={320} len={4} glow={id === 'canetrain2' ? '#ffe1a8' : '#8ff4ff'} />
          <Cane y={500} color="#0f1813" h={170} />
        </g>
      )
    case 'dawnlights':
      return (
        <g>
          <rect width={W} height={H} fill="url(#sky-dawn)" />
          <Sanheyuan y={420} color="#3e2a22" lit="#ffd88a" />
          <rect x="0" y="420" width={W} height="80" fill="#5d4330" />
        </g>
      )
    case 'stayplatform':
      return (
        <g>
          <rect width={W} height={H} fill="url(#sky-night)" />
          <Stars />
          <Moon x={680} y={80} />
          <GhostTrain x={420} y={352} len={3} />
          <Platform y={360} />
          <Conductor x={450} y={330} s={0.8} />
          <Face id="grandma" mood="happy" x={200} y={300} r={56} />
          <path d="M258 250 q16 -30 26 -10 q10 -30 22 -4" stroke="#bff8ff" strokeWidth="6" fill="none" strokeLinecap="round" />
        </g>
      )
    case 'contract':
      return (
        <g>
          <rect width={W} height={H} fill="#d9c49a" />
          <rect x="0" y="300" width={W} height="200" fill="#7c5a3c" />
          <g transform="translate(400 380) rotate(-4)">
            <rect x="-150" y="-100" width="300" height="200" fill="#fbf7ee" stroke="#b6a07a" strokeWidth="2" />
            <text x="0" y="-62" textAnchor="middle" fontSize="22" fill="#3a2a18" fontFamily="'Noto Serif TC', serif">
              土地買賣契約書
            </text>
            {[-30, -6, 18, 42].map((y) => (
              <rect key={y} x="-120" y={y} width="240" height="6" fill="#d8ccb2" />
            ))}
            <path d="M40 70 q20 -14 40 0 q20 14 36 -6" stroke="#23324f" strokeWidth="3" fill="none" />
          </g>
          <g transform="translate(640 310)">
            <path d="M-80 0 L40 -30 L60 10 L-70 40 Z" fill="#2b2f3a" />
            <rect x="30" y="-26" width="30" height="22" rx="4" fill="#d8ae3e" />
          </g>
          <Face id="xiaohan" mood="surprised" x={170} y={170} r={100} />
        </g>
      )
    case 'bulldozer':
      return (
        <g>
          <rect width={W} height={H} fill="url(#sky-dawn)" />
          <Sanheyuan y={400} color="#6a4a36" />
          <rect x="0" y="400" width={W} height="100" fill="#8a6a4a" />
          <g transform="translate(560 420)" fill="#e0a52a">
            <rect x="-90" y="-60" width="150" height="50" rx="6" />
            <rect x="-60" y="-110" width="70" height="56" rx="6" />
            <rect x="-40" y="-100" width="44" height="30" fill="#39424e" />
            <path d="M50 -50 L150 -170 L170 -150 L80 -40 Z" />
            <path d="M150 -170 L200 -110 L180 -96 L140 -150 Z" />
            <rect x="-100" y="-12" width="170" height="24" rx="12" fill="#2a2a2a" />
          </g>
          <g stroke="#8b6a44" strokeWidth="5">
            <line x1="120" y1="400" x2="120" y2="310" />
            <line x1="320" y1="400" x2="320" y2="310" />
            <line x1="100" y1="318" x2="340" y2="318" />
          </g>
          <g fill="#c85a6a">
            <rect x="150" y="320" width="30" height="40" />
            <rect x="200" y="320" width="26" height="48" fill="#6a8ac8" />
            <rect x="248" y="320" width="30" height="36" fill="#e8d07a" />
          </g>
        </g>
      )
    case 'emptyroom':
      return (
        <g>
          <rect width={W} height={H} fill="#16151f" />
          <path d="M520 60 L700 60 L700 260 L520 260 Z" fill="#26324a" />
          {[550, 590, 630, 670].map((x) => (
            <rect key={x} x={x} y="60" width="8" height="200" fill="#4a3e30" />
          ))}
          <path d="M520 260 L700 260 L560 480 L260 480 Z" fill="#dfe8ff" opacity="0.1" />
          <rect x="0" y="440" width={W} height="60" fill="#221e2a" />
          <circle cx="330" cy="320" r="100" fill="#8ff4ff" opacity="0.08" />
          <Face id="grandma" mood="normal" x={330} y={300} r={60} />
        </g>
      )
    case 'heightmarks':
      return (
        <g>
          <rect width={W} height={H} fill="#2a2018" />
          <rect x="300" y="0" width="200" height={H} fill="#8b6a44" />
          <rect x="300" y="0" width="200" height={H} fill="url(#grain)" opacity="0.4" />
          {[
            [380, '七歲'],
            [300, '九歲'],
            [210, '十二歲'],
            [150, '十五歲'],
          ].map(([y, t], i) => (
            <g key={i}>
              <line x1="330" y1={y as number} x2="420" y2={y as number} stroke="#2a1a10" strokeWidth="4" />
              <text x="430" y={(y as number) + 6} fontSize="20" fill="#2a1a10" fontFamily="'LXGW WenKai TC', serif">
                {t}
              </text>
            </g>
          ))}
          <text x="350" y="120" fontSize="30" fill="#2a1a10" fontFamily="'LXGW WenKai TC', serif">
            翰
          </text>
          <circle cx="200" cy="330" r="80" fill="#8ff4ff" opacity="0.12" />
          <path d="M190 330 Q250 300 330 300" stroke="#bff8ff" strokeWidth="12" strokeLinecap="round" opacity="0.6" />
        </g>
      )
    case 'taipei':
      return (
        <g>
          <rect width={W} height={H} fill="#0e1424" />
          <rect x="420" y="40" width="340" height="260" fill="#1b2542" />
          {Array.from({ length: 9 }, (_, i) => (
            <rect key={i} x={430 + i * 36} y={300 - ((i * 37) % 140) - 60} width="28" height={((i * 37) % 140) + 60} fill="#26314f" />
          ))}
          {Array.from({ length: 30 }, (_, i) => (
            <rect key={`w${i}`} x={436 + (i % 9) * 36} y={180 + Math.floor(i / 9) * 22} width="6" height="8" fill="#ffd88a" opacity={(i * 7) % 3 ? 0.9 : 0.3} />
          ))}
          <rect x="0" y="330" width={W} height="170" fill="#5a4332" />
          <g transform="translate(250 330)">
            <rect x="-80" y="-150" width="160" height="150" rx="6" fill="#d8c6a0" stroke="#6a5238" strokeWidth="8" />
          </g>
          <Face id="grandma" mood="happy" x={250} y={255} r={58} />
          <g transform="translate(560 330)">
            <rect x="-26" y="-60" width="52" height="60" rx="6" fill="#e8e2d6" />
            <path d="M26 -46 q24 0 24 18 q0 18 -24 18" stroke="#e8e2d6" strokeWidth="8" fill="none" />
            <path d="M-10 -80 q6 -12 0 -24 M8 -80 q6 -12 0 -24" stroke="#cfd8e8" strokeWidth="3" fill="none" opacity="0.6" />
          </g>
        </g>
      )
  }
}

/** 一張結局卡片的插畫：SVG ＋ 紙紋、暗角 */
export function StoryArt({ id }: { id: ArtId }) {
  return (
    <svg className="ending-art-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        {NIGHT}
        {DAWN}
        <filter id="grain-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <pattern id="grain" width={W} height={H} patternUnits="userSpaceOnUse">
          <rect width={W} height={H} filter="url(#grain-filter)" />
        </pattern>
        <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.75">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.55" />
        </radialGradient>
      </defs>
      <Scene id={id} />
      <rect width={W} height={H} fill="url(#grain)" opacity="0.08" />
      <rect width={W} height={H} fill="url(#vignette)" />
    </svg>
  )
}
