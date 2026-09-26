// 1958 年的畫面（暫時的空殼：一塊地）。規則在 src/world/scenePast.ts。

export function PastScene() {
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[60, 40]} />
      <meshStandardMaterial color="#3a3f3a" roughness={1} />
    </mesh>
  )
}
