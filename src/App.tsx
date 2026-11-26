import { useEffect, useRef } from 'react'
import { Map as MapLibreMap, NavigationControl, setWorkerUrl } from 'maplibre-gl'
// MapLibre 6은 지도를 그리는 보조 파일(worker)을 따로 불러와요.
// Vite가 이 파일을 배포 결과물에 같이 넣도록 주소를 직접 알려 줘요.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

setWorkerUrl(maplibreWorkerUrl)

// 0단계: 부산(서면)을 중심으로 지도가 뜨는지만 확인하는 빈 화면이에요.
// 청사진 스타일, 3D 팝업 건물은 다음 단계에서 붙여요.
const BUSAN_SEOMYEON: [number, number] = [129.0592, 35.1579] // [경도, 위도]

export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mapContainer.current) return

    const map = new MapLibreMap({
      container: mapContainer.current,
      // 무료 지도 타일 (API 키 필요 없음)
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: BUSAN_SEOMYEON,
      zoom: 15.5,
      pitch: 50, // 지도를 기울여서 나중에 3D 건물이 보이게
      bearing: -15,
    })
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right')

    // 화면에서 사라질 때 지도 정리
    return () => map.remove()
  }, [])

  return (
    <main className="relative h-full w-full">
      <div ref={mapContainer} className="h-full w-full" />
      <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-blueprint-line/60 bg-blueprint-900/90 px-4 py-2 text-blueprint-line shadow-lg">
        <p className="text-lg font-bold">팝업 청사진 지도</p>
        <p className="text-xs tracking-widest">POPUP BLUEPRINT · 0단계</p>
      </div>
    </main>
  )
}
