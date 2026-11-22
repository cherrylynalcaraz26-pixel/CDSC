-- payees had row level security switched on with no policy, so every read and
-- write from the app was refused. Cash Disbursements saved, then its "remember
-- this payee" insert failed and the save indicator showed "Something went
-- wrong", and the payee dropdown came back empty. Same rule as disbursements.
ALTER TABLE payees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_all_payees ON payees;
CREATE POLICY authenticated_all_payees ON payees FOR ALL TO authenticated USING (true) WITH CHECK (true);
