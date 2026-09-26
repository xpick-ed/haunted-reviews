import { SPECS } from './specs'

// 溪邊玩水的兩個小鬼（DESIGN §26.1）：阿弟仔、阿妹仔。國小那邊也會出現同一對小孩，所以用 ??=：
// 誰先載入就用誰的定義，兩邊長得一樣就好（只用現有的 ChibiSpec 功能）。

SPECS.guikid1 ??= {
  id: 'guikid1',
  scale: 0.7,
  headScale: 1.12,
  skin: '#e6b48c',
  hair: { style: 'crew', color: '#1e1a1a' },
  // 舊式的白色吊嘎、卡其短褲、打赤腳
  top: { kind: 'singlet', color: '#f2efe6', sleeve: 'none' },
  bottom: { kind: 'shorts', color: '#8a7a56' },
  feet: { kind: 'none', color: '#000' },
  ghost: true,
  faces: {
    normal: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true, eyeSize: 1.3 },
    happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true, eyeSize: 1.3 },
    surprised: { eyes: 'wide', mouth: 'o', brows: 'soft', eyeSize: 1.3 },
  },
}

SPECS.guikid2 ??= {
  id: 'guikid2',
  scale: 0.66,
  headScale: 1.14,
  skin: '#f2cfb2',
  hair: { style: 'ponytail', color: '#221818' },
  // 碎花洋裝、紅髮圈
  top: { kind: 'blouse', color: '#f4e2c8', sleeve: 'short', print: { base: '#f4e2c8', petals: ['#e87a8a', '#f2c14e'], center: '#fff6e0', seed: 7, repeat: 4 } },
  bottom: { kind: 'skirt', color: '#e7a0a8' },
  feet: { kind: 'slipper', color: '#d8443a' },
  ghost: true,
  extras: { hairTie: '#d8443a' },
  faces: {
    normal: { eyes: 'open', mouth: 'small', brows: 'soft', blush: true, eyeSize: 1.35, lashes: true },
    happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', blush: true, eyeSize: 1.3, lashes: true },
    surprised: { eyes: 'wide', mouth: 'o', brows: 'worried', eyeSize: 1.3, lashes: true },
  },
}
