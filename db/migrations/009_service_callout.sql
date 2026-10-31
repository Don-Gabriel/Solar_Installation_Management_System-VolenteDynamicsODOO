-- Callout is an approved selling charge, separate from actual labour cost.
-- It follows the saved labour coverage decision and defaults to no charge.
ALTER TABLE diagnosis_lines ADD COLUMN callout_price_minor bigint NOT NULL DEFAULT 0 CHECK(callout_price_minor>=0 AND callout_price_minor<=1000000000000);
