ALTER TABLE dr_logs DROP CONSTRAINT dr_logs_status_check;
ALTER TABLE dr_logs ADD CONSTRAINT dr_logs_status_check CHECK (status = ANY (ARRAY['received'::text, 'partial'::text, 'rejected'::text, 'returned'::text, 'cancelled'::text]));
