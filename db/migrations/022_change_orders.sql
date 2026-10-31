ALTER TABLE projects ADD COLUMN parent_project_id uuid REFERENCES projects(id);
CREATE INDEX projects_parent ON projects(parent_project_id);
CREATE TABLE change_order_lines(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES projects(id),product_id uuid NOT NULL REFERENCES products(id),quantity integer NOT NULL CHECK(quantity>0),UNIQUE(project_id,product_id));
CREATE INDEX change_order_lines_product ON change_order_lines(product_id);
