import type { Metadata } from 'next';
import { getAllSiteSlugs } from '@/lib/sites/get-site';
import { legalMetadata, renderLegalPage } from '@/lib/sites/render-legal-page';

export const revalidate = 60;

export async function generateStaticParams() {
  const slugs = await getAllSiteSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return legalMetadata(slug, 'privacy');
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderLegalPage(slug, 'privacy');
}
