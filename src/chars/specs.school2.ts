import { SPECS, type ChibiSpec } from './specs'

// 廢棄國小保健室的護士阿姨（DESIGN §30）：五〇年代的學校護士，白制服、白裙、低髮髻，陰陽眼才看得到。
// 只用現有的 ChibiSpec 功能；由 src/scene/SchoolRooms.tsx 匯入時登記進 SPECS。

export const SCHOOL2_SPECS: Record<string, ChibiSpec> = {
  nurse: {
    id: 'nurse',
    scale: 0.98,
    skin: '#f0cfb0',
    hair: { style: 'lowbun', color: '#2a2320' },
    top: { kind: 'shirt', color: '#f6f3ec', sleeve: 'short', accent: '#c8423a' },
    bottom: { kind: 'skirt', color: '#eeeae0' },
    feet: { kind: 'shoe', color: '#f2efe8' },
    ghost: true,
    extras: { shirtCollar: true, hairpin: true, glasses: 'thin', glassesColor: '#6b5a48' },
    faces: {
      normal: { eyes: 'calm', mouth: 'smile', brows: 'soft', blush: true, lashes: true },
      happy: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true, lashes: true },
      surprised: { eyes: 'wide', mouth: 'o', brows: 'worried', lashes: true },
    },
  },
}

for (const [id, spec] of Object.entries(SCHOOL2_SPECS)) SPECS[id] ??= spec
