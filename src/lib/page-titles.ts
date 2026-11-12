// Title + description shown in the top header bar for every system page
// (the pages themselves no longer repeat their title in the body).

export interface PageTitle { title: string; subtitle: string }

const PAGES: Record<string, PageTitle> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Last 12 months at a glance' },
  '/crm': { title: 'CRM & Leads Pipeline', subtitle: 'Track inquiries, leads and the sales pipeline' },
  '/purchase-orders': { title: 'Purchase Orders', subtitle: 'Supplier purchase orders, deliveries and payments' },
  '/purchase-requests': { title: 'Purchase Requests', subtitle: 'Create and track purchase requests through approval' },
  '/quotation': { title: 'Quotation', subtitle: 'Create and manage client quotations and requests' },
  '/sales-orders': { title: 'Sales Orders', subtitle: 'Create and manage client sales orders' },
  '/sales-deliveries': { title: 'Sales Deliveries', subtitle: 'Deliveries made to clients' },
  '/receiving': { title: 'Receiving', subtitle: 'Incoming deliveries, stock and returns' },
  '/inventory': { title: 'Inventory', subtitle: 'Stock balance per client — DR delivered + WH stock − CSI charged' },
  '/dr-logs': { title: 'DR Logs', subtitle: 'Delivery Receipt log — every incoming supplier DR' },
  '/csi-monitoring': { title: 'CSI Monitoring', subtitle: 'Charge Sales Invoice records' },
  '/pull-outs': { title: 'Pull Outs', subtitle: 'Items CDSC needs to pick up from clients and suppliers' },
  '/returns': { title: 'Returns to Supplier', subtitle: 'Items returned to suppliers' },
  '/warehouse': { title: 'Warehouse Management', subtitle: 'Multi-warehouse inventory, transfers and adjustments' },
  '/warehouse/adjustment': { title: 'Stock Adjustment', subtitle: 'Adjust quantities to match the physical count' },
  '/warehouse/transfer': { title: 'Stock Transfer', subtitle: 'Move inventory between warehouses' },
  '/accounting/collections': { title: 'Collections (OR/CR)', subtitle: 'Official Receipts and Collection Receipts' },
  '/accounting/bookkeeping': { title: 'Bookkeeping', subtitle: 'Journals, ledger and financial statements' },
  '/accounting': { title: 'Accounting', subtitle: 'Financial management and BIR compliance' },
  '/bir': { title: 'BIR Compliance', subtitle: 'Deadlines, filings, VAT, income tax and withholding' },
  '/assets': { title: 'Asset Accountability', subtitle: 'Fixed assets, assignments, transfers and disposals' },
  '/client-requests': { title: 'Client Requests', subtitle: 'Purchase requests submitted by clients via the portal' },
  '/clients': { title: 'Clients', subtitle: 'Client accounts and contacts' },
  '/employee-requests': { title: 'My Requests', subtitle: 'Office supplies, IT equipment, uniforms and consumables' },
  '/items/categories': { title: 'Categories', subtitle: 'Item categories' },
  '/messages': { title: 'Messages', subtitle: 'Conversations with clients and suppliers' },
  '/reports': { title: 'Reports Center', subtitle: 'Generate and export system reports' },
  '/settings': { title: 'Settings', subtitle: 'Company profile, master data and preferences' },
  '/users': { title: 'User Management', subtitle: 'Staff logins, portal accounts and the audit trail' },
}

// Accounting is one route with ?tab= / &sub= sections.
const ACCOUNTING: Record<string, PageTitle> = {
  overview: { title: 'Accounting Overview', subtitle: 'Cash position, receivables, payables and this period at a glance' },
  collections: { title: 'Collections (OR)', subtitle: 'Payments received from clients — Official Receipts' },
  bir: { title: 'BIR Compliance', subtitle: 'Deadlines, filings, VAT, income tax and withholding' },
  crj: { title: 'Sales Journal', subtitle: 'Sales billed (CSI) and cash received (OR), journalized' },
  cdj: { title: 'Cash Disbursements', subtitle: 'Payments to suppliers and expenses, with EWT' },
  gj: { title: 'General Journal', subtitle: 'Adjusting and other manual journal entries' },
  gl: { title: 'General Ledger', subtitle: 'Every posted entry, account by account' },
  tb: { title: 'Trial Balance', subtitle: 'Debits equal credits — balances per account' },
  coa: { title: 'Chart of Accounts', subtitle: 'Account codes, types and normal balances' },
  is: { title: 'Income Statement', subtitle: 'Revenue, cost of sales and expenses for the period' },
  bs: { title: 'Balance Sheet', subtitle: 'Assets, liabilities and equity as of the end date' },
  cf: { title: 'Cash Flow Statement', subtitle: 'Cash in and out by operating, investing and financing' },
}

const SETTINGS_TABS: Record<string, string> = {
  suppliers: 'Suppliers', items: 'Item List', categories: 'Categories', uom: 'Units of Measure',
  brands: 'Brands', attributes: 'Attributes', payees: 'Payees', deck: 'Company Profile Deck',
}

export function getPageTitle(pathname: string, search: URLSearchParams): PageTitle | null {
  if (pathname === '/accounting') {
    const tab = search.get('tab') ?? 'overview'
    const key = tab === 'bookkeeping' ? (search.get('sub') ?? 'crj') : tab
    return ACCOUNTING[key] ?? PAGES['/accounting']
  }
  if (pathname === '/settings') {
    const t = SETTINGS_TABS[search.get('tab') ?? '']
    if (t) return { title: t, subtitle: t === 'Company Profile Deck' ? 'Slides and PDF to present CDSC to clients' : 'Settings → Master Data' }
  }
  // Longest matching route wins (/warehouse/transfer before /warehouse).
  const hit = Object.keys(PAGES)
    .filter(p => pathname === p || pathname.startsWith(p + '/'))
    .sort((a, b) => b.length - a.length)[0]
  return hit ? PAGES[hit] : null
}
