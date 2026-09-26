import { SPECS } from './specs'

// nightlife 的新角色長相（DESIGN §29）：用 SPECS.id ??= {...} 登記（只用 ChibiSpec 現有的功能）。
// 老街的鬼那卡西（主唱兼電子琴、吉他手），和山上麻將桌三缺一的桂嬸。

/** 那卡西主唱：油頭、亮紫色西裝外套、白襯衫紅領帶，閉著眼睛唱得很投入 */
SPECS.nakashi ??= {
  id: 'nakashi',
  scale: 1.04,
  skin: '#e8b996',
  hair: { style: 'sidepart', color: '#1e1a1c' },
  top: { kind: 'jacket', color: '#6a2c78', sleeve: 'long', accent: '#e9c46a' },
  bottom: { kind: 'pants', color: '#232028' },
  feet: { kind: 'shoe', color: '#f4f1ea' },
  ghost: true,
  extras: { innerTop: '#f4f1ea', shirtCollar: true, tie: '#c0392b' },
  faces: {
    normal: { eyes: 'closed', mouth: 'o', brows: 'worried', wrinkles: true },
    happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', wrinkles: true },
  },
}

/** 那卡西吉他手：捲毛、黑框墨鏡、花襯衫，很酷不太講話 */
SPECS.nakashi_guitar ??= {
  id: 'nakashi_guitar',
  scale: 1.0,
  skin: '#d9a47e',
  hair: { style: 'perm', color: '#2a2422' },
  top: {
    kind: 'shirt',
    color: '#2a7a8a',
    sleeve: 'short',
    print: {
      base: '#2a7a8a',
      petals: ['#f4d27a', '#f28aa0'],
      center: '#ffffff',
      seed: 29,
      repeat: 2.2,
    },
  },
  bottom: { kind: 'pants', color: '#e8e0cc' },
  feet: { kind: 'shoe', color: '#6a4a2c' },
  ghost: true,
  extras: { glasses: true },
  faces: {
    normal: { eyes: 'calm', mouth: 'smile', brows: 'soft', stubble: true },
    happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', stubble: true },
  },
}

/** 桂嬸：山上的麻將鬼，捲髮、碎花上衣、翠玉手鐲，三缺一等了三十年 */
SPECS.guishen ??= {
  id: 'guishen',
  scale: 0.92,
  skin: '#efc6a6',
  hair: { style: 'perm', color: '#5a4a48' },
  top: {
    kind: 'blouse',
    color: '#b85a6a',
    sleeve: 'short',
    print: {
      base: '#f3d2d8',
      petals: ['#b83a5a', '#e89a3a'],
      center: '#ffffff',
      seed: 47,
      repeat: 2.6,
    },
  },
  bottom: { kind: 'wide', color: '#3a3040' },
  feet: { kind: 'slipper', color: '#b83a5a' },
  ghost: true,
  extras: { earrings: true, bracelet: '#3fae7a', readingGlasses: true },
  faces: {
    normal: {
      eyes: 'happy',
      mouth: 'grin',
      brows: 'soft',
      blush: true,
      wrinkles: true,
    },
  },
}
