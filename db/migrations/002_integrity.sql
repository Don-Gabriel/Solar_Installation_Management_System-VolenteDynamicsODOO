CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE INDEX surveys_surveyor ON surveys(surveyed_by);
CREATE INDEX surveys_approver ON surveys(approved_by);
CREATE INDEX receipts_creator ON receipts(created_by);
CREATE INDEX stock_movements_receipt ON stock_movements(receipt_id);
CREATE INDEX evidence_uploader ON evidence(uploaded_by);
CREATE INDEX payments_creator ON payments(created_by);
CREATE INDEX subsidies_owner ON subsidies(owner_id);
CREATE INDEX audit_actor ON audit_events(actor_id);
CREATE INDEX invoices_issued ON invoices(issued_at);
CREATE INDEX payments_paid ON payments(paid_at);
CREATE INDEX orders_confirmed ON orders(confirmed_at);

CREATE FUNCTION protect_accepted_quote() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.status='accepted' THEN RAISE EXCEPTION 'Accepted quotation is immutable'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER accepted_quote_lock BEFORE UPDATE OR DELETE ON quotes FOR EACH ROW EXECUTE FUNCTION protect_accepted_quote();

CREATE FUNCTION prevent_accepted_line_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM quotes WHERE id=NEW.quote_id AND status='accepted') THEN RAISE EXCEPTION 'Accepted quotation lines are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER accepted_line_insert_lock BEFORE INSERT ON quote_lines FOR EACH ROW EXECUTE FUNCTION prevent_accepted_line_insert();

CREATE FUNCTION protect_order_terms() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' OR NEW.order_id<>OLD.order_id OR NEW.quote_line_id<>OLD.quote_line_id OR NEW.product_id<>OLD.product_id OR NEW.quantity<>OLD.quantity OR NEW.description<>OLD.description OR NEW.kind<>OLD.kind OR NEW.unit_price_minor<>OLD.unit_price_minor OR NEW.warranty_months<>OLD.warranty_months THEN RAISE EXCEPTION 'Accepted order terms are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER order_terms_lock BEFORE UPDATE OR DELETE ON order_lines FOR EACH ROW EXECUTE FUNCTION protect_order_terms();
