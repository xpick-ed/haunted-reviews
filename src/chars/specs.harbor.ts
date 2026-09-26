import { SPECS } from './specs'

// 海邊漁港的人物（DESIGN §27.1）：燈塔的守燈人（鬼）、晚上坐在碼頭邊的兩個老漁夫（鬼）。
// 只用現有的 ChibiSpec 功能；用 ??=，誰先登記就用誰的。

/** 守燈人：守了一輩子燈塔的老阿伯。深藍色的舊制服外套、帽簷、白頭髮、老花眼鏡 */
SPECS.keeper ??= {
  id: 'keeper',
  scale: 1.02,
  skin: '#d9a57e',
  hair: { style: 'crew', color: '#e8e6e0' },
  top: { kind: 'jacket', color: '#26345a', sleeve: 'long', accent: '#d8b45a' },
  bottom: { kind: 'pants', color: '#1f2940' },
  feet: { kind: 'shoe', color: '#1a1a1a' },
  ghost: true,
  extras: { visor: '#1c2743', glasses: 'thin', glassesColor: '#b8943a', collar: true },
  faces: {
    normal: { eyes: 'calm', mouth: 'flat', brows: 'stern', wrinkles: true, stubble: true, browColor: '#f0eee8' },
    happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', wrinkles: true, stubble: true, browColor: '#f0eee8' },
    surprised: { eyes: 'wide', mouth: 'o', brows: 'worried', wrinkles: true, stubble: true, browColor: '#f0eee8' },
    scared: { eyes: 'wide', mouth: 'o', brows: 'worried', wrinkles: true, sweat: true, browColor: '#f0eee8' },
  },
}

/** 坐在碼頭邊釣魚的老漁夫：草帽、毛巾、汗衫 */
SPECS.harborfisher1 ??= {
  id: 'harborfisher1',
  scale: 1.0,
  skin: '#c98d62',
  hair: { style: 'crew', color: '#5a5650' },
  top: { kind: 'singlet', color: '#e8dcc0', sleeve: 'none' },
  bottom: { kind: 'shorts', color: '#4a5a44' },
  feet: { kind: 'slipper', color: '#3d6bb3' },
  ghost: true,
  extras: { strawHat: '#d8b866', neckTowel: '#f4f2ea' },
  faces: {
    normal: { eyes: 'down', mouth: 'flat', brows: 'soft', wrinkles: true, stubble: true },
    happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', wrinkles: true, stubble: true },
  },
}

/** 在補網的老漁夫：頭巾、格子襯衫 */
SPECS.harborfisher2 ??= {
  id: 'harborfisher2',
  scale: 0.98,
  skin: '#d4996e',
  hair: { style: 'short', color: '#2a2622' },
  top: { kind: 'shirt', color: '#5f7fa8', sleeve: 'long', print: { kind: 'plaid', base: '#5f7fa8', petals: ['#2f4a6e', '#d8d0bc'], center: '', seed: 3, repeat: 2.5 } },
  bottom: { kind: 'pants', color: '#3a3a3e' },
  feet: { kind: 'shoe', color: '#e8c030' },
  ghost: true,
  extras: { bandana: '#c8483a' },
  faces: {
    normal: { eyes: 'open', mouth: 'small', brows: 'soft', wrinkles: true },
    happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', wrinkles: true },
  },
}
