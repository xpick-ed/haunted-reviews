// 小火車站的畫面（暫時的空殼：一塊地）。規則在 src/world/sceneStation.ts。

export function StationScene() {
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[60, 40]} />
      <meshStandardMaterial color="#3a3f3a" roughness={1} />
    </mesh>
  )
}
