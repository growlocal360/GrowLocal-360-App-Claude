-- Which button the auto-published GBP availability post carries.
-- CALL uses the phone on the Business Profile (the API takes no URL for it);
-- BOOK / LEARN_MORE link to post_cta_url, or the site's /book page when NULL.
ALTER TABLE scheduling_configs
  ADD COLUMN IF NOT EXISTS post_cta_type text NOT NULL DEFAULT 'BOOK'
    CHECK (post_cta_type IN ('BOOK', 'CALL', 'LEARN_MORE', 'NONE')),
  ADD COLUMN IF NOT EXISTS post_cta_url text;
