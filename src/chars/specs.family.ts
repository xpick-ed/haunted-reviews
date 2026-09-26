import { SPECS } from './specs'

// family 的新角色長相（DESIGN §29）：用 SPECS.id ??= {...} 登記（只用 ChibiSpec 現有的功能）。
// 客人（志明、福伯、志偉）的表情要有 awake／scared／asleep／happy；叔叔、姑姑是 NPC（normal），姑姑晚上睡阿嬤的床（asleep）。
// 福伯的拐杖畫在 src/scene/FamilyLayer.tsx（Chibi 沒有拐杖）。

/** 志明：五十幾歲，一個人照顧爸爸三年。格子襯衫皺皺的、頭髮亂、黑眼圈很重 */
SPECS.zhiming ??= {
  id: 'zhiming',
  scale: 1.07,
  skin: '#e8bf9a',
  hair: { style: 'messy', color: '#4a4442' },
  top: {
    kind: 'shirt',
    color: '#ffffff',
    sleeve: 'short',
    print: { kind: 'plaid', base: '#9fb0a0', petals: ['#5f7a6a', '#e4e0d0'], center: '', seed: 0, repeat: 2.4 },
  },
  bottom: { kind: 'pants', color: '#4c4f58' },
  feet: { kind: 'slipper', color: '#3a3a40' },
  extras: { glasses: 'thin', glassesColor: '#3a3a3a', shirtCollar: true },
  faces: {
    awake: { eyes: 'down', mouth: 'flat', brows: 'worried', bags: true, stubble: true },
    scared: { eyes: 'wide', mouth: 'o', brows: 'worried', sweat: true, bags: true, stubble: true },
    asleep: { eyes: 'closed', mouth: 'small', brows: 'soft', bags: true, stubble: true },
    happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', bags: true, stubble: true },
    normal: { eyes: 'down', mouth: 'flat', brows: 'worried', bags: true, stubble: true },
  },
}

/** 福伯：八十幾歲，失智。白頭髮剃得短短的、毛背心、老花眼鏡，笑起來眼睛瞇成一條線 */
SPECS.fubo ??= {
  id: 'fubo',
  scale: 0.95,
  skin: '#e2b08c',
  hair: { style: 'crew', color: '#e9e7e1' },
  top: { kind: 'cardigan', color: '#9a7a52', sleeve: 'long', accent: '#7d6040' },
  bottom: { kind: 'wide', color: '#6d6a66' },
  feet: { kind: 'slipper', color: '#6b4a32' },
  extras: { innerTop: '#f1ede2', glasses: 'thin', glassesColor: '#8a6a3c' },
  faces: {
    awake: { eyes: 'open', mouth: 'small', brows: 'soft', wrinkles: true, browColor: '#f2f0ea' },
    scared: { eyes: 'wide', mouth: 'o', brows: 'worried', wrinkles: true, browColor: '#f2f0ea' },
    asleep: { eyes: 'closed', mouth: 'o', brows: 'soft', wrinkles: true, browColor: '#f2f0ea' },
    happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true, wrinkles: true, browColor: '#f2f0ea' },
    normal: { eyes: 'happy', mouth: 'smile', brows: 'soft', wrinkles: true, browColor: '#f2f0ea' },
  },
}

/** 志偉：四十歲的上班族。白襯衫、鬆開的深紅領帶、西裝褲、皮鞋，頭髮梳過但塌了 */
SPECS.zhiwei ??= {
  id: 'zhiwei',
  scale: 1.09,
  skin: '#ecc7a6',
  hair: { style: 'sidepart', color: '#221e1e' },
  top: { kind: 'shirt', color: '#eef1f4', sleeve: 'long' },
  bottom: { kind: 'pants', color: '#2d3240' },
  feet: { kind: 'shoe', color: '#1a1614' },
  extras: { tie: '#7a2a36', shirtCollar: true },
  faces: {
    awake: { eyes: 'down', mouth: 'flat', brows: 'worried', bags: true },
    scared: { eyes: 'wide', mouth: 'scream', brows: 'worried', sweat: true, bags: true },
    asleep: { eyes: 'closed', mouth: 'small', brows: 'soft' },
    happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', blush: true },
    normal: { eyes: 'down', mouth: 'flat', brows: 'worried', bags: true },
  },
}

/** 叔叔（阿國）：五十幾歲，在台北做生意。POLO 衫紮進褲子、啤酒肚、金手鍊、油頭 */
SPECS.uncle ??= {
  id: 'uncle',
  scale: 1.1,
  skin: '#dfae86',
  hair: { style: 'sidepart', color: '#16141a' },
  top: { kind: 'tee', color: '#2f4f7a', sleeve: 'short', accent: '#f0e6c8' },
  bottom: { kind: 'pants', color: '#6a5c4a' },
  feet: { kind: 'shoe', color: '#5a3a22' },
  belly: true,
  extras: { shirtCollar: true, bracelet: '#d8ae3e' },
  faces: {
    normal: { eyes: 'open', mouth: 'flat', brows: 'stern', stubble: true },
    happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', stubble: true },
  },
}

/** 姑姑（阿玲）：五十幾歲，嘴巴很利。燙捲的頭髮、珍珠耳環、紫紅色碎花上衣 */
SPECS.aunt ??= {
  id: 'aunt',
  scale: 1.0,
  skin: '#f0caa8',
  hair: { style: 'perm', color: '#3a2626' },
  top: {
    kind: 'blouse',
    color: '#ffffff',
    sleeve: 'short',
    accent: '#7a2a4a',
    print: { base: '#9a3a5e', petals: ['#f4d6e2', '#ffffff'], center: '#e8b34a', seed: 41, repeat: 2.0 },
  },
  bottom: { kind: 'pants', color: '#2f2f3a' },
  feet: { kind: 'shoe', color: '#4a2a2a' },
  extras: { earrings: true },
  faces: {
    normal: { eyes: 'open', mouth: 'flat', brows: 'stern', lashes: true },
    asleep: { eyes: 'closed', mouth: 'small', brows: 'soft', lashes: true },
    happy: { eyes: 'happy', mouth: 'smile', brows: 'soft', blush: true, lashes: true },
  },
}
