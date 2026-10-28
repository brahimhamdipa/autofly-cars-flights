import { useState } from 'react'
import { Lightbox } from './CarSection'

// Stock line, exactly like the Online Store page: green when in stock,
// red when out of stock, nothing at all when stock is not tracked
// (null — e.g. services).
export function StockLine({ stock }) {
  if (stock === null || stock === undefined) return null
  if (stock <= 0) return <p className="stock out">Out of stock</p>
  if (stock <= 10) return <p className="stock low">Only {stock} left in stock</p>
  return <p className="stock ok">{stock} available in stock</p>
}

// Card picture slideshow, exactly like the Physical Stores cards:
// arrows + counter in the card, tap the picture for the fullscreen
// Lightbox (X top-right to close). Used by the Online Store and
// category cards (General Products, Lunches/Snacks, Meats, Clothes).
export function CardSlideshow({ images, name }) {
  const [idx, setIdx] = useState(0)
  const [zoom, setZoom] = useState(false)
  const pics = images || []
  const n = pics.length
  return (
    <>
      <div className="slideshow">
        {n > 0 ? (
          <img src={pics[idx]} alt={name} onClick={() => setZoom(true)} title="Click to enlarge" />
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
      {zoom && n > 0 && <Lightbox images={pics} start={idx} onClose={() => setZoom(false)} />}
    </>
  )
}
