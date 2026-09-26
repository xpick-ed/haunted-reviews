import { SPECS, type ChibiSpec } from './specs'

// 山上墓仔埔的鬼鄰居（DESIGN §26.1）。只用現有的 ChibiSpec 功能；由 src/scene/Hill.tsx 載入時登記。

const HILL_SPECS: Record<string, ChibiSpec> = {
  /** 火伯：山東來的老兵，退伍後在村子裡住了一輩子。白平頭、橄欖綠舊夾克、嘴硬心軟 */
  huobo: {
    id: 'huobo',
    scale: 1.02,
    skin: '#d9ad88',
    hair: { style: 'crew', color: '#e4e2dc' },
    top: { kind: 'jacket', color: '#5f6645', sleeve: 'long' },
    bottom: { kind: 'pants', color: '#4b5137' },
    feet: { kind: 'shoe', color: '#2a2a24' },
    ghost: true,
    extras: { knots: '#c8b060' },
    faces: {
      normal: { eyes: 'open', mouth: 'flat', brows: 'stern', wrinkles: true, stubble: true, browColor: '#eeece6' },
      happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', wrinkles: true, stubble: true, browColor: '#eeece6' },
    },
  },
  /** 玉姨：什麼都知道的八卦阿姨，燙捲髮、紫色碎花上衣、玉手環、搧扇子 */
  yuyi: {
    id: 'yuyi',
    scale: 0.94,
    skin: '#f0c7a4',
    hair: { style: 'perm', color: '#4e3c52' },
    top: {
      kind: 'blouse',
      color: '#ffffff',
      sleeve: 'short',
      accent: '#7a3a92',
      print: { base: '#ead8f2', petals: ['#9a5ac8', '#f09ac0'], center: '#ffe08a', seed: 57, repeat: 2.3 },
    },
    bottom: { kind: 'wide', color: '#3f2c4a' },
    feet: { kind: 'slipper', color: '#9a5ac8' },
    ghost: true,
    extras: { earrings: true, hairpin: true, bracelet: '#6fbf8f' },
    faces: {
      normal: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true, wrinkles: true },
      happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true, wrinkles: true },
      surprised: { eyes: 'wide', mouth: 'o', brows: 'worried', wrinkles: true },
    },
  },
  /** 坐在墳上看山下田的老農夫（不說話） */
  hillfarmer: {
    id: 'hillfarmer',
    scale: 1.0,
    skin: '#d49a72',
    hair: { style: 'bald', color: '#bdbab4' },
    top: { kind: 'shirt', color: '#d8d2c0', sleeve: 'long' },
    bottom: { kind: 'pants', color: '#4a4f5a' },
    feet: { kind: 'none', color: '#000' },
    ghost: true,
    extras: { strawHat: '#d8bd72', neckTowel: '#f2f0ea' },
    faces: { normal: { eyes: 'calm', mouth: 'small', brows: 'soft', wrinkles: true, stubble: true } },
  },
  /** 在自己墳前站著的老太太（不說話），梳包頭、深色開襟衫 */
  hillgranny: {
    id: 'hillgranny',
    scale: 0.9,
    skin: '#eec6a4',
    hair: { style: 'bun', color: '#d6d3d0' },
    top: { kind: 'cardigan', color: '#3e4a5e', sleeve: 'long' },
    bottom: { kind: 'wide', color: '#2c2f38' },
    feet: { kind: 'slipper', color: '#20242c' },
    ghost: true,
    extras: { innerTop: '#e8e2d4', hairpin: true },
    faces: { normal: { eyes: 'calm', mouth: 'small', brows: 'soft', wrinkles: true } },
  },
}

Object.assign(SPECS, HILL_SPECS)
