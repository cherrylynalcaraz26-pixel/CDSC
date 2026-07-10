/**
 * Minimal local mock of Supabase (GoTrue auth + PostgREST) for the CDSC
 * Client Portal demo video. Serves canned demo data — no real backend, free.
 */
const http = require('http')

const PORT = 54321
const USER_ID = '11111111-1111-4111-8111-111111111111'
const EMAIL = 'maria.santos@northpointmfg.ph'
const CLIENT_ID = 'aaaaaaaa-0000-4000-8000-000000000001'
const COMPANY = 'Northpoint Manufacturing Inc.'

// --- fake but well-formed JWT ---
function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url')
}
const ACCESS_TOKEN = [
  b64url({ alg: 'HS256', typ: 'JWT' }),
  b64url({
    sub: USER_ID, email: EMAIL, aud: 'authenticated', role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    iat: Math.floor(Date.now() / 1000),
    session_id: '22222222-2222-4222-8222-222222222222',
    app_metadata: { provider: 'email' }, user_metadata: {},
  }),
  'ZmFrZXNpZ25hdHVyZQ',
].join('.')

const USER = {
  id: USER_ID, aud: 'authenticated', role: 'authenticated', email: EMAIL,
  email_confirmed_at: '2026-01-05T08:00:00Z', phone: '',
  confirmed_at: '2026-01-05T08:00:00Z', last_sign_in_at: new Date().toISOString(),
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Maria Santos' },
  identities: [], created_at: '2026-01-05T08:00:00Z', updated_at: new Date().toISOString(),
}

// --- date helpers: spread demo data over the last 6 months ---
const now = new Date()
function ago(days) {
  const d = new Date(now.getTime() - days * 86400000)
  return d.toISOString()
}
function agoDate(days) {
  return ago(days).slice(0, 10)
}

// --- demo data ---
const soItems = (rows) => rows.map((r, i) => ({
  id: `si-${Math.random().toString(36).slice(2, 8)}-${i}`,
  item_name: r[0], quantity: r[1], unit: r[2], unit_price: r[3],
  selling_price: r[3], total_amount: +(r[1] * r[3]).toFixed(2),
}))

const DB = {
  profiles: [{
    id: USER_ID, full_name: 'Maria Santos', role: 'client',
    avatar_url: null, company: COMPANY,
  }],
  clients: [{
    id: CLIENT_ID, company_name: COMPANY, auth_user_id: USER_ID,
    logo_url: null, avatar_url: null, website: 'northpointmfg.ph',
    portal_access: true, show_csi_in_portal: false,
    contact_person: 'Maria Santos', email: EMAIL, phone: '+63 917 555 0148',
    address: 'Blk 4, Light Industry & Science Park, Cabuyao, Laguna',
  }],
  system_settings: [{
    id: 1, company_name: 'CDSC Industrial Supply',
    website: 'cdscindustrialsupply.netlify.app',
    address: 'Quezon City, Metro Manila', phone: '+63 2 8123 4567',
    email: 'sales@cdscindustrialsupply.com', logo_url: null, tin: '123-456-789-000',
    live_video_url: '',
  }],
  sales_orders: [
    { id: 'so-8', so_number: 'SO-2026-0148', client_po_number: 'PO-NPM-0231', so_date: agoDate(2),   created_at: ago(2),   status: 'draft',      total_amount: 48750.00, show_in_portal: true, client_name: COMPANY, remarks: 'Rush order — production line 2',
      so_items: soItems([['Industrial Safety Gloves (Nitrile)', 50, 'pairs', 185], ['Cut-Resistant Sleeves', 30, 'pcs', 320], ['Safety Goggles Anti-Fog', 60, 'pcs', 495]]) },
    { id: 'so-7', so_number: 'SO-2026-0141', client_po_number: 'PO-NPM-0227', so_date: agoDate(9),   created_at: ago(9),   status: 'confirmed',  total_amount: 126400.00, show_in_portal: true, client_name: COMPANY, remarks: null,
      so_items: soItems([['Hydraulic Hose 3/8" R2 (per meter)', 120, 'm', 420], ['Ball Valve 1" Stainless', 24, 'pcs', 1850], ['Teflon Tape Industrial', 100, 'rolls', 32]]) },
    { id: 'so-6', so_number: 'SO-2026-0133', client_po_number: 'PO-NPM-0219', so_date: agoDate(16),  created_at: ago(16),  status: 'processing', total_amount: 89320.00, show_in_portal: true, client_name: COMPANY, remarks: null,
      so_items: soItems([['V-Belt B52', 40, 'pcs', 385], ['Bearing 6205-2RS', 60, 'pcs', 245], ['Grease Lithium EP2 (1kg)', 48, 'cans', 780]]) },
    { id: 'so-5', so_number: 'SO-2026-0127', client_po_number: 'PO-NPM-0212', so_date: agoDate(24),  created_at: ago(24),  status: 'shipped',    total_amount: 64150.00, show_in_portal: true, client_name: COMPANY, remarks: 'Deliver to Warehouse B',
      so_items: soItems([['Welding Rod 6013 (5kg box)', 30, 'boxes', 1250], ['Cutting Disc 4" (box of 25)', 20, 'boxes', 1345]]) },
    { id: 'so-4', so_number: 'SO-2026-0114', client_po_number: 'PO-NPM-0203', so_date: agoDate(41),  created_at: ago(41),  status: 'delivered',  total_amount: 152780.00, show_in_portal: true, client_name: COMPANY, remarks: null,
      so_items: soItems([['Air Filter Element AF-25270', 25, 'pcs', 2150], ['Hydraulic Oil ISO 68 (200L drum)', 4, 'drums', 24870]]) },
    { id: 'so-3', so_number: 'SO-2026-0102', client_po_number: 'PO-NPM-0195', so_date: agoDate(68),  created_at: ago(68),  status: 'delivered',  total_amount: 97640.00, show_in_portal: true, client_name: COMPANY, remarks: null,
      so_items: soItems([['Conveyor Roller 60mm x 600mm', 32, 'pcs', 1680], ['Roller Bracket Set', 32, 'sets', 425], ['Anchor Bolt M12x100', 200, 'pcs', 148]]) },
    { id: 'so-2', so_number: 'SO-2026-0089', client_po_number: 'PO-NPM-0184', so_date: agoDate(97),  created_at: ago(97),  status: 'delivered',  total_amount: 58420.00, show_in_portal: true, client_name: COMPANY, remarks: null,
      so_items: soItems([['LED High Bay Light 150W', 12, 'pcs', 3450], ['Industrial Extension Cord 30m', 8, 'pcs', 2120]]) },
    { id: 'so-1', so_number: 'SO-2026-0071', client_po_number: 'PO-NPM-0172', so_date: agoDate(131), created_at: ago(131), status: 'delivered',  total_amount: 43180.00, show_in_portal: true, client_name: COMPANY, remarks: null,
      so_items: soItems([['Safety Harness Full Body', 10, 'pcs', 2890], ['Lanyard Double Hook', 10, 'pcs', 1428]]) },
  ],
  quotations: [
    { id: 'q-5', quote_number: 'QT-2026-0212', quote_date: agoDate(3),  valid_until: agoDate(-27), client_name: COMPANY, subject: 'Preventive Maintenance Supplies — Q3', subtotal: 76500, vat_amount: 9180, ewt_amount: 0, total_amount: 85680.00, notes: 'Prices valid for 30 days.', status: 'sent', created_at: ago(3),
      quotation_items: soItems([['Bearing 6308-ZZ', 40, 'pcs', 685], ['Coupling Element L-100', 15, 'pcs', 1240], ['Grease Lithium EP2 (1kg)', 36, 'cans', 780]]) },
    { id: 'q-4', quote_number: 'QT-2026-0198', quote_date: agoDate(12), valid_until: agoDate(-18), client_name: COMPANY, subject: 'PPE Restock — July', subtotal: 43200, vat_amount: 5184, ewt_amount: 0, total_amount: 48384.00, notes: null, status: 'sent', created_at: ago(12),
      quotation_items: soItems([['Hard Hat with Chin Strap', 60, 'pcs', 385], ['Reflective Vest Class 2', 60, 'pcs', 215], ['Steel-Toe Boots (assorted sizes)', 20, 'pairs', 1450]]) },
    { id: 'q-3', quote_number: 'QT-2026-0185', quote_date: agoDate(20), valid_until: agoDate(10),  client_name: COMPANY, subject: 'Hydraulic System Components', subtotal: 112860, vat_amount: 13543.2, ewt_amount: 0, total_amount: 126403.20, notes: 'Converted to SO-2026-0141.', status: 'accepted', created_at: ago(20),
      quotation_items: soItems([['Hydraulic Hose 3/8" R2 (per meter)', 120, 'm', 420], ['Ball Valve 1" Stainless', 24, 'pcs', 1850], ['Teflon Tape Industrial', 100, 'rolls', 32]]) },
    { id: 'q-2', quote_number: 'QT-2026-0171', quote_date: agoDate(35), valid_until: agoDate(5),   client_name: COMPANY, subject: 'Workshop Tooling Upgrade', subtotal: 91800, vat_amount: 11016, ewt_amount: 0, total_amount: 102816.00, notes: null, status: 'accepted', created_at: ago(35),
      quotation_items: soItems([['Angle Grinder 4" Industrial', 8, 'pcs', 4850], ['Drill Press Bench 16mm', 2, 'units', 18900], ['Bench Vise 6"', 6, 'pcs', 2450]]) },
    { id: 'q-1', quote_number: 'QT-2026-0158', quote_date: agoDate(52), valid_until: agoDate(22),  client_name: COMPANY, subject: 'Packaging Line Consumables', subtotal: 38400, vat_amount: 4608, ewt_amount: 0, total_amount: 43008.00, notes: 'Client sourced locally.', status: 'declined', created_at: ago(52),
      quotation_items: soItems([['Stretch Film 20" x 1500ft', 40, 'rolls', 620], ['Strapping Band PET 5/8"', 24, 'rolls', 580]]) },
  ],
  client_inventory: [
    { id: 'ci-1', client_id: CLIENT_ID, item_name: 'Industrial Safety Gloves (Nitrile)', quantity_on_hand: 142, low_stock_threshold: 40, unit: 'pairs', department: 'Production', updated_at: ago(1) },
    { id: 'ci-2', client_id: CLIENT_ID, item_name: 'Safety Goggles Anti-Fog',            quantity_on_hand: 58,  low_stock_threshold: 25, unit: 'pcs',   department: 'Production', updated_at: ago(2) },
    { id: 'ci-3', client_id: CLIENT_ID, item_name: 'Bearing 6205-2RS',                   quantity_on_hand: 12,  low_stock_threshold: 20, unit: 'pcs',   department: 'Maintenance', updated_at: ago(3) },
    { id: 'ci-4', client_id: CLIENT_ID, item_name: 'Grease Lithium EP2 (1kg)',           quantity_on_hand: 26,  low_stock_threshold: 12, unit: 'cans',  department: 'Maintenance', updated_at: ago(4) },
    { id: 'ci-5', client_id: CLIENT_ID, item_name: 'Welding Rod 6013 (5kg box)',         quantity_on_hand: 0,   low_stock_threshold: 6,  unit: 'boxes', department: 'Fabrication', updated_at: ago(2) },
    { id: 'ci-6', client_id: CLIENT_ID, item_name: 'Cutting Disc 4" (box of 25)',        quantity_on_hand: 14,  low_stock_threshold: 8,  unit: 'boxes', department: 'Fabrication', updated_at: ago(6) },
    { id: 'ci-7', client_id: CLIENT_ID, item_name: 'Hydraulic Oil ISO 68 (200L drum)',   quantity_on_hand: 3,   low_stock_threshold: 2,  unit: 'drums', department: 'Maintenance', updated_at: ago(9) },
    { id: 'ci-8', client_id: CLIENT_ID, item_name: 'V-Belt B52',                         quantity_on_hand: 34,  low_stock_threshold: 15, unit: 'pcs',   department: 'Maintenance', updated_at: ago(5) },
  ],
  client_inventory_transactions: [
    { id: 'tx-1', client_id: CLIENT_ID, item_name: 'Industrial Safety Gloves (Nitrile)', type: 'issue',   quantity: -24, department: 'Production',  remarks: 'Weekly issue — Line 1 & 2', created_at: ago(1) },
    { id: 'tx-2', client_id: CLIENT_ID, item_name: 'Bearing 6205-2RS',                   type: 'issue',   quantity: -8,  department: 'Maintenance', remarks: 'Motor rebuild — Press 3',   created_at: ago(3) },
    { id: 'tx-3', client_id: CLIENT_ID, item_name: 'Grease Lithium EP2 (1kg)',           type: 'issue',   quantity: -6,  department: 'Maintenance', remarks: 'Monthly PM schedule',        created_at: ago(4) },
    { id: 'tx-4', client_id: CLIENT_ID, item_name: 'Cutting Disc 4" (box of 25)',        type: 'receive', quantity: 20,  department: 'Fabrication', remarks: 'DR-2026-0455 received',      created_at: ago(24) },
    { id: 'tx-5', client_id: CLIENT_ID, item_name: 'Welding Rod 6013 (5kg box)',         type: 'issue',   quantity: -12, department: 'Fabrication', remarks: 'Tank fabrication project',   created_at: ago(2) },
  ],
  client_departments: [
    { id: 'dep-1', client_id: CLIENT_ID, name: 'Production' },
    { id: 'dep-2', client_id: CLIENT_ID, name: 'Maintenance' },
    { id: 'dep-3', client_id: CLIENT_ID, name: 'Fabrication' },
    { id: 'dep-4', client_id: CLIENT_ID, name: 'Warehouse' },
  ],
  client_messages: [
    { id: 'msg-1', client_id: CLIENT_ID, client_name: COMPANY, message: 'Hi! Can we expedite delivery for PO-NPM-0227? Our line is waiting on the hydraulic hoses.', sent_at: ago(8), status: 'read', reply: 'Good day, Maria! Yes — we moved it up. Hoses ship this Thursday and the rest follows Monday.', replied_at: ago(7) },
    { id: 'msg-2', client_id: CLIENT_ID, client_name: COMPANY, message: 'Thank you! Also, please include the updated MSDS for the hydraulic oil in the next delivery.', sent_at: ago(7), status: 'read', reply: 'Noted — MSDS will be attached to DR paperwork.', replied_at: ago(6) },
  ],
  dr_logs: [
    { id: 'dr-3', dr_number: 'DR-2026-0455', dr_date: agoDate(38), status: 'received', po_number: 'SO-2026-0114', supplier_name: COMPANY, client_accepted_at: ago(37), client_accepted_by: 'Maria Santos' },
    { id: 'dr-2', dr_number: 'DR-2026-0431', dr_date: agoDate(64), status: 'received', po_number: 'SO-2026-0102', supplier_name: COMPANY, client_accepted_at: ago(63), client_accepted_by: 'Maria Santos' },
    { id: 'dr-1', dr_number: 'DR-2026-0398', dr_date: agoDate(94), status: 'received', po_number: 'SO-2026-0089', supplier_name: COMPANY, client_accepted_at: ago(93), client_accepted_by: 'Maria Santos' },
    { id: 'dr-4', dr_number: 'DR-2026-0472', dr_date: agoDate(21), status: 'partial',  po_number: 'SO-2026-0127', supplier_name: COMPANY, client_accepted_at: null, client_accepted_by: null },
  ],
  dr_log_items: [
    { id: 'dri-1', dr_number: 'DR-2026-0455', item_name: 'Air Filter Element AF-25270', unit: 'pcs', quantity: 25 },
    { id: 'dri-2', dr_number: 'DR-2026-0455', item_name: 'Hydraulic Oil ISO 68 (200L drum)', unit: 'drums', quantity: 4 },
    { id: 'dri-3', dr_number: 'DR-2026-0431', item_name: 'Conveyor Roller 60mm x 600mm', unit: 'pcs', quantity: 32 },
    { id: 'dri-4', dr_number: 'DR-2026-0431', item_name: 'Roller Bracket Set', unit: 'sets', quantity: 32 },
    { id: 'dri-5', dr_number: 'DR-2026-0431', item_name: 'Anchor Bolt M12x100', unit: 'pcs', quantity: 200 },
    { id: 'dri-6', dr_number: 'DR-2026-0398', item_name: 'LED High Bay Light 150W', unit: 'pcs', quantity: 12 },
    { id: 'dri-7', dr_number: 'DR-2026-0398', item_name: 'Industrial Extension Cord 30m', unit: 'pcs', quantity: 8 },
    { id: 'dri-8', dr_number: 'DR-2026-0472', item_name: 'Welding Rod 6013 (5kg box)', unit: 'boxes', quantity: 18 },
  ],
  items: [
    ['Industrial Safety Gloves (Nitrile)', 'PPE-0012', 'pairs', 185, 'Safety & PPE', 'Heavy-duty nitrile-coated work gloves, EN388 rated'],
    ['Safety Goggles Anti-Fog', 'PPE-0034', 'pcs', 495, 'Safety & PPE', 'Anti-fog, anti-scratch polycarbonate lens'],
    ['Hard Hat with Chin Strap', 'PPE-0007', 'pcs', 385, 'Safety & PPE', 'ANSI Z89.1 Type I Class E'],
    ['Safety Harness Full Body', 'PPE-0051', 'pcs', 2890, 'Safety & PPE', 'Full body harness with dorsal D-ring'],
    ['Bearing 6205-2RS', 'BRG-6205', 'pcs', 245, 'Bearings & Power Transmission', 'Sealed deep-groove ball bearing'],
    ['Bearing 6308-ZZ', 'BRG-6308', 'pcs', 685, 'Bearings & Power Transmission', 'Shielded deep-groove ball bearing'],
    ['V-Belt B52', 'BLT-B52', 'pcs', 385, 'Bearings & Power Transmission', 'Classical V-belt, B section, 52"'],
    ['Hydraulic Hose 3/8" R2 (per meter)', 'HYD-0382', 'm', 420, 'Hydraulics & Pneumatics', 'SAE 100 R2AT two-wire braid'],
    ['Ball Valve 1" Stainless', 'VLV-1000S', 'pcs', 1850, 'Hydraulics & Pneumatics', '316 stainless, full port, 1000 WOG'],
    ['Hydraulic Oil ISO 68 (200L drum)', 'LUB-6820', 'drums', 24870, 'Lubricants & Chemicals', 'Anti-wear hydraulic oil, ISO VG 68'],
    ['Grease Lithium EP2 (1kg)', 'LUB-EP2K', 'cans', 780, 'Lubricants & Chemicals', 'Extreme-pressure lithium grease NLGI 2'],
    ['Welding Rod 6013 (5kg box)', 'WLD-6013', 'boxes', 1250, 'Welding & Fabrication', 'E6013 general purpose electrodes 3.2mm'],
    ['Cutting Disc 4" (box of 25)', 'ABR-C425', 'boxes', 1345, 'Welding & Fabrication', 'Thin cut-off wheels for metal, 4" x 1mm'],
    ['Angle Grinder 4" Industrial', 'PWR-AG40', 'pcs', 4850, 'Power Tools', '840W industrial-duty angle grinder'],
    ['LED High Bay Light 150W', 'ELE-HB150', 'pcs', 3450, 'Electrical', '150W UFO high bay, 21,000 lumens, IP65'],
    ['Conveyor Roller 60mm x 600mm', 'CNV-6060', 'pcs', 1680, 'Material Handling', 'Galvanized gravity roller with bearings'],
  ].map((r, i) => ({
    id: `item-${i + 1}`, item_name: r[0], item_code: r[1], unit_of_measure: r[2],
    selling_price: r[3], status: 'active', description: r[5],
    category: [{ category_name: r[4] }],
  })),
  csi_records: [],
}

// --- generic PostgREST-ish filtering ---
function applyFilters(rows, params) {
  let out = rows
  for (const [key, raw] of params.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key)) continue
    const values = params.getAll(key)
    for (const value of values) {
      const dot = value.indexOf('.')
      if (dot < 0) continue
      const op = value.slice(0, dot)
      const arg = value.slice(dot + 1)
      if (op === 'eq') out = out.filter(r => String(r[key]) === arg)
      else if (op === 'neq') out = out.filter(r => String(r[key]) !== arg)
      else if (op === 'in') {
        const list = arg.replace(/^\(|\)$/g, '').split(',').map(s => s.trim().replace(/^"|"$/g, ''))
        out = out.filter(r => list.includes(String(r[key])))
      }
      else if (op === 'is') out = out.filter(r => arg === 'null' ? r[key] == null : String(r[key]) === arg)
      else if (op === 'gte') out = out.filter(r => r[key] >= arg)
      else if (op === 'lte') out = out.filter(r => r[key] <= arg)
      else if (op === 'ilike') {
        const pat = arg.replace(/%/g, '').toLowerCase()
        out = out.filter(r => String(r[key] ?? '').toLowerCase().includes(pat))
      }
    }
  }
  const order = params.get('order')
  if (order) {
    const [col, ...mods] = order.split(',')[0].split('.')
    const desc = mods.includes('desc')
    out = [...out].sort((a, b) => {
      const x = a[col], y = b[col]
      if (x == null) return 1
      if (y == null) return -1
      return (x < y ? -1 : x > y ? 1 : 0) * (desc ? -1 : 1)
    })
  }
  const limit = params.get('limit')
  if (limit) out = out.slice(0, parseInt(limit, 10))
  return out
}

function send(res, status, body, headers = {}) {
  const data = body == null ? '' : JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Expose-Headers': '*',
    ...headers,
  })
  res.end(data)
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
  const path = url.pathname
  let bodyChunks = []
  req.on('data', c => bodyChunks.push(c))
  req.on('end', () => {
    let body = {}
    try { body = JSON.parse(Buffer.concat(bodyChunks).toString() || '{}') } catch {}

    if (req.method === 'OPTIONS') return send(res, 204, null)

    // ---- auth ----
    if (path === '/auth/v1/token') {
      const grant = url.searchParams.get('grant_type')
      if (grant === 'password') {
        if ((body.email || '').toLowerCase() !== EMAIL || body.password !== 'demo-portal-2026') {
          return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', error_code: 'invalid_credentials', code: 400, msg: 'Invalid login credentials' })
        }
      }
      return send(res, 200, {
        access_token: ACCESS_TOKEN, token_type: 'bearer', expires_in: 604800,
        expires_at: Math.floor(Date.now() / 1000) + 604800,
        refresh_token: 'demo-refresh-token', user: USER,
      })
    }
    if (path === '/auth/v1/user') return send(res, 200, USER)
    if (path === '/auth/v1/logout') return send(res, 204, null)
    if (path.startsWith('/auth/v1/')) return send(res, 200, {})

    // ---- rest ----
    const m = path.match(/^\/rest\/v1\/([a-zA-Z0-9_]+)$/)
    if (m) {
      const table = m[1]
      const rows = DB[table]
      if (!rows) return send(res, 404, { message: `relation "${table}" does not exist` })
      const wantSingle = (req.headers.accept || '').includes('vnd.pgrst.object')

      if (req.method === 'GET' || (req.method === 'HEAD')) {
        const out = applyFilters(rows, url.searchParams)
        if (wantSingle) {
          if (out.length === 0) return send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'Results contain 0 rows' })
          return send(res, 200, out[0])
        }
        return send(res, 200, out)
      }
      if (req.method === 'POST') {
        const inserted = (Array.isArray(body) ? body : [body]).map(r => ({
          id: `${table}-${Math.random().toString(36).slice(2, 9)}`, created_at: new Date().toISOString(), ...r,
        }))
        rows.push(...inserted)
        const ret = wantSingle ? inserted[0] : inserted
        return send(res, 201, ret)
      }
      if (req.method === 'PATCH') {
        const targets = applyFilters(rows, url.searchParams)
        targets.forEach(t => Object.assign(t, body))
        return send(res, 200, wantSingle ? targets[0] ?? null : targets)
      }
      if (req.method === 'DELETE') {
        const targets = new Set(applyFilters(rows, url.searchParams))
        DB[table] = rows.filter(r => !targets.has(r))
        return send(res, 200, [])
      }
    }
    return send(res, 404, { message: 'not found' })
  })
})

server.listen(PORT, () => console.log(`mock supabase listening on :${PORT}`))
