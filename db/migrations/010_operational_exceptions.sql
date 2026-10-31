CREATE TABLE operational_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES projects(id),
 ticket_id uuid REFERENCES tickets(id), visit_id uuid REFERENCES visits(id),
 kind text NOT NULL CHECK(kind IN ('capacity','reschedule','customer_contact','hazard','overrun','parts','installation_dispute')),
 summary text NOT NULL CHECK(length(summary)>0),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','done')),
 version integer NOT NULL DEFAULT 1,
 created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 completed_by uuid REFERENCES users(id), completed_at timestamptz, outcome text,
 CHECK((status='done')=(completed_at IS NOT NULL))
);
CREATE UNIQUE INDEX task_one_open ON operational_tasks(project_id,kind,coalesce(ticket_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(visit_id,'00000000-0000-0000-0000-000000000000'::uuid)) WHERE status='open';
CREATE INDEX task_ticket ON operational_tasks(ticket_id);
CREATE INDEX task_visit ON operational_tasks(visit_id);
CREATE INDEX task_creator ON operational_tasks(created_by);
CREATE INDEX task_completer ON operational_tasks(completed_by);
CREATE TABLE company_holidays(day date PRIMARY KEY,reason text NOT NULL,created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX holidays_creator ON company_holidays(created_by);
ALTER TABLE visits ADD COLUMN acknowledgement_due_at timestamptz;
ALTER TABLE visit_crew ADD COLUMN acknowledged_at timestamptz;
