import type { Map as MapLibreMap } from 'maplibre-gl'

// 기본 지도(liberty)는 확대하면 모든 건물을 입체로 그려요.
// 쉼터만 눈에 띄어야 하니까, 기본 지도의 입체 건물 레이어는 끄고 납작한 건물만 남겨요.
export function keepOnlyShelters3D(map: MapLibreMap) {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type === 'fill-extrusion') map.setLayoutProperty(layer.id, 'visibility', 'none')
  }
}
