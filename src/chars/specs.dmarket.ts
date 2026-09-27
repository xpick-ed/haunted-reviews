import { SPECS, type ChibiSpec } from './specs'

// 黃昏市場的人（DESIGN §32.1）：六個攤販、鬼菜販阿葉嬸、來買菜的人。
// 只用現有的 ChibiSpec 功能；由 src/scene/DuskMarket.tsx 載入時登記。

const DMARKET_SPECS: Record<string, ChibiSpec> = {
  /** 阿蘭姐：豬肉攤，嗓門大、手起刀落。燙捲的頭髮、紅上衣、白色橡膠圍裙、藍袖套 */
  alan: {
    id: 'alan',
    scale: 1.02,
    skin: '#e8b48e',
    hair: { style: 'perm', color: '#2a1c16' },
    top: { kind: 'blouse', color: '#c8323e', sleeve: 'short', accent: '#8a1e26' },
    bottom: { kind: 'wide', color: '#2c3346' },
    feet: { kind: 'slipper', color: '#3a3a3a' },
    extras: { apron: '#eeeae0', sleeveCovers: '#5a7ab0', earrings: true },
    faces: {
      normal: { eyes: 'open', mouth: 'grin', brows: 'stern', blush: true },
      happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true },
      angry: { eyes: 'open', mouth: 'flat', brows: 'stern' },
    },
  },
  /** 阿忠：魚販，愛講笑話。反戴的鴨舌帽、深綠橡膠圍裙、脖子掛毛巾 */
  azhong: {
    id: 'azhong',
    scale: 1.06,
    skin: '#d49a72',
    hair: { style: 'crew', color: '#1c1a18' },
    top: { kind: 'tee', color: '#3a6a9a', sleeve: 'short' },
    bottom: { kind: 'pants', color: '#2c2c30' },
    feet: { kind: 'shoe', color: '#1e2a22' },
    extras: { apron: '#2f4a3a', cap: '#e8e0c8', neckTowel: '#f2f0ea' },
    faces: {
      normal: { eyes: 'happy', mouth: 'grin', brows: 'soft', stubble: true },
      happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', stubble: true, blush: true },
    },
  },
  /** 萬伯：雜貨攤的老闆，戴細框眼鏡、大肚子、白汗衫外面一件短袖襯衫 */
  wanbo: {
    id: 'wanbo',
    scale: 1.0,
    skin: '#e6b894',
    hair: { style: 'sidepart', color: '#b8b4ae' },
    top: { kind: 'shirt', color: '#dcd4c0', sleeve: 'short' },
    bottom: { kind: 'pants', color: '#4a4a4c' },
    feet: { kind: 'slipper', color: '#5a4a3a' },
    belly: true,
    extras: { glasses: 'thin', glassesColor: '#6a5a3a' },
    faces: {
      normal: { eyes: 'calm', mouth: 'smile', brows: 'soft', wrinkles: true },
      happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', wrinkles: true },
    },
  },
  /** 粿嬸：粿攤，髮髻插簪子、碎花衫、粉紅圍裙 */
  guoshen: {
    id: 'guoshen',
    scale: 0.95,
    skin: '#f0c4a2',
    hair: { style: 'bun', color: '#3a2a22' },
    top: {
      kind: 'blouse',
      color: '#ffffff',
      sleeve: 'short',
      accent: '#a84a5a',
      print: { base: '#f4e6d8', petals: ['#c84a5a', '#e8a04a'], center: '#ffffff', seed: 57, repeat: 2.2 },
    },
    bottom: { kind: 'wide', color: '#3a3448' },
    feet: { kind: 'slipper', color: '#c84a5a' },
    extras: { apron: '#f0c8c8', hairpin: true },
    faces: {
      normal: { eyes: 'happy', mouth: 'smile', brows: 'soft', blush: true, wrinkles: true },
      happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true, wrinkles: true },
    },
  },
  /** 菜阿婆：自己種菜來賣，坐小板凳。草帽往後戴、花布衫、袖套 */
  caipo: {
    id: 'caipo',
    scale: 0.9,
    skin: '#dca680',
    hair: { style: 'lowbun', color: '#a8a49e' },
    top: {
      kind: 'blouse',
      color: '#ffffff',
      sleeve: 'long',
      accent: '#4a6a3a',
      print: { base: '#dfe8d4', petals: ['#4a7a3a', '#c8a04a'], center: '#f4f0e0', seed: 71, repeat: 2.4 },
    },
    bottom: { kind: 'wide', color: '#3a3a44' },
    feet: { kind: 'slipper', color: '#4a4a4a' },
    extras: { strawHat: '#d8c08a', sleeveCovers: '#8aa0c0' },
    faces: {
      normal: { eyes: 'calm', mouth: 'smile', brows: 'soft', wrinkles: true },
      happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', wrinkles: true, blush: true },
    },
  },
  /** 豆花阿伯：白汗衫、短褲、脖子掛毛巾，推一台豆花車 */
  douhuabo: {
    id: 'douhuabo',
    scale: 1.0,
    skin: '#dcaa84',
    hair: { style: 'messy', color: '#c4c0ba' },
    top: { kind: 'singlet', color: '#f2f0ea', sleeve: 'none' },
    bottom: { kind: 'shorts', color: '#3a4a6a' },
    feet: { kind: 'slipper', color: '#3a5a8a' },
    extras: { neckTowel: '#f2f0ea' },
    faces: {
      normal: { eyes: 'happy', mouth: 'smile', brows: 'soft', wrinkles: true },
      happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', wrinkles: true },
    },
  },
  /** 阿葉嬸（鬼）：以前在這裡賣菜，那年颱風回來收菜就沒回去。草帽、舊花布衫、袖套 */
  aye: {
    id: 'aye',
    scale: 0.9,
    skin: '#e6c0a0',
    hair: { style: 'lowbun', color: '#8e8a84' },
    top: {
      kind: 'blouse',
      color: '#ffffff',
      sleeve: 'long',
      accent: '#5a7a5a',
      print: { base: '#d8e0cc', petals: ['#6a8a5a', '#b89a5a'], center: '#eeeadc', seed: 93, repeat: 2.2 },
    },
    bottom: { kind: 'wide', color: '#34343c' },
    feet: { kind: 'slipper', color: '#4a4a4a' },
    ghost: true,
    extras: { strawHat: '#c8b48a', sleeveCovers: '#9aa8b8' },
    faces: {
      normal: { eyes: 'calm', mouth: 'smile', brows: 'soft', wrinkles: true },
      happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', wrinkles: true },
    },
  },
  /** 來買菜的人：燙頭髮的阿桑（提著菜）、戴帽子的阿伯、綁馬尾的年輕媽媽、搧扇子的阿公 */
  dm_shop1: {
    id: 'dm_shop1',
    scale: 0.96,
    skin: '#f0c6a4',
    hair: { style: 'perm', color: '#3a2a26' },
    top: {
      kind: 'blouse',
      color: '#ffffff',
      sleeve: 'short',
      accent: '#6a4a8a',
      print: { base: '#e8dcf0', petals: ['#8a5aa8', '#e0a04a'], center: '#ffffff', seed: 31, repeat: 2.6 },
    },
    bottom: { kind: 'wide', color: '#2e3444' },
    feet: { kind: 'slipper', color: '#8a4a6a' },
    faces: { normal: { eyes: 'open', mouth: 'smile', brows: 'soft', wrinkles: true } },
  },
  dm_shop2: {
    id: 'dm_shop2',
    scale: 1.04,
    skin: '#dcaa84',
    hair: { style: 'crew', color: '#4a4640' },
    top: { kind: 'shirt', color: '#a8c0d0', sleeve: 'short' },
    bottom: { kind: 'pants', color: '#5a5040' },
    feet: { kind: 'slipper', color: '#3a3a3a' },
    extras: { cap: '#3a5a3a' },
    faces: { normal: { eyes: 'calm', mouth: 'small', brows: 'soft', wrinkles: true } },
  },
  dm_shop3: {
    id: 'dm_shop3',
    scale: 1.0,
    skin: '#f4d0b0',
    hair: { style: 'ponytail', color: '#1e1a18' },
    top: { kind: 'tee', color: '#e8a86a', sleeve: 'short' },
    bottom: { kind: 'pants', color: '#3a4a6a' },
    feet: { kind: 'shoe', color: '#e8e4dc' },
    extras: { hairTie: '#c83a4a' },
    faces: { normal: { eyes: 'open', mouth: 'smile', brows: 'soft', lashes: true } },
  },
  dm_walker: {
    id: 'dm_walker',
    scale: 0.98,
    skin: '#e0b08c',
    hair: { style: 'bald', color: '#c8c4be' },
    top: { kind: 'singlet', color: '#f0eee6', sleeve: 'none' },
    bottom: { kind: 'shorts', color: '#5a4a3a' },
    feet: { kind: 'slipper', color: '#2a3a5a' },
    belly: true,
    faces: { normal: { eyes: 'calm', mouth: 'smile', brows: 'soft', wrinkles: true } },
  },
}

for (const [id, spec] of Object.entries(DMARKET_SPECS)) SPECS[id] ??= spec
