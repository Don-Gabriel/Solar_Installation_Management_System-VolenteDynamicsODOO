ALTER TABLE order_lines ADD COLUMN delivered_at timestamptz;
UPDATE order_lines l SET delivered_at=o.delivered_at FROM orders o WHERE l.order_id=o.id AND o.status='delivered';
CREATE TABLE delivery_incidents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES orders(id),kind text NOT NULL CHECK(kind IN ('wrong_destination','refused','transit_damage')),custody text NOT NULL,reason text NOT NULL,status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','retry','returned')),created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),reviewed_by uuid REFERENCES users(id),reviewed_at timestamptz,outcome text NOT NULL DEFAULT '',version integer NOT NULL DEFAULT 1);
CREATE INDEX delivery_incidents_order ON delivery_incidents(order_id);
CREATE INDEX delivery_incidents_creator ON delivery_incidents(created_by);
CREATE INDEX delivery_incidents_reviewer ON delivery_incidents(reviewed_by);
