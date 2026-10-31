ALTER TABLE tickets ADD COLUMN diagnosis_revision integer NOT NULL DEFAULT 0;
ALTER TABLE diagnosis_lines ADD COLUMN coverage_override text NOT NULL DEFAULT 'auto' CHECK(coverage_override IN ('auto','covered','chargeable'));
ALTER TABLE diagnosis_lines ADD COLUMN labour_coverage_override text NOT NULL DEFAULT 'auto' CHECK(labour_coverage_override IN ('auto','covered','chargeable'));
ALTER TABLE evidence ADD COLUMN diagnosis_revision integer;
