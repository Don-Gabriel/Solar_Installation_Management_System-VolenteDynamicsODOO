ALTER TABLE tickets ADD COLUMN parent_ticket_id uuid REFERENCES tickets(id);
CREATE INDEX tickets_parent ON tickets(parent_ticket_id);
