import { Scene } from './scene/Scene'
import { Hud } from './ui/Hud'
import { Intro } from './ui/Intro'
import { useStore } from './store'

export default function App() {
  const started = useStore((s) => s.started)
  return (
    <>
      <div className="stage">
        <Scene />
      </div>
      {started && <Hud />}
      <Intro />
    </>
  )
}
