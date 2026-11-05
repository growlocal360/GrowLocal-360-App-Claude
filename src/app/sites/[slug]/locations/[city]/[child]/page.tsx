import { notFound, redirect, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { loadTown, renderTownService, resolveTownChild } from '@/lib/sites/render-town';
import { withOpenGraph, getSiteOgImage } from '@/lib/sites/og-metadata';
import * as paths from '@/lib/routing/paths';

/**
 * v6.1 SILO PAGE — /locations/{city}/{service}/
 * A main-service entry localized to a location (a town with its own GBP).
 * Under a plain town there is no silo: the URL 301s to the town page, which
 * already lists every service and links to the root pages.
 * `/locations/{city}/service-areas/` (the branch's own towns) arrives once
 * towns can be assigned to a branch; until then it is not a page.
 */

export const revalidate = 60;

interface Props { params: Promise<{ slug: string; city: string; child: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, city, child } = await params;
  const ctx = await loadTown(slug, city);
  if (!ctx || ctx === 'primary_market' || !ctx.promoted) return { title: 'Page Not Found' };
  const entry = await resolveTownChild(ctx.base.site.id, child);
  if (!entry) return { title: 'Page Not Found' };
  const { site } = ctx.base;
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'growlocal360.com';
  const domain = (site.custom_domain_verified && site.custom_domain) ? site.custom_domain : `${slug}.${appDomain}`;
  const canonicalUrl = `https://${domain}/locations/${city}/${child}`;
  const state = ctx.area.state || ctx.base.primaryLocation?.state;
  const label = state ? `${ctx.area.name}, ${state}` : ctx.area.name;
  return withOpenGraph({
    title: `${entry.name} in ${label} | ${site.name}`,
    description: `Professional ${entry.name.toLowerCase()} in ${ctx.area.name} from ${site.name}'s local team. Contact us for fast, reliable service.`,
    alternates: { canonical: canonicalUrl },
  }, { url: canonicalUrl, siteName: site.name, logoUrl: getSiteOgImage(site.settings) });
}

export default async function LocationServiceRoute({ params }: Props) {
  const { slug, city, child } = await params;
  const ctx = await loadTown(slug, city);
  if (!ctx) notFound();
  // The Primary Market's "silo" is the root service page itself.
  if (ctx === 'primary_market') redirect(`/${child}`);
  const entry = await resolveTownChild(ctx.base.site.id, child);
  if (!entry) notFound();
  if (!ctx.promoted) {
    if (!ctx.hasPage) notFound();
    permanentRedirect(paths.townPage(city));
  }
  const rendered = await renderTownService(ctx, slug, entry);
  if (!rendered) notFound();
  return rendered;
}
