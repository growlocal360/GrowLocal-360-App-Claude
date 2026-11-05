import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { loadTown, renderTownPage } from '@/lib/sites/render-town';
import { withOpenGraph, getSiteOgImage } from '@/lib/sites/og-metadata';

/**
 * v6 TOWN PAGE — /service-areas/{city}/
 * One page per served town, listing the full main service list. The Primary
 * Market redirects to the home page (its page IS the home page). Towns the
 * plan left as text-only 404 here so thin pages never render.
 */

export const revalidate = 60;

interface Props { params: Promise<{ slug: string; city: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, city } = await params;
  const ctx = await loadTown(slug, city);
  if (!ctx || ctx === 'primary_market' || !ctx.hasPage) return { title: 'Page Not Found' };
  const { site } = ctx.base;
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'growlocal360.com';
  const domain = (site.custom_domain_verified && site.custom_domain) ? site.custom_domain : `${slug}.${appDomain}`;
  const canonicalUrl = `https://${domain}/service-areas/${city}`;
  const state = ctx.area.state || ctx.base.primaryLocation?.state;
  const label = state ? `${ctx.area.name}, ${state}` : ctx.area.name;
  return withOpenGraph({
    title: ctx.area.meta_title || `${ctx.primaryCategoryName} in ${label} | ${site.name}`,
    description: ctx.area.meta_description || `${site.name} provides ${ctx.primaryCategoryName.toLowerCase()} in ${ctx.area.name}. See every service we offer in ${ctx.area.name} and book online or call.`,
    alternates: { canonical: canonicalUrl },
  }, { url: canonicalUrl, siteName: site.name, logoUrl: getSiteOgImage(site.settings) });
}

export default async function TownPageRoute({ params }: Props) {
  const { slug, city } = await params;
  const ctx = await loadTown(slug, city);
  if (!ctx) notFound();
  if (ctx === 'primary_market') redirect('/');
  if (!ctx.hasPage) notFound();
  const rendered = await renderTownPage(ctx, slug);
  if (!rendered) notFound();
  return rendered;
}
