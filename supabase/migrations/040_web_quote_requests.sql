-- 040 — Website "Request a Quotation" / Contact form → Quotation Requests.
--
-- The website form now matches the system: First/Middle/Last name, split
-- address, and item lines (item, qty, unit, specs). Submissions land in
-- Quotation → Requests (status "pending") exactly like client-portal RFQs,
-- plus a CRM lead for follow-up.
--
-- Safe to deploy the app before running this: until it exists the website
-- falls back to saving the request as a CRM lead only (previous behaviour).

CREATE OR REPLACE FUNCTION submit_web_quote_request(p_customer jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company   text := btrim(coalesce(p_customer->>'company_name', ''));
  v_first     text := btrim(coalesce(p_customer->>'first_name', ''));
  v_middle    text := btrim(coalesce(p_customer->>'middle_name', ''));
  v_last      text := btrim(coalesce(p_customer->>'last_name', ''));
  v_email     text := lower(btrim(coalesce(p_customer->>'email', '')));
  v_phone     text := btrim(coalesce(p_customer->>'phone', ''));
  v_subject   text := left(btrim(coalesce(p_customer->>'subject', '')), 200);
  v_target    text := btrim(coalesce(p_customer->>'target_date', ''));
  v_notes     text := left(btrim(coalesce(p_customer->>'notes', '')), 2000);
  v_source    text := left(btrim(coalesce(p_customer->>'source', 'Website')), 80);
  v_addr_no   text := btrim(coalesce(p_customer->>'address_no', ''));
  v_street    text := btrim(coalesce(p_customer->>'street', ''));
  v_brgy      text := btrim(coalesce(p_customer->>'barangay', ''));
  v_muni      text := btrim(coalesce(p_customer->>'municipality', ''));
  v_city      text := btrim(coalesce(p_customer->>'city', ''));
  v_contact   text;
  v_address   text;
  v_client_id uuid;
  v_req_id    uuid;
  v_req_no    text;
  v_lines     int;
  v_summary   text;
BEGIN
  -- ── validate customer ──
  IF v_company = '' OR v_first = '' OR v_last = '' THEN
    RAISE EXCEPTION 'Company name, first name and last name are required';
  END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'A valid email address is required';
  END IF;
  IF v_phone = '' THEN
    RAISE EXCEPTION 'A contact number is required';
  END IF;

  -- ── validate items ──
  IF jsonb_typeof(p_items) <> 'array' THEN RAISE EXCEPTION 'Invalid item list'; END IF;
  v_lines := jsonb_array_length(p_items);
  IF v_lines = 0 THEN RAISE EXCEPTION 'Add at least one item'; END IF;
  IF v_lines > 100 THEN RAISE EXCEPTION 'Too many items in one request (max 100)'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) e
     WHERE btrim(coalesce(e->>'item_name', '')) = ''
        OR length(e->>'item_name') > 300
        OR NOT ((coalesce(e->>'quantity', '1')) ~ '^\d+(\.\d+)?$')
        OR coalesce(e->>'quantity', '1')::numeric <= 0
        OR coalesce(e->>'quantity', '1')::numeric > 1000000
  ) THEN
    RAISE EXCEPTION 'Every item needs a name and a quantity greater than zero';
  END IF;

  v_contact := btrim(concat_ws(' ', NULLIF(v_first, ''), NULLIF(v_middle, ''), NULLIF(v_last, '')));
  v_address := concat_ws(', ',
    NULLIF(btrim(concat_ws(' ', NULLIF(v_addr_no, ''), NULLIF(v_street, ''))), ''),
    CASE WHEN v_brgy = '' THEN NULL WHEN v_brgy ~* '^(brgy|barangay)' THEN v_brgy ELSE 'Brgy. ' || v_brgy END,
    NULLIF(v_muni, ''));

  -- ── find or create the client (matched by email) ──
  SELECT id INTO v_client_id FROM clients WHERE lower(email) = v_email ORDER BY created_at LIMIT 1;
  IF v_client_id IS NULL THEN
    INSERT INTO clients (company_name, contact_person, contact_first_name, contact_middle_name, contact_last_name,
                         email, mobile, address, address_no, street, barangay, municipality, city, status, notes)
    VALUES (v_company, v_contact, v_first, NULLIF(v_middle, ''), v_last,
            v_email, v_phone, NULLIF(v_address, ''), NULLIF(v_addr_no, ''), NULLIF(v_street, ''),
            NULLIF(v_brgy, ''), NULLIF(v_muni, ''), NULLIF(v_city, ''), 'active', 'Created from website quotation request')
    RETURNING id INTO v_client_id;
  END IF;

  SELECT string_agg(btrim(e->>'item_name'), ', ') INTO v_summary
    FROM (SELECT e FROM jsonb_array_elements(p_items) e LIMIT 3) s;
  IF v_subject = '' THEN
    v_subject := left(v_summary || CASE WHEN v_lines > 3 THEN ' +' || (v_lines - 3) || ' more' ELSE '' END, 200);
  END IF;

  v_req_no := 'RFQ-WEB-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(random()::text), 1, 4));

  INSERT INTO quotation_requests (request_number, client_id, client_name, subject, notes, status)
  VALUES (v_req_no, v_client_id, v_company, v_subject,
          concat_ws(E'\n',
            'Website request — ' || v_contact || ' · ' || v_email || ' · ' || v_phone,
            CASE WHEN v_target <> '' THEN 'Target delivery: ' || v_target END,
            CASE WHEN v_address <> '' OR v_city <> '' THEN 'Deliver to: ' || concat_ws(', ', NULLIF(v_address, ''), NULLIF(v_city, '')) END,
            NULLIF(v_notes, ''),
            'Source: ' || v_source),
          'pending')
  RETURNING id INTO v_req_id;

  INSERT INTO quotation_request_items (request_id, item_name, quantity, unit, remarks)
  SELECT v_req_id, left(btrim(e->>'item_name'), 300),
         coalesce(NULLIF(e->>'quantity', ''), '1')::numeric,
         NULLIF(left(btrim(coalesce(e->>'unit', '')), 40), ''),
         NULLIF(left(btrim(coalesce(e->>'remarks', '')), 500), '')
    FROM jsonb_array_elements(p_items) e;

  INSERT INTO crm_leads (company_name, contact_person, contact_first_name, contact_middle_name, contact_last_name,
                         contact_email, contact_phone, product_interest, notes, stage, priority, source)
  VALUES (v_company, v_contact, v_first, NULLIF(v_middle, ''), v_last, v_email, v_phone,
          left(v_summary, 200), 'Quotation Request ' || v_req_no, 'new_lead', 'medium', v_source);

  RETURN jsonb_build_object('request_number', v_req_no, 'request_id', v_req_id);
END;
$$;

REVOKE ALL ON FUNCTION submit_web_quote_request(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_web_quote_request(jsonb, jsonb) TO anon, authenticated;
