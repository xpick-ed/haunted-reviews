import { SPECS, type ChibiSpec } from './specs'

// 廢棄國小的小孩鬼（DESIGN §26.1）：五、六十年代的鄉下小孩，赤腳、汗衫、制服。
// 只用現有的 ChibiSpec 功能；由 src/scene/School.tsx 匯入時登記進 SPECS。

const kidFaces = (blush = true): ChibiSpec['faces'] => ({
  normal: { eyes: 'open', mouth: 'grin', brows: 'soft', blush, eyeSize: 1.3 },
  happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush, eyeSize: 1.25 },
  surprised: { eyes: 'wide', mouth: 'o', brows: 'worried', eyeSize: 1.25 },
  shy: { eyes: 'down', mouth: 'small', brows: 'soft', blush: true, eyeSize: 1.25 },
})

export const SCHOOL_SPECS: Record<string, ChibiSpec> = {
  // 阿弟仔：皮、跑最快，白汗衫、卡其短褲、赤腳、平頭
  guikid1: {
    id: 'guikid1',
    scale: 0.72,
    headScale: 1.12,
    skin: '#e6c09c',
    hair: { style: 'crew', color: '#1f1a18' },
    top: { kind: 'singlet', color: '#f0ece0', sleeve: 'none' },
    bottom: { kind: 'shorts', color: '#a88f5c' },
    feet: { kind: 'none', color: '#000' },
    ghost: true,
    faces: kidFaces(),
  },
  // 阿妹仔：綁兩條辮子、碎花衫、藍裙，害羞
  guikid2: {
    id: 'guikid2',
    scale: 0.7,
    headScale: 1.12,
    skin: '#f3d2b4',
    hair: { style: 'long', color: '#1b1716' },
    top: { kind: 'blouse', color: '#f4e6c8', sleeve: 'short', print: { base: '#f4e6c8', petals: ['#e07a8a', '#f2b45b'], center: '#fff6d8', seed: 23, repeat: 5 } },
    bottom: { kind: 'skirt', color: '#3f5f8f' },
    feet: { kind: 'none', color: '#000' },
    ghost: true,
    faces: { ...kidFaces(), normal: { eyes: 'open', mouth: 'small', brows: 'soft', blush: true, eyeSize: 1.35 } },
  },
  // 阿龍：穿制服（卡其襯衫、白領子、藍短褲、黑布鞋），愛當孩子王
  guikid3: {
    id: 'guikid3',
    scale: 0.75,
    headScale: 1.1,
    skin: '#e9c7a6',
    hair: { style: 'crew', color: '#221c1a' },
    top: { kind: 'shirt', color: '#c9b890', sleeve: 'short' },
    bottom: { kind: 'shorts', color: '#2e3a5e' },
    feet: { kind: 'shoe', color: '#1c1a1c' },
    ghost: true,
    extras: { shirtCollar: true },
    faces: kidFaces(false),
  },
  // 阿珠：西瓜皮、紅上衣、藍拖鞋，最小的一個
  guikid4: {
    id: 'guikid4',
    scale: 0.66,
    headScale: 1.14,
    skin: '#f5d6ba',
    hair: { style: 'bowl', color: '#2a1f1c' },
    top: { kind: 'tee', color: '#d0453a', sleeve: 'short' },
    bottom: { kind: 'shorts', color: '#4a4a52' },
    feet: { kind: 'slipper', color: '#3f7fbf' },
    ghost: true,
    faces: kidFaces(),
  },
}

Object.assign(SPECS, SCHOOL_SPECS)
