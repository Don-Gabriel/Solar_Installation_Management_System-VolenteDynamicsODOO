ALTER TABLE diagnosis_lines ADD COLUMN labour_covered boolean;
UPDATE diagnosis_lines SET labour_covered=covered;
ALTER TABLE diagnosis_lines ALTER COLUMN labour_covered SET NOT NULL;
ALTER TABLE diagnosis_lines ALTER COLUMN labour_covered SET DEFAULT false;
