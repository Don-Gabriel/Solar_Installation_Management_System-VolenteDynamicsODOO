ALTER TABLE orders DROP CONSTRAINT orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK(status IN ('packing','dispatched','delivered','cancelled'));
ALTER TABLE jobs DROP CONSTRAINT jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check CHECK(status IN ('unassigned','scheduled','in_progress','completed','cancelled'));
CREATE TABLE order_cancellations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES orders(id),reason text NOT NULL,requested_by uuid NOT NULL REFERENCES users(id),status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),reviewed_by uuid REFERENCES users(id),review_note text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz,CHECK(reviewed_by IS NULL OR reviewed_by<>requested_by));
CREATE UNIQUE INDEX order_cancellation_pending ON order_cancellations(order_id) WHERE status='pending';
CREATE INDEX order_cancellation_order ON order_cancellations(order_id);
CREATE INDEX order_cancellation_requester ON order_cancellations(requested_by);
CREATE INDEX order_cancellation_reviewer ON order_cancellations(reviewed_by);
