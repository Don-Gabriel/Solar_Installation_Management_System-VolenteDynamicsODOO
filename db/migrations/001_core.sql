CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, email text NOT NULL,
 password_hash text NOT NULL, role text NOT NULL CHECK(role IN ('admin','sales','surveyor','warehouse','technician','support','accounts')),
 hourly_rate_minor bigint NOT NULL DEFAULT 35000 CHECK(hourly_rate_minor BETWEEN 0 AND 10000000), active boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX users_email_unique ON users(lower(email));
CREATE TABLE sessions (token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), csrf_token text NOT NULL, expires_at timestamptz NOT NULL);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, phone text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX customers_phone ON customers(phone);
CREATE TABLE sites (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES customers(id), address text NOT NULL);
CREATE INDEX sites_customer ON sites(customer_id);
CREATE TABLE projects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), number bigint GENERATED ALWAYS AS IDENTITY UNIQUE, site_id uuid NOT NULL REFERENCES sites(id),
 capacity_kw integer NOT NULL CHECK(capacity_kw BETWEEN 1 AND 5), system_type text NOT NULL CHECK(system_type IN ('on_grid','off_grid','panel_set')),
 stage text NOT NULL DEFAULT 'enquiry' CHECK(stage IN ('enquiry','survey','quoted','confirmed','dispatched','delivered','completed')),
 source text NOT NULL, notes text NOT NULL DEFAULT '', owner_id uuid REFERENCES users(id), follow_up date,
 subsidy_interest boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projects_site ON projects(site_id); CREATE INDEX projects_owner ON projects(owner_id); CREATE INDEX projects_stage ON projects(stage,created_at DESC);
CREATE TABLE surveys (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id), roof_area numeric(10,2) NOT NULL CHECK(roof_area>0),
 bill_minor bigint NOT NULL CHECK(bill_minor BETWEEN 0 AND 100000000), grid_suitable boolean NOT NULL, direction text NOT NULL,
 tilt numeric(5,2) NOT NULL CHECK(tilt BETWEEN 0 AND 90), cable_distance numeric(10,2) NOT NULL CHECK(cable_distance>=0),
 notes text NOT NULL DEFAULT '', status text NOT NULL CHECK(status IN ('pending','approved','rejected')), surveyed_by uuid NOT NULL REFERENCES users(id),
 approved_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), CHECK(status<>'approved' OR approved_by IS NOT NULL)
);
CREATE INDEX surveys_project ON surveys(project_id,created_at DESC);
CREATE TABLE products (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sku text NOT NULL UNIQUE, name text NOT NULL, unit text NOT NULL DEFAULT 'unit',
 kind text NOT NULL CHECK(kind IN ('serialized','quantity','service')), price_minor bigint NOT NULL CHECK(price_minor BETWEEN 0 AND 1000000000),
 warranty_months integer NOT NULL DEFAULT 0 CHECK(warranty_months BETWEEN 0 AND 360),
 stock_qty integer NOT NULL DEFAULT 0 CHECK(stock_qty>=0), reserved_qty integer NOT NULL DEFAULT 0 CHECK(reserved_qty>=0 AND reserved_qty<=stock_qty),
 stock_value_minor bigint NOT NULL DEFAULT 0 CHECK(stock_value_minor>=0)
);
CREATE TABLE packages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), system_type text NOT NULL, capacity_kw integer NOT NULL, version integer NOT NULL DEFAULT 1, UNIQUE(system_type,capacity_kw,version));
CREATE TABLE package_lines (package_id uuid NOT NULL REFERENCES packages(id), product_id uuid NOT NULL REFERENCES products(id), quantity integer NOT NULL CHECK(quantity>0), PRIMARY KEY(package_id,product_id));
CREATE INDEX package_lines_product ON package_lines(product_id);
CREATE TABLE quotes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id), package_id uuid NOT NULL REFERENCES packages(id), survey_id uuid NOT NULL REFERENCES surveys(id), version integer NOT NULL, total_minor bigint NOT NULL CHECK(total_minor>=0), status text NOT NULL DEFAULT 'issued' CHECK(status IN ('issued','accepted')), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id,version));
CREATE INDEX quotes_package ON quotes(package_id); CREATE INDEX quotes_survey ON quotes(survey_id);
CREATE TABLE quote_lines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quote_id uuid NOT NULL REFERENCES quotes(id), product_id uuid NOT NULL REFERENCES products(id), description text NOT NULL, kind text NOT NULL, quantity integer NOT NULL CHECK(quantity>0), unit_price_minor bigint NOT NULL CHECK(unit_price_minor>=0), warranty_months integer NOT NULL);
CREATE INDEX quote_lines_quote ON quote_lines(quote_id); CREATE INDEX quote_lines_product ON quote_lines(product_id);
CREATE TABLE orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL UNIQUE REFERENCES projects(id), quote_id uuid NOT NULL UNIQUE REFERENCES quotes(id), total_minor bigint NOT NULL CHECK(total_minor>=0), minimum_advance_minor bigint NOT NULL CHECK(minimum_advance_minor>=0), status text NOT NULL DEFAULT 'packing' CHECK(status IN ('packing','dispatched','delivered')), confirmed_at timestamptz NOT NULL DEFAULT now(), dispatched_at timestamptz, delivered_at timestamptz);
CREATE TABLE order_lines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id), quote_line_id uuid NOT NULL UNIQUE REFERENCES quote_lines(id), product_id uuid NOT NULL REFERENCES products(id), description text NOT NULL, kind text NOT NULL, quantity integer NOT NULL CHECK(quantity>0), unit_price_minor bigint NOT NULL CHECK(unit_price_minor>=0), warranty_months integer NOT NULL, reserved boolean NOT NULL DEFAULT false, material_cost_minor bigint NOT NULL DEFAULT 0 CHECK(material_cost_minor>=0), UNIQUE(order_id,product_id));
CREATE INDEX order_lines_product ON order_lines(product_id);
CREATE TABLE receipts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id), supplier text NOT NULL, reference text NOT NULL, quantity integer NOT NULL CHECK(quantity>0), unit_cost_minor bigint NOT NULL CHECK(unit_cost_minor>=0), created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX receipts_product ON receipts(product_id);
CREATE TABLE assets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id), receipt_id uuid NOT NULL REFERENCES receipts(id), serial text NOT NULL UNIQUE CHECK(length(serial) BETWEEN 2 AND 100), cost_minor bigint NOT NULL CHECK(cost_minor>=0), order_line_id uuid REFERENCES order_lines(id), status text NOT NULL DEFAULT 'available' CHECK(status IN ('available','allocated','dispatched','delivered','replaced')), CHECK((status='available')=(order_line_id IS NULL)));
CREATE INDEX assets_product ON assets(product_id); CREATE INDEX assets_receipt ON assets(receipt_id); CREATE INDEX assets_line ON assets(order_line_id);
CREATE TABLE stock_movements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id), order_id uuid REFERENCES orders(id), receipt_id uuid REFERENCES receipts(id), quantity integer NOT NULL CHECK(quantity<>0), value_minor bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX stock_movements_product ON stock_movements(product_id); CREATE INDEX stock_movements_order ON stock_movements(order_id);
CREATE TABLE warranties (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_line_id uuid NOT NULL REFERENCES order_lines(id), asset_id uuid UNIQUE REFERENCES assets(id), quantity integer NOT NULL CHECK(quantity>0), starts_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, policy_months integer NOT NULL CHECK(policy_months>0), CHECK(expires_at>starts_at));
CREATE UNIQUE INDEX warranties_quantity_line ON warranties(order_line_id) WHERE asset_id IS NULL;
CREATE INDEX warranties_line ON warranties(order_line_id);
CREATE TABLE jobs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL UNIQUE REFERENCES orders(id), technician_id uuid REFERENCES users(id), scheduled_at timestamptz, duration_hours integer NOT NULL DEFAULT 4 CHECK(duration_hours BETWEEN 1 AND 12), status text NOT NULL DEFAULT 'unassigned' CHECK(status IN ('unassigned','scheduled','in_progress','completed')), started_at timestamptz, finished_at timestamptz, capacity_kw numeric(5,2), generation_kw numeric(6,2), checklist jsonb NOT NULL DEFAULT '{}', signer_name text, labour_minutes integer NOT NULL DEFAULT 0 CHECK(labour_minutes>=0), hourly_rate_minor bigint NOT NULL DEFAULT 0, labour_cost_minor bigint NOT NULL DEFAULT 0, CHECK(finished_at IS NULL OR finished_at>=started_at));
CREATE INDEX jobs_technician ON jobs(technician_id,scheduled_at);
CREATE TABLE evidence (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL REFERENCES jobs(id), kind text NOT NULL CHECK(kind IN ('photo','signature')), filename text NOT NULL UNIQUE, mime text NOT NULL, size_bytes integer NOT NULL CHECK(size_bytes>0), uploaded_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX evidence_job ON evidence(job_id);
CREATE TABLE tickets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), number bigint GENERATED ALWAYS AS IDENTITY UNIQUE, warranty_id uuid NOT NULL REFERENCES warranties(id), complaint text NOT NULL, fault_code text NOT NULL, status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','awaiting_confirmation','closed')), assigned_to uuid REFERENCES users(id), covered boolean NOT NULL, coverage_reason text NOT NULL, opened_at timestamptz NOT NULL DEFAULT now(), resolution text, parts_cost_minor bigint NOT NULL DEFAULT 0 CHECK(parts_cost_minor>=0), labour_cost_minor bigint NOT NULL DEFAULT 0 CHECK(labour_cost_minor>=0), customer_charge_minor bigint NOT NULL DEFAULT 0 CHECK(customer_charge_minor>=0), replacement_asset_id uuid UNIQUE REFERENCES assets(id), confirmed_by text, confirmed_at timestamptz);
CREATE INDEX tickets_warranty ON tickets(warranty_id); CREATE INDEX tickets_status ON tickets(status); CREATE INDEX tickets_assigned ON tickets(assigned_to);
CREATE TABLE invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), number bigint GENERATED ALWAYS AS IDENTITY UNIQUE, order_id uuid NOT NULL REFERENCES orders(id), ticket_id uuid UNIQUE REFERENCES tickets(id), kind text NOT NULL CHECK(kind IN ('installation','service')), total_minor bigint NOT NULL CHECK(total_minor>=0), issued_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX invoice_installation_order ON invoices(order_id) WHERE kind='installation'; CREATE INDEX invoices_order ON invoices(order_id);
CREATE TABLE invoice_lines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid NOT NULL REFERENCES invoices(id), description text NOT NULL, quantity integer NOT NULL CHECK(quantity>0), unit_price_minor bigint NOT NULL CHECK(unit_price_minor>=0));
CREATE INDEX invoice_lines_invoice ON invoice_lines(invoice_id);
CREATE TABLE payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid NOT NULL REFERENCES invoices(id), amount_minor bigint NOT NULL CHECK(amount_minor>0 AND amount_minor<=1000000000000), method text NOT NULL CHECK(method IN ('cash','bank','upi','card')), reference text NOT NULL, created_by uuid NOT NULL REFERENCES users(id), paid_at timestamptz NOT NULL DEFAULT now(), UNIQUE(invoice_id,reference));
CREATE INDEX payments_invoice ON payments(invoice_id);
CREATE TABLE technician_payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL UNIQUE REFERENCES jobs(id), amount_minor bigint NOT NULL CHECK(amount_minor>=0), reference text NOT NULL, paid_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE subsidies (project_id uuid PRIMARY KEY REFERENCES projects(id), status text NOT NULL DEFAULT 'documents_pending' CHECK(status IN ('documents_pending','submitted','approved','received','not_applicable')), reference text NOT NULL DEFAULT '', owner_id uuid REFERENCES users(id), documents jsonb NOT NULL DEFAULT '{}', next_action text NOT NULL DEFAULT 'Collect homeowner documents', updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE audit_events (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid REFERENCES users(id), entity_type text NOT NULL, entity_id uuid NOT NULL, action text NOT NULL, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX audit_entity ON audit_events(entity_id,created_at DESC);
CREATE TABLE idempotency (user_id uuid NOT NULL REFERENCES users(id), key text NOT NULL, route text NOT NULL, body_hash text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,key));
CREATE TABLE settings (key text PRIMARY KEY, value jsonb NOT NULL);
INSERT INTO settings VALUES ('policy','{"advance_percent":30,"currency":"INR","tax_percent":0,"note":"Demo commercial policy: 30% advance; prices exclude any unconfigured tax. Subsidy is tracking only, not an eligibility assessment."}');

-- Snapshot lines may never be rewritten after an order has been accepted.
CREATE FUNCTION protect_quote_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM quotes WHERE id=OLD.quote_id AND status='accepted') THEN RAISE EXCEPTION 'Accepted quotation lines are immutable'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER quote_snapshot_lock BEFORE UPDATE OR DELETE ON quote_lines FOR EACH ROW EXECUTE FUNCTION protect_quote_snapshot();
