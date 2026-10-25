import { useMemo, useState } from 'react'
import { loadStores, searchStores } from '../StoresSection'

// Admin tracker for the folder-driven Stores directory. This reads the
// same Stores/*/store.txt files the public pages use, so the list here
// always matches what visitors see — no separate database to keep in sync.
// Search by ID_Store_Number (or name, country, city) to find a store's
// folder and open its page.
const TEMPLATE = `ID_Store_Number: ST-004
Store Name: Your Store Name
Phone Number: +1 000-000-0000
Email: store@autofly.us.com
Address: 1 Example Street
City: Your City
Country: Your Country
Zip Code: 00000
Hours: Monday - Saturday, 8:00 AM - 8:00 PM
About the Store: A few lines about what this store sells and why people like it.`

export default function AdminStores({ onViewStore }) {
  const stores = useMemo(loadStores, [])
  const [query, setQuery] = useState('')
  const filtered = searchStores(stores, query)

  return (
    <div>
      <div className="hero-card">
        <h2>🏬 Physical Stores</h2>
        <p>Every folder under <b>Stores</b> on GitHub, with its store.txt details and its page. Search by <b>ID_Store_Number</b> to find a store fast.</p>
        <div className="filters">
          <input placeholder="Search by ID (e.g. ST-002), name, country or city" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <p className="hint">{filtered.length} of {stores.length} stores shown</p>
      </div>

      <div className="hero-card">
        <table className="admin-table">
          <thead>
            <tr><th>ID</th><th>Store</th><th>Country / City</th><th>Photos</th><th>Folder</th><th>Page</th></tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id}>
                <td><b>{s.id}</b></td>
                <td>{s.name}</td>
                <td>{[s.city, s.country].filter(Boolean).join(', ')}</td>
                <td>{s.images.length}</td>
                <td>Stores/{s.folder}</td>
                <td><button type="button" className="btn-mini" onClick={() => onViewStore && onViewStore(s.id)}>View page</button></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan="6">No stores match that search.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="hero-card">
        <h3>How to add a new store (and match its page to its folder)</h3>
        <ol>
          <li>On GitHub, in the <b>Stores</b> folder, create a new folder named after the store (the folder name is just for you — it does not have to match anything).</li>
          <li>Upload the store's photos into that folder.</li>
          <li>Add a file named <b>store.txt</b> in the same folder, copied from the template below. Give it a <b>unique ID_Store_Number</b> (for example ST-004) — that ID is the key: the "Shop with us" button and this admin list both find the store's page by that ID, not by the folder name.</li>
          <li>Push (or save on GitHub) and wait a few minutes for the site to rebuild. The store then appears on the Physical Stores page, and its own page opens from "Shop with us".</li>
          <li>To change a store, edit its store.txt or photos in its folder. To remove it, delete the folder.</li>
        </ol>
        <p className="hint">Copy this template into the new store.txt and fill it in:</p>
        <pre className="code-block">{TEMPLATE}</pre>
      </div>
    </div>
  )
}
