import { useEffect, useState } from 'react'
import { Lightbox } from './CarSection'
import { GroceryTopBar } from './GroceryMenu'
import { loadProvider } from '../lib/storeData'

// One page per store, keyed by provider ID. Reached from "View details"
// on the Physical Stores list (or a shared #store/<id> link). Ordering
// happens from the list's "Shop with us" button, which opens the store's
// order page directly — there is no order button on this page anymore.
// Layout: hero on top, then one section with the pictures above the
// "Visit us" details, and Call (blue) / Get directions (gray) buttons
// arranged like the Online Store card buttons.
export default function ProviderPage({ providerId, go, goBack }) {
  const [store, setStore] = useState(null)
  const [error, setError] = useState('')
  const [idx, setIdx] = useState(0)
  const [zoom, setZoom] = useState(false)

  useEffect(() => {
    setStore(null)
    setError('')
    loadProvider(providerId).then(setStore).catch(e => setError(e.message))
  }, [providerId])

  if (error) {
    return (
      <div>
        <GroceryTopBar go={go} />
        <div className="hero-card">
          <h2>Store not found</h2>
          <p>There is no store with ID <b>{providerId}</b>. It may have been renamed or removed.{error ? ` (${error})` : ''}</p>
          <button onClick={goBack || (() => go('stores'))}>← Back</button>
        </div>
      </div>
    )
  }

  if (!store) {
    return (
      <div>
        <GroceryTopBar go={go} />
        <div className="hero-card"><p>Loading store...</p></div>
      </div>
    )
  }

  const images = store.pics || []
  const n = images.length
  const fullAddress = [store.address, store.city, store.zip, store.country].filter(Boolean).join(', ')
  const mapsUrl = fullAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}` : null

  return (
    <div>
      <GroceryTopBar go={go} />

      <div className="hero-card">
        {goBack && <button className="link-btn" onClick={goBack}>← Back</button>}
        <h2>🏬 {store.name}</h2>
        <p className="hint">Store ID: <b>{store.id}</b>{store.city || store.country ? ` · ${[store.city, store.country].filter(Boolean).join(', ')}` : ''}</p>
      </div>

      <div className="form-card wide store-info">
        <div className="slideshow store-photos">
          {n > 0 ? (
            <img src={images[idx]} alt={store.name} onClick={() => setZoom(true)} title="Click to enlarge" />
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

        <h3>Visit us</h3>
        {store.address && <p><b>Address:</b> {store.address}</p>}
        {(store.city || store.zip || store.country) && <p><b>City / Zip / Country:</b> {[store.city, store.zip, store.country].filter(Boolean).join(', ')}</p>}
        {store.phone && <p><b>Phone:</b> <a href={`tel:${store.phone.replace(/[^+0-9]/g, '')}`}>{store.phone}</a></p>}
        {store.email && <p><b>Email:</b> <a href={`mailto:${store.email}`}>{store.email}</a></p>}
        {store.hours && <p><b>Hours:</b> {store.hours}</p>}
        {store.about && <p>{store.about}</p>}
        <div className="item-actions">
          {store.phone && <a className="store-btn" href={`tel:${store.phone.replace(/[^+0-9]/g, '')}`}>📞 Call the store</a>}
          {mapsUrl && <a className="store-btn btn-soft" href={mapsUrl} target="_blank" rel="noreferrer">🗺️ Get directions</a>}
        </div>
      </div>

      {zoom && n > 0 && <Lightbox images={images} start={idx} onClose={() => setZoom(false)} />}
    </div>
  )
}
