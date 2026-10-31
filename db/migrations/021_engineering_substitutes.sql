CREATE TABLE engineering_substitutes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_id uuid NOT NULL REFERENCES tickets(id),asset_id uuid NOT NULL REFERENCES assets(id),replacement_product_id uuid NOT NULL REFERENCES products(id),compatibility_note text NOT NULL,customer_agreement text NOT NULL,unit_price_minor bigint NOT NULL CHECK(unit_price_minor>=0),approved_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(ticket_id,asset_id,replacement_product_id));
CREATE INDEX engineering_substitutes_asset ON engineering_substitutes(asset_id);
CREATE INDEX engineering_substitutes_product ON engineering_substitutes(replacement_product_id);
CREATE INDEX engineering_substitutes_actor ON engineering_substitutes(approved_by);
