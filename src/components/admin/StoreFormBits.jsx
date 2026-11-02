import { useState } from 'react'
import { uploadStorePictures, removeStorePictureUrl } from '../../lib/storeUpload'
import { formatVariant } from '../../lib/storeData'

// Shared bits for the store admin forms. All store admin forms live
// inline on the page now (no popups): the Add section shows blank
// forms, and the Manage section shows the same form above its table,
// filled with the row being edited (or blank for a new row).
// Items link to categories ONLY via the tick boxes on the Items form
// (Manage) — there is no category select and no online flag anymore:
// the old store_categories table is gone, and whether an item can be
// delivered or picked up comes from its delivery/pickup flags.
// Items can also carry explicit subcategory picks per linked category.

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


// --- Jobs / employees / languages / employee passes (batch 3) ---
export function JobForm({ draft, setDraft, onSubmit, submitLabel, onCancel }) {
  return (
    <form className="form-card" onSubmit={onSubmit}>
      <h3>{submitLabel}</h3>
      <input required placeholder="Job title" value={draft.jobTitle || ''} onChange={e => setDraft({ ...draft, jobTitle: e.target.value })} />
      <textarea placeholder="Job description" value={draft.jobDescription || ''} onChange={e => setDraft({ ...draft, jobDescription: e.target.value })} />
      <div className="store-actions">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

export function EmployeeForm({ draft, setDraft, onSubmit, submitLabel, onCancel, jobs }) {
  return (
    <form className="form-card" onSubmit={onSubmit}>
      <h3>{submitLabel}</h3>
      <input required placeholder="First name" value={draft.firstName || ''} onChange={e => setDraft({ ...draft, firstName: e.target.value })} />
      <input placeholder="Last name" value={draft.lastName || ''} onChange={e => setDraft({ ...draft, lastName: e.target.value })} />
      <select value={draft.job_id ?? ''} onChange={e => setDraft({ ...draft, job_id: e.target.value })}>
        <option value="">— Job —</option>
        {(jobs || []).map(j => <option key={j.id} value={j.id}>{j.jobTitle}</option>)}
      </select>
      <input placeholder="Address" value={draft.address || ''} onChange={e => setDraft({ ...draft, address: e.target.value })} />
      <input placeholder="City" value={draft.city || ''} onChange={e => setDraft({ ...draft, city: e.target.value })} />
      <input placeholder="Zip" value={draft.zip || ''} onChange={e => setDraft({ ...draft, zip: e.target.value })} />
      <input placeholder="State" value={draft.state || ''} onChange={e => setDraft({ ...draft, state: e.target.value })} />
      <input placeholder="County" value={draft.county || ''} onChange={e => setDraft({ ...draft, county: e.target.value })} />
      <label>Date of birth <input type="date" value={draft.dob || ''} onChange={e => setDraft({ ...draft, dob: e.target.value })} /></label>
      <input placeholder="Email 1" value={draft.email1 || ''} onChange={e => setDraft({ ...draft, email1: e.target.value })} />
      <input placeholder="Email 2" value={draft.email2 || ''} onChange={e => setDraft({ ...draft, email2: e.target.value })} />
      <input placeholder="Phone 1" value={draft.phone1 || ''} onChange={e => setDraft({ ...draft, phone1: e.target.value })} />
      <input placeholder="Phone 2" value={draft.phone2 || ''} onChange={e => setDraft({ ...draft, phone2: e.target.value })} />
      <textarea placeholder="About" value={draft.about || ''} onChange={e => setDraft({ ...draft, about: e.target.value })} />
      <input placeholder="Marital status" value={draft.maritalStatus || ''} onChange={e => setDraft({ ...draft, maritalStatus: e.target.value })} />
      <input placeholder="Gender" value={draft.gender || ''} onChange={e => setDraft({ ...draft, gender: e.target.value })} />
      <textarea placeholder="Notes" value={draft.notes || ''} onChange={e => setDraft({ ...draft, notes: e.target.value })} />
      <PicField pics={draft.pictures || []} setPics={pictures => setDraft({ ...draft, pictures })} />
      <div className="store-actions">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

export function LanguageForm({ draft, setDraft, onSubmit, submitLabel, onCancel, employees }) {
  return (
    <form className="form-card" onSubmit={onSubmit}>
      <h3>{submitLabel}</h3>
      <input required placeholder="Language" value={draft.language || ''} onChange={e => setDraft({ ...draft, language: e.target.value })} />
      <input placeholder="Note" value={draft.note || ''} onChange={e => setDraft({ ...draft, note: e.target.value })} />
      <select required value={draft.employee_id ?? ''} onChange={e => setDraft({ ...draft, employee_id: e.target.value })}>
        <option value="">— Employee —</option>
        {(employees || []).map(emp => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName || ''}</option>)}
      </select>
      <div className="store-actions">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

export function EmployeePassForm({ draft, setDraft, onSubmit, submitLabel, onCancel, employees }) {
  return (
    <form className="form-card" onSubmit={onSubmit}>
      <h3>{submitLabel}</h3>
      <select required value={draft.employee_id ?? ''} onChange={e => setDraft({ ...draft, employee_id: e.target.value })}>
        <option value="">— Employee —</option>
        {(employees || []).map(emp => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName || ''}</option>)}
      </select>
      <input required placeholder="Form name (the link after autofly.us.com/)" value={draft.formName || ''} onChange={e => setDraft({ ...draft, formName: e.target.value })} />
      <input required placeholder="Username" value={draft.u || ''} onChange={e => setDraft({ ...draft, u: e.target.value })} />
      <input required placeholder="Password (visible — the employee logs in with this)" value={draft.p || ''} onChange={e => setDraft({ ...draft, p: e.target.value })} />
      <input placeholder="Note" value={draft.note || ''} onChange={e => setDraft({ ...draft, note: e.target.value })} />
      <label><input type="checkbox" checked={draft.chat !== false} onChange={e => setDraft({ ...draft, chat: e.target.checked })} /> Allow chat</label>
      <div className="store-actions">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

export function ItemForm({ draft, setDraft, onSubmit, submitLabel, onCancel, providers, linkData }) {
  return (
    <form onSubmit={onSubmit} className="form-card">
      <select required value={draft.provider_id || ''} onChange={e => setDraft({ ...draft, provider_id: e.target.value })}>
        <option value="">— Provider —</option>
        {providers.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
      </select>
      <input required placeholder="Item name" value={draft.name || ''} onChange={e => setDraft({ ...draft, name: e.target.value })} />
      <input required placeholder="Price" type="number" step="0.01" min="0" value={draft.price ?? ''} onChange={e => setDraft({ ...draft, price: e.target.value })} />
      <textarea placeholder="Description" value={draft.description || ''} onChange={e => setDraft({ ...draft, description: e.target.value })} />
      <input placeholder="Delivery address (where delivery comes from)" value={draft.delivery_address || ''} onChange={e => setDraft({ ...draft, delivery_address: e.target.value })} />
      <input placeholder="Pickup address (where to pick up)" value={draft.pickup_address || ''} onChange={e => setDraft({ ...draft, pickup_address: e.target.value })} />
      <label><input type="checkbox" checked={!!draft.delivery} onChange={e => setDraft({ ...draft, delivery: e.target.checked })} /> Delivery available</label>
      <label><input type="checkbox" checked={!!draft.pickup} onChange={e => setDraft({ ...draft, pickup: e.target.checked })} /> Pickup available</label>
      <label><input type="checkbox" checked={!!draft.is_active} onChange={e => setDraft({ ...draft, is_active: e.target.checked })} /> Show this item on the site (uncheck to hide it)</label>
      <input placeholder="Stock (how many available — leave empty if not tracked, e.g. services)" type="number" min="0" value={draft.stock ?? ''} onChange={e => setDraft({ ...draft, stock: e.target.value })} />
      <input placeholder="Barcode (optional)" value={draft.barCode || ''} onChange={e => setDraft({ ...draft, barCode: e.target.value })} />
      <PicField pics={draft.pics || []} setPics={pics => setDraft({ ...draft, pics })} />
      {linkData && (
        <div>
          <p><b>Item categories</b></p>
          {(linkData.itemCategories || []).length === 0 && <p className="hint">No item categories yet.</p>}
          {(linkData.itemCategories || []).map(c => (
            <label key={c.id}><input type="checkbox" checked={linkData.selected.categoryIds.includes(c.id)} onChange={() => linkData.onToggle('cat', c.id)} /> {c.label}</label>
          ))}
          <p><b>Delivery locations</b></p>
          {(linkData.fromdel || []).length === 0 && <p className="hint">No delivery locations yet.</p>}
          {(linkData.fromdel || []).map(r => (
            <label key={r.id}><input type="checkbox" checked={linkData.selected.fromdelIds.includes(r.id)} onChange={() => linkData.onToggle('from', r.id)} /> {r.fname}{r.fcity ? ` — ${r.fcity}` : ''}</label>label>
          ))}
          <p><b>Pickup locations</b></p>
          {(linkData.topick || []).length === 0 && <p className="hint">No pickup locations yet.</p>}
          {(linkData.topick || []).map(r => (
            <label key={r.id}><input type="checkbox" checked={linkData.selected.topickIds.includes(r.id)} onChange={() => linkData.onToggle('to', r.id)} /> {r.tname}{r.tcity ? ` — ${r.tcity}` : ''}</label>
          ))}
      {(linkData.selected.categoryIds || []).map(catId => {
      const cat = (linkData.itemCategories || []).find(c => c.id === catId)
                const subs = (linkData.subcats || []).filter(s => s.category_id === catId)
                return (
                              <div key={catId} style={{ marginLeft: 16, borderLeft: '3px solid #e8e8f0', paddingLeft: 10, marginTop: 8 }}>
                                              <label style={{ fontWeight: 600 }}>Options for {cat ? cat.label : 'category'}:</label>
                                {subs.length === 0 && <div className="hint">No options defined for this category yet — add them in Sub Categories.</div>}
                                {subs.map(s => (
                                                <label key={s.id} style={{ display: 'block' }}>
                                                                  <input
                                                                                        type="checkbox"
                                                                                        checked={(linkData.selected.subcategoryIds || []).includes(s.id)}
                                                                                        onChange={() => linkData.onToggle('sub', s.id)}
                                                                                      /> {formatVariant(s)}
                                                </label>
                                              ))}
                              </div>
                            )
      })}
        </div>
      
    
    
      )}
      <div className="store-actions">
        <button type="submit">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

// Delivery locations (fromDel): the "from" addresses a store item can
// ship from. Linked to items in Manage → Items, picked by customers
// in the cart's Delivery popup.
export function FromDelForm({ draft, setDraft, onSubmit, submitLabel, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="form-card">
      <input required placeholder="Location name" value={draft.fname || ''} onChange={e => setDraft({ ...draft, fname: e.target.value })} />
      <input placeholder="Address" value={draft.faddress || ''} onChange={e => setDraft({ ...draft, faddress: e.target.value })} />
      <input placeholder="City" value={draft.fcity || ''} onChange={e => setDraft({ ...draft, fcity: e.target.value })} />
      <input placeholder="State" value={draft.fstate || ''} onChange={e => setDraft({ ...draft, fstate: e.target.value })} />
      <input placeholder="Zip code" value={draft.fzip || ''} onChange={e => setDraft({ ...draft, fzip: e.target.value })} />
      <input placeholder="Country" value={draft.fcountry || ''} onChange={e => setDraft({ ...draft, fcountry: e.target.value })} />
      <input placeholder="County" value={draft.fcounty || ''} onChange={e => setDraft({ ...draft, fcounty: e.target.value })} />
      <input placeholder="Township" value={draft.ftownship || ''} onChange={e => setDraft({ ...draft, ftownship: e.target.value })} />
      <textarea placeholder="Comment (admin note — not shown to customers)" value={draft.fcomment || ''} onChange={e => setDraft({ ...draft, fcomment: e.target.value })} />
      <div className="store-actions">
        <button type="submit">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

// Pickup locations (toPick): the "to" addresses customers pick up
// from. Linked to items in Manage → Items, picked by customers
// in the cart's Pickup popup.
export function ToPickForm({ draft, setDraft, onSubmit, submitLabel, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="form-card">
      <input required placeholder="Location name" value={draft.tname || ''} onChange={e => setDraft({ ...draft, tname: e.target.value })} />
      <input placeholder="Address" value={draft.taddress || ''} onChange={e => setDraft({ ...draft, taddress: e.target.value })} />
      <input placeholder="City" value={draft.tcity || ''} onChange={e => setDraft({ ...draft, city: e.target.value })} />
      <input placeholder="State" value={draft.tstate || ''} onChange={e => setDraft({ ...draft, tstate: e.target.value })} />
      <input placeholder="Zip code" value={draft.tzip || ''} onChange={e => setDraft({ ...draft, tzip: e.target.value })} />
      <input placeholder="Country" value={draft.tcountry || ''} onChange={e => setDraft({ ...draft, tcountry: e.target.value })} />
      <input placeholder="Township" value={draft.ttownship || ''} onChange={e => setDraft({ ...draft, ttownship: e.target.value })} />
      <textarea placeholder="Comment (admin note — not shown to customers)" value={draft.tcomment || ''} onChange={e => setDraft({ ...draft, tcomment: e.target.value })} />
      <div className="store-actions">
        <button type="submit">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

// Item categories (the NEW category table — not store_categories).
// The slug is auto-made from the label on create and never changes
// on edit.
export function ItemCategoryForm({ draft, setDraft, onSubmit, submitLabel, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="form-card">
      <input required placeholder="Item category label (e.g. Dairy)" value={draft.label || ''} onChange={e => setDraft({ ...draft, label: e.target.value })} />
      {draft.id
        ? <p className="hint">Slug stays "{draft.slug}" — renaming here does not change it.</p>
        : <p className="hint">The category's slug is made from this automatically (e.g. "Dairy" → dairy).</p>}
      <div className="store-actions">
        <button type="submit">{submitLabel}</button>
        {onCancel && <button type="button" className="btn-soft" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

// Sub categories: variant-style attributes belonging to one item
// category (flavor, color, pack size, weight...).
export function SubCategoryForm({ draft, setDraft, onSubmit, submitLabel, onCancel, itemCategories }) {
  return (
    <form onSubmit={onSubmit} className="form-card">
      <select required value={draft.category_id || ''} onChange={e => setDraft({ ...draft, category_id: e.target.value })}>
        <option value="">— Item category —</option>
        {(itemCategories || []).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <input placeholder="Flavor (e.g. vanilla)" value={draft.flavor || ''} onChange={e => setDraft({ ...draft, flavor: e.target.value })} />
      <input placeholder="Color" value={draft.color || ''} onChange={e => setDraft({ ...draft, color: e.target.value })} />
      <input placeholder="Pack of (how many in a pack)" type="number" min="0" value={draft.packof ?? ''} onChange={e => setDraft({ ...draft, packof: e.target.value })} />
      <input placeholder="Size" value={draft.size || ''} onChange={e => setDraft({ ...draft, size: e.target.value })} />
      <input placeholder="Weight" type="number" step="any" min="0" value={draft.weight ?? ''} onChange={e => setDraft({ ...draft, weight: e.target.value })} />
      <input placeholder="Unit (e.g. kg, lb, oz)" value={draft.unit || ''} onChange={e => setDraft({ ...draft, unit: e.target.value })} />
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
