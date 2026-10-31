CREATE TABLE job_crew (
 job_id uuid NOT NULL REFERENCES jobs(id), user_id uuid NOT NULL REFERENCES users(id),
 is_lead boolean NOT NULL DEFAULT false, labour_minutes integer CHECK(labour_minutes>=0),
 hourly_rate_minor bigint CHECK(hourly_rate_minor>=0), labour_cost_minor bigint CHECK(labour_cost_minor>=0),
 PRIMARY KEY(job_id,user_id)
);
CREATE UNIQUE INDEX job_crew_lead ON job_crew(job_id) WHERE is_lead;
CREATE INDEX job_crew_worker ON job_crew(user_id,job_id);
INSERT INTO job_crew(job_id,user_id,is_lead,labour_minutes,hourly_rate_minor,labour_cost_minor)
 SELECT id,technician_id,true,labour_minutes,hourly_rate_minor,labour_cost_minor FROM jobs WHERE technician_id IS NOT NULL;
