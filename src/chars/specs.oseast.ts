import { SPECS, type ChibiSpec } from './specs'

// 老街東邊的店（DESIGN §30）：錦繡布莊的錦繡姨（鬼）。冰果室晚上的學生、小姐在 specs.oldstreet.ts。
// 只用現有的 ChibiSpec 功能；由 src/scene/OldStreetEast.tsx 載入時登記。

const OSEAST_SPECS: Record<string, ChibiSpec> = {
  /** 錦繡姨：做了五十年衫的老師傅，去年冬天走的。低髮髻、深藍開襟衫、老花眼鏡掛在胸前、袖套 */
  jinxiu: {
    id: 'jinxiu',
    scale: 0.92,
    skin: '#eec4a4',
    hair: { style: 'lowbun', color: '#9a9690' },
    top: { kind: 'cardigan', color: '#2f4a6a', sleeve: 'long' },
    bottom: { kind: 'wide', color: '#2c2c34' },
    feet: { kind: 'slipper', color: '#5a3a2a' },
    ghost: true,
    extras: { innerTop: '#e8dcc6', readingGlasses: true, sleeveCovers: '#c8b89a', earrings: true },
    faces: {
      normal: { eyes: 'calm', mouth: 'smile', brows: 'soft', wrinkles: true },
      happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', wrinkles: true, blush: true },
    },
  },
}

for (const [id, spec] of Object.entries(OSEAST_SPECS)) SPECS[id] ??= spec
