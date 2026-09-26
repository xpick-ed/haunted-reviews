// 溪邊＋螢火蟲的畫面（暫時的空殼：一塊地）。規則在 src/world/sceneRiver.ts。

export function RiverScene() {
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[60, 40]} />
      <meshStandardMaterial color="#34402e" roughness={1} />
    </mesh>
  )
}
