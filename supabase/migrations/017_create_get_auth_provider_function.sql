-- Function to check if an email is associated with a non-email auth provider (e.g., Google OAuth).
-- Used by the login page to show a helpful message when a Google user tries password login.
-- SECURITY DEFINER allows it to access the auth schema regardless of caller permissions.
CREATE OR REPLACE FUNCTION public.get_auth_provider(email_input TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT i.provider
  FROM auth.users u
  JOIN auth.identities i ON i.user_id = u.id
  WHERE u.email = lower(email_input)
  AND i.provider != 'email'
  LIMIT 1;
$$;
