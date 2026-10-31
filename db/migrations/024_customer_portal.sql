ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('admin','sales','surveyor','warehouse','technician','support','accounts','coordinator','customer'));
ALTER TABLE users ADD COLUMN customer_id uuid REFERENCES customers(id);
ALTER TABLE users ADD CONSTRAINT users_customer_link CHECK((role='customer')=(customer_id IS NOT NULL));
CREATE INDEX users_customer ON users(customer_id) WHERE customer_id IS NOT NULL;

CREATE TABLE customer_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_id uuid NOT NULL REFERENCES customers(id),
 project_id uuid NOT NULL REFERENCES projects(id),
 title text NOT NULL, body text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz
);
CREATE INDEX customer_notifications_inbox ON customer_notifications(customer_id,created_at DESC);
CREATE INDEX customer_notifications_project ON customer_notifications(project_id);

-- Notifications commit with the business change. Rolled-back or idempotent retries cannot send duplicates.
-- This is an in-app inbox only: no external email or SMS delivery is asserted.
CREATE FUNCTION notify_customer_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE project uuid; heading text; message text;
BEGIN
 IF TG_TABLE_NAME='tickets' THEN
  IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  project:=NEW.project_id;
  heading:=CASE WHEN TG_OP='INSERT' THEN 'Repair request received' ELSE 'Repair status updated' END;
  message:=format('Repair SR-%s is now %s. Open My solar service for the latest details.',NEW.number,replace(NEW.status,'_',' '));
 ELSIF TG_TABLE_NAME='visits' THEN
  IF TG_OP='UPDATE' AND (NEW.starts_at,NEW.ends_at,NEW.status) IS NOT DISTINCT FROM (OLD.starts_at,OLD.ends_at,OLD.status) THEN RETURN NEW; END IF;
  project:=NEW.project_id; heading:='Visit updated';
  message:=format('Your %s visit is %s: %s to %s IST.',NEW.kind,replace(NEW.status,'_',' '),to_char(NEW.starts_at AT TIME ZONE 'Asia/Kolkata','DD Mon YYYY HH24:MI'),to_char(NEW.ends_at AT TIME ZONE 'Asia/Kolkata','HH24:MI'));
 ELSIF TG_TABLE_NAME='jobs' THEN
  IF (NEW.scheduled_at,NEW.status) IS NOT DISTINCT FROM (OLD.scheduled_at,OLD.status) THEN RETURN NEW; END IF;
  SELECT project_id INTO project FROM orders WHERE id=NEW.order_id;
  heading:='Installation updated';
  message:=format('Your installation is %s%s.',replace(NEW.status,'_',' '),CASE WHEN NEW.scheduled_at IS NULL THEN '' ELSE ' for '||to_char(NEW.scheduled_at AT TIME ZONE 'Asia/Kolkata','DD Mon YYYY HH24:MI')||' IST' END);
 ELSIF TG_TABLE_NAME='invoices' THEN
  SELECT project_id INTO project FROM orders WHERE id=NEW.order_id;
  heading:='New invoice';
  message:=format('Invoice INV-%s is available. Total: INR %s. Open My solar service to see the item details and balance.',NEW.number,to_char(NEW.total_minor::numeric/100,'FM999999999999990.00'));
 ELSIF TG_TABLE_NAME='orders' THEN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  project:=NEW.project_id; heading:='Order updated';
  message:=format('Your equipment order is now %s.',replace(NEW.status,'_',' '));
 END IF;
 INSERT INTO customer_notifications(customer_id,project_id,title,body)
 SELECT s.customer_id,p.id,heading,message FROM projects p JOIN sites s ON s.id=p.site_id WHERE p.id=project;
 RETURN NEW;
END $$;
CREATE TRIGGER customer_ticket_notice AFTER INSERT OR UPDATE OF status ON tickets FOR EACH ROW EXECUTE FUNCTION notify_customer_event();
CREATE TRIGGER customer_visit_notice AFTER INSERT OR UPDATE OF starts_at,ends_at,status ON visits FOR EACH ROW EXECUTE FUNCTION notify_customer_event();
CREATE TRIGGER customer_job_notice AFTER UPDATE OF scheduled_at,status ON jobs FOR EACH ROW EXECUTE FUNCTION notify_customer_event();
CREATE TRIGGER customer_invoice_notice AFTER INSERT ON invoices FOR EACH ROW EXECUTE FUNCTION notify_customer_event();
CREATE TRIGGER customer_order_notice AFTER UPDATE OF status ON orders FOR EACH ROW EXECUTE FUNCTION notify_customer_event();
