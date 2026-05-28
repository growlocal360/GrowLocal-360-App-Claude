/**
 * Routes the user to the dedicated GBP connect page for a site. That page
 * handles auth, location picking, and persistence in one canonical place.
 * Returning to here was always meant to be "kick off OAuth," but doing OAuth
 * in place from a toast/banner gave too many ways for the flow to silently
 * fail (multi-location accounts, auto-pick misses, etc.). The dedicated page
 * always shows a picker, so the user gets a clear, completable flow.
 */
export function startGbpConnect(siteId: string, returnPath: string): void {
  const next = encodeURIComponent(returnPath);
  window.location.href = `/dashboard/sites/${siteId}/connect-gbp?next=${next}`;
}
