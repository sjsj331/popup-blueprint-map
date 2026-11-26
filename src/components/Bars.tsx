import type { Season } from '../types'

// 상단: 제목 + 여름/겨울 쉼터 전환 (어르신이 누르기 쉽게 크게)
// 아래 패널이 열려 있을 때는 지도가 잘 보이도록 전환 버튼을 숨겨요.
export function TopBar({
  season,
  onSeason,
  compact,
}: {
  season: Season
  onSeason: (s: Season) => void
  compact: boolean
}) {
  const btn = (s: Season, label: string, active: string) => (
    <button
      type="button"
      onClick={() => onSeason(s)}
      aria-pressed={season === s}
      className={`flex-1 rounded-full py-3 text-xl font-bold transition ${season === s ? active : 'text-slate-600'}`}
    >
      {label}
    </button>
  )
  return (
    <header className="pointer-events-auto absolute inset-x-3 top-3 space-y-2">
      <div className="flex items-baseline justify-between rounded-2xl bg-white/95 px-4 py-2 shadow-lg">
        <p className="text-2xl font-extrabold text-slate-900">우리동네 쉼터</p>
        <p className="text-base font-semibold text-slate-500">부산 금정구</p>
      </div>
      {!compact && (
        <div className="flex gap-1 rounded-full bg-white/95 p-1 shadow-lg">
          {btn('heat', '☀️ 더위 쉼터', 'bg-orange-500 text-white')}
          {btn('cold', '❄️ 추위 쉼터', 'bg-sky-600 text-white')}
        </div>
      )}
    </header>
  )
}

// 하단: 큰 둥근 버튼 3개
export function BottomBar({
  onMyLocation,
  onNearest,
  onReset,
}: {
  onMyLocation: () => void
  onNearest: () => void
  onReset: () => void
}) {
  const cls =
    'flex flex-1 flex-col items-center justify-center gap-1 rounded-3xl bg-white py-3 text-lg font-bold text-slate-900 shadow-lg active:scale-95'
  return (
    <nav className="pointer-events-auto absolute inset-x-3 bottom-8 flex gap-2">
      <button type="button" className={cls} onClick={onMyLocation}>
        <span className="text-2xl">📍</span>내 위치
      </button>
      <button
        type="button"
        className="flex flex-[1.4] flex-col items-center justify-center gap-1 rounded-3xl bg-blue-700 py-3 text-lg font-extrabold text-white shadow-lg active:scale-95"
        onClick={onNearest}
      >
        <span className="text-2xl">🏠</span>가까운 쉼터
      </button>
      <button type="button" className={cls} onClick={onReset}>
        <span className="text-2xl">↻</span>처음 화면
      </button>
    </nav>
  )
}
