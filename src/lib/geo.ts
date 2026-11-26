import type { LngLat } from '../types'

// 두 지점 사이 거리(m)
export function distanceM([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// 어르신 걸음(분당 약 60m) 기준 예상 시간
export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 60))
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10}m` : `${(meters / 1000).toFixed(1)}km`
}

// 건물 윤곽 정보가 없는 쉼터용: 좌표를 중심으로 한 작은 정사각형
export function boxRing([lng, lat]: LngLat, sizeM = 12): LngLat[] {
  const half = sizeM / 2
  const dLat = half / 110_540
  const dLng = half / (111_320 * Math.cos((lat * Math.PI) / 180))
  return [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat],
    [lng - dLng, lat + dLat],
    [lng - dLng, lat - dLat],
  ]
}
