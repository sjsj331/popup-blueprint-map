// 쉼터 좌표에 있는 "실제 건물 윤곽"을 OpenStreetMap에서 가져와요.
// 실행: node tools/fetch-buildings.mjs [구 이름]   (기본값: 금정구)
// 입력: public/data/shelters.json
// 출력: public/data/buildings-<구>.geojson
//
// 건물 색은 우리가 칠하지 않아요. OSM에 실제 색(building:colour)이 있으면 그 값을 그대로 쓰고,
// 없으면 color를 비워 둬서 화면에서 중립색으로 보여 줘요.
import { readFileSync, writeFileSync } from 'node:fs'

const GU = process.argv[2] ?? '금정구'
const SEARCH_RADIUS_M = 30 // 쉼터 좌표 주변 몇 m 안의 건물을 찾을지
const NEAREST_MAX_M = 15 // 좌표가 건물 안에 없을 때, 이 거리 안의 가장 가까운 건물을 같은 건물로 봐요
const LEVEL_HEIGHT_M = 3.2

const shelters = JSON.parse(readFileSync('public/data/shelters.json', 'utf8')).filter((s) => s.gu === GU)
console.log(`${GU} 쉼터 ${shelters.length}곳의 건물을 찾아요`)

const query = `[out:json][timeout:90];
(
${shelters.map((s) => `  way[building](around:${SEARCH_RADIUS_M},${s.lat},${s.lng});`).join('\n')}
);
out tags geom;`

const res = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'shelter-map-hackathon/0.1' },
  body: new URLSearchParams({ data: query }),
})
if (!res.ok) throw new Error(`Overpass 요청 실패: ${res.status} ${await res.text()}`)
const { elements } = await res.json()
const buildings = elements
  .filter((e) => e.type === 'way' && e.geometry?.length >= 4)
  .map((e) => ({ id: e.id, tags: e.tags ?? {}, ring: e.geometry.map((p) => [p.lon, p.lat]) }))
console.log(`주변 건물 ${buildings.length}개를 받았어요`)

// 점이 다각형 안에 있는지 (ray casting)
function contains(ring, [x, y]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

// 대략적인 거리(m): 부산 위도에서는 이 근사로 충분해요
function distanceM([x1, y1], [x2, y2]) {
  const dx = (x2 - x1) * 111_320 * Math.cos((y1 * Math.PI) / 180)
  const dy = (y2 - y1) * 110_540
  return Math.hypot(dx, dy)
}
function nearestDistance(ring, p) {
  return Math.min(...ring.map((q) => distanceM(p, q)))
}

function heightOf(tags) {
  const h = parseFloat(tags.height)
  if (Number.isFinite(h)) return { height: h, levels: Math.max(1, Math.round(h / LEVEL_HEIGHT_M)), estimated: false }
  const lv = parseInt(tags['building:levels'], 10)
  if (Number.isFinite(lv)) return { height: lv * LEVEL_HEIGHT_M, levels: lv, estimated: false }
  return { height: 2 * LEVEL_HEIGHT_M, levels: 2, estimated: true } // 층수 정보가 없으면 2층으로 추정
}

const features = []
const missing = []
for (const s of shelters) {
  const p = [s.lng, s.lat]
  let match = buildings.find((b) => contains(b.ring, p))
  if (!match) {
    const near = buildings
      .map((b) => ({ b, d: nearestDistance(b.ring, p) }))
      .filter((x) => x.d <= NEAREST_MAX_M)
      .sort((a, b) => a.d - b.d)[0]
    match = near?.b
  }
  if (!match) {
    missing.push(s.name)
    continue
  }
  const { height, levels, estimated } = heightOf(match.tags)
  features.push({
    type: 'Feature',
    properties: {
      shelterId: s.id,
      osmId: match.id,
      height,
      levels,
      levelsEstimated: estimated,
      color: match.tags['building:colour'] ?? null,
      roofColor: match.tags['roof:colour'] ?? null,
    },
    geometry: { type: 'Polygon', coordinates: [match.ring] },
  })
}

writeFileSync(`public/data/buildings-${GU}.geojson`, JSON.stringify({ type: 'FeatureCollection', features }))
console.log(`건물을 찾은 쉼터: ${features.length}곳 / 못 찾은 쉼터: ${missing.length}곳`)
console.log(`실제 색 정보가 있는 건물: ${features.filter((f) => f.properties.color).length}곳`)
console.log(`층수 정보가 있는 건물: ${features.filter((f) => !f.properties.levelsEstimated).length}곳`)
if (missing.length) console.log('못 찾은 쉼터 (화면에서는 기본 상자로 보여 줘요):', missing.join(', '))
