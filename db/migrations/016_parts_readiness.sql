CREATE TABLE service_parts_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_id uuid NOT NULL REFERENCES tickets(id),product_id uuid NOT NULL REFERENCES products(id),quantity integer NOT NULL CHECK(quantity>0),status text NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','ready','cancelled')),expected_on date,note text NOT NULL,requested_by uuid NOT NULL REFERENCES users(id),ready_by uuid REFERENCES users(id),ready_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1);
CREATE INDEX service_parts_ticket ON service_parts_requests(ticket_id);
CREATE INDEX service_parts_product ON service_parts_requests(product_id);
CREATE INDEX service_parts_requester ON service_parts_requests(requested_by);
CREATE INDEX service_parts_ready_actor ON service_parts_requests(ready_by);
