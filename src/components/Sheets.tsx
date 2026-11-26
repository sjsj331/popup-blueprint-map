import type { ReactNode } from 'react'
import type { BuildingInfo, Shelter } from '../types'
import { formatDistance, walkMinutes } from '../lib/geo'

// 아래쪽 패널 틀. 지도(건물)가 보이도록 화면의 60%까지만 차지해요.
function Sheet({ children, onClose, closeLabel = '닫기' }: { children: ReactNode; onClose: () => void; closeLabel?: string }) {
  return (
    <section className="pointer-events-auto absolute inset-x-0 bottom-0 max-h-[60%] overflow-y-auto rounded-t-3xl bg-white px-4 pb-5 pt-3 text-slate-900 shadow-[0_-8px_30px_rgba(0,0,0,0.25)]">
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="absolute right-3 top-3 flex h-12 min-w-12 items-center justify-center rounded-full border-2 border-slate-300 px-3 text-xl font-bold text-slate-700"
      >
        {closeLabel === '닫기' ? '✕' : closeLabel}
      </button>
      {children}
    </section>
  )
}

// 정보 표
function TitleBlock({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <table className="w-full overflow-hidden rounded-xl border-2 border-slate-200 text-lg">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-slate-200 last:border-0">
            <th className="w-16 bg-slate-50 px-2 py-1.5 text-left align-top font-bold text-slate-500">
              {k}
            </th>
            <td className="px-3 py-1.5 leading-snug">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const bigBtn = 'flex w-full items-center justify-center gap-2 rounded-full py-4 text-xl font-extrabold active:scale-[0.98]'

function DistanceLine({ meters, fromLabel }: { meters: number | null; fromLabel: string }) {
  if (meters == null) return null
  return (
    <p className="mt-2 text-xl">
      {fromLabel}에서 <b className="text-blue-700">{formatDistance(meters)}</b> · 걸어서{' '}
      <b className="text-blue-700">{walkMinutes(meters)}분</b>
    </p>
  )
}

export function DetailSheet({
  shelter,
  building,
  meters,
  fromLabel,
  onDirections,
  onClose,
}: {
  shelter: Shelter
  building: BuildingInfo | null
  meters: number | null
  fromLabel: string
  onDirections: () => void
  onClose: () => void
}) {
  const buildingText = building
    ? `실제 건물 모양 · ${building.levels}층${building.levelsEstimated ? '(추정)' : ''}`
    : shelter.type === '공원'
      ? '야외 쉼터 (건물 없음)'
      : '건물 모양 정보 없음 (위치만 표시)'
  const seasonText = [shelter.seasons.includes('heat') && '여름', shelter.seasons.includes('cold') && '겨울']
    .filter(Boolean)
    .join(' · ')
  return (
    <Sheet onClose={onClose}>
      <p className="text-base font-bold text-blue-700">쉼터 정보</p>
      <h2 className="mb-2 mr-14 mt-1 text-[1.7rem] font-extrabold leading-tight">{shelter.name}</h2>
      <TitleBlock
        rows={[
          ['종류', `${shelter.type} · ${seasonText} 쉼터`],
          ['주소', shelter.address],
          ['건물', buildingText],
        ]}
      />
      <DistanceLine meters={meters} fromLabel={fromLabel} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" className={`${bigBtn} bg-blue-700 text-white`} onClick={onDirections}>
          🧭 길찾기
        </button>
        <a
          className={`${bigBtn} border-2 border-slate-300 text-slate-900`}
          href={`https://map.kakao.com/link/roadview/${shelter.lat},${shelter.lng}`}
          target="_blank"
          rel="noreferrer"
        >
          📷 건물 사진
        </a>
      </div>
      <a
        className="mt-2 flex w-full items-center justify-between rounded-2xl bg-slate-100 px-4 py-3 text-lg"
        href="tel:120"
      >
        <span>문이 열렸는지 궁금하면</span>
        <b className="rounded-full bg-green-700 px-3 py-1 text-xl text-white">📞 120</b>
      </a>
    </Sheet>
  )
}

export function DirectionsSheet({
  shelter,
  meters,
  fromLabel,
  onBack,
}: {
  shelter: Shelter
  meters: number | null
  fromLabel: string
  onBack: () => void
}) {
  const kakao = `https://map.kakao.com/link/to/${encodeURIComponent(shelter.name)},${shelter.lat},${shelter.lng}`
  const naver = `https://map.naver.com/p/search/${encodeURIComponent(shelter.address)}`
  return (
    <Sheet onClose={onBack} closeLabel="← 뒤로">
      <p className="text-base font-bold text-blue-700">출발 전 확인</p>
      <h2 className="mr-24 mt-1 text-[1.7rem] font-extrabold leading-tight">{shelter.name}</h2>
      <DistanceLine meters={meters} fromLabel={fromLabel} />
      <p className="mt-1 text-lg text-slate-600">지도의 점선이 가는 방향이에요.</p>
      <div className="mt-3 space-y-2">
        <a className={`${bigBtn} bg-blue-700 text-white`} href={kakao} target="_blank" rel="noreferrer">
          카카오맵으로 길 안내
        </a>
        <a className={`${bigBtn} border-2 border-slate-300 text-slate-900`} href={naver} target="_blank" rel="noreferrer">
          네이버지도에서 보기
        </a>
      </div>
    </Sheet>
  )
}

export function NearestSheet({
  items,
  fromLabel,
  onPick,
  onClose,
}: {
  items: { shelter: Shelter; meters: number }[]
  fromLabel: string
  onPick: (s: Shelter) => void
  onClose: () => void
}) {
  return (
    <Sheet onClose={onClose}>
      <p className="text-base font-bold text-blue-700">가까운 쉼터</p>
      <h2 className="mb-3 mr-14 mt-1 text-2xl font-extrabold">{fromLabel}에서 가까운 곳</h2>
      <ol className="space-y-2">
        {items.map(({ shelter, meters }, i) => (
          <li key={shelter.id}>
            <button
              type="button"
              onClick={() => onPick(shelter)}
              className="flex w-full items-center gap-3 rounded-2xl border-2 border-slate-200 p-3 text-left active:scale-[0.98]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-700 text-2xl font-extrabold text-white">
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xl font-bold">{shelter.name}</span>
                <span className="block text-lg text-slate-600">
                  {formatDistance(meters)} · 걸어서 {walkMinutes(meters)}분
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </Sheet>
  )
}
