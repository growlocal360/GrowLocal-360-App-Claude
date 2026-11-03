import { NextRequest, NextResponse } from 'next/server';

/** Human-readable status page Meta links users to after a data deletion request. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code') || '';
  const removed = req.nextUrl.searchParams.get('removed') || '0';
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Data deletion</title>
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:10vh auto;padding:0 16px;color:#111}code{background:#f3f4f6;padding:2px 6px;border-radius:4px}</style></head>
<body><h1>Facebook data deleted</h1>
<p>GrowLocal 360 removed the Facebook and Instagram connections tied to your account (${esc(removed)} connection${removed === '1' ? '' : 's'}). We keep no other Facebook data.</p>
<p>Confirmation code: <code>${esc(code)}</code></p>
<p>Questions: <a href="mailto:support@growlocal360.com">support@growlocal360.com</a></p></body></html>`;
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
