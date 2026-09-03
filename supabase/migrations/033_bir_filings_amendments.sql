-- Supports the Filing Monitor grid's Amendments column: an amended return is
-- tracked as its own row against the same form+period rather than overwriting
-- the original filing.
alter table bir_filings
  add column is_amendment boolean not null default false;

alter table bir_filings
  drop constraint bir_filings_period_unique;

alter table bir_filings
  add constraint bir_filings_period_unique unique (form_type, tax_period, is_amendment);
