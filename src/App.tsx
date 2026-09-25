import { Scene } from './scene/Scene'
import { Hud } from './ui/Hud'
import { Blackout, Title } from './ui/Title'
import { useStore } from './store'

export default function App() {
  const started = useStore((s) => s.started)
  return (
    <>
      <div className="stage">
        <Scene />
      </div>
      {started && <Hud />}
      <Blackout />
      <Title />
    </>
  )
}
