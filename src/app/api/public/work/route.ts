import { NextResponse } from 'next/server';
import { getPublishedWorkItems, getPublishedWorkItemsCount } from '@/lib/sites/get-work-items';
import { toPublicWorkItem } from '@/lib/sites/public-render-model';

/**
 * GET /api/public/work?siteId=xxx&offset=12&limit=12
 *
 * Public endpoint for paginated work items. No auth required — only returns
 * published work_items which are already public on the website.
 *
 * Returns: { items: PublicRenderWorkItem[], hasMore: boolean }
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');

  if (!siteId) {
    return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
  }

  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0);
  const limit = Math.min(24, Math.max(1, parseInt(searchParams.get('limit') ?? '12', 10) || 12));

  const [items, total] = await Promise.all([
    getPublishedWorkItems(siteId, { offset, limit }),
    getPublishedWorkItemsCount(siteId),
  ]);

  return NextResponse.json({
    items: items.map(toPublicWorkItem),
    hasMore: offset + items.length < total,
  });
}
