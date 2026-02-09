-- Google Reviews table
-- Caches reviews fetched from GBP API during site generation

CREATE TABLE google_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  google_review_id VARCHAR(255) NOT NULL,
  author_name VARCHAR(255),
  author_photo_url TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  review_date TIMESTAMPTZ,
  review_reply TEXT,
  reply_date TIMESTAMPTZ,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, google_review_id)
);

CREATE INDEX idx_google_reviews_site_id ON google_reviews(site_id);
CREATE INDEX idx_google_reviews_rating ON google_reviews(rating);

-- RLS policies
ALTER TABLE google_reviews ENABLE ROW LEVEL SECURITY;

-- Public can read reviews for active sites (needed for public site rendering)
CREATE POLICY "Public can read reviews for active sites"
  ON google_reviews FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM sites WHERE sites.id = google_reviews.site_id AND sites.is_active = true
  ));

-- Site owners can manage their reviews
CREATE POLICY "Site owners can manage reviews"
  ON google_reviews FOR ALL
  USING (EXISTS (
    SELECT 1 FROM sites
    JOIN profiles ON profiles.organization_id = sites.organization_id
    WHERE sites.id = google_reviews.site_id
    AND profiles.user_id = auth.uid()
  ));
