// 山上墓仔埔的畫面（暫時的空殼：一塊地）。規則在 src/world/sceneHill.ts。

export function HillScene() {
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[60, 40]} />
      <meshStandardMaterial color="#34402e" roughness={1} />
    </mesh>
  )
}
