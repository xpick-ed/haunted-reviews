// 夢境的畫面（暫時的空殼：一塊地）。規則在 src/world/sceneDream.ts。

export function DreamScene() {
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[60, 40]} />
      <meshStandardMaterial color="#3d4a33" roughness={1} />
    </mesh>
  )
}
