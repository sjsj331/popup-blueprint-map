import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl'
// MapLibre 6은 지도를 그리는 보조 파일(worker)을 따로 불러와요.
// Vite가 이 파일을 배포 결과물에 같이 넣도록 주소를 직접 알려 줘요.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { ExpressionSpecification } from 'maplibre-gl'
import type { BuildingInfo, LngLat, Season, Shelter } from './types'
import { keepOnlyShelters3D } from './lib/mapStyle'
import { boxRing, distanceM } from './lib/geo'
import { BottomBar, TopBar } from './components/Bars'
import { DetailSheet, DirectionsSheet, NearestSheet } from './components/Sheets'

setWorkerUrl(maplibreWorkerUrl)

const DEMO_GU = '금정구'
const FALLBACK_CENTER: LngLat = [129.0922, 35.2429] // 금정구청 근처
const INITIAL_VIEW = { zoom: 15.2, pitch: 55, bearing: -20 }
const NEUTRAL_BUILDING = '#d9d3c7' // 실제 색 정보가 없을 때: 칠하지 않은 콘크리트색
const SEASON_COLOR: Record<Season, string> = { heat: '#ea580c', cold: '#0369a1' } // 밝은 지도 위에서 잘 보이게 진한 색

type BuildingFeature = Feature<Polygon, BuildingInfo>
type Sheet = 'none' | 'detail' | 'directions' | 'nearest'

// 5~9월은 더위 쉼터, 나머지는 추위 쉼터를 먼저 보여 줘요
function defaultSeason(): Season {
  const m = new Date().getMonth() + 1
  return m >= 5 && m <= 9 ? 'heat' : 'cold'
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const pinRef = useRef<Marker | null>(null)
  const [mapReady, setMapReady] = useState(false)

  const [shelters, setShelters] = useState<Shelter[] | null>(null)
  const [buildings, setBuildings] = useState<BuildingFeature[]>([])
  const [loadError, setLoadError] = useState(false)

  const [season, setSeason] = useState<Season>(defaultSeason)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<Sheet>('none')
  const [userPos, setUserPos] = useState<LngLat | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // ---------- 데이터 불러오기 ----------
  const loadData = useCallback(async () => {
    try {
      const [s, b] = await Promise.all([
        fetch('/data/shelters.json').then((r) => r.json()),
        fetch(`/data/buildings-${DEMO_GU}.geojson`).then((r) => r.json()),
      ])
      setShelters(s)
      setBuildings(b.features)
    } catch {
      setLoadError(true)
    }
  }, [])
  useEffect(() => {
    loadData()
  }, [loadData])

  const shelterById = useMemo(() => new Map((shelters ?? []).map((s) => [s.id, s])), [shelters])
  const buildingByShelter = useMemo(() => new Map(buildings.map((f) => [f.properties.shelterId, f.properties])), [buildings])
  const center: LngLat = useMemo(() => {
    const office = shelters?.find((s) => s.name.includes('금정구청'))
    return office ? [office.lng, office.lat] : FALLBACK_CENTER
  }, [shelters])

  const origin: LngLat = userPos ?? center
  const fromLabel = userPos ? '내 위치' : '금정구청'
  const selected = selectedId ? (shelterById.get(selectedId) ?? null) : null
  const selectedMeters = selected ? distanceM(origin, [selected.lng, selected.lat]) : null

  // ---------- 지도 만들기 (한 번만) ----------
  const selectRef = useRef<(id: string) => void>(() => {})
  useEffect(() => {
    if (!mapContainer.current) return
    const map = new MapLibreMap({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: FALLBACK_CENTER,
      ...INITIAL_VIEW,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    if (import.meta.env.DEV) Object.assign(window, { __map: map }) // 개발 중 디버깅용
    map.addControl(new NavigationControl({ visualizePitch: true, showZoom: false }), 'top-right')

    map.on('load', () => {
      keepOnlyShelters3D(map)
      map.addSource('shelter-points', { type: 'geojson', data: EMPTY })
      map.addSource('shelter-buildings', { type: 'geojson', data: EMPTY })
      map.addSource('route', { type: 'geojson', data: EMPTY })
      map.addSource('me', { type: 'geojson', data: EMPTY })

      // 실제 윤곽이 있는 쉼터 건물 (색은 실제 색 → 없으면 중립색)
      map.addLayer({
        id: 'shelter-3d-real',
        type: 'fill-extrusion',
        source: 'shelter-buildings',
        filter: ['==', ['get', 'shape'], 'real'],
        paint: {
          'fill-extrusion-color': ['coalesce', ['get', 'color'], NEUTRAL_BUILDING],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-opacity': 0.95,
        },
      })
      // 윤곽 정보가 없는 쉼터: 반투명 상자로 "여기쯤"만 알려 줘요
      map.addLayer({
        id: 'shelter-3d-box',
        type: 'fill-extrusion',
        source: 'shelter-buildings',
        filter: ['==', ['get', 'shape'], 'box'],
        paint: {
          'fill-extrusion-color': NEUTRAL_BUILDING,
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-opacity': 0.5,
        },
      })
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#1d4ed8', 'line-width': 6, 'line-dasharray': [1.5, 1.5] },
      })
      map.addLayer({
        id: 'shelter-dots',
        type: 'circle',
        source: 'shelter-points',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 16, 10],
          'circle-color': SEASON_COLOR.cold,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
        },
      })
      map.addLayer({
        id: 'shelter-labels',
        type: 'symbol',
        source: 'shelter-points',
        minzoom: 15,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 17,
          'text-anchor': 'top',
          'text-offset': [0, 1],
        },
        paint: { 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 2.5 },
      })
      map.addLayer({
        id: 'me-dot',
        type: 'circle',
        source: 'me',
        paint: { 'circle-radius': 11, 'circle-color': '#2f80ff', 'circle-stroke-color': '#fff', 'circle-stroke-width': 4 },
      })

      for (const layer of ['shelter-3d-real', 'shelter-3d-box', 'shelter-dots']) {
        map.on('click', layer, (e) => {
          const id = e.features?.[0]?.properties?.shelterId ?? e.features?.[0]?.properties?.id
          if (id) selectRef.current(id)
        })
        map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'))
        map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''))
      }
      setMapReady(true)
    })
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // ---------- 데이터 → 지도 ----------
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !shelters) return
    const seasonFlags = (s: Shelter) => ({ heat: s.seasons.includes('heat'), cold: s.seasons.includes('cold') })

    ;(map.getSource('shelter-points') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: shelters.map((s) => ({
        type: 'Feature',
        properties: { id: s.id, name: s.name, ...seasonFlags(s) },
        geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      })),
    })

    // 시연 지역(금정구) 쉼터만 3D로 세워요. 공원처럼 건물이 없는 곳은 점만 보여 줘요.
    const features: Feature[] = []
    for (const s of shelters) {
      if (s.gu !== DEMO_GU || s.type === '공원') continue
      const real = buildings.find((b) => b.properties.shelterId === s.id)
      features.push(
        real
          ? { ...real, properties: { ...real.properties, shape: 'real', ...seasonFlags(s) } }
          : {
              type: 'Feature',
              properties: { shelterId: s.id, shape: 'box', height: 6, color: null, ...seasonFlags(s) },
              geometry: { type: 'Polygon', coordinates: [boxRing([s.lng, s.lat])] },
            },
      )
    }
    ;(map.getSource('shelter-buildings') as GeoJSONSource).setData({ type: 'FeatureCollection', features })
    map.jumpTo({ center })
  }, [mapReady, shelters, buildings, center])

  // 계절이 바뀌면 그 계절 쉼터만 보이게
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const onlySeason: ExpressionSpecification = ['==', ['get', season], true]
    map.setFilter('shelter-dots', onlySeason)
    map.setFilter('shelter-labels', onlySeason)
    map.setFilter('shelter-3d-real', ['all', ['==', ['get', 'shape'], 'real'], onlySeason])
    map.setFilter('shelter-3d-box', ['all', ['==', ['get', 'shape'], 'box'], onlySeason])
    map.setPaintProperty('shelter-dots', 'circle-color', SEASON_COLOR[season])
  }, [season, mapReady])

  // 선택한 쉼터 위에 "여기예요" 표시 (건물을 칠하지 않고 위에 띄워요)
  useEffect(() => {
    pinRef.current?.remove()
    pinRef.current = null
    const map = mapRef.current
    if (!map || !selected) return
    const el = document.createElement('div')
    el.className =
      'pointer-events-none rounded-full border-4 border-white bg-blue-700 px-4 py-2 text-xl font-extrabold text-white shadow-xl'
    el.textContent = '여기예요 ▼'
    pinRef.current = new Marker({ element: el, anchor: 'bottom', offset: [0, -40] })
      .setLngLat([selected.lng, selected.lat])
      .addTo(map)
  }, [selected])

  // 길찾기 화면일 때만 점선 경로 표시
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const data: FeatureCollection =
      sheet === 'directions' && selected
        ? {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: [origin, [selected.lng, selected.lat]] },
              },
            ],
          }
        : EMPTY
    ;(map.getSource('route') as GeoJSONSource).setData(data)
  }, [sheet, selected, origin, mapReady])

  // 내 위치 점
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    ;(map.getSource('me') as GeoJSONSource).setData(
      userPos
        ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: userPos } }] }
        : EMPTY,
    )
  }, [userPos, mapReady])

  // 안내 문구는 4초 뒤 사라져요
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // ---------- 동작 ----------
  const select = useCallback(
    (id: string) => {
      const s = shelterById.get(id)
      if (!s) return
      setSelectedId(id)
      setSheet('detail')
      mapRef.current?.easeTo({
        center: [s.lng, s.lat],
        zoom: Math.max(mapRef.current.getZoom(), 17),
        pitch: 55,
        padding: { top: 80, bottom: Math.round(window.innerHeight * 0.6), left: 0, right: 0 },
        duration: 800,
      })
    },
    [shelterById],
  )
  useEffect(() => {
    selectRef.current = select
  }, [select])

  function findMyLocation() {
    if (!navigator.geolocation) {
      setToast('위치를 찾을 수 없어서 금정구청 기준으로 보여 드려요')
      return
    }
    setToast('내 위치를 찾는 중이에요…')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: LngLat = [pos.coords.longitude, pos.coords.latitude]
        if (distanceM(p, center) > 30_000) {
          setToast('부산 밖이라 금정구청 기준으로 보여 드려요')
          return
        }
        setUserPos(p)
        setToast(null)
        mapRef.current?.easeTo({ center: p, zoom: 16.5, duration: 800 })
      },
      () => setToast('위치 권한이 없어서 금정구청 기준으로 보여 드려요'),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  const nearest = useMemo(() => {
    if (!shelters) return []
    return shelters
      .filter((s) => s.seasons.includes(season))
      .map((s) => ({ shelter: s, meters: distanceM(origin, [s.lng, s.lat]) }))
      .sort((a, b) => a.meters - b.meters)
      .slice(0, 3)
  }, [shelters, season, origin])

  function showNearest() {
    setSelectedId(null)
    setSheet('nearest')
    const map = mapRef.current
    if (!map || nearest.length === 0) return
    const lngs = [origin[0], ...nearest.map((n) => n.shelter.lng)]
    const lats = [origin[1], ...nearest.map((n) => n.shelter.lat)]
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: { top: 180, bottom: 420, left: 60, right: 60 }, maxZoom: 17, pitch: 50, duration: 800 },
    )
  }

  function reset() {
    setSelectedId(null)
    setSheet('none')
    mapRef.current?.easeTo({ center: userPos ?? center, ...INITIAL_VIEW, duration: 800 })
  }

  return (
    <main className="relative h-full w-full overflow-hidden text-lg">
      <div ref={mapContainer} className="h-full w-full" />

      <div className="pointer-events-none absolute inset-0">
        <TopBar season={season} onSeason={setSeason} compact={sheet !== 'none'} />

        {toast && (
          <div className="absolute inset-x-6 top-40 rounded-2xl bg-white px-4 py-3 text-center text-xl font-bold text-slate-900 shadow-xl">
            {toast}
          </div>
        )}

        {!shelters && (
          <div className="pointer-events-auto absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-2xl bg-white/95 p-5 text-center text-xl text-slate-900 shadow-xl">
            {loadError ? (
              <>
                쉼터 정보를 불러오지 못했어요.
                <button
                  type="button"
                  onClick={() => {
                    setLoadError(false)
                    loadData()
                  }}
                  className="mt-3 w-full rounded-full bg-blue-700 py-3 font-bold text-white">
                  다시 시도
                </button>
              </>
            ) : (
              '도면 불러오는 중…'
            )}
          </div>
        )}

        {sheet === 'none' && <BottomBar onMyLocation={findMyLocation} onNearest={showNearest} onReset={reset} />}

        {sheet === 'detail' && selected && (
          <DetailSheet
            shelter={selected}
            building={buildingByShelter.get(selected.id) ?? null}
            meters={selectedMeters}
            fromLabel={fromLabel}
            onDirections={() => setSheet('directions')}
            onClose={() => {
              setSelectedId(null)
              setSheet('none')
            }}
          />
        )}
        {sheet === 'directions' && selected && (
          <DirectionsSheet shelter={selected} meters={selectedMeters} fromLabel={fromLabel} onBack={() => setSheet('detail')} />
        )}
        {sheet === 'nearest' && (
          <NearestSheet items={nearest} fromLabel={fromLabel} onPick={(s) => select(s.id)} onClose={() => setSheet('none')} />
        )}
      </div>
    </main>
  )
}
