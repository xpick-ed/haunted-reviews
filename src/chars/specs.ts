import type { FaceSpec } from './faces'

// 每個角色的長相：身材、髮型、衣服、配件、表情。
// 顏色跟 2D 插畫（src/art/）對齊，對話框的頭像跟 3D 角色是同一個人。

export type HairStyle = 'bun' | 'long' | 'short' | 'bald' | 'crew' | 'perm'
export type TopKind = 'blouse' | 'hoodie' | 'tee' | 'singlet' | 'jacket'
export type BottomKind = 'wide' | 'pants' | 'shorts'
export type Sleeve = 'long' | 'short' | 'none'

export interface Print {
  base: string
  petals: string[]
  center: string
  seed: number
  repeat?: number
}

export interface ChibiSpec {
  id: string
  /** 整體縮放（大人 1.1、老人 1.0、小孩 0.8） */
  scale: number
  skin: string
  hair: { style: HairStyle; color: string }
  top: { kind: TopKind; color: string; sleeve: Sleeve; print?: Print; accent?: string }
  bottom: { kind: BottomKind; color: string; print?: Print }
  feet: { kind: 'slipper' | 'shoe' | 'none'; color: string }
  belly?: boolean
  ghost?: boolean
  extras?: {
    earrings?: boolean
    hairpin?: boolean
    collar?: boolean
    towel?: boolean
    glasses?: boolean
    visor?: string
    redNose?: boolean
    hood?: boolean
    knots?: string
  }
  faces: Record<string, FaceSpec>
}

export const SPECS: Record<string, ChibiSpec> = {
  grandma: {
    id: 'grandma',
    scale: 1.0,
    skin: '#f3cfae',
    hair: { style: 'bun', color: '#bcc2cd' },
    top: {
      kind: 'blouse',
      color: '#ffffff',
      sleeve: 'long',
      accent: '#6f3f95',
      print: { base: '#8e5bb5', petals: ['#f4f1ea', '#f6c6ea'], center: '#e8b34a', seed: 11, repeat: 2.2 },
    },
    bottom: { kind: 'wide', color: '#363c5c' },
    feet: { kind: 'none', color: '#000' },
    ghost: true,
    extras: { earrings: true, hairpin: true, collar: true, knots: '#f3e6c8' },
    faces: {
      normal: { eyes: 'happy', mouth: 'grin', brows: 'soft', blush: true, wrinkles: true },
      reach: { eyes: 'happy', mouth: 'smile', brows: 'soft', blush: true, wrinkles: true },
    },
  },
  xiaomei: {
    id: 'xiaomei',
    scale: 0.96,
    skin: '#f6d6bd',
    hair: { style: 'long', color: '#4a2e22' },
    top: { kind: 'hoodie', color: '#f4a6c0', sleeve: 'long' },
    bottom: { kind: 'pants', color: '#9aa0ab' },
    feet: { kind: 'none', color: '#000' },
    extras: { hood: true },
    faces: {
      awake: { eyes: 'down', mouth: 'small', brows: 'soft', blush: true, lashes: true },
      scared: { eyes: 'wide', mouth: 'scream', brows: 'worried', fear: true, sweat: true },
      asleep: { eyes: 'closed', mouth: 'o', blush: true, lashes: true, brows: 'soft' },
    },
  },
  xiaohan: {
    id: 'xiaohan',
    scale: 1.1,
    skin: '#ebc39f',
    hair: { style: 'short', color: '#1e1a1c' },
    top: { kind: 'tee', color: '#7ea8d2', sleeve: 'short' },
    bottom: { kind: 'shorts', color: '#b89a6c' },
    feet: { kind: 'slipper', color: '#3d6bb3' },
    extras: { towel: true },
    faces: { normal: { eyes: 'open', mouth: 'smile', brows: 'soft' } },
  },
  ayi: {
    id: 'ayi',
    scale: 1.06,
    skin: '#f1bf9c',
    hair: { style: 'bald', color: '#4b4a4e' },
    top: { kind: 'singlet', color: '#f2efe6', sleeve: 'none' },
    bottom: { kind: 'shorts', color: '#5b606c' },
    feet: { kind: 'none', color: '#000' },
    belly: true,
    ghost: true,
    extras: { redNose: true },
    faces: { normal: { eyes: 'sleepy', mouth: 'grin', brows: 'soft', blush: true, stubble: true } },
  },
  miaogong: {
    id: 'miaogong',
    scale: 1.06,
    skin: '#e8c19f',
    hair: { style: 'crew', color: '#9b9ca2' },
    top: { kind: 'jacket', color: '#26314f', sleeve: 'long' },
    bottom: { kind: 'pants', color: '#6a6d74' },
    feet: { kind: 'shoe', color: '#1b1b1d' },
    extras: { glasses: true, knots: '#d8a444' },
    faces: { normal: { eyes: 'open', mouth: 'flat', brows: 'stern', wrinkles: true } },
  },
  agui: {
    id: 'agui',
    scale: 0.94,
    skin: '#eec39f',
    hair: { style: 'perm', color: '#2d2430' },
    top: {
      kind: 'blouse',
      color: '#ffffff',
      sleeve: 'short',
      accent: '#1f7a6c',
      print: { base: '#2f9a8a', petals: ['#f2a24a', '#ffe08a'], center: '#c0392b', seed: 23, repeat: 2.2 },
    },
    bottom: { kind: 'wide', color: '#ffffff', print: { base: '#6b3fa0', petals: ['#f6c6ea', '#ffffff'], center: '#f2c44a', seed: 31, repeat: 1.6 } },
    feet: { kind: 'slipper', color: '#c0392b' },
    extras: { visor: '#5fd0a0', earrings: true },
    faces: { normal: { eyes: 'happy', mouth: 'goldgrin', brows: 'soft', blush: true, wrinkles: true } },
  },
}
