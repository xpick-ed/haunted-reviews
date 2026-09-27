import { SPECS, type ChibiSpec } from './specs'
import './specs.station'

// 糖廠的鬼工人、鬼火車車廂裡的乘客（DESIGN §32.3–32.4）。只用現有的 ChibiSpec 功能；
// 由 src/scene/Sugar.tsx、src/scene/GhostTrain.tsx 載入時登記（已經有同 id 的就不蓋掉）。
// 月台上的鬼乘客（學生、阿伯、提皮箱的小姐、阿兵哥）、車掌在 specs.station.ts。

const STATION2_SPECS: Record<string, ChibiSpec> = {
  /** 糖廠的工頭：卡其工作服、草帽、脖子掛毛巾，嗓門大 */
  sugar_foreman: {
    id: 'sugar_foreman',
    scale: 1.08,
    skin: '#c9926a',
    hair: { style: 'crew', color: '#2a2420' },
    top: { kind: 'shirt', color: '#b8a57a', sleeve: 'short' },
    bottom: { kind: 'pants', color: '#6a5c44' },
    feet: { kind: 'shoe', color: '#2a2218' },
    ghost: true,
    extras: { strawHat: '#d8c27a', neckTowel: '#ece8dc', shirtCollar: true },
    faces: { normal: { eyes: 'happy', mouth: 'grin', brows: 'stern', stubble: true } },
  },
  /** 糖廠工人：汗衫、捲起來的褲管、頭巾 */
  sugar_worker1: {
    id: 'sugar_worker1',
    scale: 1.02,
    skin: '#c08a60',
    hair: { style: 'crew', color: '#1c1814' },
    top: { kind: 'singlet', color: '#e9e4d6', sleeve: 'none' },
    bottom: { kind: 'wide', color: '#4a4a44' },
    feet: { kind: 'slipper', color: '#3a342c' },
    ghost: true,
    extras: { bandana: '#e8e0c8' },
    faces: { normal: { eyes: 'open', mouth: 'flat', brows: 'soft' } },
  },
  sugar_worker2: {
    id: 'sugar_worker2',
    scale: 0.98,
    skin: '#cf9a70',
    hair: { style: 'short', color: '#241e1a' },
    top: { kind: 'shirt', color: '#8a9aa6', sleeve: 'long' },
    bottom: { kind: 'wide', color: '#3e3c36' },
    feet: { kind: 'slipper', color: '#3a342c' },
    ghost: true,
    extras: { strawHat: '#cdb46a', sleeveCovers: '#5a6a78' },
    faces: { normal: { eyes: 'calm', mouth: 'small', brows: 'soft' } },
  },
  sugar_worker3: {
    id: 'sugar_worker3',
    scale: 0.94,
    skin: '#d4a07a',
    hair: { style: 'messy', color: '#1a1614' },
    top: { kind: 'singlet', color: '#d9d2c0', sleeve: 'none' },
    bottom: { kind: 'shorts', color: '#4c5a66' },
    feet: { kind: 'slipper', color: '#3a342c' },
    ghost: true,
    extras: { neckTowel: '#e0dccf' },
    faces: { normal: { eyes: 'sleepy', mouth: 'smile', brows: 'soft' } },
  },
  /** 福利社阿姨：花圍裙、袖套 */
  sugar_auntie: {
    id: 'sugar_auntie',
    scale: 1.0,
    skin: '#ecc4a2',
    hair: { style: 'perm', color: '#2a2220' },
    top: { kind: 'blouse', color: '#f0e6d2', sleeve: 'short', print: { base: '#f0e6d2', petals: ['#e07a7a', '#7aa0d0'], center: '#e8c04a', seed: 61, repeat: 2 } },
    bottom: { kind: 'wide', color: '#44485a' },
    feet: { kind: 'slipper', color: '#5a4a3a' },
    ghost: true,
    extras: { apron: '#eee6d6', sleeveCovers: '#7a8ab0', earrings: true },
    faces: { normal: { eyes: 'happy', mouth: 'smile', brows: 'soft', blush: true } },
  },
  /** 抱著空背巾的媽媽：素色衫、盤起來的頭髮，輕輕搖著 */
  gt_mother: {
    id: 'gt_mother',
    scale: 0.98,
    skin: '#f0cbaa',
    hair: { style: 'lowbun', color: '#231c18' },
    top: { kind: 'blouse', color: '#c9d6d0', sleeve: 'long', accent: '#e8efe9' },
    bottom: { kind: 'wide', color: '#3c4a52' },
    feet: { kind: 'slipper', color: '#4a3e34' },
    ghost: true,
    extras: { hairpin: true },
    faces: { normal: { eyes: 'down', mouth: 'smile', brows: 'soft', lashes: true } },
  },
  /** 改考卷的林老師：灰西裝、圓框眼鏡、梳得整整齊齊 */
  gt_teacher: {
    id: 'gt_teacher',
    scale: 1.04,
    skin: '#e8c2a0',
    hair: { style: 'sidepart', color: '#3a3430' },
    top: { kind: 'jacket', color: '#6e6a62', sleeve: 'long', accent: '#e8e2d4' },
    bottom: { kind: 'pants', color: '#4a4640' },
    feet: { kind: 'shoe', color: '#1a1614' },
    ghost: true,
    extras: { glasses: 'thin', glassesColor: '#3a3024', shirtCollar: true, tie: '#5a2a2a' },
    faces: { normal: { eyes: 'calm', mouth: 'flat', brows: 'stern', wrinkles: true } },
  },
  /** 度蜜月的新郎：白襯衫、西裝褲、油頭 */
  gt_groom: {
    id: 'gt_groom',
    scale: 1.06,
    skin: '#e2b894',
    hair: { style: 'sidepart', color: '#141210' },
    top: { kind: 'shirt', color: '#f4f2ea', sleeve: 'long' },
    bottom: { kind: 'pants', color: '#2e3444' },
    feet: { kind: 'shoe', color: '#16161a' },
    ghost: true,
    extras: { shirtCollar: true, tie: '#8f2a20' },
    faces: { normal: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true } },
  },
  /** 度蜜月的新娘：紅洋裝、髮夾、珍珠耳環 */
  gt_bride: {
    id: 'gt_bride',
    scale: 0.96,
    skin: '#f3d0b4',
    hair: { style: 'perm', color: '#1e1614' },
    top: { kind: 'blouse', color: '#d8484a', sleeve: 'short', accent: '#f4e0d8' },
    bottom: { kind: 'skirt', color: '#c83c40' },
    feet: { kind: 'shoe', color: '#f4efe6' },
    ghost: true,
    extras: { hairpin: true, earrings: true },
    faces: { normal: { eyes: 'happy', mouth: 'smile', brows: 'soft', lashes: true, blush: true } },
  },
}

for (const [id, spec] of Object.entries(STATION2_SPECS)) SPECS[id] ??= spec
