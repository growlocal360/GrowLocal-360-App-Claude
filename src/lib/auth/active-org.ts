import { cookies } from 'next/headers';

const COOKIE_NAME = 'active_org_id';

/**
 * Read the active org ID from the cookie (server-side only).
 */
export async function getActiveOrgId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

/**
 * Set the active org ID cookie (server-side only).
 */
export async function setActiveOrgId(orgId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, orgId, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });
}
