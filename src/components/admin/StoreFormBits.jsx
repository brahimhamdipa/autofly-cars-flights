import { useState } from 'react'
import { uploadStorePictures, removeStorePictureUrl } from '../../lib/storeUpload'

// Shared bits for the store admin forms. All store admin forms live
// inline on the page now (no popups): the Add section shows blank
// forms, and the Manage section shows the same form above its table,
// filled with the row being edited (or blank for a new row).

export function PicField({ pics, setPics }) {
  const [uploading, setUploading] = useState(false)
  const upload = async (e) => {
    const files = [...(e.target.files || [])]
    if (!files.length) return
    setUploading(true)
    try {
      const urls = await uploadStorePictures(files)
      setPics([...pics, ...urls])
    } catch (err) {
      alert('Upload failed: ' + err.message)
    }
    setUploading(false)
  }
  return (
    <div>
      <label className="upload-btn">
        {uploading ? 'Uploading...' : '📷 Upload pictures'}
        <input type="file" accept="image/*" multiple hidden onChange={upload} disabled={uploading} />
      </label>
      {pics.length > 0 && (
        <div className="pic-list">
          {pics.map((u, i) => (
            <span key={i}>{u.split('/').pop()}
              <button type="button" className="btn-mini" onClick={() => { removeStorePictureUrl(u); setPics(pics.filter((_, j) => j !== i)) }}>✕</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function ProviderForm({ draft, setDraft, onSubmit, submitLabel, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="form-card">
      <input required placeholder="Store name" value={draft.name || ''} onChange={e => setDraft({ ...draft, name: e.target.value })} />
      <input placeholder="Phone" value={draft.phone || ''} onChange={e => setDraft({ ...draft, phone: e.target.value })} />
      <input placeholder="Email" type="email" value={draft.email || ''} onChange={e => setDraft({ ...draft, email: e.target.value })} />
      <input placeholder="Address" value={draft.address || ''} onChange={e => setDraft({ ...draft, address: e.target.value })} />
      <input placeholder="City" value={draft.city || ''} onChange={e => setDraft({ ...draft, city: e.target.value })} />
      <input placeholder="Country" value={draft.country || ''} onChange={e => setDraft({ ...draft, country: e.target.value })} />
      <input placeholder="Zip code" value={draft.zip || ''} onChange={e => setDraft({ ...draft, zip: e.target.value })} />
      <input placeholder="Hours" value={draft.hours || ''} onChange={e => setDraft({ ...draft, hours: e.target.value })} />
      <textarea placeholder="About the store" value={draft.about || ''} onChange={e => setDraft({ ...draft, about: e.target.value })} />
      <label><input type="checkbox" checked={!!draft.holdorder} onChange={e => setDraft({ ...draft, holdorder: e.target.checked })} /> Hold orders: show the gray "Hold Order / Pay at store" button in the cart for this store</label>
      <label><input type="checkbox" checked={draft.payorder !== false} onChange={e => setDraft({ ...draft, payorder: e.target.checked })} /> Pay orders: show the blue "Place order" button in the cart for this store</label>
      <PicField pics={draft.pics || []} setPics={pics => setDraft({ ...draft, pics })} />
      <div className="store-actions">
        <button type="submit">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

export function ItemForm({ draft, setDraft, onSubmit, submitLabel, onCancel, providers, categories }) {
  return (
    <form onSubmit={onSubmit} className="form-card">
      <select required value={draft.provider_id || ''} onChange={e => setDraft({ ...draft, provider_id: e.target.value })}>
        <option value="">— Provider —</option>
        {providers.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
      </select>
      <select required value={draft.category_id || ''} onChange={e => setDraft({ ...draft, category_id: e.target.value })}>
        <option value="">— Category —</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <input required placeholder="Item name" value={draft.name || ''} onChange={e => setDraft({ ...draft, name: e.target.value })} />
      <input required placeholder="Price" type="number" step="0.01" min="0" value={draft.price ?? ''} onChange={e => setDraft({ ...draft, price: e.target.value })} />
      <textarea placeholder="Description" value={draft.description || ''} onChange={e => setDraft({ ...draft, description: e.target.value })} />
      <input placeholder="Delivery address (where delivery comes from)" value={draft.delivery_address || ''} onChange={e => setDraft({ ...draft, delivery_address: e.target.value })} />
      <input placeholder="Pickup address (where to pick up)" value={draft.pickup_address || ''} onChange={e => setDraft({ ...draft, pickup_address: e.target.value })} />
      <label><input type="checkbox" checked={!!draft.delivery} onChange={e => setDraft({ ...draft, delivery: e.target.checked })} /> Delivery available</label>
      <label><input type="checkbox" checked={!!draft.pickup} onChange={e => setDraft({ ...draft, pickup: e.target.checked })} /> Pickup available</label>
      <label><input type="checkbox" checked={!!draft.is_active} onChange={e => setDraft({ ...draft, is_active: e.target.checked })} /> Show this item on the site (uncheck to hide it)</label>
      <label><input type="checkbox" checked={!!draft.online} onChange={e => setDraft({ ...draft, online: e.target.checked })} /> Sell this item on the Online Store page (otherwise it shows on "Groceries / General Products" for Store products)</label>
      <input placeholder="Stock (how many available — leave empty if not tracked, e.g. services)" type="number" min="0" value={draft.stock ?? ''} onChange={e => setDraft({ ...draft, stock: e.target.value })} />
      <PicField pics={draft.pics || []} setPics={pics => setDraft({ ...draft, pics })} />
      <div className="store-actions">
        <button type="submit">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

export function CategoryForm({ draft, setDraft, onSubmit, submitLabel, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="form-card">
      <input required placeholder="Category name (e.g. Bakery)" value={draft.name || ''} onChange={e => setDraft({ ...draft, name: e.target.value })} />
      {draft.id
        ? <p className="hint">Link name stays "{draft.slug}" — renaming here does not change existing links.</p>
        : <p className="hint">The category's link name is made from this automatically (e.g. "Bakery" → bakery).</p>}
      <div className="store-actions">
        <button type="submit">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

// The provider-form editor, shared by Stores → Add ("Create Provider
// Form") and Stores → Manage ("Provider Forms"). One form per store
// (one-to-one): providers that already have a form are shown disabled
// in the list, except the row being edited, whose own provider stays
// selectable. f is the word the store types after autofly.us.com/;
// p is a throwaway password the owner invents for the store — never
// his own password — and it is shown here in plain text so he can
// copy it to the store.
export function ProviderFormEditor({ draft, setDraft, onSubmit, submitLabel, onCancel, providers, takenProviderIds }) {
  const taken = takenProviderIds || []
  return (
    <form onSubmit={onSubmit} className="form-card">
      <select required value={draft.provider_id || ''} onChange={e => setDraft({ ...draft, provider_id: e.target.value })}>
        <option value="">— Store provider —</option>
        {providers.map(pr => {
          const disabled = taken.includes(pr.id) && String(pr.id) !== String(draft.provider_id)
          return <option key={pr.id} value={pr.id} disabled={disabled}>{pr.name}{disabled ? ' — already has a form' : ''}</option>
        })}
      </select>
      <input required placeholder="Form name — the word after autofly.us.com/ (e.g. paris-form)" value={draft.f || ''} onChange={e => setDraft({ ...draft, f: e.target.value })} />
      <p className="hint">The store will open autofly.us.com/{(draft.f || 'form-name').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')} and log in there.</p>
      <input required placeholder="Username for the store" value={draft.u || ''} onChange={e => setDraft({ ...draft, u: e.target.value })} />
      <input required placeholder="Password for the store" value={draft.p || ''} onChange={e => setDraft({ ...draft, p: e.target.value })} />
      <p className="hint">Use a throwaway password you invent for this store — never your own password. Only you can see it here.</p>
      <input placeholder="Note for yourself (optional — not shown to the store)" value={draft.comment || ''} onChange={e => setDraft({ ...draft, comment: e.target.value })} />
      <div className="store-actions">
        <button type="submit">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}
