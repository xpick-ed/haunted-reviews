import { SPECS, type ChibiSpec } from './specs'

// 村子房子裡的人（DESIGN §30）：透天厝的阿財伯（退休的辦桌總鋪師，看得到鬼）、他的媳婦秀娟。
// 只用現有的 ChibiSpec 功能；由 src/scene/VillageHouses.tsx 載入時登記。

const VILLAGE2_SPECS: Record<string, ChibiSpec> = {
  /** 阿財伯：七十幾歲，大肚子、白平頭，在家穿白色汗衫、短褲、藍白拖，脖子掛毛巾 */
  acai: {
    id: 'acai',
    scale: 1.0,
    skin: '#dca27a',
    hair: { style: 'crew', color: '#e6e3dc' },
    top: { kind: 'singlet', color: '#f4f1ea', sleeve: 'none' },
    bottom: { kind: 'shorts', color: '#4a5a78' },
    feet: { kind: 'slipper', color: '#2f6fb8' },
    belly: true,
    extras: { neckTowel: '#f4f1ea' },
    faces: {
      awake: { eyes: 'open', mouth: 'grin', brows: 'soft', wrinkles: true, browColor: '#f2f0ea' },
      happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true, wrinkles: true, browColor: '#f2f0ea' },
      asleep: { eyes: 'closed', mouth: 'o', brows: 'soft', wrinkles: true, browColor: '#f2f0ea' },
    },
  },
  /** 秀娟：阿財伯的媳婦，四十幾歲，燙髮、碎花居家洋裝（上衣＋寬褲）、塑膠拖鞋 */
  xiujuan: {
    id: 'xiujuan',
    scale: 1.02,
    skin: '#efc3a0',
    hair: { style: 'perm', color: '#3a2a22' },
    top: {
      kind: 'blouse',
      color: '#ffffff',
      sleeve: 'short',
      accent: '#6a8ac2',
      print: { base: '#dbe6f4', petals: ['#6a8ac2', '#f0a0b4'], center: '#ffffff', seed: 41, repeat: 2.6 },
    },
    bottom: { kind: 'wide', color: '#6a6f86' },
    feet: { kind: 'slipper', color: '#d8607a' },
    extras: { earrings: true },
    faces: {
      awake: { eyes: 'down', mouth: 'small', brows: 'soft', blush: true, lashes: true },
      happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', blush: true, lashes: true },
      asleep: { eyes: 'closed', mouth: 'small', brows: 'soft', lashes: true },
    },
  },
}

for (const [id, spec] of Object.entries(VILLAGE2_SPECS)) SPECS[id] ??= spec
