-- Fix: Allow authenticated users to create organizations
-- This is needed for users who signed up before the handle_new_user trigger was set up

-- Allow authenticated users to insert organizations
CREATE POLICY "Authenticated users can create organizations" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to insert their profile
CREATE POLICY "Authenticated users can create their profile" ON profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());
