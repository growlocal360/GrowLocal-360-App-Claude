import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
  const token = request.headers.get('x-revalidate-token');

  if (!token || token !== process.env.REVALIDATE_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { siteSlug, slug, relatedPaths } = body;

  if (!siteSlug || typeof siteSlug !== 'string') {
    return NextResponse.json(
      { error: 'siteSlug is required' },
      { status: 400 }
    );
  }

  if (!slug || typeof slug !== 'string') {
    return NextResponse.json(
      { error: 'slug is required' },
      { status: 400 }
    );
  }

  // Build the paths to revalidate
  const pathsToRevalidate = [
    `/sites/${siteSlug}/work`,
    `/sites/${siteSlug}/work/${slug}`,
  ];

  // Add any related paths (e.g., multi-location variants)
  if (Array.isArray(relatedPaths)) {
    for (const path of relatedPaths) {
      if (typeof path === 'string' && path.startsWith('/')) {
        pathsToRevalidate.push(path);
      }
    }
  }

  for (const path of pathsToRevalidate) {
    revalidatePath(path);
  }

  return NextResponse.json({ revalidated: true, paths: pathsToRevalidate });
}
