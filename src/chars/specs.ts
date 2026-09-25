import type { FaceSpec } from './faces'

// 每個角色的長相：身材、髮型、衣服、配件、表情。
// 顏色跟 2D 插畫（src/art/）對齊，對話框的頭像跟 3D 角色是同一個人。

export type HairStyle = 'bun' | 'long' | 'short' | 'bald' | 'crew' | 'perm' | 'messy' | 'sidepart' | 'bowl' | 'ponytail' | 'lowbun'
export type TopKind = 'blouse' | 'hoodie' | 'tee' | 'singlet' | 'jacket' | 'shirt' | 'cardigan'
/** skirt：到小腿的長裙（紅姨的旗袍下襬），腿藏在裙子裡 */
export type BottomKind = 'wide' | 'pants' | 'shorts' | 'skirt'
export type Sleeve = 'long' | 'short' | 'none'

export interface Print {
  /** floral（預設）：小碎花；stripe：橫條紋（petals[0] 是條紋色）；plaid：格子（petals 是格線色） */
  kind?: 'floral' | 'stripe' | 'plaid'
  base: string
  petals: string[]
  center: string
  seed: number
  /** floral／plaid：重複次數；stripe：身體一圈有幾條 */
  repeat?: number
}

export interface ChibiSpec {
  id: string
  /** 整體縮放（大人 1.1、老人 1.0、小孩 0.72） */
  scale: number
  /** 頭的額外縮放（小孩頭比較大） */
  headScale?: number
  skin: string
  hair: { style: HairStyle; color: string }
  top: { kind: TopKind; color: string; sleeve: Sleeve; print?: Print; accent?: string }
  bottom: { kind: BottomKind; color: string; print?: Print }
  feet: { kind: 'slipper' | 'shoe' | 'none'; color: string }
  belly?: boolean
  ghost?: boolean
  extras?: {
    earrings?: boolean
    hairpin?: boolean
    collar?: boolean
    towel?: boolean
    /** true：粗黑框（廟公）；'thin'：細框（上班族、老人） */
    glasses?: boolean | 'thin'
    /** 細框眼鏡的顏色 */
    glassesColor?: string
    visor?: string
    redNose?: boolean
    hood?: boolean
    knots?: string
    /** 反戴的棒球帽（顏色） */
    cap?: string
    /** 綁在額頭的頭巾（顏色） */
    bandana?: string
    /** 領帶（顏色）；上班族鬆開的領帶 */
    tie?: string
    /** 白襯衫的領子 */
    shirtCollar?: boolean
    /** 開襟外套裡面那件的顏色（林太太） */
    innerTop?: string
    /** 胸口的小標誌（YouTuber 帽 T 上的紅色 logo） */
    logo?: string
    /** 綁馬尾的髮圈顏色 */
    hairTie?: string
    /** 圍裙（顏色）：胸前一片＋腰下一片，口袋是白的（柑仔店阿嬌） */
    apron?: string
    /** 袖套（顏色）：套在前臂上，兩端有鬆緊帶 */
    sleeveCovers?: string
    /** 老花眼鏡用鍊子掛在胸前 */
    readingGlasses?: boolean
    /** 草帽（顏色）：往後戴，露出臉 */
    strawHat?: string
    /** 毛巾掛在脖子上、兩端垂在胸前（顏色；會有一條藍色條紋） */
    neckTowel?: string
    /** 左手腕的手鐲（顏色；翠玉） */
    bracelet?: string
  }
  faces: Record<string, FaceSpec>
}

export const SPECS: Record<string, ChibiSpec> = {
  grandma: {
    id: 'grandma',
    scale: 1.0,
    skin: '#f3cfae',
    hair: { style: 'bun', color: '#bcc2cd' },
    top: {
      kind: 'blouse',
      color: '#ffffff',
      sleeve: 'long',
      accent: '#6f3f95',
      print: { base: '#8e5bb5', petals: ['#f4f1ea', '#f6c6ea'], center: '#e8b34a', seed: 11, repeat: 2.2 },
    },
    bottom: { kind: 'wide', color: '#363c5c' },
    feet: { kind: 'none', color: '#000' },
    ghost: true,
    extras: { earrings: true, hairpin: true, collar: true, knots: '#f3e6c8' },
    faces: {
      normal: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true, wrinkles: true },
      reach: { eyes: 'happy', mouth: 'smile', brows: 'soft', blush: true, wrinkles: true },
    },
  },
  xiaomei: {
    id: 'xiaomei',
    scale: 0.96,
    skin: '#f6d6bd',
    hair: { style: 'long', color: '#4a2e22' },
    top: { kind: 'hoodie', color: '#f4a6c0', sleeve: 'long' },
    bottom: { kind: 'pants', color: '#9aa0ab' },
    feet: { kind: 'none', color: '#000' },
    extras: { hood: true },
    faces: {
      awake: { eyes: 'down', mouth: 'small', brows: 'soft', blush: true, lashes: true },
      scared: { eyes: 'wide', mouth: 'scream', brows: 'worried', fear: true, sweat: true },
      asleep: { eyes: 'closed', mouth: 'o', blush: true, lashes: true, brows: 'soft' },
      happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', blush: true, lashes: true },
    },
  },
  xiaohan: {
    id: 'xiaohan',
    scale: 1.1,
    skin: '#ebc39f',
    hair: { style: 'short', color: '#1e1a1c' },
    top: { kind: 'tee', color: '#7ea8d2', sleeve: 'short' },
    bottom: { kind: 'shorts', color: '#b89a6c' },
    feet: { kind: 'slipper', color: '#3d6bb3' },
    extras: { towel: true },
    faces: { normal: { eyes: 'open', mouth: 'smile', brows: 'soft' } },
  },
  ayi: {
    id: 'ayi',
    scale: 1.06,
    skin: '#f1bf9c',
    hair: { style: 'bald', color: '#4b4a4e' },
    top: { kind: 'singlet', color: '#f2efe6', sleeve: 'none' },
    bottom: { kind: 'shorts', color: '#5b606c' },
    feet: { kind: 'none', color: '#000' },
    belly: true,
    ghost: true,
    extras: { redNose: true },
    faces: { normal: { eyes: 'sleepy', mouth: 'grin', brows: 'soft', blush: true, stubble: true } },
  },
  miaogong: {
    id: 'miaogong',
    scale: 1.06,
    skin: '#e8c19f',
    hair: { style: 'crew', color: '#9b9ca2' },
    top: { kind: 'jacket', color: '#26314f', sleeve: 'long' },
    bottom: { kind: 'pants', color: '#6a6d74' },
    feet: { kind: 'shoe', color: '#1b1b1d' },
    extras: { glasses: true, knots: '#d8a444' },
    faces: { normal: { eyes: 'open', mouth: 'flat', brows: 'stern', wrinkles: true } },
  },
  agui: {
    id: 'agui',
    scale: 0.94,
    skin: '#eec39f',
    hair: { style: 'perm', color: '#2d2430' },
    top: {
      kind: 'blouse',
      color: '#ffffff',
      sleeve: 'short',
      accent: '#1f7a6c',
      print: { base: '#2f9a8a', petals: ['#f2a24a', '#ffe08a'], center: '#c0392b', seed: 23, repeat: 2.2 },
    },
    bottom: { kind: 'wide', color: '#ffffff', print: { base: '#6b3fa0', petals: ['#f6c6ea', '#ffffff'], center: '#f2c44a', seed: 31, repeat: 1.6 } },
    feet: { kind: 'slipper', color: '#c0392b' },
    extras: { visor: '#5fd0a0', earrings: true },
    faces: {
      normal: { eyes: 'happy', mouth: 'goldgrin', brows: 'soft', blush: true, wrinkles: true },
      awake: { eyes: 'happy', mouth: 'goldgrin', brows: 'soft', blush: true, wrinkles: true },
      scared: { eyes: 'wide', mouth: 'o', brows: 'worried', wrinkles: true, sweat: true },
      asleep: { eyes: 'closed', mouth: 'small', brows: 'soft', wrinkles: true },
      happy: { eyes: 'happy', mouth: 'goldgrin', brows: 'soft', blush: true, wrinkles: true },
    },
  },

  // -------------------------------------------------------------------------
  // 客人（GuestId，見 src/world/night/types.ts）。表情都有 awake／scared／asleep／happy。
  // -------------------------------------------------------------------------

  akai: {
    id: 'akai',
    scale: 1.08,
    skin: '#f0c8a4',
    hair: { style: 'messy', color: '#8a5634' },
    top: { kind: 'hoodie', color: '#2c2c33', sleeve: 'long', accent: '#1d1d22' },
    bottom: { kind: 'pants', color: '#394562' },
    feet: { kind: 'shoe', color: '#f1f1ee' },
    extras: { hood: true, cap: '#d8443a', logo: '#e0453a' },
    faces: {
      awake: { eyes: 'open', mouth: 'grin', brows: 'soft' },
      scared: { eyes: 'wide', mouth: 'scream', brows: 'worried', fear: true, sweat: true },
      asleep: { eyes: 'closed', mouth: 'o', brows: 'soft' },
      happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true },
    },
  },
  zhang: {
    id: 'zhang',
    scale: 1.1,
    skin: '#eac4a2',
    hair: { style: 'sidepart', color: '#1b191c' },
    top: { kind: 'shirt', color: '#f3f4f6', sleeve: 'long' },
    bottom: { kind: 'pants', color: '#5d636f' },
    feet: { kind: 'shoe', color: '#19191b' },
    extras: { glasses: 'thin', glassesColor: '#2a2a30', tie: '#24365f', shirtCollar: true },
    faces: {
      awake: { eyes: 'open', mouth: 'flat', brows: 'soft', bags: true },
      scared: { eyes: 'wide', mouth: 'scream', brows: 'worried', sweat: true, bags: true },
      asleep: { eyes: 'closed', mouth: 'small', brows: 'soft', bags: true },
      happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', bags: true },
    },
  },
  ahao: {
    id: 'ahao',
    scale: 1.08,
    skin: '#dca67c',
    hair: { style: 'crew', color: '#2a2320' },
    top: { kind: 'tee', color: '#7b8451', sleeve: 'short' },
    bottom: { kind: 'shorts', color: '#b49b6b' },
    feet: { kind: 'slipper', color: '#5a4632' },
    extras: { bandana: '#2f8f7a' },
    faces: {
      awake: { eyes: 'open', mouth: 'smile', brows: 'soft', stubble: true },
      scared: { eyes: 'wide', mouth: 'o', brows: 'worried', sweat: true, stubble: true },
      asleep: { eyes: 'closed', mouth: 'o', brows: 'soft', stubble: true },
      happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', stubble: true },
    },
  },
  xiaoyu: {
    id: 'xiaoyu',
    scale: 0.72,
    headScale: 1.12,
    skin: '#f8d8bb',
    hair: { style: 'bowl', color: '#221a1a' },
    top: { kind: 'tee', color: '#ffffff', sleeve: 'short', print: { kind: 'stripe', base: '#f8d54a', petals: ['#f08a3a'], center: '', seed: 0, repeat: 5 } },
    bottom: { kind: 'shorts', color: '#4a78c8' },
    feet: { kind: 'shoe', color: '#e2463a' },
    faces: {
      awake: { eyes: 'open', mouth: 'small', brows: 'soft', blush: true, eyeSize: 1.35 },
      scared: { eyes: 'wide', mouth: 'o', brows: 'worried', sweat: true, eyeSize: 1.2 },
      asleep: { eyes: 'closed', mouth: 'o', brows: 'soft', blush: true, eyeSize: 1.2 },
      happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true, eyeSize: 1.25 },
    },
  },
  linmom: {
    id: 'linmom',
    scale: 1.0,
    skin: '#f5d4b8',
    hair: { style: 'ponytail', color: '#3a2a24' },
    top: { kind: 'cardigan', color: '#e2cead', sleeve: 'long', accent: '#cbb591' },
    bottom: { kind: 'pants', color: '#2e3a5c' },
    feet: { kind: 'shoe', color: '#7a4a32' },
    extras: { innerTop: '#a9c8e8', hairTie: '#e07a8a' },
    faces: {
      awake: { eyes: 'open', mouth: 'small', brows: 'worried', blush: true, lashes: true },
      scared: { eyes: 'wide', mouth: 'scream', brows: 'worried', fear: true, sweat: true, lashes: true },
      asleep: { eyes: 'closed', mouth: 'small', brows: 'soft', lashes: true },
      happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', blush: true, lashes: true },
    },
  },
  atu: {
    id: 'atu',
    scale: 1.0,
    skin: '#e3b18c',
    hair: { style: 'bald', color: '#ecebe6' },
    top: {
      kind: 'shirt',
      color: '#ffffff',
      sleeve: 'short',
      print: { kind: 'plaid', base: '#aebccb', petals: ['#7089a6', '#e8e2d0'], center: '', seed: 0, repeat: 2.5 },
    },
    bottom: { kind: 'pants', color: '#7a7c82' },
    feet: { kind: 'slipper', color: '#3d6bb3' },
    extras: { glasses: 'thin', glassesColor: '#7a5a34', shirtCollar: true },
    faces: {
      awake: { eyes: 'open', mouth: 'smile', brows: 'soft', wrinkles: true, browColor: '#f2f0ea' },
      scared: { eyes: 'wide', mouth: 'o', brows: 'worried', wrinkles: true, sweat: true, browColor: '#f2f0ea' },
      asleep: { eyes: 'closed', mouth: 'o', brows: 'soft', wrinkles: true, browColor: '#f2f0ea' },
      happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true, wrinkles: true, browColor: '#f2f0ea' },
    },
  },

  // -------------------------------------------------------------------------
  // 更多場景的 NPC（DESIGN §25）
  // -------------------------------------------------------------------------

  /** 柑仔店的阿嬌：70 幾歲、看得到鬼、嗓門大心很軟。灰色燙髮、碎花上衣、藍圍裙、袖套、老花眼鏡掛胸前 */
  ajiao: {
    id: 'ajiao',
    scale: 0.95,
    skin: '#efc29c',
    hair: { style: 'perm', color: '#c3c0c8' },
    top: {
      kind: 'blouse',
      color: '#ffffff',
      sleeve: 'long',
      accent: '#b8456a',
      print: { base: '#f6e3ea', petals: ['#e0457a', '#f2a24a', '#6a9ad8'], center: '#ffe08a', seed: 41, repeat: 2.6 },
    },
    bottom: { kind: 'wide', color: '#3a3f58' },
    feet: { kind: 'slipper', color: '#e05a8a' },
    extras: { apron: '#3f6aa6', sleeveCovers: '#7fa6d8', readingGlasses: true, earrings: true },
    faces: {
      normal: { eyes: 'open', mouth: 'grin', brows: 'soft', blush: true, wrinkles: true },
      happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true, wrinkles: true },
      scared: { eyes: 'wide', mouth: 'o', brows: 'worried', wrinkles: true, sweat: true },
      surprised: { eyes: 'wide', mouth: 'o', brows: 'worried', wrinkles: true },
    },
  },
  /** 鬼夜市撈金魚的金魚伯（好兄弟）：曬黑、汗衫、短褲、大肚子、草帽往後戴、毛巾掛脖子，笑嘻嘻 */
  jinyubo: {
    id: 'jinyubo',
    scale: 1.04,
    skin: '#e2a878',
    hair: { style: 'crew', color: '#8d8b88' },
    top: { kind: 'singlet', color: '#ecdcb4', sleeve: 'none' },
    bottom: { kind: 'shorts', color: '#35507e' },
    feet: { kind: 'none', color: '#000' },
    belly: true,
    ghost: true,
    extras: { strawHat: '#e8c872', neckTowel: '#fbfaf6' },
    faces: {
      normal: { eyes: 'open', mouth: 'grin', brows: 'soft', blush: true, wrinkles: true, stubble: true },
      happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true, wrinkles: true, stubble: true },
      scared: { eyes: 'wide', mouth: 'o', brows: 'worried', wrinkles: true, sweat: true, stubble: true },
      surprised: { eyes: 'wide', mouth: 'o', brows: 'worried', wrinkles: true, stubble: true },
    },
  },
  /** 鬼夜市賣法器的紅姨（女鬼）：紅色旗袍（盤扣、立領）、低髮髻插金簪、翠玉手鐲、半閉的眼睛、口紅 */
  hongyi: {
    id: 'hongyi',
    scale: 1.0,
    skin: '#f4d8c8',
    hair: { style: 'lowbun', color: '#1e1418' },
    top: {
      kind: 'blouse',
      color: '#ffffff',
      sleeve: 'short',
      accent: '#6e1420',
      print: { base: '#b3262e', petals: ['#d8a444', '#c9404a'], center: '#f2d27a', seed: 7, repeat: 3.2 },
    },
    bottom: { kind: 'skirt', color: '#a8222c' },
    feet: { kind: 'none', color: '#000' },
    ghost: true,
    extras: { collar: true, knots: '#e8c066', bracelet: '#3fae7a', earrings: true },
    faces: {
      normal: { eyes: 'calm', mouth: 'smile', brows: 'soft', lashes: true, lipstick: '#c0243a' },
      happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', lashes: true, blush: true, lipstick: '#c0243a' },
      scared: { eyes: 'wide', mouth: 'o', brows: 'worried', lashes: true },
      surprised: { eyes: 'wide', mouth: 'o', brows: 'worried', lashes: true },
    },
  },
}
