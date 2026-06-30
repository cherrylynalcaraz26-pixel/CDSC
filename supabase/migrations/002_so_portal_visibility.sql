alter table sales_orders
  add column if not exists show_in_portal boolean not null default false;
