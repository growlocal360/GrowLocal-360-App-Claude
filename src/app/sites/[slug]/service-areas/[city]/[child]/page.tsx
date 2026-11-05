import { notFound, permanentRedirect, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { loadTown, renderTownService, resolveTownChild } from '@/lib/sites/render-town';
import { withOpenGraph, getSiteOgImage } from '@/lib/sites/og-metadata';
import * as paths from '@/lib/routing/paths';

/**
 * v6 SILO PAGE — /service-areas/{city}/{service}/
 * Exists only under a PROMOTED town (one that has its own GBP). Under a plain
 * town the same URL sends visitors to the town page, which already lists every
 * service and links to the root pages.
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
  const canonicalUrl = `https://${domain}/service-areas/${city}/${child}`;
  const state = ctx.area.state || ctx.base.primaryLocation?.state;
  const label = state ? `${ctx.area.name}, ${state}` : ctx.area.name;
  return withOpenGraph({
    title: `${entry.name} in ${label} | ${site.name}`,
    description: `Professional ${entry.name.toLowerCase()} in ${ctx.area.name}. Contact ${site.name} for fast, reliable local service.`,
    alternates: { canonical: canonicalUrl },
  }, { url: canonicalUrl, siteName: site.name, logoUrl: getSiteOgImage(site.settings) });
}

export default async function TownServiceRoute({ params }: Props) {
  const { slug, city, child } = await params;
  const ctx = await loadTown(slug, city);
  if (!ctx) notFound();
  // The Primary Market's "silo" is the root service page itself.
  if (ctx === 'primary_market') redirect(`/${child}`);
  const entry = await resolveTownChild(ctx.base.site.id, child);
  if (!entry) notFound();
  // Plain town: no silo. Send to the town page (which links to the root page).
  if (!ctx.promoted || !ctx.hasPage) permanentRedirect(paths.townPage(city));
  const rendered = await renderTownService(ctx, slug, entry);
  if (!rendered) notFound();
  return rendered;
}
