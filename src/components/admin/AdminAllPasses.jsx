import { useEffect, useState } from 'react'

import { supabase } from '../../lib/supabaseClient'

// All Passes: every login the admin has handed out, in one place —
// the link, the username, the password, who uses it, and the note.
// Grouped by area (Stores, Diner, POS, Dealer, Employee, Bodyshop,
// Barbers, Websites, Chat), with a search box over everything. Display
// or deleted in its own table, this page just gathers them.
// Passwords show readable here BY DESIGN, like everywhere else in
// Admin — this page is owner-only, and the whole point of it is that
// the admin can see what he gave out.
//
// AUTOMATIC: the page reads the pass tables live on every load, so a
// new pass in any system below appears here on its own, the moment it
// is created. A completely NEW kind of pass (a new system with its own
// table) needs one small addition here: one more map in the `all`
// array below, and a group above if it is a new group.
const GROUPS = [
  { key: 'stores', title: 'Stores' },
  { key: 'diner', title: 'Diner' },
  { key: 'pos', title: 'POS' },
  { key: 'dealer', title: 'Dealer' },
  { key: 'employee', title: 'Employee' },
  { key: 'bodyshop', title: 'Bodyshop' },
  { key: 'barbers', title: 'Barbers' },
  { key: 'websites', title: 'Websites' },
  { key: 'chat', title: 'Chat' },
]

export default function AdminAllPasses() {
  const [rows, setRows] = useState(null)
  const [failed, setFailed] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const failedGroups = []
    const grab = async (key, q) => {
      const { data, error } = await q
      if (error) { failedGroups.push(key); return [] }
      return data || []
    }
    const [providers, formRows, employees, passRows, intakeRows, dinerRows, shopRows, uploadRows, folderRows, posRows, dealerRows, employeeRows, bodyshopRows] = await Promise.all([
      grab('stores', supabase.from('store_providers').select('id, name')),
      grab('stores', supabase.from('providersForm').select('id, provider_id, f, u, p, comment').order('f')),
      grab('chat', supabase.from('employees').select('id, firstName, lastName')),
      grab('chat', supabase.from('fPasses').select('id, employee_id, formName, u, p, note').order('formName')),
      grab('websites', supabase.from('barber_intake_forms').select('id, f, u, p, note').order('f')),
      grab('diner', supabase.from('diner_restaurants').select('id, slug, name, u, p, epass, note').order('name')),
      grab('barbers', supabase.from('barbershop_shops').select('id, slug, name, u, p, epass, note').order('name')),
      grab('websites', supabase.from('upload_forms').select('id, f, u, p, folder, note').order('f')),
      grab('websites', supabase.from('folder_passes').select('id, folder, username, password, note').order('folder')),
      grab('pos', supabase.from('pos_stores').select('id, slug, name, u, p, epass, note').order('name')),
      grab('dealer', supabase.from('dealer_shops').select('id, slug, name, u, p, epass, note').order('name')),
      grab('employee', supabase.from('employee_shops').select('id, slug, name, u, p, epass, note').order('name')),
      grab('bodyshop', supabase.from('bodyshop_shops').select('id, slug, name, u, p, epass, note').order('name')),
    ])
    const providerName = (id) => providers.find(p => p.id === id)?.name || '—'
    const employeeName = (id) => {
      const e = employees.find(x => x.id === id)
      return e ? `${e.firstName} ${e.lastName || ''}`.trim() : '—'
    }
    const all = [
      ...formRows.map(r => ({
        key: 'store-' + r.id, group: 'stores', kind: 'Store pass',
        link: '/' + r.f, linkText: 'autofly.us.com/' + r.f,
        user: r.u, pass: r.p, passExtra: '', customer: providerName(r.provider_id), note: r.comment || '',
      })),
      ...dinerRows.map(r => ({
        key: 'diner-' + r.id, group: 'diner', kind: 'Diner pass',
        link: '/diner?r=' + r.slug, linkText: 'autofly.us.com/diner?r=' + r.slug,
        user: r.u, pass: r.p, passExtra: r.epass ? 'Team: ' + r.epass : '', customer: r.name || '—', note: r.note || '',
      })),
      ...posRows.map(r => ({
        key: 'pos-' + r.id, group: 'pos', kind: 'POS pass',
        link: '/pos?s=' + r.slug, linkText: 'autofly.us.com/pos?s=' + r.slug,
        user: r.u, pass: r.p, passExtra: r.epass ? 'Team: ' + r.epass : '', customer: r.name || '—', note: r.note || '',
      })),
      ...dealerRows.map(r => ({
        key: 'dealer-' + r.id, group: 'dealer', kind: 'Dealer pass',
        link: '/dealer?d=' + r.slug, linkText: 'autofly.us.com/dealer?d=' + r.slug,
        user: r.u, pass: r.p, passExtra: r.epass ? 'Team: ' + r.epass : '', customer: r.name || '—', note: r.note || '',
      })),
      ...employeeRows.map(r => ({
        key: 'employee-' + r.id, group: 'employee', kind: 'Employee pass',
        link: '/employee?e=' + r.slug, linkText: 'autofly.us.com/employee?e=' + r.slug,
        user: r.u, pass: r.p, passExtra: r.epass ? 'Team: ' + r.epass : '', customer: r.name || '—', note: r.note || '',
      })),
      ...bodyshopRows.map(r => ({
        key: 'bodyshop-' + r.id, group: 'bodyshop', kind: 'Bodyshop pass',
        link: '/bodyshop?b=' + r.slug, linkText: 'autofly.us.com/bodyshop?b=' + r.slug,
        user: r.u, pass: r.p, passExtra: r.epass ? 'Team: ' + r.epass : '', customer: r.name || '—', note: r.note || '',
      })),
      ...shopRows.map(r => ({
        key: 'barber-' + r.id, group: 'barbers', kind: 'Barber pass',
        link: '/barbers?s=' + r.slug, linkText: 'autofly.us.com/barbers?s=' + r.slug,
        user: r.u, pass: r.p, passExtra: r.epass ? 'Team: ' + r.epass : '', customer: r.name || '—', note: r.note || '',
      })),
      ...intakeRows.map(r => ({
        key: 'intake-' + r.id, group: 'websites', kind: 'Intake form',
        link: '/barber-intake', linkText: 'autofly.us.com/barber-intake (' + r.f + ')',
        user: r.u, pass: r.p, passExtra: '', customer: '—', note: r.note || '',
      })),
      ...uploadRows.map(r => ({
        key: 'upload-' + r.id, group: 'websites', kind: 'Upload form',
        link: '/' + r.f, linkText: 'autofly.us.com/' + r.f,
        user: r.u, pass: r.p, passExtra: 'Folder: ' + r.folder, customer: '—', note: r.note || '',
      })),
      ...folderRows.map(r => ({
        key: 'folder-' + r.id, group: 'websites', kind: 'Folder pass',
        link: '/' + r.folder, linkText: 'autofly.us.com/' + r.folder,
        user: r.username, pass: r.password, passExtra: '', customer: '—', note: r.note || '',
      })),
      ...passRows.map(r => ({
        key: 'emp-' + r.id, group: 'chat', kind: 'Employee pass',
        link: '/' + r.formName, linkText: 'autofly.us.com/' + r.formName,
        user: r.u, pass: r.p, passExtra: '', customer: employeeName(r.employee_id), note: r.note || '',
      })),
    ]
    setRows(all)
    setFailed(failedGroups)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="hero-card"><p>Loading all passes...</p></div>

  const q = search.trim().toLowerCase()
  const shown = (rows || []).filter(r => !q || [r.linkText, r.user, r.pass, r.customer, r.note, r.kind].join(' ').toLowerCase().includes(q))
  const total = (rows || []).length

  return (
    <div>
      <div className="hero-card">
        <h2>🔑 All Passes {total > 0 && `(${total})`}</h2>
        <p>Every login you have handed out — the link, the username, the password, who uses it, and your note. Grouped by area; use the search to find one fast. Passes are created and changed in their own tables — this page just gathers them.</p>
      </div>
      <div className="form-card">
        <input placeholder="Search link, username, customer, note..." value={search} onChange={e => setSearch(e.target.value)} />
        <button type="button" className="btn-soft" onClick={load}>↻ Refresh</button>
      </div>
      {GROUPS.map(g => {
        const list = shown.filter(r => r.group === g.key)
        if (q && list.length === 0) return null
        return (
          <div key={g.key}>
            <h3>{g.title} ({list.length})</h3>
            {failed.includes(g.key) && <p className="hint">Could not load this group — tap Refresh to try again.</p>}
            {list.length === 0 && !failed.includes(g.key) && <p className="hint">Nothing here yet.</p>}
            {list.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Link</th><th>Username</th><th>Password</th><th>Customer</th><th>Note</th></tr>
                  </thead>
                  <tbody>
                    {list.map(r => (
                      <tr key={r.key}>
                        <td><a href={r.link} target="_blank" rel="noreferrer">{r.linkText}</a><br /><span className="hint">{r.kind}</span></td>
                        <td>{r.user}</td>
                        <td>{r.pass}{r.passExtra && <><br /><span className="hint">{r.passExtra}</span></>}</td>
                        <td>{r.customer}</td>
                        <td>{r.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
