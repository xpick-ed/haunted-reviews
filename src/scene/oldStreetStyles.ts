import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'
import { lanternAt } from './daylight'
import type { LotStyle } from './OldStreetFacades'

// 老街牌樓厝的樣子（OldStreet.tsx、OldStreetWest.tsx、OldStreetEast.tsx 共用）

/** 立面的樣子（顏色、家徽、招牌） */
export const STYLES: Record<string, LotStyle> = {
  barber: {
    color: '#b9cdb4',
    crest: '新',
    crestColor: '#2e5a3a',
    windows: 'glass',
    sign: { text: '新美理髮廳', bg: '#1d4f8a', fg: '#fdf6e8', frame: '#e8e2d4' },
    vsign: { text: '理髮', bg: '#f4f1ea', fg: '#c62828' },
  },
  herb: {
    color: '#bdb6a8',
    crest: '和',
    crestColor: '#5a3a1a',
    windows: 'shutter',
    sign: { text: '和春中藥行', bg: '#1c1a18', fg: '#e9c46a', frame: '#b08a3a', sub: '參茸燕窩．丸散膏丹' },
    vsign: { text: '中藥', bg: '#1c1a18', fg: '#e9c46a' },
  },
  cinema: { color: '#d9ccb0', windows: 'glass', noWindows: true },
  ice: {
    color: '#e6c2bc',
    crest: '桃',
    crestColor: '#c2385a',
    windows: 'glass',
    sign: { text: '阿桃冰果室', bg: '#d8342b', fg: '#fff6e2', frame: '#f4efe2', sub: '清涼消暑．剉冰．果汁' },
  },
  photo: {
    color: '#b8c6cf',
    crest: '光',
    crestColor: '#1d4f8a',
    windows: 'glass',
    sign: { text: '光明照相館', bg: '#f4efe2', fg: '#1d4f8a', frame: '#1d4f8a', sub: '人像．結婚照．證件' },
    vsign: { text: '照相', bg: '#1d4f8a', fg: '#fdf6e8' },
  },
  cloth: {
    color: '#d9c29a',
    crest: '錦',
    crestColor: '#8f2a20',
    windows: 'shutter',
    sign: { text: '錦繡布莊', bg: '#8f2a20', fg: '#f4d27a', frame: '#e9c46a' },
    vsign: { text: '布莊', bg: '#f4efe2', fg: '#8f2a20' },
  },
  end: { color: '#c4c0b8', windows: 'shutter' },
}


/** 二樓的窗（晚上亮）：跟村子的一樣，天黑變成屋裡的燈光 */
export function useWindowGlowMat(color: string, strength: number) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#1a2230', toneMapped: false, side: THREE.DoubleSide }), [])
  const on = useMemo(() => new THREE.Color(color), [color])
  const off = useMemo(() => new THREE.Color('#1c2533'), [])
  useFrame(() => {
    const l = lanternAt(useStore.getState().time)
    mat.color.copy(off).lerp(on, THREE.MathUtils.clamp(l * strength, 0, 1.3))
  })
  return mat
}

