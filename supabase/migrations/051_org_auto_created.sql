-- Distinguishes throwaway orgs auto-created at signup from organizations a user
-- deliberately creates via the self-service "Create your own business" flow.
--
-- The invite-acceptance cleanup (api/team/invitations/accept) deletes a user's
-- empty owner-orgs when they join a team, to remove the org auto-created by the
-- handle_new_user() trigger at signup. Without a marker it can't tell a throwaway
-- org from a deliberately created (but still empty) business and would wrongly
-- delete the latter. Cleanup now only targets auto_created = true orgs.
--
-- Default true so the signup trigger (which doesn't set the column) and all
-- existing rows keep current behavior; the deliberate-create route sets false.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS auto_created BOOLEAN NOT NULL DEFAULT true;
