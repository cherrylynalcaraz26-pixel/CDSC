// ============================================================
// CDSC ERP SYSTEM — Core Type Definitions
// ============================================================

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'purchasing_officer'
  | 'warehouse_manager'
  | 'warehouse_staff'
  | 'accounting_staff'
  | 'accounting_manager'
  | 'department_head'
  | 'employee'
  | 'auditor'
  | 'client'
  | 'vendor'

export type Status = 'active' | 'inactive' | 'archived'

// ─── SUPPLIER ────────────────────────────────────────────────
export interface Supplier {
  id: string
  supplier_code: string
  company_name: string
  contact_person: string
  mobile_number: string
  telephone?: string
  email: string
  address: string
  tin: string
  vat_registered: boolean
  supplier_category: string
  payment_terms: string
  lead_time_days: number
  atc_code?: string
  tax_type?: string
  ewt_rate?: number
  final_tax_rate?: number
  vat_classification?: 'vatable' | 'vat_exempt' | 'zero_rated'
  bir_registered_address?: string
  status: Status
  created_at: string
  updated_at: string
}

// ─── ITEM ─────────────────────────────────────────────────────
export interface Item {
  id: string
  item_code: string
  barcode?: string
  category: string
  subcategory?: string
  brand?: string
  item_name: string
  description?: string
  unit_of_measure: string
  cost: number
  selling_price?: number
  reorder_level: number
  minimum_stock: number
  maximum_stock: number
  warehouse_location?: string
  status: Status
  created_at: string
  updated_at: string
}

export interface StockLevel {
  item_id: string
  warehouse_id: string
  quantity_on_hand: number
  quantity_reserved: number
  quantity_available: number
}

// ─── WAREHOUSE ────────────────────────────────────────────────
export interface Warehouse {
  id: string
  warehouse_code: string
  warehouse_name: string
  address?: string
  manager_id?: string
  status: Status
  created_at: string
}

// ─── PURCHASE REQUEST ─────────────────────────────────────────
export type PRStatus = 'draft' | 'submitted' | 'dept_approved' | 'admin_approved' | 'purchasing_approved' | 'rejected' | 'converted_to_po'

export interface PurchaseRequest {
  id: string
  pr_number: string
  date: string
  requestor_id: string
  department: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  purpose: string
  status: PRStatus
  rejection_reason?: string
  approved_by?: string
  approved_at?: string
  created_at: string
  updated_at: string
  items?: PRItem[]
}

export interface PRItem {
  id: string
  pr_id: string
  item_id: string
  item_name: string
  quantity: number
  unit_of_measure: string
  estimated_cost: number
  remarks?: string
}

// ─── PURCHASE ORDER ───────────────────────────────────────────
export type POStatus = 'open' | 'partially_delivered' | 'completed' | 'cancelled'

export interface PurchaseOrder {
  id: string
  po_number: string
  pr_id?: string
  supplier_id: string
  po_date: string
  delivery_date: string
  payment_terms: string
  status: POStatus
  subtotal: number
  vat_amount: number
  total_amount: number
  remarks?: string
  created_by: string
  created_at: string
  updated_at: string
  items?: POItem[]
  supplier?: Supplier
}

export interface POItem {
  id: string
  po_id: string
  item_id: string
  item_name: string
  quantity: number
  unit_of_measure: string
  unit_cost: number
  vat_rate: number
  vat_amount: number
  total_cost: number
  quantity_received: number
  remarks?: string
}

// ─── RECEIVING REPORT ─────────────────────────────────────────
export type RRStatus = 'draft' | 'completed' | 'partial'

export interface ReceivingReport {
  id: string
  rr_number: string
  po_id: string
  supplier_id: string
  delivery_date: string
  received_by: string
  status: RRStatus
  remarks?: string
  created_at: string
  updated_at: string
  items?: RRItem[]
}

export interface RRItem {
  id: string
  rr_id: string
  po_item_id: string
  item_id: string
  item_name: string
  quantity_ordered: number
  quantity_received: number
  quantity_rejected: number
  rejection_reason?: string
}

// ─── INVENTORY TRANSACTION ────────────────────────────────────
export type TransactionType = 'purchase' | 'receiving' | 'return' | 'transfer' | 'adjustment' | 'issuance' | 'disposal'

export interface InventoryTransaction {
  id: string
  transaction_type: TransactionType
  reference_number: string
  item_id: string
  warehouse_id: string
  quantity: number
  unit_cost: number
  total_cost: number
  balance: number
  transaction_date: string
  created_by: string
  created_at: string
  remarks?: string
}

// ─── ASSET ────────────────────────────────────────────────────
export type AssetStatus = 'active' | 'transferred' | 'returned' | 'disposed'

export interface Asset {
  id: string
  asset_number: string
  asset_category: string
  item_id: string
  item_name: string
  serial_number?: string
  assigned_to?: string
  department?: string
  date_issued?: string
  status: AssetStatus
  remarks?: string
  created_at: string
  updated_at: string
}

// ─── EMPLOYEE REQUEST ─────────────────────────────────────────
export type ERStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'released'

export interface EmployeeRequest {
  id: string
  er_number: string
  requestor_id: string
  department: string
  request_type: 'office_supplies' | 'it_equipment' | 'uniforms' | 'consumables'
  purpose: string
  status: ERStatus
  created_at: string
  updated_at: string
  items?: ERItem[]
}

export interface ERItem {
  id: string
  er_id: string
  item_id: string
  item_name: string
  quantity: number
  unit_of_measure: string
  remarks?: string
}

// ─── USER / PROFILE ───────────────────────────────────────────
export interface Profile {
  id: string
  email: string
  full_name: string
  employee_id?: string
  department?: string
  role: UserRole
  avatar_url?: string
  status: Status
  created_at: string
}

// ─── RETURN ───────────────────────────────────────────────────
export type ReturnStatus = 'pending' | 'approved' | 'returned' | 'replaced' | 'credit_memo'

export interface SupplierReturn {
  id: string
  return_number: string
  rr_id: string
  supplier_id: string
  return_date: string
  reason: string
  status: ReturnStatus
  resolution: 'replacement' | 'credit_memo' | 'pending'
  created_by: string
  created_at: string
  items?: ReturnItem[]
}

export interface ReturnItem {
  id: string
  return_id: string
  item_id: string
  item_name: string
  quantity: number
  unit_cost: number
}

// ─── DASHBOARD KPIs ───────────────────────────────────────────
export interface DashboardKPIs {
  total_inventory_value: number
  total_stock_on_hand: number
  low_stock_items: number
  critical_stock_items: number
  out_of_stock_items: number
  pending_purchase_requests: number
  pending_purchase_orders: number
  pending_receiving_reports: number
  pending_returns: number
  pending_approvals: number
  monthly_purchases: number
  active_suppliers: number
  total_assets: number
}
