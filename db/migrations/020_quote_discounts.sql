CREATE TABLE quote_discounts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),quote_id uuid NOT NULL REFERENCES quotes(id),percent integer NOT NULL CHECK(percent BETWEEN 1 AND 20),reason text NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),requested_by uuid NOT NULL REFERENCES users(id),reviewed_by uuid REFERENCES users(id),review_note text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz,result_quote_id uuid REFERENCES quotes(id),CHECK(reviewed_by IS NULL OR reviewed_by<>requested_by));
CREATE INDEX quote_discounts_quote ON quote_discounts(quote_id);
CREATE INDEX quote_discounts_result ON quote_discounts(result_quote_id);
CREATE INDEX quote_discounts_requester ON quote_discounts(requested_by);
CREATE INDEX quote_discounts_reviewer ON quote_discounts(reviewed_by);
CREATE UNIQUE INDEX quote_discounts_pending ON quote_discounts(quote_id) WHERE status='pending';
