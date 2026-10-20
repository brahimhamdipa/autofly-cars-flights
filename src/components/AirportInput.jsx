import { useMemo, useState } from 'react'
import AIRPORTS from '../data/airports.json'

// "New York" should find "Zürich"-style names too: match without accents.
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

function searchAirports(q) {
  const query = norm(q).trim()
  if (!query) return []
  const scored = []
  for (const a of AIRPORTS) {
    const iata = a.iata.toLowerCase()
    const city = norm(a.city)
    const name = norm(a.name)
    let score = -1
    if (iata === query) score = 100
    else if (iata.startsWith(query)) score = 90
    else if (city.startsWith(query)) score = 80
    else if (name.startsWith(query)) score = 70
    else if (city.includes(query)) score = 60
    else if (name.includes(query)) score = 50
    if (score >= 0) scored.push({ a, score: score + a.size })
  }
  return scored.sort((x, y) => y.score - x.score).slice(0, 8).map(s => s.a)
}

export default function AirportInput({ label, placeholder, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const results = useMemo(() => searchAirports(value), [value])

  const pick = (a) => {
    onChange(`${a.city} (${a.iata})`)
    setOpen(false)
    setHighlight(-1)
  }

  const onKeyDown = (e) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault()
      pick(results[highlight])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <label>{label}
      <div className="airport-wrap">
        <input
          required
          placeholder={placeholder}
          value={value}
          autoComplete="off"
          onChange={e => { onChange(e.target.value); setOpen(true); setHighlight(-1) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
        />
        {open && results.length > 0 && (
          <ul className="airport-list">
            {results.map((a, i) => (
              <li
                key={a.iata}
                className={i === highlight ? 'active' : ''}
                onMouseDown={e => { e.preventDefault(); pick(a) }}
              >
                <span className="airport-main">{a.city} ({a.iata})</span>
                <span className="airport-sub">{a.name}, {a.country}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </label>
  )
}
