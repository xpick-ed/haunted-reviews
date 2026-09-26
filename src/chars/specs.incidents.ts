import { SPECS } from './specs'

// 半夜突發事件的人（DESIGN §27.2）：小偷、醉漢。只用現有的 ChibiSpec 功能；由 src/scene/Incidents.tsx 載入時登記。

/** 小偷：黑色連帽 T、深色褲子、反戴的黑帽子，膽子很小 */
SPECS.thief ??= {
  id: 'thief',
  scale: 1.02,
  skin: '#e3b894',
  hair: { style: 'short', color: '#1c1a1c' },
  top: { kind: 'hoodie', color: '#26262c', sleeve: 'long' },
  bottom: { kind: 'pants', color: '#2e3038' },
  feet: { kind: 'shoe', color: '#18181c' },
  extras: { hood: true, cap: '#141418' },
  faces: {
    normal: { eyes: 'down', mouth: 'flat', brows: 'stern', stubble: true },
    scared: { eyes: 'wide', mouth: 'scream', brows: 'worried', fear: true, sweat: true, stubble: true },
  },
}

/** 醉漢：汗衫、短褲、臉紅紅的，想家的中年人 */
SPECS.drunk ??= {
  id: 'drunk',
  scale: 1.06,
  skin: '#e9b08e',
  hair: { style: 'messy', color: '#2a2422' },
  top: { kind: 'singlet', color: '#ece8dc', sleeve: 'none' },
  bottom: { kind: 'shorts', color: '#50607a' },
  feet: { kind: 'slipper', color: '#3d6bb3' },
  belly: true,
  extras: { redNose: true },
  faces: {
    normal: { eyes: 'sleepy', mouth: 'grin', brows: 'soft', blush: true, stubble: true },
    scared: { eyes: 'wide', mouth: 'scream', brows: 'worried', blush: true, stubble: true, sweat: true },
  },
}
