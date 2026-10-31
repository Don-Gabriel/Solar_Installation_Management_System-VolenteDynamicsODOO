ALTER TABLE customers ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE customers ADD COLUMN billing_address text NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN merged_into uuid REFERENCES customers(id);
CREATE INDEX customers_merged ON customers(merged_into);
ALTER TABLE sites ADD COLUMN access_notes text NOT NULL DEFAULT '';
ALTER TABLE sites ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE projects ALTER COLUMN capacity_kw DROP NOT NULL;
ALTER TABLE projects ADD COLUMN preferred_date date;
ALTER TABLE projects ADD COLUMN preferred_window text NOT NULL DEFAULT 'any' CHECK(preferred_window IN ('any','morning','afternoon'));
ALTER TABLE projects ADD COLUMN hazard_notes text NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN cancelled_at timestamptz;
ALTER TABLE projects ADD COLUMN cancellation_reason text;
CREATE TABLE customer_history(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,customer_id uuid NOT NULL REFERENCES customers(id),actor_id uuid NOT NULL REFERENCES users(id),before_value jsonb NOT NULL,after_value jsonb NOT NULL,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX customer_history_customer ON customer_history(customer_id,created_at);
CREATE INDEX customer_history_actor ON customer_history(actor_id);
CREATE TABLE project_contacts(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,project_id uuid NOT NULL REFERENCES projects(id),actor_id uuid NOT NULL REFERENCES users(id),note text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX project_contacts_project ON project_contacts(project_id,created_at);
CREATE INDEX project_contacts_actor ON project_contacts(actor_id);
ALTER TABLE invoices ADD COLUMN customer_name_snapshot text;
ALTER TABLE invoices ADD COLUMN billing_address_snapshot text;
ALTER TABLE invoices ADD COLUMN service_address_snapshot text;
UPDATE invoices i SET customer_name_snapshot=c.name,billing_address_snapshot=coalesce(nullif(c.billing_address,''),s.address),service_address_snapshot=s.address FROM orders o JOIN projects p ON p.id=o.project_id JOIN sites s ON s.id=p.site_id JOIN customers c ON c.id=s.customer_id WHERE i.order_id=o.id;
CREATE FUNCTION snapshot_invoice_customer() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.customer_name_snapshot IS DISTINCT FROM OLD.customer_name_snapshot OR NEW.billing_address_snapshot IS DISTINCT FROM OLD.billing_address_snapshot OR NEW.service_address_snapshot IS DISTINCT FROM OLD.service_address_snapshot THEN RAISE EXCEPTION 'Issued customer snapshots cannot be changed'; END IF;
 ELSE
  SELECT c.name,coalesce(nullif(c.billing_address,''),s.address),s.address INTO NEW.customer_name_snapshot,NEW.billing_address_snapshot,NEW.service_address_snapshot FROM orders o JOIN projects p ON p.id=o.project_id JOIN sites s ON s.id=p.site_id JOIN customers c ON c.id=s.customer_id WHERE o.id=NEW.order_id;
 END IF; RETURN NEW; END $$;
CREATE TRIGGER invoice_customer_snapshot BEFORE INSERT OR UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION snapshot_invoice_customer();
ALTER TABLE quotes ADD COLUMN customer_name_snapshot text;
ALTER TABLE quotes ADD COLUMN billing_address_snapshot text;
-- The migration holds the table lock; only initialize new snapshot columns on existing rows.
ALTER TABLE quotes DISABLE TRIGGER accepted_quote_lock;
UPDATE quotes q SET customer_name_snapshot=c.name,billing_address_snapshot=coalesce(nullif(c.billing_address,''),s.address) FROM projects p JOIN sites s ON s.id=p.site_id JOIN customers c ON c.id=s.customer_id WHERE q.project_id=p.id;
ALTER TABLE quotes ENABLE TRIGGER accepted_quote_lock;
CREATE FUNCTION snapshot_quote_customer() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.customer_name_snapshot IS DISTINCT FROM OLD.customer_name_snapshot OR NEW.billing_address_snapshot IS DISTINCT FROM OLD.billing_address_snapshot THEN RAISE EXCEPTION 'Issued quote customer snapshots cannot be changed'; END IF;
 ELSE
  SELECT c.name,coalesce(nullif(c.billing_address,''),s.address) INTO NEW.customer_name_snapshot,NEW.billing_address_snapshot FROM projects p JOIN sites s ON s.id=p.site_id JOIN customers c ON c.id=s.customer_id WHERE p.id=NEW.project_id;
 END IF; RETURN NEW; END $$;
CREATE TRIGGER quote_customer_snapshot BEFORE INSERT OR UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION snapshot_quote_customer();
DROP VIEW invoice_balances;
CREATE VIEW invoice_balances AS SELECT i.*,
 (i.total_minor-coalesce((SELECT sum(amount_minor) FROM credit_notes c WHERE c.invoice_id=i.id),0))::bigint AS net_total_minor,
 coalesce((SELECT sum(amount_minor) FROM credit_notes c WHERE c.invoice_id=i.id),0)::bigint AS credited_minor,
 coalesce((SELECT sum(amount_minor) FROM cash_movements p WHERE p.invoice_id=i.id),0)::bigint AS paid_minor FROM invoices i;
