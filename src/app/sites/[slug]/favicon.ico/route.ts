import { siteIconResponse } from '@/lib/sites/site-icon';

export const revalidate = 3600;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return siteIconResponse(slug, 96);
}
