import { useMemo, useState } from 'react'
import { Lightbox } from './CarSection'
import { GroceryTopBar } from './GroceryMenu'

// ---------------------------------------------------------------------------
// Folder-driven store directory — mirrors the Cars inventory.
// To add a physical store: create Stores/<Folder Name>/ containing photos
// plus a store.txt file, then push to GitHub. store.txt format (one per line):
//   ID_Store_Number: ST-001
//   Store Name: Paris Fresh Market
//   Phone Number: +33 1 42 60 00 01
//   Email: paris@autofly.us.com
//   Address: 12 Rue de la Paix
//   City: Paris
//   Country: France
//   Zip Code: 75002
//   Hours: Monday - Saturday, 8:00 AM - 8:00 PM
//   About the Store: A friendly neighborhood market...
// The site rebuilds on push (auto-deploy) and the store appears
// automatically — its page is keyed by ID_Store_Number, so the folder name
// never has to match the ID. Keep every ID unique.
// ---------------------------------------------------------------------------
const txtModules = import.meta.glob('../../Stores/*/store.txt', { query: '?raw', import: 'default', eager: true })
const imgModules = import.meta.glob('../../Stores/*/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', { query: '?url', import: 'default', eager: true })

function parseStoreTxt(raw) {
  const info = { id: '', name: '', phone: '', email: '', address: '', city: '', country: '', zip: '', hours: '', about: '' }
  for (const line of String(raw || '').split('\n')) {
    const i = line.indexOf(':')
    if (i === -1) continue
    const key = line.slice(0, i).trim().toLowerCase()
    const val = line.slice(i + 1).trim()
    if (['id_store_number', 'id', 'store id', 'store_id'].includes(key)) info.id = val
    else if (['store name', 'name'].includes(key)) info.name = val
    else if (['phone number', 'phone', 'tel'].includes(key)) info.phone = val
    else if (key === 'email') info.email = val
    else if (key === 'address') info.address = val
    else if (key === 'city') info.city = val
    else if (key === 'country') info.country = val
    else if (['zip code', 'zip', 'zipcode', 'postal code', 'postal'].includes(key)) info.zip = val
    else if (key === 'hours') info.hours = val
    else if (['about the store', 'about', 'description', 'desc'].includes(key)) info.about = val
  }
  return info
}

export function loadStores() {
  const stores = []
  for (const [path, raw] of Object.entries(txtModules)) {
    const m = path.match(/Stores\/([^/]+)\/store\.txt$/)
    if (!m) continue
    const folder = m[1]
    const prefix = `../../Stores/${folder}/`
    const images = Object.entries(imgModules)
      .filter(([p]) => p.startsWith(prefix))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, url]) => url)
    const info = parseStoreTxt(raw)
    stores.push({ folder, ...info, id: info.id || folder, name: info.name || folder, images })
  }
  return stores.sort((a, b) => a.name.localeCompare(b.name))
}

// One search box over everything in store.txt: name, country, city,
// zip code, address, phone, ID and the about text.
export function searchStores(stores, q) {
  const needle = q.trim().toLowerCase()
  if (!needle) return stores
  return stores.filter(s =>
    [s.id, s.name, s.country, s.city, s.zip, s.address, s.phone, s.email, s.about]
      .join(' ').toLowerCase().includes(needle)
  )
}

function StoreCard({ store, onShop }) {
  const [idx, setIdx] = useState(0)
  const [zoom, setZoom] = useState(false)
  const n = store.images.length
  const place = [store.city, store.country].filter(Boolean).join(', ')
  return (
    <div className="card">
      <div className="slideshow">
        {n > 0 ? (
          <img src={store.images[idx]} alt={store.name} onClick={() => setZoom(true)} title="Click to enlarge" />
        ) : (
          <div className="no-photo">No photos yet</div>
        )}
        {n > 1 && (
          <>
            <button className="slide-btn prev" onClick={() => setIdx(i => (i - 1 + n) % n)} aria-label="Previous photo">‹</button>
            <button className="slide-btn next" onClick={() => setIdx(i => (i + 1) % n)} aria-label="Next photo">›</button>
            <span className="slide-count">{idx + 1} / {n}</span>
          </>
        )}
      </div>
      <div className="card-body">
        <h3>{store.name}</h3>
        {place && <p>📍 {place}{store.zip ? ` ${store.zip}` : ''}</p>}
        {store.phone && <p>📞 {store.phone}</p>}
        {store.about && <p className="car-desc">{store.about}</p>}
        <button onClick={() => onShop(store.id)}>Shop with us</button>
      </div>
      {zoom && n > 0 && <Lightbox images={store.images} start={idx} onClose={() => setZoom(false)} />}
    </div>
  )
}

export default function StoresSection({ go, onShop }) {
  const stores = useMemo(loadStores, [])
  const [query, setQuery] = useState('')
  const filtered = searchStores(stores, query)

  return (
    <div>
      <GroceryTopBar go={go} />

      <div className="hero-card">
        <h2>🏬 Our Physical Stores</h2>
        <p>AutoFly stores around the world — visit one near you. Search by store name, country, city or zip code.</p>
        <div className="filters">
          <input placeholder="Search stores (e.g. Paris, Morocco, 10007, ST-002)" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <p className="hint">{filtered.length} store{filtered.length === 1 ? '' : 's'} found</p>
      </div>

      {filtered.length === 0 && (
        <div className="hero-card"><p>No stores match. To add a store, create a folder under <b>Stores</b>, add its photos and a <b>store.txt</b> file, then push.</p></div>
      )}

      <div className="grid">
        {filtered.map(store => (
          <StoreCard key={store.id} store={store} onShop={onShop} />
        ))}
      </div>
    </div>
  )
}
