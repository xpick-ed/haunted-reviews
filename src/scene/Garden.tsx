// 後院菜園＋雞舍的畫面（暫時的空殼：一塊地）。規則在 src/world/sceneGarden.ts。

export function GardenScene() {
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[60, 40]} />
      <meshStandardMaterial color="#3d4a33" roughness={1} />
    </mesh>
  )
}
