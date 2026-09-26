import { useStore } from '../store'
import '../chars/specs.special'
import { TyphoonLayer } from './SpecialTyphoon'
import { GhostLayer } from './SpecialGhost'

// 特別的夜晚的畫面（DESIGN §31.3）：掛在家的場景裡。颱風夜（SpecialTyphoon.tsx）、中元鬼客人夜（SpecialGhost.tsx）。
// 傍晚就看得到（下雨、釘窗戶；普渡的燈籠和供桌），深夜才有模擬裡的東西（漏水、窗板、蠟燭、鬼火、音符）。

export function SpecialLayer() {
  const special = useStore((s) => s.plan.special)
  const phase = useStore((s) => s.phase)
  if (!special || (phase !== 'dusk' && phase !== 'night')) return null
  const night = phase === 'night'
  return special === 'typhoon' ? <TyphoonLayer night={night} /> : <GhostLayer night={night} />
}
