-- Support representative city for Service Area Businesses (SABs).
-- SABs have no physical address, so the user picks a representative city
-- to anchor their content (e.g. "Parma" instead of GBP's default "Cleveland").

ALTER TABLE locations ADD COLUMN representative_city TEXT;
ALTER TABLE locations ADD COLUMN representative_state TEXT;
