import { SPECS } from './specs'

// 情侶客人的長相（DESIGN §29）：用 SPECS.id ??= {...} 登記（只用 ChibiSpec 現有的功能）。由 src/scene/Guests.tsx 載入。

/** 阿傑：新婚的先生，跟老婆穿同一件粉紅色情侶 T */
SPECS.ajie ??= {
  id: 'ajie',
  scale: 1.08,
  skin: '#f2cba8',
  hair: { style: 'short', color: '#2a211d' },
  top: { kind: 'tee', color: '#f7b3c6', sleeve: 'short' },
  bottom: { kind: 'pants', color: '#4a5f86' },
  feet: { kind: 'slipper', color: '#3d6bb3' },
  extras: { logo: '#e0455a' },
  faces: {
    awake: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true },
    scared: { eyes: 'wide', mouth: 'scream', brows: 'worried', fear: true, sweat: true },
    asleep: { eyes: 'closed', mouth: 'smile', brows: 'soft', blush: true },
    happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true },
  },
}

/** 小惠：新婚的太太，同一件情侶 T、長裙、髮夾和小耳環 */
SPECS.xiaohui ??= {
  id: 'xiaohui',
  scale: 0.96,
  skin: '#f7d8c0',
  hair: { style: 'long', color: '#3b2620' },
  top: { kind: 'tee', color: '#f7b3c6', sleeve: 'short' },
  bottom: { kind: 'skirt', color: '#f3eee4' },
  feet: { kind: 'slipper', color: '#f08aa0' },
  extras: { logo: '#e0455a', hairpin: true, earrings: true },
  faces: {
    awake: { eyes: 'open', mouth: 'smile', brows: 'soft', blush: true, lashes: true },
    scared: { eyes: 'wide', mouth: 'scream', brows: 'worried', fear: true, sweat: true, lashes: true },
    asleep: { eyes: 'closed', mouth: 'small', brows: 'soft', blush: true, lashes: true },
    happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', blush: true, lashes: true },
  },
}

/** 王先生：中年、油頭、深藍襯衫、晚上還戴著黑框墨鏡，一直在冒汗 */
SPECS.mrwang ??= {
  id: 'mrwang',
  scale: 1.1,
  skin: '#e6bd98',
  hair: { style: 'sidepart', color: '#1e1a19' },
  top: { kind: 'shirt', color: '#2f4266', sleeve: 'long' },
  bottom: { kind: 'pants', color: '#2b2b31' },
  feet: { kind: 'shoe', color: '#16161a' },
  belly: true,
  extras: { glasses: true, shirtCollar: true },
  faces: {
    awake: { eyes: 'down', mouth: 'flat', brows: 'worried', sweat: true },
    scared: { eyes: 'wide', mouth: 'scream', brows: 'worried', fear: true, sweat: true },
    asleep: { eyes: 'closed', mouth: 'o', brows: 'soft' },
    happy: { eyes: 'happy', mouth: 'smile', brows: 'soft' },
  },
}

/** 王太太（登記的名字）：紅色上衣、黑長裙、低髮髻、口紅、金手鐲、借來的細框墨鏡 */
SPECS.mrswang ??= {
  id: 'mrswang',
  scale: 0.98,
  skin: '#f3d0b4',
  hair: { style: 'lowbun', color: '#5a2e28' },
  top: { kind: 'blouse', color: '#b3263a', sleeve: 'short' },
  bottom: { kind: 'skirt', color: '#26262c' },
  feet: { kind: 'shoe', color: '#7a1f2a' },
  extras: { earrings: true, bracelet: '#e2c76a', glasses: 'thin', glassesColor: '#141414' },
  faces: {
    awake: { eyes: 'calm', mouth: 'small', brows: 'stern', lashes: true, lipstick: '#c0303e' },
    scared: { eyes: 'wide', mouth: 'scream', brows: 'worried', fear: true, sweat: true, lashes: true },
    asleep: { eyes: 'closed', mouth: 'small', brows: 'soft', lashes: true, lipstick: '#c0303e' },
    happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', lashes: true, lipstick: '#c0303e' },
  },
}
