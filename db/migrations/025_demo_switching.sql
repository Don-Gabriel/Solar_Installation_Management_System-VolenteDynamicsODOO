ALTER TABLE sessions ADD COLUMN demo_operator_id uuid REFERENCES users(id);
