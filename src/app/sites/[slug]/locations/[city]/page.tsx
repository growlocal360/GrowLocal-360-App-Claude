import { notFound, redirect, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { loadTown, renderTownPage, canonicalTownPath } from '@/lib/sites/render-town';
import { withOpenGraph, getSiteOgImage } from '@/lib/sites/og-metadata';

/**
 * v6.1 LOCATION PAGE — /locations/{city}/
 * A town / branch WITH its own Google Business Profile: that listing's landing
 * page. Full main service list linking into the location's silo, the branch's
 * own contact details, reviews and job snaps. A town WITHOUT a GBP lives at
 * /service-areas/{city}/ and 301s there; the Primary Market goes home.
 */

export const revalidate = 60;

interface Props { params: Promise<{ slug: string; city: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, city } = await params;
  const ctx = await loadTown(slug, city);
  if (!ctx || ctx === 'primary_market' || !ctx.promoted) return { title: 'Page Not Found' };
  const { site } = ctx.base;
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'growlocal360.com';
  const domain = (site.custom_domain_verified && site.custom_domain) ? site.custom_domain : `${slug}.${appDomain}`;
  const canonicalUrl = `https://${domain}/locations/${city}`;
  const state = ctx.area.state || ctx.base.primaryLocation?.state;
  const label = state ? `${ctx.area.name}, ${state}` : ctx.area.name;
  return withOpenGraph({
    title: ctx.area.meta_title || `${ctx.primaryCategoryName} in ${label} | ${site.name}`,
    description: ctx.area.meta_description || `${site.name} in ${ctx.area.name}: ${ctx.primaryCategoryName.toLowerCase()} from our local team. See every service we offer in ${ctx.area.name} and book online or call.`,
    alternates: { canonical: canonicalUrl },
  }, { url: canonicalUrl, siteName: site.name, logoUrl: getSiteOgImage(site.settings) });
}

export default async function LocationPageRoute({ params }: Props) {
  const { slug, city } = await params;
  const ctx = await loadTown(slug, city);
  if (!ctx) notFound();
  if (ctx === 'primary_market') redirect('/');
  if (!ctx.promoted) {
    if (!ctx.hasPage) notFound();
    permanentRedirect(canonicalTownPath(ctx));
  }
  const rendered = await renderTownPage(ctx, slug);
  if (!rendered) notFound();
  return rendered;
}
