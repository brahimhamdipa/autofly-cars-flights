import { useMemo, useState } from 'react'
import { Lightbox } from './CarSection'
import { GroceryTopBar } from './GroceryMenu'
import { loadStores } from './StoresSection'

// One page per store, keyed by ID_Store_Number. The "Shop with us" button
// on the Stores list opens the page whose ID matches the store's folder.
export default function StoreDetailPage({ storeId, go }) {
  const store = useMemo(() => loadStores().find(s => s.id === storeId), [storeId])
  const [idx, setIdx] = useState(0)
  const [zoom, setZoom] = useState(false)

  if (!store) {
    return (
      <div>
        <GroceryTopBar go={go} />
        <div className="hero-card">
          <h2>Store not found</h2>
          <p>There is no store with ID <b>{storeId}</b>. It may have been renamed or removed.</p>
          <button onClick={() => go('stores')}>← Back to all stores</button>
        </div>
      </div>
    )
  }

  const n = store.images.length
  const fullAddress = [store.address, store.city, store.zip, store.country].filter(Boolean).join(', ')
  const mapsUrl = fullAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}` : null

  return (
    <div>
      <GroceryTopBar go={go} />

      <div className="hero-card">
        <button className="link-btn" onClick={() => go('stores')}>← All stores</button>
        <h2>🏬 {store.name}</h2>
        <p className="hint">Store ID: <b>{store.id}</b>{store.city || store.country ? ` · ${[store.city, store.country].filter(Boolean).join(', ')}` : ''}</p>
      </div>

      <div className="store-detail">
        <div className="slideshow store-photos">
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

        <div className="form-card wide store-info">
          <h3>Visit us</h3>
          {store.address && <p><b>Address:</b> {store.address}</p>}
          {(store.city || store.zip || store.country) && <p><b>City / Zip / Country:</b> {[store.city, store.zip, store.country].filter(Boolean).join(', ')}</p>}
          {store.phone && <p><b>Phone:</b> <a href={`tel:${store.phone.replace(/[^+0-9]/g, '')}`}>{store.phone}</a></p>}
          {store.email && <p><b>Email:</b> <a href={`mailto:${store.email}`}>{store.email}</a></p>}
          {store.hours && <p><b>Hours:</b> {store.hours}</p>}
          {store.about && <p>{store.about}</p>}
          <div className="store-actions">
            {store.phone && <a className="store-btn" href={`tel:${store.phone.replace(/[^+0-9]/g, '')}`}>📞 Call the store</a>}
            {mapsUrl && <a className="store-btn" href={mapsUrl} target="_blank" rel="noreferrer">🗺️ Get directions</a>}
          </div>
        </div>
      </div>

      {zoom && n > 0 && <Lightbox images={store.images} start={idx} onClose={() => setZoom(false)} />}
    </div>
  )
}
