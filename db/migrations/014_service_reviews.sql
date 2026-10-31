CREATE TABLE service_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_id uuid NOT NULL REFERENCES tickets(id),ticket_version integer NOT NULL,kind text NOT NULL CHECK(kind IN ('remote','no_fault')),observations text NOT NULL,customer_confirmation text NOT NULL DEFAULT '',minutes integer NOT NULL DEFAULT 0 CHECK(minutes BETWEEN 0 AND 720),visit_id uuid REFERENCES visits(id),requested_by uuid NOT NULL REFERENCES users(id),reviewed_by uuid REFERENCES users(id),status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),review_note text,created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz,CHECK(reviewed_by IS NULL OR reviewed_by<>requested_by));
CREATE UNIQUE INDEX service_reviews_pending ON service_reviews(ticket_id) WHERE status='pending';
CREATE INDEX service_reviews_ticket ON service_reviews(ticket_id);
CREATE INDEX service_reviews_visit ON service_reviews(visit_id);
CREATE INDEX service_reviews_requester ON service_reviews(requested_by);
CREATE INDEX service_reviews_reviewer ON service_reviews(reviewed_by);
ALTER TABLE jobs ADD COLUMN review_required boolean NOT NULL DEFAULT false;
ALTER TABLE jobs ADD COLUMN review_reason text NOT NULL DEFAULT '';
ALTER TABLE diagnosis_lines ADD COLUMN entitlement_review text NOT NULL DEFAULT '';
