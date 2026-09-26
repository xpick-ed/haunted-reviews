import { SPECS, type ChibiSpec } from './specs'

// 回到 1958 的人（DESIGN §27.1）：年輕的阿春、年輕的阿公、婆婆、叔公、嬸婆。
// 只用現有的 ChibiSpec 功能；src/scene/Past.tsx 載入時登記。都是活人（不是鬼）。

const PAST_SPECS: Record<string, ChibiSpec> = {
  /** 十八歲的阿春：黑長髮綁起來、紅碎花短袖衫、深藍寬褲、木屐前是借來的布鞋 */
  youngchun: {
    id: 'youngchun',
    scale: 0.98,
    skin: '#f2cba6',
    hair: { style: 'ponytail', color: '#231a18' },
    top: {
      kind: 'blouse',
      color: '#ffffff',
      sleeve: 'short',
      accent: '#b8453a',
      print: { base: '#d8574a', petals: ['#fbe8d2', '#f6c05a'], center: '#fff4e0', seed: 58, repeat: 2.4 },
    },
    bottom: { kind: 'wide', color: '#2f3a5a' },
    feet: { kind: 'shoe', color: '#3a2c28' },
    extras: { hairTie: '#c0392b', collar: true },
    faces: {
      normal: { eyes: 'open', mouth: 'smile', brows: 'soft', blush: true, lashes: true },
      happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true, lashes: true },
      surprised: { eyes: 'wide', mouth: 'o', brows: 'worried', lashes: true, sweat: true },
    },
  },
  /** 二十出頭的林添福：平頭、曬黑、白汗衫、捲起來的卡其褲，笑起來很憨 */
  agong: {
    id: 'agong',
    scale: 1.08,
    skin: '#d9a07a',
    hair: { style: 'crew', color: '#1b1716' },
    top: { kind: 'singlet', color: '#f4f1e8', sleeve: 'none' },
    bottom: { kind: 'shorts', color: '#9a8a62' },
    feet: { kind: 'none', color: '#000' },
    extras: { neckTowel: '#f2f0ea' },
    faces: {
      normal: { eyes: 'open', mouth: 'small', brows: 'soft', blush: true },
      happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true },
      surprised: { eyes: 'wide', mouth: 'o', brows: 'worried', sweat: true },
    },
  },
  /** 婆婆：梳包頭、深色大襟衫、嘴巴嚴、心很軟 */
  popo: {
    id: 'popo',
    scale: 0.94,
    skin: '#e8b996',
    hair: { style: 'bun', color: '#3a3438' },
    top: { kind: 'blouse', color: '#3d4a5c', sleeve: 'long', accent: '#262d3a' },
    bottom: { kind: 'wide', color: '#1f2430' },
    feet: { kind: 'slipper', color: '#6a4a32' },
    extras: { hairpin: true, knots: '#c9b27c', collar: true },
    faces: {
      normal: { eyes: 'calm', mouth: 'flat', brows: 'stern', wrinkles: true },
      happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', wrinkles: true, blush: true },
    },
  },
  /** 叔公：白鬍渣、瓜皮帽不做，戴草帽、藍色唐衫，愛開玩笑 */
  shugong: {
    id: 'shugong',
    scale: 1.0,
    skin: '#dcaa84',
    hair: { style: 'bald', color: '#d8d6d0' },
    top: { kind: 'shirt', color: '#4f6f96', sleeve: 'long' },
    bottom: { kind: 'pants', color: '#2d2d34' },
    feet: { kind: 'slipper', color: '#3a3028' },
    extras: { strawHat: '#d8bd72' },
    faces: {
      normal: { eyes: 'happy', mouth: 'grin', brows: 'soft', wrinkles: true, stubble: true, browColor: '#eeece6' },
    },
  },
  /** 嬸婆：燙頭髮還沒流行，梳低髻、碎花衫、手上搖扇子 */
  shenpo: {
    id: 'shenpo',
    scale: 0.92,
    skin: '#eec39f',
    hair: { style: 'lowbun', color: '#2f2a2e' },
    top: {
      kind: 'blouse',
      color: '#ffffff',
      sleeve: 'long',
      accent: '#2e6f5c',
      print: { base: '#6fa88a', petals: ['#f2e6c8', '#f6b0a0'], center: '#f2c44a', seed: 71, repeat: 2.0 },
    },
    bottom: { kind: 'wide', color: '#2a2a36' },
    feet: { kind: 'slipper', color: '#7a3a2a' },
    extras: { earrings: true, hairpin: true },
    faces: {
      normal: { eyes: 'happy', mouth: 'smile', brows: 'soft', wrinkles: true, blush: true },
    },
  },
}

for (const [id, spec] of Object.entries(PAST_SPECS)) SPECS[id] ??= spec
