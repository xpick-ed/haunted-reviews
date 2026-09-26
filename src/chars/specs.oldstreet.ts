import { SPECS, type ChibiSpec } from './specs'

// 老街的人（DESIGN §27.1）：冰果室阿桃、照相館老闆、老戲院的放映師（鬼），還有晚上來吃冰的好兄弟。
// 只用現有的 ChibiSpec 功能；由 src/scene/OldStreet.tsx 載入時登記。

const OLDSTREET_SPECS: Record<string, ChibiSpec> = {
  /** 阿桃：七十幾歲的冰果室老闆娘，看得到鬼。捲髮、碎花上衣、白圍裙、袖套 */
  bingmom: {
    id: 'bingmom',
    scale: 0.93,
    skin: '#f1c6a2',
    hair: { style: 'perm', color: '#8d8a88' },
    top: {
      kind: 'blouse',
      color: '#ffffff',
      sleeve: 'short',
      accent: '#d25a78',
      print: { base: '#fbe2ea', petals: ['#e85a82', '#f4b04a'], center: '#ffffff', seed: 83, repeat: 2.4 },
    },
    bottom: { kind: 'wide', color: '#3b4660' },
    feet: { kind: 'slipper', color: '#e05a7a' },
    extras: { apron: '#f4f1ea', sleeveCovers: '#8ec3e0', earrings: true },
    faces: {
      normal: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true, wrinkles: true },
      happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true, wrinkles: true },
      surprised: { eyes: 'wide', mouth: 'o', brows: 'worried', wrinkles: true },
    },
  },
  /** 照相館老闆：戴細框眼鏡的老先生，白襯衫、深色背心（用開襟衫做）、西裝褲 */
  photographer: {
    id: 'photographer',
    scale: 1.0,
    skin: '#e8b996',
    hair: { style: 'sidepart', color: '#cfcac4' },
    top: { kind: 'cardigan', color: '#4a3a2c', sleeve: 'long' },
    bottom: { kind: 'pants', color: '#3a3a40' },
    feet: { kind: 'shoe', color: '#2a1c14' },
    extras: { glasses: 'thin', glassesColor: '#8a6a3a', innerTop: '#f4f1ea', shirtCollar: true },
    faces: {
      normal: { eyes: 'open', mouth: 'smile', brows: 'soft', wrinkles: true },
      surprised: { eyes: 'wide', mouth: 'o', brows: 'worried', wrinkles: true },
    },
  },
  /** 放映師（鬼）：戲院關了四十年還在等最後一場。平頭、灰色毛衣、吊帶褲感的深色褲子 */
  projectionist: {
    id: 'projectionist',
    scale: 1.02,
    skin: '#e2b494',
    hair: { style: 'crew', color: '#6a6660' },
    top: { kind: 'cardigan', color: '#7a7466', sleeve: 'long' },
    bottom: { kind: 'pants', color: '#2e3036' },
    feet: { kind: 'shoe', color: '#1c1c1e' },
    ghost: true,
    extras: { innerTop: '#d8d0bc', glasses: 'thin', glassesColor: '#2a2a2a' },
    faces: {
      normal: { eyes: 'calm', mouth: 'small', brows: 'soft', wrinkles: true, stubble: true },
      happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', wrinkles: true, stubble: true },
    },
  },
  /** 晚上來吃冰的好兄弟：穿卡其制服的學生（1960 年代） */
  os_ghost_student: {
    id: 'os_ghost_student',
    scale: 0.82,
    headScale: 1.05,
    skin: '#eec3a0',
    hair: { style: 'crew', color: '#1c1a1a' },
    top: { kind: 'shirt', color: '#c9b98a', sleeve: 'short' },
    bottom: { kind: 'shorts', color: '#2f3a5a' },
    feet: { kind: 'shoe', color: '#1c1c1e' },
    ghost: true,
    extras: { shirtCollar: true },
    faces: { normal: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true } },
  },
  /** 晚上來吃冰的好兄弟：穿洋裝的小姐，燙頭髮 */
  os_ghost_lady: {
    id: 'os_ghost_lady',
    scale: 0.95,
    skin: '#f3cdb0',
    hair: { style: 'perm', color: '#2a1e1c' },
    top: {
      kind: 'blouse',
      color: '#ffffff',
      sleeve: 'short',
      accent: '#3a6a9a',
      print: { base: '#dbe8f4', petals: ['#3a6a9a', '#ffffff'], center: '#f4d06a', seed: 91, repeat: 2.2 },
    },
    bottom: { kind: 'skirt', color: '#2c4a6a' },
    feet: { kind: 'shoe', color: '#c8a070' },
    ghost: true,
    extras: { earrings: true, hairpin: true },
    faces: { normal: { eyes: 'calm', mouth: 'smile', brows: 'soft', lashes: true, lipstick: '#c84a5a' } },
  },
}

for (const [id, spec] of Object.entries(OLDSTREET_SPECS)) SPECS[id] ??= spec
