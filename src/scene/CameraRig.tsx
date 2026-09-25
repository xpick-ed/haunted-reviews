import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'

const WIDE_POS = new THREE.Vector3(19, 14, 22)
const WIDE_LOOK = new THREE.Vector3(0.5, 0.8, 0)
const ROOM_POS = new THREE.Vector3(13.2, 6.4, 10.6)
const ROOM_LOOK = new THREE.Vector3(8.5, 1.0, 3.6)
const PANEL_W = 366 // 橫式時右邊操作面板的寬度（含邊距），畫面往左推一半

// 固定斜視的模型屋鏡頭：滑鼠／手指有視差，點房間會推近，嚇到時會抖。
export function CameraRig() {
  const { camera, size, pointer } = useThree()
  const look = useRef(WIDE_LOOK.clone())
  const base = useMemo(() => new THREE.Vector3(), [])
  const lookTarget = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const aspect = size.width / size.height
    cam.fov = aspect < 1 ? 52 : 36
    // 直式手機：把畫面往上推，底下留給操作面板；橫式：往左推，右邊留給面板
    if (aspect < 1) cam.setViewOffset(size.width, size.height, 0, size.height * 0.17, size.width, size.height)
    else if (size.width >= 760) cam.setViewOffset(size.width, size.height, PANEL_W / 2, 0, size.width, size.height)
    else cam.clearViewOffset()
    cam.updateProjectionMatrix()
  }, [camera, size])

  useFrame((_, dt) => {
    const s = useStore.getState()
    const aspect = size.width / size.height
    const zoomOut = THREE.MathUtils.clamp(1.0 / Math.min(aspect, 1.0), 1, 1.85)
    if (s.focusRoom) {
      base.copy(ROOM_POS).multiplyScalar(1 + (zoomOut - 1) * 0.55)
      lookTarget.copy(ROOM_LOOK)
    } else {
      base.copy(WIDE_POS).multiplyScalar(zoomOut)
      lookTarget.copy(WIDE_LOOK)
    }
    base.x += pointer.x * 1.3
    base.y += pointer.y * 0.7
    const k = 1 - Math.pow(0.02, dt)
    camera.position.lerp(base, k)
    look.current.lerp(lookTarget, k)
    if (s.horror > 0) {
      const a = 0.24 * s.horror
      camera.position.x += (Math.random() - 0.5) * a
      camera.position.y += (Math.random() - 0.5) * a
    }
    camera.lookAt(look.current)
  })
  return null
}
