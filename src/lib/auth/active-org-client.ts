const COOKIE_NAME = 'active_org_id';

/**
 * Read active_org_id from document.cookie (client-side only).
 */
export function getActiveOrgIdClient(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}
