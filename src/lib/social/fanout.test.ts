import { describe, it, expect } from 'vitest';
import { instagramCaption, orderSnapImages, socialSettings } from './fanout';
import { fitForInstagram } from './image';
import sharp from 'sharp';

describe('socialSettings', () => {
  it('defaults both triggers on', () => {
    expect(socialSettings(null)).toEqual({ snaps: true, gbpPosts: true });
    expect(socialSettings({ automation: { social: { snaps: false } } } as never)).toEqual({ snaps: false, gbpPosts: true });
    expect(socialSettings({ automation: { social: { gbp_posts: false } } } as never)).toEqual({ snaps: true, gbpPosts: false });
  });
});

describe('instagramCaption', () => {
  it('appends the bare domain since links are not clickable', () => {
    expect(instagramCaption('Fixed a leaking faucet.', 'https://www.example.com/work/faucet')).toBe('Fixed a leaking faucet.\n\nMore at example.com');
  });
  it('leaves the caption alone without a usable link', () => {
    expect(instagramCaption('Hello', 'not a url')).toBe('Hello');
  });
});

describe('orderSnapImages', () => {
  it('leads with the after photo, keeps before photos, caps at four', () => {
    const media = [
      { id: 'b', role: 'before', sort_order: 0 },
      { id: 'p', role: 'process', sort_order: 1 },
      { id: 'a', role: 'after', sort_order: 2 },
      { id: 'd1', role: 'detail', sort_order: 3 },
      { id: 'd2', role: 'detail', sort_order: 4 },
    ];
    expect(orderSnapImages(media).map((m) => m.id)).toEqual(['a', 'b', 'p', 'd1']);
  });
  it('falls back to primary, then first', () => {
    expect(orderSnapImages([{ id: 'x', role: 'detail', sort_order: 1 }, { id: 'y', role: 'primary', sort_order: 2 }]).map((m) => m.id)).toEqual(['y', 'x']);
    expect(orderSnapImages([{ id: 'x', role: null, sort_order: 1 }]).map((m) => m.id)).toEqual(['x']);
    expect(orderSnapImages([])).toEqual([]);
  });
});

describe('fitForInstagram', () => {
  const ratio = async (buf: Buffer) => { const m = await sharp(buf).metadata(); return (m.width || 0) / (m.height || 1); };
  it('crops a 9:16 phone photo to 4:5', async () => {
    const tall = await sharp({ create: { width: 900, height: 1600, channels: 3, background: '#888' } }).png().toBuffer();
    const out = await fitForInstagram(tall);
    expect(await ratio(out)).toBeCloseTo(0.8, 2);
    expect((await sharp(out).metadata()).format).toBe('jpeg');
  });
  it('crops a panorama to 1.91:1 and leaves a square alone', async () => {
    const wide = await sharp({ create: { width: 3000, height: 1000, channels: 3, background: '#888' } }).png().toBuffer();
    expect(await ratio(await fitForInstagram(wide))).toBeCloseTo(1.91, 2);
    const square = await sharp({ create: { width: 1200, height: 1200, channels: 3, background: '#888' } }).png().toBuffer();
    expect(await ratio(await fitForInstagram(square))).toBeCloseTo(1, 2);
  });
});
