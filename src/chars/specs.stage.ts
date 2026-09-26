import { SPECS, type ChibiSpec } from './specs'

// 廟埕野台戲的角色（DESIGN §26.1）：班主、台上的小生與苦旦、台下看戲的村民。
// 只用現有的長相零件；Stage.tsx import 這個檔案時登記進 SPECS。

/** 從現有角色借身體，換衣服顏色（台下的村民） */
function villager(base: string, id: string, top: string, hair?: string, bottom?: string): ChibiSpec {
  const b = SPECS[base]
  return {
    ...b,
    id,
    top: { ...b.top, color: top, print: undefined },
    hair: hair ? { ...b.hair, color: hair } : b.hair,
    bottom: bottom ? { ...b.bottom, color: bottom } : b.bottom,
  }
}

const STAGE_SPECS: Record<string, ChibiSpec> = {
  // 班主：走江湖四十年的老班主，POLO 衫、脖子掛毛巾、老花眼鏡、啤酒肚
  banzhu: {
    id: 'banzhu',
    scale: 1.02,
    skin: '#d9a47e',
    hair: { style: 'crew', color: '#9a9690' },
    top: { kind: 'shirt', color: '#c8453a', sleeve: 'short' },
    bottom: { kind: 'pants', color: '#3b3a40' },
    feet: { kind: 'slipper', color: '#2a2a2a' },
    belly: true,
    extras: { neckTowel: '#f4f1ea', glasses: 'thin', glassesColor: '#3a2a1a', shirtCollar: true },
    faces: {
      normal: { eyes: 'open', mouth: 'smile', brows: 'soft', wrinkles: true, stubble: true },
      worried: { eyes: 'down', mouth: 'flat', brows: 'worried', wrinkles: true, stubble: true, sweat: true },
      happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', wrinkles: true, stubble: true, blush: true },
      surprised: { eyes: 'wide', mouth: 'o', brows: 'worried', wrinkles: true, stubble: true },
    },
  },
  // 小生：白底藍花的戲服、長袍，濃妝
  xiaosheng: {
    id: 'xiaosheng',
    scale: 1.05,
    skin: '#f8e4da',
    hair: { style: 'bun', color: '#141014' },
    top: {
      kind: 'jacket',
      color: '#f5f1e6',
      sleeve: 'long',
      accent: '#2d6fb0',
      print: { base: '#f5f1e6', petals: ['#6fa8dc', '#2d6fb0'], center: '#e8c066', seed: 21, repeat: 2.6 },
    },
    bottom: { kind: 'skirt', color: '#e8e2d2' },
    feet: { kind: 'shoe', color: '#1a1a1a' },
    extras: { collar: true, hairpin: true, knots: '#e8c066' },
    faces: {
      normal: { eyes: 'calm', mouth: 'smile', brows: 'stern', blush: true, lashes: true, lipstick: '#c8202e' },
      happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', blush: true, lashes: true, lipstick: '#c8202e' },
      sad: { eyes: 'down', mouth: 'small', brows: 'worried', blush: true, lashes: true, lipstick: '#c8202e' },
    },
  },
  // 苦旦：粉紅花衫、長裙、長頭髮插髮簪，濃妝
  kudan: {
    id: 'kudan',
    scale: 1.0,
    skin: '#fae8e0',
    hair: { style: 'long', color: '#100c10' },
    top: {
      kind: 'blouse',
      color: '#f4c6d2',
      sleeve: 'long',
      accent: '#b0386a',
      print: { base: '#f4c6d2', petals: ['#e8709a', '#f8f0f4'], center: '#e8c066', seed: 33, repeat: 3 },
    },
    bottom: { kind: 'skirt', color: '#f2dde6' },
    feet: { kind: 'none', color: '#000' },
    extras: { hairpin: true, earrings: true, collar: true, bracelet: '#eadcf0' },
    faces: {
      normal: { eyes: 'calm', mouth: 'small', brows: 'soft', blush: true, lashes: true, lipstick: '#d0243e' },
      happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', blush: true, lashes: true, lipstick: '#d0243e' },
      sad: { eyes: 'down', mouth: 'small', brows: 'worried', blush: true, lashes: true, lipstick: '#d0243e' },
    },
  },
}

// 台下的村民（跟客人長得不一樣：換衣服、換頭髮顏色）
export const VILLAGER_IDS = ['stage_v1', 'stage_v2', 'stage_v3', 'stage_v4'] as const

Object.assign(SPECS, STAGE_SPECS, {
  stage_v1: villager('agui', 'stage_v1', '#6a8a5a', '#d8d4cc', '#40444c'),
  stage_v2: villager('atu', 'stage_v2', '#e6d9b8', undefined, '#5a5046'),
  stage_v3: villager('ahao', 'stage_v3', '#3a5a8a', '#1e1a18', '#2a2c34'),
  stage_v4: villager('linmom', 'stage_v4', '#c87a4a', '#2a201c', '#6a5a4a'),
})
