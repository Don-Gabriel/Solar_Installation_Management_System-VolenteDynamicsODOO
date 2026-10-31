ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('admin','sales','surveyor','warehouse','technician','support','accounts','coordinator'));
ALTER TABLE users ADD COLUMN skills text[] NOT NULL DEFAULT ARRAY['installation','inverter_repair','battery_repair','survey','crew_lead'];
ALTER TABLE users ADD COLUMN dispatch_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN working_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6];
CREATE TABLE staff_leave(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, reason text NOT NULL, created_by uuid NOT NULL REFERENCES users(id), CHECK(ends_at>starts_at));
CREATE INDEX staff_leave_user_time ON staff_leave(user_id,starts_at,ends_at);
ALTER TABLE tickets ALTER COLUMN warranty_id DROP NOT NULL;
ALTER TABLE tickets ADD COLUMN project_id uuid REFERENCES projects(id);
UPDATE tickets t SET project_id=o.project_id FROM warranties w JOIN order_lines l ON l.id=w.order_line_id JOIN orders o ON o.id=l.order_id WHERE w.id=t.warranty_id;
ALTER TABLE tickets ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE tickets ALTER COLUMN covered DROP NOT NULL;
ALTER TABLE tickets ALTER COLUMN coverage_reason SET DEFAULT 'Pending component diagnosis';
ALTER TABLE tickets ADD COLUMN priority text NOT NULL DEFAULT 'routine' CHECK(priority IN ('routine','urgent'));
ALTER TABLE tickets ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE tickets ADD COLUMN estimate_status text NOT NULL DEFAULT 'draft' CHECK(estimate_status IN ('draft','approved'));
ALTER TABLE tickets ADD COLUMN approved_by uuid REFERENCES users(id);
ALTER TABLE tickets ADD COLUMN customer_approval text;
ALTER TABLE tickets DROP CONSTRAINT tickets_status_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_status_check CHECK(status IN ('open','scheduled','in_progress','diagnosed','waiting_parts','awaiting_confirmation','closed','cancelled','disputed'));
CREATE INDEX tickets_project ON tickets(project_id);
CREATE TABLE visits(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id), ticket_id uuid REFERENCES tickets(id),
 kind text NOT NULL CHECK(kind IN ('repair','survey')), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 required_skill text NOT NULL, status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','in_progress','completed','cancelled','no_access')),
 version integer NOT NULL DEFAULT 1, reason text NOT NULL DEFAULT '', created_by uuid NOT NULL REFERENCES users(id),
 started_at timestamptz, completed_at timestamptz, CHECK(ends_at>starts_at), CHECK((kind='repair')=(ticket_id IS NOT NULL)));
CREATE INDEX visits_ticket ON visits(ticket_id);
CREATE INDEX visits_project_time ON visits(project_id,starts_at);
CREATE TABLE visit_crew(visit_id uuid NOT NULL REFERENCES visits(id), user_id uuid NOT NULL REFERENCES users(id), is_lead boolean NOT NULL DEFAULT false, PRIMARY KEY(visit_id,user_id));
CREATE INDEX visit_crew_user ON visit_crew(user_id,visit_id);
CREATE UNIQUE INDEX visit_one_lead ON visit_crew(visit_id) WHERE is_lead;
CREATE TABLE diagnosis_lines(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid NOT NULL REFERENCES tickets(id), order_line_id uuid NOT NULL REFERENCES order_lines(id),
 asset_id uuid REFERENCES assets(id), warranty_id uuid REFERENCES warranties(id), product_id uuid NOT NULL REFERENCES products(id),
 description text NOT NULL, finding text NOT NULL, quantity integer NOT NULL CHECK(quantity>0), action text NOT NULL CHECK(action IN ('repair','replace')),
 replacement_serial text, covered boolean NOT NULL, coverage_reason text NOT NULL,
 unit_price_minor bigint NOT NULL CHECK(unit_price_minor>=0), unit_cost_minor bigint NOT NULL CHECK(unit_cost_minor>=0),
 labour_price_minor bigint NOT NULL CHECK(labour_price_minor>=0), labour_cost_minor bigint NOT NULL CHECK(labour_cost_minor>=0),
 labour_minutes integer NOT NULL CHECK(labour_minutes>=0), replacement_asset_id uuid REFERENCES assets(id));
CREATE UNIQUE INDEX diagnosis_component ON diagnosis_lines(ticket_id,order_line_id,coalesce(asset_id,'00000000-0000-0000-0000-000000000000'::uuid));
CREATE TABLE service_returns(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid NOT NULL REFERENCES tickets(id), asset_id uuid NOT NULL UNIQUE REFERENCES assets(id), replacement_asset_id uuid NOT NULL REFERENCES assets(id), status text NOT NULL DEFAULT 'pending_return' CHECK(status IN ('pending_return','quarantined','sent_to_supplier','closed')), received_by uuid REFERENCES users(id), received_at timestamptz, note text NOT NULL DEFAULT '');
CREATE INDEX service_returns_ticket ON service_returns(ticket_id);
ALTER TABLE evidence ALTER COLUMN job_id DROP NOT NULL;
ALTER TABLE evidence ADD COLUMN ticket_id uuid REFERENCES tickets(id);
ALTER TABLE evidence ADD COLUMN visit_id uuid REFERENCES visits(id);
ALTER TABLE evidence ADD CONSTRAINT evidence_owner CHECK((job_id IS NOT NULL)::integer+(ticket_id IS NOT NULL)::integer=1);
CREATE INDEX evidence_ticket ON evidence(ticket_id);
CREATE INDEX evidence_visit ON evidence(visit_id);
ALTER TABLE invoice_lines ADD COLUMN gross_unit_price_minor bigint;
ALTER TABLE invoice_lines ADD COLUMN warranty_credit_minor bigint NOT NULL DEFAULT 0 CHECK(warranty_credit_minor>=0);
ALTER TABLE invoice_lines ADD COLUMN coverage_reason text;
ALTER TABLE invoice_lines ADD COLUMN original_serial text;
ALTER TABLE invoice_lines ADD COLUMN replacement_serial text;
CREATE TABLE ticket_events(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,ticket_id uuid NOT NULL REFERENCES tickets(id),actor_id uuid NOT NULL REFERENCES users(id),note text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX ticket_events_ticket ON ticket_events(ticket_id,created_at);
