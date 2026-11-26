export type Season = 'heat' | 'cold'

// public/data/shelters.json 한 줄 (tools/build-shelters.mjs가 만들어요)
export type Shelter = {
  id: string
  name: string
  address: string
  gu: string
  type: string // 경로당, 주민센터, 복지관, 도서관, 은행, 공원, 파출소, 종교시설, 기타
  lng: number
  lat: number
  seasons: Season[]
}

// public/data/buildings-금정구.geojson 의 properties (tools/fetch-buildings.mjs가 만들어요)
export type BuildingInfo = {
  shelterId: string
  height: number
  levels: number
  levelsEstimated: boolean
  color: string | null
}

export type LngLat = [number, number]
