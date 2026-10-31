CREATE TABLE crew_payments (
 job_id uuid NOT NULL, user_id uuid NOT NULL, amount_minor bigint NOT NULL CHECK(amount_minor>=0),
 reference text NOT NULL, paid_by uuid REFERENCES users(id), paid_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(job_id,user_id), FOREIGN KEY(job_id,user_id) REFERENCES job_crew(job_id,user_id)
);
CREATE INDEX crew_payments_user ON crew_payments(user_id);
INSERT INTO crew_payments(job_id,user_id,amount_minor,reference,paid_at)
 SELECT c.job_id,c.user_id,coalesce(c.labour_cost_minor,0),p.reference,p.paid_at FROM job_crew c JOIN technician_payments p ON p.job_id=c.job_id;
