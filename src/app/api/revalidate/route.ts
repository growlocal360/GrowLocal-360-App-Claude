import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
  const token = request.headers.get('x-revalidate-token');

  if (!token || token !== process.env.REVALIDATE_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { paths } = body;

  if (!Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json(
      { error: 'paths must be a non-empty array' },
      { status: 400 }
    );
  }

  if (paths.length > 50) {
    return NextResponse.json(
      { error: 'Maximum 50 paths per request' },
      { status: 400 }
    );
  }

  for (const path of paths) {
    if (typeof path !== 'string' || !path.startsWith('/')) {
      return NextResponse.json(
        { error: `Invalid path: ${path}. Each path must be a string starting with "/"` },
        { status: 400 }
      );
    }
  }

  for (const path of paths) {
    revalidatePath(path);
  }

  return NextResponse.json({ revalidated: true, paths });
}
