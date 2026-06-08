-- ============================================================
-- CDSC ERP SYSTEM — Complete Database Schema
-- PostgreSQL / Supabase
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUMS ────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM (
  'super_admin', 'admin', 'purchasing_officer', 'warehouse_manager',
  'warehouse_staff', 'accounting_staff', 'accounting_manager',
  'department_head', 'employee', 'auditor'
);

CREATE TYPE item_status AS ENUM ('active', 'inactive', 'archived');
CREATE TYPE supplier_status AS ENUM ('active', 'inactive', 'archived');
CREATE TYPE vat_classification AS ENUM ('vatable', 'vat_exempt', 'zero_rated');
CREATE TYPE pr_status AS ENUM ('draft', 'submitted', 'dept_approved', 'admin_approved', 'purchasing_approved', 'rejected', 'converted_to_po');
CREATE TYPE po_status AS ENUM ('open', 'partially_delivered', 'completed', 'cancelled');
CREATE TYPE rr_status AS ENUM ('draft', 'partial', 'completed');
CREATE TYPE transaction_type AS ENUM ('purchase', 'receiving', 'return', 'transfer', 'adjustment', 'issuance', 'disposal');
CREATE TYPE asset_status AS ENUM ('active', 'transferred', 'returned', 'disposed');
CREATE TYPE er_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'released');
CREATE TYPE return_status AS ENUM ('pending', 'approved', 'returned', 'replaced', 'credit_memo');
CREATE TYPE priority_level AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE request_type AS ENUM ('office_supplies', 'it_equipment', 'uniforms', 'consumables');
CREATE TYPE return_resolution AS ENUM ('replacement', 'credit_memo', 'pending');

-- ─── PROFILES ────────────────────────────────────────────────
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  employee_id TEXT UNIQUE,
  department TEXT,
  role user_role NOT NULL DEFAULT 'employee',
  avatar_url TEXT,
  status item_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── DEPARTMENTS ─────────────────────────────────────────────
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_code TEXT NOT NULL UNIQUE,
  department_name TEXT NOT NULL,
  head_id UUID REFERENCES profiles(id),
  status item_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── WAREHOUSES ───────────────────────────────────────────────
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_code TEXT NOT NULL UNIQUE,
  warehouse_name TEXT NOT NULL,
  address TEXT,
  manager_id UUID REFERENCES profiles(id),
  status item_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── CATEGORIES ───────────────────────────────────────────────
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_code TEXT NOT NULL UNIQUE,
  category_name TEXT NOT NULL,
  parent_id UUID REFERENCES categories(id),
  status item_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SUPPLIERS ────────────────────────────────────────────────
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_code TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  telephone TEXT,
  email TEXT NOT NULL,
  address TEXT NOT NULL,
  tin TEXT,
  vat_registered BOOLEAN NOT NULL DEFAULT FALSE,
  supplier_category TEXT NOT NULL,
  payment_terms TEXT NOT NULL DEFAULT 'COD',
  lead_time_days INTEGER NOT NULL DEFAULT 0,
  -- BIR Tax Fields
  atc_code TEXT,
  tax_type TEXT,
  ewt_rate NUMERIC(5,2) DEFAULT 0,
  final_tax_rate NUMERIC(5,2) DEFAULT 0,
  vat_classification vat_classification DEFAULT 'vatable',
  bir_registered_address TEXT,
  status supplier_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ITEMS ────────────────────────────────────────────────────
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_code TEXT NOT NULL UNIQUE,
  barcode TEXT UNIQUE,
  category_id UUID REFERENCES categories(id),
  subcategory TEXT,
  brand TEXT,
  item_name TEXT NOT NULL,
  description TEXT,
  unit_of_measure TEXT NOT NULL DEFAULT 'piece',
  cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(15,2),
  reorder_level INTEGER NOT NULL DEFAULT 0,
  minimum_stock INTEGER NOT NULL DEFAULT 0,
  maximum_stock INTEGER NOT NULL DEFAULT 0,
  warehouse_location TEXT,
  status item_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── STOCK LEVELS ────────────────────────────────────────────
CREATE TABLE stock_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity_on_hand NUMERIC(15,3) NOT NULL DEFAULT 0,
  quantity_reserved NUMERIC(15,3) NOT NULL DEFAULT 0,
  quantity_available NUMERIC(15,3) GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(item_id, warehouse_id)
);

-- ─── PURCHASE REQUESTS ────────────────────────────────────────
CREATE TABLE purchase_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pr_number TEXT NOT NULL UNIQUE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  requestor_id UUID NOT NULL REFERENCES profiles(id),
  department TEXT NOT NULL,
  priority priority_level NOT NULL DEFAULT 'normal',
  purpose TEXT NOT NULL,
  status pr_status NOT NULL DEFAULT 'draft',
  rejection_reason TEXT,
  dept_approved_by UUID REFERENCES profiles(id),
  dept_approved_at TIMESTAMPTZ,
  admin_approved_by UUID REFERENCES profiles(id),
  admin_approved_at TIMESTAMPTZ,
  purchasing_approved_by UUID REFERENCES profiles(id),
  purchasing_approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pr_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pr_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  item_name TEXT NOT NULL,
  quantity NUMERIC(15,3) NOT NULL,
  unit_of_measure TEXT NOT NULL,
  estimated_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── PURCHASE ORDERS ─────────────────────────────────────────
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number TEXT NOT NULL UNIQUE,
  pr_id UUID REFERENCES purchase_requests(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE NOT NULL,
  payment_terms TEXT NOT NULL,
  status po_status NOT NULL DEFAULT 'open',
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  ewt_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_payable NUMERIC(15,2) NOT NULL DEFAULT 0,
  remarks TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE po_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  item_name TEXT NOT NULL,
  quantity NUMERIC(15,3) NOT NULL,
  unit_of_measure TEXT NOT NULL,
  unit_cost NUMERIC(15,2) NOT NULL,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 12,
  vat_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  quantity_received NUMERIC(15,3) NOT NULL DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── RECEIVING REPORTS ───────────────────────────────────────
CREATE TABLE receiving_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rr_number TEXT NOT NULL UNIQUE,
  po_id UUID NOT NULL REFERENCES purchase_orders(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  received_by UUID NOT NULL REFERENCES profiles(id),
  warehouse_id UUID REFERENCES warehouses(id),
  status rr_status NOT NULL DEFAULT 'draft',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rr_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rr_id UUID NOT NULL REFERENCES receiving_reports(id) ON DELETE CASCADE,
  po_item_id UUID REFERENCES po_items(id),
  item_id UUID REFERENCES items(id),
  item_name TEXT NOT NULL,
  quantity_ordered NUMERIC(15,3) NOT NULL,
  quantity_received NUMERIC(15,3) NOT NULL,
  quantity_rejected NUMERIC(15,3) NOT NULL DEFAULT 0,
  rejection_reason TEXT,
  unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── INVENTORY TRANSACTIONS ──────────────────────────────────
CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_type transaction_type NOT NULL,
  reference_number TEXT NOT NULL,
  reference_id UUID,
  item_id UUID NOT NULL REFERENCES items(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  quantity NUMERIC(15,3) NOT NULL,
  unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  running_balance NUMERIC(15,3) NOT NULL DEFAULT 0,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  remarks TEXT
);

-- ─── STOCK TRANSFERS ─────────────────────────────────────────
CREATE TABLE stock_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_number TEXT NOT NULL UNIQUE,
  from_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  to_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  remarks TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  quantity NUMERIC(15,3) NOT NULL,
  unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0
);

-- ─── STOCK ADJUSTMENTS ───────────────────────────────────────
CREATE TABLE stock_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  adjustment_number TEXT NOT NULL UNIQUE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES profiles(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE stock_adjustment_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  adjustment_id UUID NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  quantity_before NUMERIC(15,3) NOT NULL,
  quantity_after NUMERIC(15,3) NOT NULL,
  variance NUMERIC(15,3) GENERATED ALWAYS AS (quantity_after - quantity_before) STORED,
  unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0
);

-- ─── SUPPLIER RETURNS ────────────────────────────────────────
CREATE TABLE supplier_returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_number TEXT NOT NULL UNIQUE,
  rr_id UUID REFERENCES receiving_reports(id),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL,
  status return_status NOT NULL DEFAULT 'pending',
  resolution return_resolution NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE return_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id UUID NOT NULL REFERENCES supplier_returns(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  item_name TEXT NOT NULL,
  quantity NUMERIC(15,3) NOT NULL,
  unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0
);

-- ─── ASSETS ──────────────────────────────────────────────────
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_number TEXT NOT NULL UNIQUE,
  asset_category TEXT NOT NULL,
  item_id UUID REFERENCES items(id),
  item_name TEXT NOT NULL,
  serial_number TEXT,
  purchase_date DATE,
  purchase_cost NUMERIC(15,2) DEFAULT 0,
  useful_life_years INTEGER DEFAULT 5,
  assigned_to UUID REFERENCES profiles(id),
  department TEXT,
  date_issued DATE,
  date_returned DATE,
  status asset_status NOT NULL DEFAULT 'active',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE asset_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  from_employee UUID REFERENCES profiles(id),
  to_employee UUID REFERENCES profiles(id),
  from_department TEXT,
  to_department TEXT,
  action_date DATE NOT NULL DEFAULT CURRENT_DATE,
  remarks TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── EMPLOYEE REQUESTS ───────────────────────────────────────
CREATE TABLE employee_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  er_number TEXT NOT NULL UNIQUE,
  requestor_id UUID NOT NULL REFERENCES profiles(id),
  department TEXT NOT NULL,
  request_type request_type NOT NULL,
  purpose TEXT NOT NULL,
  status er_status NOT NULL DEFAULT 'draft',
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  released_by UUID REFERENCES profiles(id),
  released_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE er_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  er_id UUID NOT NULL REFERENCES employee_requests(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  item_name TEXT NOT NULL,
  quantity NUMERIC(15,3) NOT NULL,
  unit_of_measure TEXT NOT NULL,
  remarks TEXT
);

-- ─── BIR / TAX RECORDS ───────────────────────────────────────
CREATE TABLE tax_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_type TEXT NOT NULL,
  reference_id UUID NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  tin TEXT,
  atc_code TEXT,
  tax_period DATE NOT NULL,
  gross_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  vat_exclusive_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  input_vat NUMERIC(15,2) NOT NULL DEFAULT 0,
  output_vat NUMERIC(15,2) NOT NULL DEFAULT 0,
  ewt_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  final_tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_payable NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bir_filings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_type TEXT NOT NULL,
  tax_period TEXT NOT NULL,
  filing_date DATE,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  amount_due NUMERIC(15,2) DEFAULT 0,
  amount_paid NUMERIC(15,2) DEFAULT 0,
  confirmation_number TEXT,
  filed_by UUID REFERENCES profiles(id),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── AUDIT LOG ───────────────────────────────────────────────
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SEQUENCES FOR DOCUMENT NUMBERS ─────────────────────────
CREATE SEQUENCE pr_seq START 1;
CREATE SEQUENCE po_seq START 1;
CREATE SEQUENCE rr_seq START 1;
CREATE SEQUENCE er_seq START 1;
CREATE SEQUENCE return_seq START 1;
CREATE SEQUENCE asset_seq START 1;
CREATE SEQUENCE transfer_seq START 1;
CREATE SEQUENCE adjustment_seq START 1;

-- ─── AUTO-NUMBER FUNCTIONS ────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_pr_number() RETURNS TEXT AS $$
BEGIN
  RETURN 'PR-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('pr_seq')::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_po_number() RETURNS TEXT AS $$
BEGIN
  RETURN 'PO-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('po_seq')::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_rr_number() RETURNS TEXT AS $$
BEGIN
  RETURN 'RR-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('rr_seq')::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_er_number() RETURNS TEXT AS $$
BEGIN
  RETURN 'ER-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('er_seq')::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ─── TRIGGER: AUTO-GENERATE DOCUMENT NUMBERS ─────────────────
CREATE OR REPLACE FUNCTION set_document_number() RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'purchase_requests' AND (NEW.pr_number IS NULL OR NEW.pr_number = '') THEN
    NEW.pr_number := generate_pr_number();
  ELSIF TG_TABLE_NAME = 'purchase_orders' AND (NEW.po_number IS NULL OR NEW.po_number = '') THEN
    NEW.po_number := generate_po_number();
  ELSIF TG_TABLE_NAME = 'receiving_reports' AND (NEW.rr_number IS NULL OR NEW.rr_number = '') THEN
    NEW.rr_number := generate_rr_number();
  ELSIF TG_TABLE_NAME = 'employee_requests' AND (NEW.er_number IS NULL OR NEW.er_number = '') THEN
    NEW.er_number := generate_er_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pr_number BEFORE INSERT ON purchase_requests
  FOR EACH ROW EXECUTE FUNCTION set_document_number();
CREATE TRIGGER trg_po_number BEFORE INSERT ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION set_document_number();
CREATE TRIGGER trg_rr_number BEFORE INSERT ON receiving_reports
  FOR EACH ROW EXECUTE FUNCTION set_document_number();
CREATE TRIGGER trg_er_number BEFORE INSERT ON employee_requests
  FOR EACH ROW EXECUTE FUNCTION set_document_number();

-- ─── TRIGGER: UPDATE STOCK LEVELS ON RECEIVING ───────────────
CREATE OR REPLACE FUNCTION update_stock_on_receive() RETURNS TRIGGER AS $$
DECLARE
  v_warehouse_id UUID;
BEGIN
  SELECT warehouse_id INTO v_warehouse_id FROM receiving_reports WHERE id = NEW.rr_id;

  IF NEW.quantity_received > 0 THEN
    INSERT INTO stock_levels (item_id, warehouse_id, quantity_on_hand)
    VALUES (NEW.item_id, v_warehouse_id, NEW.quantity_received)
    ON CONFLICT (item_id, warehouse_id)
    DO UPDATE SET
      quantity_on_hand = stock_levels.quantity_on_hand + NEW.quantity_received,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_on_receive AFTER INSERT ON rr_items
  FOR EACH ROW EXECUTE FUNCTION update_stock_on_receive();

-- ─── TRIGGER: UPDATE TIMESTAMPS ──────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_items_updated BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_po_updated BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_pr_updated BEFORE UPDATE ON purchase_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_rr_updated BEFORE UPDATE ON receiving_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_assets_updated BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_er_updated BEFORE UPDATE ON employee_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── TRIGGER: NEW USER → CREATE PROFILE ──────────────────────
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'employee'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── INDEXES ─────────────────────────────────────────────────
CREATE INDEX idx_items_category ON items(category_id);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_stock_levels_item ON stock_levels(item_id);
CREATE INDEX idx_stock_levels_warehouse ON stock_levels(warehouse_id);
CREATE INDEX idx_pr_requestor ON purchase_requests(requestor_id);
CREATE INDEX idx_pr_status ON purchase_requests(status);
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_po_status ON purchase_orders(status);
CREATE INDEX idx_rr_po ON receiving_reports(po_id);
CREATE INDEX idx_inv_trans_item ON inventory_transactions(item_id);
CREATE INDEX idx_inv_trans_date ON inventory_transactions(transaction_date);
CREATE INDEX idx_assets_assigned ON assets(assigned_to);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX idx_tax_transactions_period ON tax_transactions(tax_period);
CREATE INDEX idx_bir_filings_period ON bir_filings(tax_period);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE pr_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE receiving_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE rr_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE er_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bir_filings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION get_my_role() RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ─── RLS POLICIES ────────────────────────────────────────────

-- PROFILES
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_select_admin" ON profiles FOR SELECT USING (get_my_role() IN ('super_admin', 'admin'));
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_admin_all" ON profiles FOR ALL USING (get_my_role() = 'super_admin') WITH CHECK (get_my_role() = 'super_admin');

-- SUPPLIERS — purchasing + admin + accounting can manage
CREATE POLICY "suppliers_read_all" ON suppliers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "suppliers_write" ON suppliers FOR INSERT WITH CHECK (get_my_role() IN ('super_admin', 'admin', 'purchasing_officer'));
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE USING (get_my_role() IN ('super_admin', 'admin', 'purchasing_officer'));
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE USING (get_my_role() = 'super_admin');

-- ITEMS — all authenticated can read
CREATE POLICY "items_read_all" ON items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "items_write" ON items FOR INSERT WITH CHECK (get_my_role() IN ('super_admin', 'admin', 'warehouse_manager'));
CREATE POLICY "items_update" ON items FOR UPDATE USING (get_my_role() IN ('super_admin', 'admin', 'warehouse_manager'));
CREATE POLICY "items_delete" ON items FOR DELETE USING (get_my_role() = 'super_admin');

-- PURCHASE REQUESTS — employees can see their own; managers see all
CREATE POLICY "pr_own" ON purchase_requests FOR SELECT USING (requestor_id = auth.uid() OR get_my_role() IN ('super_admin', 'admin', 'purchasing_officer', 'department_head', 'accounting_manager', 'auditor'));
CREATE POLICY "pr_insert" ON purchase_requests FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "pr_update" ON purchase_requests FOR UPDATE USING (requestor_id = auth.uid() OR get_my_role() IN ('super_admin', 'admin', 'purchasing_officer', 'department_head'));

-- PURCHASE ORDERS
CREATE POLICY "po_read" ON purchase_orders FOR SELECT USING (get_my_role() IN ('super_admin', 'admin', 'purchasing_officer', 'warehouse_manager', 'accounting_staff', 'accounting_manager', 'auditor') OR created_by = auth.uid());
CREATE POLICY "po_write" ON purchase_orders FOR INSERT WITH CHECK (get_my_role() IN ('super_admin', 'admin', 'purchasing_officer'));
CREATE POLICY "po_update" ON purchase_orders FOR UPDATE USING (get_my_role() IN ('super_admin', 'admin', 'purchasing_officer'));

-- RECEIVING REPORTS
CREATE POLICY "rr_read" ON receiving_reports FOR SELECT USING (get_my_role() IN ('super_admin', 'admin', 'purchasing_officer', 'warehouse_manager', 'warehouse_staff', 'accounting_staff', 'accounting_manager', 'auditor'));
CREATE POLICY "rr_write" ON receiving_reports FOR INSERT WITH CHECK (get_my_role() IN ('super_admin', 'admin', 'warehouse_manager', 'warehouse_staff'));
CREATE POLICY "rr_update" ON receiving_reports FOR UPDATE USING (get_my_role() IN ('super_admin', 'admin', 'warehouse_manager', 'warehouse_staff'));

-- INVENTORY TRANSACTIONS — read by warehouse and accounting
CREATE POLICY "inv_trans_read" ON inventory_transactions FOR SELECT USING (get_my_role() IN ('super_admin', 'admin', 'warehouse_manager', 'warehouse_staff', 'accounting_staff', 'accounting_manager', 'auditor'));
CREATE POLICY "inv_trans_write" ON inventory_transactions FOR INSERT WITH CHECK (get_my_role() IN ('super_admin', 'admin', 'warehouse_manager', 'warehouse_staff'));

-- ASSETS
CREATE POLICY "assets_read" ON assets FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "assets_write" ON assets FOR INSERT WITH CHECK (get_my_role() IN ('super_admin', 'admin', 'warehouse_manager'));
CREATE POLICY "assets_update" ON assets FOR UPDATE USING (get_my_role() IN ('super_admin', 'admin', 'warehouse_manager'));

-- EMPLOYEE REQUESTS
CREATE POLICY "er_own" ON employee_requests FOR SELECT USING (requestor_id = auth.uid() OR get_my_role() IN ('super_admin', 'admin', 'warehouse_manager', 'warehouse_staff', 'department_head'));
CREATE POLICY "er_insert" ON employee_requests FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "er_update" ON employee_requests FOR UPDATE USING (requestor_id = auth.uid() OR get_my_role() IN ('super_admin', 'admin', 'warehouse_manager', 'department_head'));

-- TAX / BIR — accounting only
CREATE POLICY "tax_read" ON tax_transactions FOR SELECT USING (get_my_role() IN ('super_admin', 'admin', 'accounting_staff', 'accounting_manager', 'auditor'));
CREATE POLICY "tax_write" ON tax_transactions FOR INSERT WITH CHECK (get_my_role() IN ('super_admin', 'accounting_staff', 'accounting_manager'));
CREATE POLICY "bir_read" ON bir_filings FOR SELECT USING (get_my_role() IN ('super_admin', 'admin', 'accounting_staff', 'accounting_manager', 'auditor'));
CREATE POLICY "bir_write" ON bir_filings FOR ALL USING (get_my_role() IN ('super_admin', 'accounting_manager')) WITH CHECK (get_my_role() IN ('super_admin', 'accounting_manager'));

-- AUDIT LOGS — read only for admins/auditors
CREATE POLICY "audit_read" ON audit_logs FOR SELECT USING (get_my_role() IN ('super_admin', 'admin', 'auditor'));
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ─── SEED DATA ────────────────────────────────────────────────
INSERT INTO warehouses (warehouse_code, warehouse_name, address) VALUES
  ('WH-MAIN', 'Main Warehouse', 'Head Office'),
  ('WH-IT', 'IT Storage Room', 'IT Department'),
  ('WH-SUPPLY', 'Office Supply Room', 'Admin Department');

INSERT INTO categories (category_code, category_name) VALUES
  ('OFF-SUP', 'Office Supplies'),
  ('IT-EQP', 'IT Equipment'),
  ('UNIFORM', 'Uniforms'),
  ('CONSUM', 'Consumables'),
  ('FIXED-ASSET', 'Fixed Assets'),
  ('FURNITURE', 'Furniture & Fixtures');

INSERT INTO departments (department_code, department_name) VALUES
  ('ADMIN', 'Administration'),
  ('IT', 'Information Technology'),
  ('FIN', 'Finance & Accounting'),
  ('OPS', 'Operations'),
  ('HR', 'Human Resources'),
  ('PURCH', 'Purchasing');
