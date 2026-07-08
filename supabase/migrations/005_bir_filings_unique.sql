alter table bir_filings
  add constraint bir_filings_period_unique unique (form_type, tax_period);
