import { useEffect, useState } from 'react'

import { supabase } from '../../lib/supabaseClient'

// All Passes: every login the admin has handed out, in one place —
// the link, the username, the password, who uses it, and the note.
// Grouped by area (Stores, Diner, POS, Dealer, Employee, Bodyshop,
// Barbers, Websites, Chat), with a search box over everything.
// Passwords show readable here BY DESIGN, like everywhere else in
// Admin — this page is owner-only, and the whole point of it is that
// the admin can see what he gave out.
//
// This page is the ONE place for passes — no need to open the pass's
// own table anywhere else:
//   - ADD: "Add a pass" at the top. Pick the system, fill in its
//     fields, Save. Every system's create rules mirror AdminStoreManage
//     exactly (slug rules, cross-checks, fresh live_data for new shops,
//     the storage folder for upload forms, the fAllowed row for
//     employee passes).
//   - EDIT (pencil on a row): username, password, shop name and note
//     become inputs (plus the team/employee password on shop rows).
//     Slugs, links and folders are never editable here. Save writes
//     the row back to its own table by id.
//   - DELETE (trash on a row): asks in-page first (never a browser
//     popup — those are ignored on the live site). Deleting a shop
//     removes the whole shop; deleting an upload form removes its
//     picture folder too.
//   - APPROVE DRAFT: only on the six dynamic shop rows (Diner, POS,
//     Dealer, Employee, Bodyshop, Barbers) and only while that shop's
//     draft is pending — one tap makes the draft live, through the
//     same approve RPC AdminStoreManage uses. Any other draft state
//     shows as small "Draft: ..." text instead of a button.
//
// AUTOMATIC: the page reads the pass tables live on every load, so a
// new pass in any system below appears here on its own, the moment it
// is created. A completely NEW kind of pass (a new system with its own
// table) needs one small addition here: one more map in the `all`
// array below, one more entry in CREATE_SYSTEMS, and a group above
// if it is a new group.
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

// The six dynamic shop tables — the only rows that carry a draft and
// can be approved, and the only rows with a team/employee password.
const SHOP_TABLES = ['diner_restaurants', 'barbershop_shops', 'pos_stores', 'dealer_shops', 'employee_shops', 'bodyshop_shops']

// Approve RPCs, copied exactly from AdminStoreManage: diner takes
// p_restaurant_id, POS takes p_store_id, the other four take p_shop_id.
const APPROVE_RPC = {
  diner_restaurants: { rpc: 'approve_diner_draft', param: 'p_restaurant_id' },
  barbershop_shops: { rpc: 'approve_barbershop_draft', param: 'p_shop_id' },
  pos_stores: { rpc: 'approve_pos_draft', param: 'p_store_id' },
  dealer_shops: { rpc: 'approve_dealer_draft', param: 'p_shop_id' },
  employee_shops: { rpc: 'approve_employee_draft', param: 'p_shop_id' },
  bodyshop_shops: { rpc: 'approve_bodyshop_draft', param: 'p_shop_id' },
}

// Every system a pass can be added to, in the page's group order.
const CREATE_SYSTEMS = [
  { value: 'providersForm', group: 'Stores', label: 'Store pass' },
  { value: 'diner_restaurants', group: 'Diner', label: 'Diner restaurant' },
  { value: 'pos_stores', group: 'POS', label: 'POS store' },
  { value: 'dealer_shops', group: 'Dealer', label: 'Dealer' },
  { value: 'employee_shops', group: 'Employee', label: 'Employee team' },
  { value: 'bodyshop_shops', group: 'Bodyshop', label: 'Bodyshop' },
  { value: 'barbershop_shops', group: 'Barbers', label: 'Barbershop' },
  { value: 'barber_intake_forms', group: 'Websites', label: 'Barber intake form' },
  { value: 'upload_forms', group: 'Websites', label: 'Picture upload form' },
  { value: 'folder_passes', group: 'Websites', label: 'Folder pass' },
  { value: 'fPasses', group: 'Chat', label: 'Employee pass' },
]

const slugify = (s) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

// Folder-pass rule, copied from AdminFolderPasses.
const FOLDER_RULE = /^[a-z0-9][a-z0-9-]*$/

const blankCreate = (system) => {
  if (system === 'providersForm') return { provider_id: '', f: '', u: '', p: '', comment: '' }
  if (system === 'fPasses') return { employee_id: '', formName: '', u: '', p: '', note: '', chat: true }
  if (system === 'barber_intake_forms') return { f: '', u: '', p: '', note: '' }
  if (system === 'upload_forms') return { f: '', u: '', p: '', folder: '', note: '' }
  if (system === 'folder_passes') return { folder: '', username: '', password: '', note: '' }
  return { slug: '', name: '', u: '', p: '', epass: '', note: '' }
}

// The fresh live_data AdminStoreManage sets when a shop is created.
// Diner and Barbershop are not here on purpose: their live_data column
// default already supplies the demo menu / demo services, and Manage
// sets nothing for them on create either.
const liveDataDefault = (table, name) => {
  if (table === 'pos_stores') return { name, taxRate: 0.08, address: '', phone: '', receiptMessage: 'Thank you for shopping with us!' }
  if (table === 'dealer_shops') return { name, address: '', phone: '', hours: '', about: '' }
  if (table === 'employee_shops') return { name, address: '', phone: '', hours: '', about: '', jobs: [] }
  if (table === 'bodyshop_shops') return { name, address: '', phone: '', hours: '', about: '' }
  return null
}

export default function AdminAllPasses() {
  const [rows, setRows] = useState(null)
  const [failed, setFailed] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [storeList, setStoreList] = useState([])
  const [employeeList, setEmployeeList] = useState([])
  const [takenProviderIds, setTakenProviderIds] = useState([])

  // Edit state: which row is being edited, and its draft values.
  const [editingKey, setEditingKey] = useState(null)
  const [edit, setEdit] = useState({ user: '', pass: '', epass: '', customer: '', note: '' })
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Delete state: the row waiting for its in-page confirmation.
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Approve state: which row's draft is being approved right now.
  const [approving, setApproving] = useState(null)

  // Create state: the "Add a pass" form.
  const [showCreate, setShowCreate] = useState(false)
  const [createSystem, setCreateSystem] = useState('')
  const [create, setCreate] = useState(blankCreate(''))
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  // Change admin password: lives here at the bottom of All Passes,
  // not at the top of every admin page.
  const [newPassword, setNewPassword] = useState('')
  const [pwMsg, setPwMsg] = useState('')

  const load = async (silent) => {
    if (!silent) setLoading(true)
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
      grab('diner', supabase.from('diner_restaurants').select('id, slug, name, u, p, epass, note, draft_status').order('name')),
      grab('barbers', supabase.from('barbershop_shops').select('id, slug, name, u, p, epass, note, draft_status').order('name')),
      grab('websites', supabase.from('upload_forms').select('id, f, u, p, folder, note').order('f')),
      grab('websites', supabase.from('folder_passes').select('id, folder, username, password, note').order('folder')),
      grab('pos', supabase.from('pos_stores').select('id, slug, name, u, p, epass, note, draft_status').order('name')),
      grab('dealer', supabase.from('dealer_shops').select('id, slug, name, u, p, epass, note, draft_status').order('name')),
      grab('employee', supabase.from('employee_shops').select('id, slug, name, u, p, epass, note, draft_status').order('name')),
      grab('bodyshop', supabase.from('bodyshop_shops').select('id, slug, name, u, p, epass, note, draft_status').order('name')),
    ])
    setStoreList(providers)
    setEmployeeList(employees)
    setTakenProviderIds(formRows.map(r => r.provider_id))
    const providerName = (id) => providers.find(p => p.id === id)?.name || '—'
    const employeeName = (id) => {
      const e = employees.find(x => x.id === id)
      return e ? `${e.firstName} ${e.lastName || ''}`.trim() : '—'
    }
    const shopRow = (prefix, group, kind, table, linkPrefix, r) => ({
      key: prefix + '-' + r.id, group, kind,
      table, id: r.id,
      link: linkPrefix + r.slug, linkText: 'yently.com' + linkPrefix + r.slug,
      user: r.u, pass: r.p, epass: r.epass || '', passExtra: r.epass ? 'Team: ' + r.epass : '',
      customer: r.name || '—', note: r.note || '', draftStatus: r.draft_status || 'editing',
    })
    const all = [
      ...formRows.map(r => ({
        key: 'store-' + r.id, group: 'stores', kind: 'Store pass',
        table: 'providersForm', id: r.id,
        link: '/' + r.f, linkText: 'yently.com/' + r.f,
        user: r.u, pass: r.p, passExtra: '', customer: providerName(r.provider_id), note: r.comment || '',
      })),
      ...dinerRows.map(r => shopRow('diner', 'diner', 'Diner pass', 'diner_restaurants', '/diner?r=', r)),
      ...posRows.map(r => shopRow('pos', 'pos', 'POS pass', 'pos_stores', '/pos?s=', r)),
      ...dealerRows.map(r => shopRow('dealer', 'dealer', 'Dealer pass', 'dealer_shops', '/dealer?d=', r)),
      ...employeeRows.map(r => shopRow('employee', 'employee', 'Employee pass', 'employee_shops', '/employee?e=', r)),
      ...bodyshopRows.map(r => shopRow('bodyshop', 'bodyshop', 'Bodyshop pass', 'bodyshop_shops', '/bodyshop?b=', r)),
      ...shopRows.map(r => shopRow('barber', 'barbers', 'Barber pass', 'barbershop_shops', '/barbers?s=', r)),
      ...intakeRows.map(r => ({
        key: 'intake-' + r.id, group: 'websites', kind: 'Intake form',
        table: 'barber_intake_forms', id: r.id,
        link: '/barber-intake', linkText: 'yently.com/barber-intake (' + r.f + ')',
        user: r.u, pass: r.p, passExtra: '', customer: '—', note: r.note || '',
      })),
      ...uploadRows.map(r => ({
        key: 'upload-' + r.id, group: 'websites', kind: 'Upload form',
        table: 'upload_forms', id: r.id,
        link: '/' + r.f, linkText: 'yently.com/' + r.f,
        user: r.u, pass: r.p, passExtra: 'Folder: ' + r.folder, folder: r.folder, customer: '—', note: r.note || '',
      })),
      ...folderRows.map(r => ({
        key: 'folder-' + r.id, group: 'websites', kind: 'Folder pass',
        table: 'folder_passes', id: r.id,
        link: '/' + r.folder, linkText: 'yently.com/' + r.folder,
        user: r.username, pass: r.password, passExtra: '', customer: '—', note: r.note || '',
      })),
      ...passRows.map(r => ({
        key: 'emp-' + r.id, group: 'chat', kind: 'Employee pass',
        table: 'fPasses', id: r.id,
        link: '/' + r.formName, linkText: 'yently.com/' + r.formName,
        user: r.u, pass: r.p, passExtra: '', customer: employeeName(r.employee_id), note: r.note || '',
      })),
    ]
    setRows(all)
    setFailed(failedGroups)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ----- Edit -----

  const startEdit = (r) => {
    setEditingKey(r.key)
    setEdit({ user: r.user || '', pass: r.pass || '', epass: r.epass || '', customer: r.customer === '—' ? '' : (r.customer || ''), note: r.note || '' })
    setEditError('')
  }

  const cancelEdit = () => {
    setEditingKey(null)
    setEditError('')
  }

  // Save writes the edited fields back to the row's own table, by id —
  // the same update AdminStoreManage does. Slugs, links and folders are
  // never edited here, so none of Manage's slug cross-checks apply.
  const saveEdit = async (r) => {
    if (!edit.user.trim() || !edit.pass) { setEditError('Username and password are both required.'); return }
    let fields
    if (r.table === 'providersForm') {
      // Manage also stamps updated_at on a provider-form update.
      fields = { u: edit.user.trim(), p: edit.pass, comment: edit.note, updated_at: new Date().toISOString() }
    } else if (SHOP_TABLES.includes(r.table)) {
      if (!edit.customer.trim()) { setEditError('The shop name is required.'); return }
      fields = { u: edit.user.trim(), p: edit.pass, epass: edit.epass || '', name: edit.customer.trim(), note: edit.note }
    } else if (r.table === 'folder_passes') {
      fields = { username: edit.user.trim(), password: edit.pass, note: edit.note }
    } else {
      // fPasses, barber_intake_forms, upload_forms
      fields = { u: edit.user.trim(), p: edit.pass, note: edit.note }
    }
    setSavingEdit(true)
    try {
      const { error } = await supabase.from(r.table).update(fields).eq('id', r.id)
      if (error) { setEditError('Cannot save: ' + error.message); return }
      setStatus('✓ Saved.')
      setEditingKey(null)
      setEditError('')
      await load(true)
    } catch (err) {
      setEditError('Cannot save: ' + err.message)
    } finally {
      setSavingEdit(false)
    }
  }

  // ----- Delete -----

  const deleteLabel = (r) => (r.customer && r.customer !== '—' ? r.customer + ' — ' + r.linkText : r.linkText)

  // The row delete is exactly AdminStoreManage's remove(): delete by id,
  // except an upload form first has its picture folder deleted from
  // storage — and the form itself is only deleted once the folder is
  // really empty, so pictures are never orphaned. The only difference
  // is the confirmation: in-page here, never window.confirm().
  const doDelete = async () => {
    const r = confirmDelete
    if (!r) return
    setDeleting(true)
    setDeleteError('')
    try {
      if (r.table === 'upload_forms' && r.folder) {
        let offset = 0
        for (;;) {
          const { data: files, error: listErr } = await supabase.storage.from('product-images').list('store/' + r.folder, { limit: 1000, offset })
          if (listErr) { setDeleteError(`Cannot delete: the folder "${r.folder}" could not be read (${listErr.message}) — the form was NOT deleted. Try again.`); return }
          const paths = (files || []).map(f => 'store/' + r.folder + '/' + f.name)
          if (paths.length > 0) {
            const { error: rmErr } = await supabase.storage.from('product-images').remove(paths)
            if (rmErr) { setDeleteError(`Cannot delete: the folder "${r.folder}" could not be deleted (${rmErr.message}) — the form was NOT deleted. Try again.`); return }
          }
          if ((files || []).length < 1000) break
          offset += 1000
        }
        // A storage delete can report no error and still leave files
        // behind, so check the folder is really empty before the form
        // itself is deleted — otherwise the pictures would be orphaned
        // with no form pointing at them.
        const { data: left, error: checkErr } = await supabase.storage.from('product-images').list('store/' + r.folder, { limit: 1 })
        if (checkErr) { setDeleteError(`Cannot delete: the folder "${r.folder}" could not be checked (${checkErr.message}) — the form was NOT deleted. Try again.`); return }
        if (left && left.length > 0) { setDeleteError(`Cannot delete: the pictures in "${r.folder}" could not be deleted — the form was NOT deleted. Try again.`); return }
      }
      const { error } = await supabase.from(r.table).delete().eq('id', r.id)
      if (error) { setDeleteError('Cannot delete: ' + error.message); return }
      setStatus(`✓ Deleted "${deleteLabel(r)}".`)
      setConfirmDelete(null)
      if (editingKey === r.key) setEditingKey(null)
      await load(true)
    } catch (err) {
      setDeleteError('Cannot delete: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  // ----- Approve -----

  // One tap makes a pending shop draft live, through the same approve
  // RPC AdminStoreManage uses for that system.
  const approveRow = async (r) => {
    const spec = APPROVE_RPC[r.table]
    if (!spec) return
    setApproving(r.key)
    try {
      const { error } = await supabase.rpc(spec.rpc, { [spec.param]: r.id })
      if (error) { setStatus('Cannot approve: ' + error.message); return }
      setStatus(`✓ Draft approved — ${r.customer} is live now.`)
      await load(true)
    } catch (err) {
      setStatus('Cannot approve: ' + err.message)
    } finally {
      setApproving(null)
    }
  }

  // ----- Create -----

  // A form name is taken if another table already uses it — the same
  // checks AdminStoreManage runs, per table. A check that fails to run
  // behaves like Manage: it does not block the save.
  const nameTaken = async (table, col, val) => {
    const { data } = await supabase.from(table).select('id').eq(col, val)
    return data && data.length > 0
  }

  const saveCreate = async () => {
    const system = createSystem
    if (!system) { setCreateError('Pick a system first.'); return }
    setCreateError('')
    setCreating(true)
    try {
      const c = create
      if (SHOP_TABLES.includes(system)) {
        const slug = slugify(c.slug)
        if (!slug) { setCreateError('The slug has to contain a letter or number.'); return }
        if (slug === 'admin') { setCreateError('"admin" is reserved — pick another slug.'); return }
        if (!c.name?.trim() || !c.u?.trim() || !c.p) { setCreateError('Name, username and password are all required.'); return }
        const fields = { slug, name: c.name.trim(), u: c.u.trim(), p: c.p, epass: c.epass || '', note: c.note || '' }
        const live = liveDataDefault(system, c.name.trim())
        if (live) fields.live_data = live
        const { error } = await supabase.from(system).insert(fields)
        if (error) { setCreateError('Cannot add: ' + error.message); return }
      } else if (system === 'providersForm') {
        if (!c.provider_id) { setCreateError('Pick a store first.'); return }
        const f = slugify(c.f)
        if (!f) { setCreateError('The form name has to contain a letter or number.'); return }
        if (f === 'admin') { setCreateError('"admin" is reserved — pick another form name.'); return }
        if (!c.u?.trim() || !c.p) { setCreateError('Username and password are both required.'); return }
        if (await nameTaken('fPasses', 'formName', f)) { setCreateError('That form name is already used by an employee pass — pick another.'); return }
        if (await nameTaken('website_domain', 'slug', f)) { setCreateError('That form name is already used by a barber website — pick another.'); return }
        if (await nameTaken('upload_forms', 'f', f)) { setCreateError('That form name is already used by a picture upload form — pick another.'); return }
        const { error } = await supabase.from('providersForm').insert({ provider_id: Number(c.provider_id), f, u: c.u.trim(), p: c.p, comment: c.comment || '' })
        if (error) { setCreateError('Cannot add: ' + error.message); return }
      } else if (system === 'fPasses') {
        const formName = slugify(c.formName)
        if (!formName) { setCreateError('The form name has to contain a letter or number.'); return }
        if (formName === 'admin') { setCreateError('"admin" is reserved — pick another form name.'); return }
        if (!c.employee_id) { setCreateError('Pick an employee first.'); return }
        if (!c.u?.trim() || !c.p) { setCreateError('Username and password are both required.'); return }
        if (await nameTaken('providersForm', 'f', formName)) { setCreateError('That form name is already used by a provider form — pick another.'); return }
        if (await nameTaken('website_domain', 'slug', formName)) { setCreateError('That form name is already used by a barber website — pick another.'); return }
        if (await nameTaken('upload_forms', 'f', formName)) { setCreateError('That form name is already used by a picture upload form — pick another.'); return }
        const { data, error } = await supabase.from('fPasses').insert({ employee_id: Number(c.employee_id), formName, u: c.u.trim(), p: c.p, note: c.note || '' }).select('id').single()
        if (error) { setCreateError('Cannot add: ' + error.message); return }
        const { error: allowErr } = await supabase.from('fAllowed').upsert({ pass_id: data.id, chat: c.chat !== false }, { onConflict: 'pass_id' })
        if (allowErr) {
          setStatus(`✓ Pass added, but the chat setting failed: ${allowErr.message}`)
          setCreate(blankCreate(system))
          await load(true)
          return
        }
      } else if (system === 'barber_intake_forms') {
        const f = slugify(c.f)
        if (!f) { setCreateError('The form name has to contain a letter or number.'); return }
        if (f === 'admin') { setCreateError('"admin" is reserved — pick another form name.'); return }
        if (!c.u?.trim() || !c.p) { setCreateError('Username and password are both required.'); return }
        if (await nameTaken('providersForm', 'f', f)) { setCreateError('That form name is already used by a provider form — pick another.'); return }
        if (await nameTaken('fPasses', 'formName', f)) { setCreateError('That form name is already used by an employee pass — pick another.'); return }
        if (await nameTaken('website_domain', 'slug', f)) { setCreateError('That form name is already used by a barber website — pick another.'); return }
        if (await nameTaken('upload_forms', 'f', f)) { setCreateError('That form name is already used by a picture upload form — pick another.'); return }
        const { error } = await supabase.from('barber_intake_forms').insert({ f, u: c.u.trim(), p: c.p, note: c.note || '' })
        if (error) { setCreateError('Cannot add: ' + error.message); return }
      } else if (system === 'upload_forms') {
        const f = slugify(c.f)
        if (!f) { setCreateError('The form name has to contain a letter or number.'); return }
        if (f === 'admin') { setCreateError('"admin" is reserved — pick another form name.'); return }
        if (!c.u?.trim() || !c.p) { setCreateError('Username and password are both required.'); return }
        const folder = slugify(c.folder)
        if (!folder) { setCreateError('The upload folder name has to contain a letter or number.'); return }
        if (await nameTaken('providersForm', 'f', f)) { setCreateError('That form name is already used by a provider form — pick another.'); return }
        if (await nameTaken('fPasses', 'formName', f)) { setCreateError('That form name is already used by an employee pass — pick another.'); return }
        if (await nameTaken('website_domain', 'slug', f)) { setCreateError('That form name is already used by a barber website — pick another.'); return }
        if (await nameTaken('barber_intake_forms', 'f', f)) { setCreateError('That form name is already used by a barber intake form — pick another.'); return }
        const { error } = await supabase.from('upload_forms').insert({ f, u: c.u.trim(), p: c.p, folder, note: c.note || '' })
        if (error) { setCreateError('Cannot add: ' + error.message); return }
        // Saving an upload form creates its folder for real in the
        // picture storage (an empty marker file), so the customer can
        // upload into it right away. Best effort: a storage failure
        // leaves the form saved and says so.
        let folderNote = ''
        const { error: folderErr } = await supabase.storage.from('product-images').upload('store/' + folder + '/.keep', new Blob([''], { type: 'text/plain' }), { upsert: true })
        if (folderErr) folderNote = ` The folder "${folder}" could not be created (${folderErr.message}) — the form is saved; save it again to retry.`
        setStatus('✓ Pass added.' + folderNote)
        setCreate(blankCreate(system))
        await load(true)
        return
      } else if (system === 'folder_passes') {
        const folder = (c.folder || '').trim().toLowerCase()
        if (!FOLDER_RULE.test(folder) || folder === 'admin') { setCreateError('Folder names can only use small letters, numbers and dashes, and cannot be "admin".'); return }
        if (!c.username?.trim() || !c.password) { setCreateError('Username and password are both required.'); return }
        const { error } = await supabase.from('folder_passes').upsert({ folder, username: c.username.trim(), password: c.password, note: (c.note || '').trim() }, { onConflict: 'folder' })
        if (error) { setCreateError('Cannot add: ' + error.message); return }
      }
      setStatus('✓ Pass added.')
      setCreate(blankCreate(system))
      await load(true)
    } catch (err) {
      setCreateError('Cannot add: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  // ----- Change admin password -----

  // Changes the password used to log in to Admin. Store and shop
  // passwords are untouched — they live in their own tables.
  const changePassword = async (e) => {
    e.preventDefault()
    if (newPassword.length < 6) { setPwMsg('Password must be at least 6 characters.'); return }
    setPwMsg('Saving…')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setPwMsg('Error: ' + error.message); return }
    setNewPassword('')
    setPwMsg('✓ Password changed.')
  }

  const createHint = () => {
    if (createSystem === 'diner_restaurants') return 'The customer shares yently.com/diner?r=' + (slugify(create.slug) || 'slug') + ' with their own customers. New restaurants start with the demo menu.'
    if (createSystem === 'barbershop_shops') return 'The customer shares yently.com/barbers?s=' + (slugify(create.slug) || 'slug') + ' with their own customers. New shops start with the demo services.'
    if (createSystem === 'pos_stores') return 'The customer shares yently.com/pos?s=' + (slugify(create.slug) || 'slug') + ' with their staff. New stores start empty — the owner adds items in Setup.'
    if (createSystem === 'dealer_shops') return 'The customer shares yently.com/dealer?d=' + (slugify(create.slug) || 'slug') + ' with their own customers. New dealers start empty — the owner adds vehicles in Setup.'
    if (createSystem === 'employee_shops') return 'The customer shares yently.com/employee?e=' + (slugify(create.slug) || 'slug') + ' with their staff. New teams start empty — the owner adds staff in Setup.'
    if (createSystem === 'bodyshop_shops') return 'The customer shares yently.com/bodyshop?b=' + (slugify(create.slug) || 'slug') + ' with their own customers. New bodyshops start empty.'
    if (createSystem === 'providersForm') return 'The store will open yently.com/' + (slugify(create.f) || 'form-name') + ' and log in there.'
    if (createSystem === 'fPasses') return 'The employee logs in at yently.com/' + (slugify(create.formName) || 'form-name') + ' with this username and password.'
    if (createSystem === 'barber_intake_forms') return 'The barber logs in at yently.com/barber-intake with this form name, a username, and a password.'
    if (createSystem === 'upload_forms') return 'The customer logs in at yently.com/' + (slugify(create.f) || 'form-name') + ' with a username and a password. Saving creates the upload folder for real.'
    if (createSystem === 'folder_passes') return 'The folder\'s Setup tab will ask for this username and password. Leave the folder open by deleting the pass.'
    return ''
  }

  if (loading) return <div className="hero-card"><p>Loading all passes...</p></div>

  const q = search.trim().toLowerCase()
  const shown = (rows || []).filter(r => !q || [r.linkText, r.user, r.pass, r.customer, r.note, r.kind].join(' ').toLowerCase().includes(q))
  const total = (rows || []).length
  const isShop = (r) => SHOP_TABLES.includes(r.table)

  return (
    <div>
      <div className="hero-card">
        <h2>🔑 All Passes {total > 0 && `(${total})`}</h2>
        <p>Every login you have handed out — the link, the username, the password, who uses it, and your note. Grouped by area; use the search to find one fast. Add, edit, delete and approve passes right here — no need to open their own tables.</p>
      </div>
      <div className="form-card">
        <input placeholder="Search link, username, customer, note..." value={search} onChange={e => setSearch(e.target.value)} />
        <button type="button" className="btn-soft" onClick={() => load()}>↻ Refresh</button>
        <button type="button" className="btn-primary" onClick={() => { setShowCreate(!showCreate); setCreateError('') }}>{showCreate ? 'Close add form' : '+ Add a pass'}</button>
      </div>
      {status && <p>{status}</p>}

      {showCreate && (
        <div className="form-card">
          <h3>Add a pass</h3>
          <select value={createSystem} onChange={e => { setCreateSystem(e.target.value); setCreate(blankCreate(e.target.value)); setCreateError('') }}>
            <option value="">— Pick a system —</option>
            {GROUPS.map(g => (
              <optgroup key={g.key} label={g.title}>
                {CREATE_SYSTEMS.filter(s => s.group === g.title).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </optgroup>
            ))}
          </select>
          {createSystem && <p className="hint">{createHint()}</p>}
          {SHOP_TABLES.includes(createSystem) && (<>
            <input required placeholder="Slug — the word in the link" value={create.slug || ''} onChange={e => setCreate({ ...create, slug: e.target.value })} />
            <input required placeholder={createSystem === 'employee_shops' ? 'Team name' : createSystem === 'dealer_shops' ? 'Dealer name' : createSystem === 'bodyshop_shops' ? 'Bodyshop name' : createSystem === 'pos_stores' ? 'Store name' : createSystem === 'barbershop_shops' ? 'Shop name' : 'Restaurant name'} value={create.name || ''} onChange={e => setCreate({ ...create, name: e.target.value })} />
            <input required placeholder="Username" value={create.u || ''} onChange={e => setCreate({ ...create, u: e.target.value })} />
            <input required placeholder="Password" value={create.p || ''} onChange={e => setCreate({ ...create, p: e.target.value })} />
            <input placeholder="Employee password (optional — one shared team password)" value={create.epass || ''} onChange={e => setCreate({ ...create, epass: e.target.value })} />
            <input placeholder="Note for yourself (optional — not shown to the shop)" value={create.note || ''} onChange={e => setCreate({ ...create, note: e.target.value })} />
          </>)}
          {createSystem === 'providersForm' && (<>
            <select required value={create.provider_id || ''} onChange={e => setCreate({ ...create, provider_id: e.target.value })}>
              <option value="">— Store provider —</option>
              {storeList.map(pr => {
                const taken = takenProviderIds.includes(pr.id)
                return <option key={pr.id} value={pr.id} disabled={taken}>{pr.name}{taken ? ' — already has a form' : ''}</option>
              })}
            </select>
            <input required placeholder="Form name — the word after yently.com/ (e.g. paris-form)" value={create.f || ''} onChange={e => setCreate({ ...create, f: e.target.value })} />
            <input required placeholder="Username for the store" value={create.u || ''} onChange={e => setCreate({ ...create, u: e.target.value })} />
            <input required placeholder="Password for the store" value={create.p || ''} onChange={e => setCreate({ ...create, p: e.target.value })} />
            <input placeholder="Note for yourself (optional — not shown to the store)" value={create.comment || ''} onChange={e => setCreate({ ...create, comment: e.target.value })} />
          </>)}
          {createSystem === 'fPasses' && (<>
            <select required value={create.employee_id || ''} onChange={e => setCreate({ ...create, employee_id: e.target.value })}>
              <option value="">— Employee —</option>
              {employeeList.map(emp => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName || ''}</option>)}
            </select>
            <input required placeholder="Form name (the link after yently.com/)" value={create.formName || ''} onChange={e => setCreate({ ...create, formName: e.target.value })} />
            <input required placeholder="Username" value={create.u || ''} onChange={e => setCreate({ ...create, u: e.target.value })} />
            <input required placeholder="Password (visible — the employee logs in with this)" value={create.p || ''} onChange={e => setCreate({ ...create, p: e.target.value })} />
            <input placeholder="Note" value={create.note || ''} onChange={e => setCreate({ ...create, note: e.target.value })} />
            <label><input type="checkbox" checked={create.chat !== false} onChange={e => setCreate({ ...create, chat: e.target.checked })} /> Allow chat</label>
          </>)}
          {createSystem === 'barber_intake_forms' && (<>
            <input required placeholder="Form name — given to the barber for login" value={create.f || ''} onChange={e => setCreate({ ...create, f: e.target.value })} />
            <input required placeholder="Username for the barber" value={create.u || ''} onChange={e => setCreate({ ...create, u: e.target.value })} />
            <input required placeholder="Password for the barber" value={create.p || ''} onChange={e => setCreate({ ...create, p: e.target.value })} />
            <input placeholder="Note for yourself (optional — not shown to the barber)" value={create.note || ''} onChange={e => setCreate({ ...create, note: e.target.value })} />
          </>)}
          {createSystem === 'upload_forms' && (<>
            <input required placeholder="Form name — the word in yently.com/form-name" value={create.f || ''} onChange={e => setCreate({ ...create, f: e.target.value })} />
            <input required placeholder="Username for the customer" value={create.u || ''} onChange={e => setCreate({ ...create, u: e.target.value })} />
            <input required placeholder="Password for the customer" value={create.p || ''} onChange={e => setCreate({ ...create, p: e.target.value })} />
            <input required placeholder="Upload folder name — where the pictures will go" value={create.folder || ''} onChange={e => setCreate({ ...create, folder: e.target.value })} />
            <input placeholder="Note for yourself (optional — not shown to the customer)" value={create.note || ''} onChange={e => setCreate({ ...create, note: e.target.value })} />
          </>)}
          {createSystem === 'folder_passes' && (<>
            <input required placeholder="Folder name — small letters, numbers and dashes" value={create.folder || ''} onChange={e => setCreate({ ...create, folder: e.target.value })} />
            <input required placeholder="Username" value={create.username || ''} onChange={e => setCreate({ ...create, username: e.target.value })} />
            <input required placeholder="Password" value={create.password || ''} onChange={e => setCreate({ ...create, password: e.target.value })} />
            <input placeholder="Note" value={create.note || ''} onChange={e => setCreate({ ...create, note: e.target.value })} />
          </>)}
          {createSystem && (
            <div className="store-actions">
              <button type="button" className="btn-primary" onClick={saveCreate} disabled={creating}>Save</button>
              <button type="button" className="btn-soft" onClick={() => { setShowCreate(false); setCreateSystem(''); setCreateError('') }}>Cancel</button>
            </div>
          )}
          {createError && <p className="hint">{createError}</p>}
        </div>
      )}

      {confirmDelete && (
        <div className="form-card">
          <h3>Delete {confirmDelete.kind}?</h3>
          <p>Delete “{deleteLabel(confirmDelete)}”?</p>
          {isShop(confirmDelete) && <p className="hint">Deleting this shop removes the whole shop — its page, its orders and bookings, and everything in it. This cannot be undone.</p>}
          {confirmDelete.table === 'upload_forms' && confirmDelete.folder && <p className="hint">Its folder “{confirmDelete.folder}” and all the pictures in it will be deleted too. This cannot be undone.</p>}
          {!isShop(confirmDelete) && confirmDelete.table !== 'upload_forms' && <p className="hint">This login will stop working. This cannot be undone.</p>}
          <div className="store-actions">
            <button type="button" className="btn-primary" onClick={doDelete} disabled={deleting}>Delete</button>
            <button type="button" className="btn-soft" onClick={() => { setConfirmDelete(null); setDeleteError('') }}>Cancel</button>
          </div>
          {deleteError && <p className="hint">{deleteError}</p>}
        </div>
      )}

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
                    <tr><th>Link</th><th>Username</th><th>Password</th><th>Customer</th><th>Note</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {list.map(r => {
                      const editing = editingKey === r.key
                      return (
                        <tr key={r.key}>
                          <td><a href={r.link} target="_blank" rel="noreferrer">{r.linkText}</a><br /><span className="hint">{r.kind}</span></td>
                          <td>{editing ? <input style={{ width: '100%' }} value={edit.user} onChange={e => setEdit({ ...edit, user: e.target.value })} /> : r.user}</td>
                          <td>
                            {editing ? (
                              <>
                                <input style={{ width: '100%' }} value={edit.pass} onChange={e => setEdit({ ...edit, pass: e.target.value })} />
                                {isShop(r) && <><br /><input style={{ width: '100%' }} placeholder="Team password" value={edit.epass} onChange={e => setEdit({ ...edit, epass: e.target.value })} /></>}
                              </>
                            ) : (
                              <>{r.pass}{r.passExtra && <><br /><span className="hint">{r.passExtra}</span></>}</>
                            )}
                          </td>
                          <td>{editing && isShop(r) ? <input style={{ width: '100%' }} value={edit.customer} onChange={e => setEdit({ ...edit, customer: e.target.value })} /> : r.customer}</td>
                          <td>{editing ? <input style={{ width: '100%' }} value={edit.note} onChange={e => setEdit({ ...edit, note: e.target.value })} /> : (r.note || '—')}</td>
                          <td>
                            {editing ? (
                              <>
                                <button type="button" className="btn-primary" onClick={() => saveEdit(r)} disabled={savingEdit}>Save</button>{' '}
                                <button type="button" className="btn-soft" onClick={cancelEdit}>Cancel</button>
                                {editError && <><br /><span className="hint">{editError}</span></>}
                              </>
                            ) : (
                              <>
                                <button type="button" className="btn-mini" onClick={() => startEdit(r)}>✏️ Edit</button>{' '}
                                <button type="button" className="btn-mini" onClick={() => { setConfirmDelete(r); setDeleteError('') }}>🗑 Delete</button>
                                {isShop(r) && (
                                  r.draftStatus === 'pending'
                                    ? <>{' '}<button type="button" className="btn-mini" onClick={() => approveRow(r)} disabled={approving === r.key}>Approve draft</button></>
                                    : <><br /><span className="hint">Draft: {r.draftStatus}</span></>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}

      <div className="form-card" style={{ marginTop: 20 }}>
        <h3>🔑 Change your admin password</h3>
        <p className="hint">This changes the password you use to log in to Admin. It only changes it here — the store and shop passwords on the rows above stay as they are.</p>
        <form onSubmit={changePassword} className="pw-row" style={{ margin: 0 }}>
          <input type="password" placeholder="New password" style={{ maxWidth: 260 }} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          <button type="submit" className="btn-mini">Change password</button>
          {pwMsg && <span className="status">{pwMsg}</span>}
        </form>
      </div>
    </div>
  )
}
