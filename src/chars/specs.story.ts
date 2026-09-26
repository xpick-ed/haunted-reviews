import { SPECS } from './specs'

// 主線的角色（DESIGN §28.3）：建商陳董。西裝、油頭、金錶、有點肚子，笑起來很有禮貌。
SPECS.chendong ??= {
  id: 'chendong',
  scale: 1.12,
  skin: '#e6bd97',
  hair: { style: 'sidepart', color: '#141214' },
  top: { kind: 'jacket', color: '#2b2f3a', sleeve: 'long' },
  bottom: { kind: 'pants', color: '#2b2f3a' },
  feet: { kind: 'shoe', color: '#120f0d' },
  belly: true,
  extras: { shirtCollar: true, tie: '#9b1f2a', bracelet: '#d8ae3e' },
  faces: {
    normal: { eyes: 'calm', mouth: 'smile', brows: 'soft' },
    happy: { eyes: 'happy', mouth: 'goldgrin', brows: 'soft' },
  },
}
