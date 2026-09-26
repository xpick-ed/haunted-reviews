import { SPECS, type ChibiSpec } from './specs'

// horror 的新角色長相（DESIGN §29）：用 SPECS.id ??= {...} 登記（只用 ChibiSpec 現有的功能）。
//   ghostbride       鬼新娘：褪色的紅嫁衣、金色滾邊、長頭髮，頭上沒有簪子（玉簪弄丟了）
//   ghostbride_pin   戴回玉簪、要走的時候
//   jibaoling        客房二的地縛靈：1986 年讀夜校的女孩子，耳下的短髮、白襯衫、深藍百褶裙
//   *_dark           恐怖加強：更蒼白、顏色更暗、淡色的空洞眼睛（頭髮蓋臉、歪頭在 HorrorLayer 做）

const bride: ChibiSpec = {
  id: 'ghostbride',
  scale: 1.0,
  skin: '#ecdcd4',
  hair: { style: 'long', color: '#141016' },
  top: {
    kind: 'blouse',
    color: '#b0585a',
    sleeve: 'long',
    accent: '#cfa85a',
    print: { base: '#a24a4c', petals: ['#c9a25c', '#b8686a'], center: '#dcc07a', seed: 62, repeat: 2.6 },
  },
  bottom: { kind: 'skirt', color: '#8e3c40' },
  feet: { kind: 'none', color: '#000' },
  ghost: true,
  extras: { collar: true, knots: '#cfa85a', earrings: true },
  faces: {
    normal: { eyes: 'down', mouth: 'flat', brows: 'worried', lashes: true, lipstick: '#8a2a34' },
    sad: { eyes: 'down', mouth: 'small', brows: 'worried', lashes: true, lipstick: '#8a2a34' },
    happy: { eyes: 'closed', mouth: 'smile', brows: 'soft', lashes: true, lipstick: '#9a3040' },
  },
}
SPECS.ghostbride ??= bride
SPECS.ghostbride_pin ??= { ...bride, id: 'ghostbride_pin', extras: { ...bride.extras, hairpin: true } }
SPECS.ghostbride_dark ??= {
  ...bride,
  id: 'ghostbride_dark',
  skin: '#d6d2d6',
  hair: { style: 'long', color: '#060508' },
  top: { ...bride.top, color: '#6e2328', accent: '#7a6236', print: { base: '#6a2226', petals: ['#7c6034', '#58181e'], center: '#8a7040', seed: 62, repeat: 2.6 } },
  bottom: { kind: 'skirt', color: '#4e1a1e' },
  faces: {
    normal: { eyes: 'wide', eyeColor: '#e6e2da', eyeSize: 0.8, mouth: 'flat', brows: 'none', lipstick: '#3a1418' },
    sad: { eyes: 'wide', eyeColor: '#e6e2da', eyeSize: 0.8, mouth: 'small', brows: 'none', lipstick: '#3a1418' },
    happy: { eyes: 'closed', mouth: 'small', brows: 'soft', lashes: true, lipstick: '#5a2028' },
  },
}

const girl: ChibiSpec = {
  id: 'jibaoling',
  scale: 0.96,
  skin: '#efdcd2',
  hair: { style: 'short', color: '#1a1416' },
  top: { kind: 'shirt', color: '#eef0f2', sleeve: 'short' },
  bottom: { kind: 'skirt', color: '#2b3550' },
  feet: { kind: 'none', color: '#000' },
  ghost: true,
  extras: { shirtCollar: true },
  faces: {
    normal: { eyes: 'down', mouth: 'small', brows: 'worried', lashes: true },
    relief: { eyes: 'closed', mouth: 'smile', brows: 'soft', lashes: true, blush: true },
  },
}
SPECS.jibaoling ??= girl
SPECS.jibaoling_dark ??= {
  ...girl,
  id: 'jibaoling_dark',
  skin: '#d4d0d4',
  hair: { style: 'long', color: '#060508' },
  top: { kind: 'shirt', color: '#aeb2ba', sleeve: 'short' },
  bottom: { kind: 'skirt', color: '#161c2c' },
  faces: {
    normal: { eyes: 'wide', eyeColor: '#e6e2da', eyeSize: 0.8, mouth: 'flat', brows: 'none' },
    relief: { eyes: 'closed', mouth: 'small', brows: 'soft', lashes: true },
  },
}
