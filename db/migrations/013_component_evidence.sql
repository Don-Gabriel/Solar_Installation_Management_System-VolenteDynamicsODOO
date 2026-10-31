ALTER TABLE evidence ADD COLUMN order_line_id uuid REFERENCES order_lines(id);
ALTER TABLE evidence ADD COLUMN asset_id uuid REFERENCES assets(id);
ALTER TABLE evidence ADD COLUMN content_hash text;
CREATE INDEX evidence_component ON evidence(order_line_id,asset_id);
CREATE INDEX evidence_asset ON evidence(asset_id);
CREATE UNIQUE INDEX evidence_content_once ON evidence(coalesce(job_id,ticket_id),kind,coalesce(visit_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(diagnosis_revision,-1),coalesce(order_line_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(asset_id,'00000000-0000-0000-0000-000000000000'::uuid),content_hash) WHERE content_hash IS NOT NULL;
