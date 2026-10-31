ALTER TABLE quotes ADD COLUMN expires_at timestamptz NOT NULL DEFAULT (now()+interval '14 days');
ALTER TABLE invoices DROP CONSTRAINT invoices_kind_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_kind_check CHECK(kind IN ('installation','service','correction'));
ALTER TABLE invoices ADD COLUMN parent_invoice_id uuid REFERENCES invoices(id);
CREATE INDEX invoices_parent ON invoices(parent_invoice_id);
ALTER TABLE payments ADD COLUMN status text NOT NULL DEFAULT 'verified' CHECK(status IN ('pending','verified','rejected'));
ALTER TABLE payments ADD COLUMN verified_by uuid REFERENCES users(id);
ALTER TABLE payments ADD COLUMN verified_at timestamptz;
ALTER TABLE payments ADD COLUMN verification_note text;
CREATE INDEX payments_verifier ON payments(verified_by);
CREATE TABLE payment_reversals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),payment_id uuid NOT NULL UNIQUE REFERENCES payments(id),reason text NOT NULL,created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX payment_reversals_actor ON payment_reversals(created_by);
CREATE TABLE invoice_corrections(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),invoice_id uuid NOT NULL REFERENCES invoices(id),reason text NOT NULL,credit_minor bigint NOT NULL CHECK(credit_minor>0),replacement_lines jsonb NOT NULL DEFAULT '[]',status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),requested_by uuid NOT NULL REFERENCES users(id),reviewed_by uuid REFERENCES users(id),review_note text,created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz,replacement_invoice_id uuid REFERENCES invoices(id),CHECK(reviewed_by IS NULL OR reviewed_by<>requested_by));
CREATE INDEX invoice_corrections_invoice ON invoice_corrections(invoice_id);
CREATE INDEX invoice_corrections_requester ON invoice_corrections(requested_by);
CREATE INDEX invoice_corrections_reviewer ON invoice_corrections(reviewed_by);
CREATE INDEX invoice_corrections_replacement ON invoice_corrections(replacement_invoice_id);
CREATE TABLE credit_notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,invoice_id uuid NOT NULL REFERENCES invoices(id),correction_id uuid NOT NULL UNIQUE REFERENCES invoice_corrections(id),amount_minor bigint NOT NULL CHECK(amount_minor>0),reason text NOT NULL,issued_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX credit_notes_invoice ON credit_notes(invoice_id);
CREATE TABLE refunds(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),invoice_id uuid NOT NULL REFERENCES invoices(id),amount_minor bigint NOT NULL CHECK(amount_minor>0),reference text NOT NULL,reason text NOT NULL,created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(invoice_id,reference));
CREATE INDEX refunds_invoice ON refunds(invoice_id);
CREATE INDEX refunds_actor ON refunds(created_by);
CREATE VIEW cash_movements AS
 SELECT id,invoice_id,amount_minor,coalesce(verified_at,paid_at) AS paid_at FROM payments WHERE status='verified'
 UNION ALL SELECT r.id,p.invoice_id,-p.amount_minor,r.created_at FROM payment_reversals r JOIN payments p ON p.id=r.payment_id
 UNION ALL SELECT id,invoice_id,-amount_minor,created_at FROM refunds;
CREATE VIEW invoice_balances AS SELECT i.*,
 (i.total_minor-coalesce((SELECT sum(amount_minor) FROM credit_notes c WHERE c.invoice_id=i.id),0))::bigint AS net_total_minor,
 coalesce((SELECT sum(amount_minor) FROM credit_notes c WHERE c.invoice_id=i.id),0)::bigint AS credited_minor,
 coalesce((SELECT sum(amount_minor) FROM cash_movements p WHERE p.invoice_id=i.id),0)::bigint AS paid_minor
 FROM invoices i;
