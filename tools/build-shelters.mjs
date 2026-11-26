// 부산시 무더위/한파 쉼터 CSV(공공데이터포털)를 앱에서 쓰는 JSON으로 바꿔요.
// 실행: node tools/build-shelters.mjs
// 입력: data/raw/heat.csv, data/raw/cold.csv (CP949 인코딩)
// 출력: public/data/shelters.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const decoder = new TextDecoder('euc-kr')

function readCsv(path) {
  const text = decoder.decode(readFileSync(path))
  const [, ...rows] = text.trim().split(/\r?\n/)
  return rows.map((line) => {
    // 쉼표가 주소 안에 들어간 경우를 대비해, 앞의 2칸과 뒤의 2칸(좌표)만 확실히 자르고 가운데는 주소로 봐요
    const parts = line.split(',')
    const name = parts[1].trim()
    const lat = Number(parts.at(-1))
    const lng = Number(parts.at(-2))
    const address = parts.slice(2, -2).join(',').trim()
    return { name, address, lng, lat }
  })
}

// 쉼터 이름을 보고 종류를 정해요 (어르신이 알아보기 쉬운 말로)
const TYPES = [
  ['경로당', /경로당|원로의집|노인정|노인회/],
  ['주민센터', /주민센터|행정복지센터|구청/],
  ['복지관', /복지관|복지센터/],
  ['도서관', /도서관/],
  ['은행', /은행|금고|신협|농협|수협/],
  ['공원', /공원|광장|정자|숲/],
  ['파출소', /파출소|치안센터|지구대/],
  ['종교시설', /교회|성당|사찰|절$/],
]
function typeOf(name) {
  for (const [label, re] of TYPES) if (re.test(name)) return label
  return '기타'
}

function guOf(address) {
  return address.match(/부산(?:광역시)?\s+(\S+[구군])/)?.[1] ?? ''
}

const byKey = new Map()
for (const [season, file] of [
  ['heat', 'data/raw/heat.csv'],
  ['cold', 'data/raw/cold.csv'],
]) {
  for (const row of readCsv(file)) {
    // 좌표가 없거나 부산 밖(예: 0,0으로 잘못 들어간 값)이면 지도에 못 올리니까 빼요
    const inBusan = row.lat > 34.8 && row.lat < 35.5 && row.lng > 128.7 && row.lng < 129.4
    if (!inBusan) {
      console.warn(`좌표 오류로 제외: ${row.name} (${row.address})`)
      continue
    }
    // 같은 이름 + 거의 같은 위치면 같은 쉼터로 봐요 (여름·겨울 둘 다 운영하는 곳)
    const key = `${row.name}|${row.lat.toFixed(4)}|${row.lng.toFixed(4)}`
    const existing = byKey.get(key)
    if (existing) {
      if (!existing.seasons.includes(season)) existing.seasons.push(season)
      continue
    }
    byKey.set(key, {
      id: `s${byKey.size + 1}`,
      name: row.name,
      address: row.address,
      gu: guOf(row.address),
      type: typeOf(row.name),
      lng: row.lng,
      lat: row.lat,
      seasons: [season],
    })
  }
}

const shelters = [...byKey.values()]
mkdirSync('public/data', { recursive: true })
writeFileSync('public/data/shelters.json', JSON.stringify(shelters))

const count = (pred) => shelters.filter(pred).length
console.log(`쉼터 ${shelters.length}곳 (여름 ${count((s) => s.seasons.includes('heat'))}, 겨울 ${count((s) => s.seasons.includes('cold'))}, 둘 다 ${count((s) => s.seasons.length === 2)})`)
console.log(`금정구 ${count((s) => s.gu === '금정구')}곳`)
