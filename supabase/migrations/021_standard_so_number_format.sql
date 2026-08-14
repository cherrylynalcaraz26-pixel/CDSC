-- A generate_so_number() trigger already produces the standard YYYY-MM-0000
-- format, but the column's old SO-00001-style DEFAULT fills so_number in
-- before that BEFORE INSERT trigger ever runs (Postgres applies column
-- defaults first), so the trigger's own NULL check always saw a non-null
-- value and never actually fired. Dropping the default lets it take over.
ALTER TABLE sales_orders ALTER COLUMN so_number DROP DEFAULT;
