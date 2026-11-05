import { notFound, permanentRedirect, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { loadTown, resolveTownChild } from '@/lib/sites/render-town';
import * as paths from '@/lib/routing/paths';

/**
 * /service-areas/{city}/{service}/ — RETIRED location (v6.1).
 * Silos live under /locations/{city}/{service}/. A promoted town 301s there;
 * under a plain town the URL sends visitors to the town page, which already
 * lists every service and links to the root pages.
 */

export const revalidate = 60;

interface Props { params: Promise<{ slug: string; city: string; child: string }> }

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Page Not Found' };
}

export default async function RetiredTownServiceRoute({ params }: Props) {
  const { slug, city, child } = await params;
  const ctx = await loadTown(slug, city);
  if (!ctx) notFound();
  // The Primary Market's "silo" is the root service page itself.
  if (ctx === 'primary_market') redirect(`/${child}`);
  const entry = await resolveTownChild(ctx.base.site.id, child);
  if (!entry) notFound();
  if (ctx.promoted) permanentRedirect(paths.locationServicePage(city, child));
  if (!ctx.hasPage) notFound();
  permanentRedirect(paths.townPage(city));
}
