CREATE TABLE delivery_replacements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),incident_id uuid NOT NULL REFERENCES delivery_incidents(id),original_asset_id uuid NOT NULL UNIQUE REFERENCES assets(id),replacement_asset_id uuid NOT NULL UNIQUE REFERENCES assets(id),note text NOT NULL,created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX delivery_replacements_incident ON delivery_replacements(incident_id);
CREATE INDEX delivery_replacements_actor ON delivery_replacements(created_by);
