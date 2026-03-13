-- 024: Ensure sites table has a SELECT policy for org members
-- This may already exist from initial schema setup, so we check first.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can view sites in their org'
      AND tablename = 'sites'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view sites in their org" ON sites
      FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
      )';
  END IF;
END $$;
