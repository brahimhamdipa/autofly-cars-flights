import { useMemo } from 'react'
import { formatVariant } from '../lib/storeData'

// Shared filter popup for the shop: used by the Products page (every
// category) and by each "Shop with us" page (only that store's categories
// and subcategories — the caller scopes what it passes in).
//
// Layout: categories show as a compact grid of chips, not a long list.
// Once a category is checked, its subcategories appear grouped UNDER it
// in a separate section below the grid, each group headed by its
// category name and set apart with a left border, so subcategories never
// mix with the category chips.
// Clear filters and Done sit on the header line (top-right) as well as
// at the bottom; X closes without changing the selection. Toggling a
// checkbox applies immediately; Done just closes.
export default function FilterPopup({ title, categories, subcats, selCats, selSubs, onToggleCat, onToggleSub, onClear, onClose }) {
  const subsByCat = useMemo(() => {
    const map = {}
    for (const s of subcats || []) {
      if (!map[s.category_id]) map[s.category_id] = []
      map[s.category_id].push(s)
    }
    return map
  }, [subcats])

  const selectedCats = (categories || []).filter(c => selCats.includes(c.id))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 560, maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{title || 'Filter products'}</h3>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <button type="button" className="btn-soft" onClick={onClear}>Clear filters</button>
            <button type="button" onClick={onClose}>Done</button>
            <button type="button" onClick={onClose} aria-label="Close" style={{ fontSize: 22, lineHeight: 1, padding: '4px 8px', background: '#f0f1f8', border: '1px solid #d8dbe8', borderRadius: 8, cursor: 'pointer' }}>✕</button>
          </span>
        </div>

        {(categories || []).length === 0 && <p className="hint">No categories yet — add some from Admin.</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {(categories || []).map(c => {
            const checked = selCats.includes(c.id)
            return (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', border: '1px solid #d8dbe8', borderRadius: 8, cursor: 'pointer', background: checked ? '#e8eaf6' : '#fff' }}>
                <input type="checkbox" checked={checked} onChange={() => onToggleCat(c.id)} />
                <b style={{ fontSize: 14 }}>{c.label}</b>
              </label>
            )
          })}
        </div>

        {selectedCats.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p className="hint" style={{ marginBottom: 8 }}>Options for the categories you picked:</p>
            {selectedCats.map(c => (
              <div key={c.id} style={{ borderLeft: '3px solid #1e2a5a', paddingLeft: 12, marginBottom: 12 }}>
                <p style={{ margin: '0 0 6px', fontWeight: 700 }}>{c.label}</p>
                {(subsByCat[c.id] || []).length === 0 && <p className="hint" style={{ margin: 0 }}>No options for this category yet.</p>}
                {(subsByCat[c.id] || []).map(s => (
                  <div key={s.id} style={{ marginLeft: 8, marginBottom: 4 }}>
                    <label><input type="checkbox" checked={selSubs.includes(s.id)} onChange={() => onToggleSub(s.id)} /> {formatVariant(s)}</label>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="store-actions" style={{ marginTop: 12 }}>
          <button type="button" className="btn-soft" onClick={onClear}>Clear filters</button>
          <button type="button" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
