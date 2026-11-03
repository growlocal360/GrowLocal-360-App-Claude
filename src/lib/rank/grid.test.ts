import { describe, it, expect } from 'vitest';
import { buildGrid, cleanKeyword, defaultKeywords, summarize, findRank, rankTone, fitZoom, mapPercent } from './grid';
import { analyzeAnswer, visibilityPrompts } from './ai-visibility';

describe('rank grid', () => {
  it('builds a centred square grid at the requested spacing', () => {
    const g = buildGrid(27.3364, -82.5307, 5, 1);
    expect(g).toHaveLength(25);
    const centre = g.find((p) => p.row === 2 && p.col === 2)!;
    expect(centre.lat).toBeCloseTo(27.3364, 5);
    expect(centre.lng).toBeCloseTo(-82.5307, 5);
    const north = g.find((p) => p.row === 0 && p.col === 2)!;
    expect((north.lat - centre.lat) * 69).toBeCloseTo(2, 1); // 2 miles north
  });

  it('turns category and service names into search phrases', () => {
    expect(cleanKeyword('Appliance repair service')).toBe('appliance repair');
    expect(defaultKeywords('Appliance repair service', ['Refrigerator Repair Service', 'Washing Machine Repair', 'Dryer Repair Service', 'Dishwasher Repair Service', 'Oven & Range Repair', 'Microwave Repair Service']))
      .toEqual(['appliance repair', 'refrigerator repair', 'washing machine repair', 'dryer repair', 'dishwasher repair']);
  });

  it('summarizes ranks into visibility', () => {
    const pts = [1, 2, 3, 8, 15, null, null, null, null].map((rank, i) => ({ row: 0, col: i, lat: 0, lng: 0, rank }));
    const s = summarize(pts);
    expect(s).toMatchObject({ totalPoints: 9, foundPoints: 5, top3Points: 3, top10Points: 4, averageRank: 5.8 });
    expect(s.visibility).toBeGreaterThan(30);
    expect(rankTone(2)).toBe('top3'); expect(rankTone(null)).toBe('none');
  });

  it('finds the business by place id, then by tolerant title', () => {
    const items = [
      { type: 'maps_paid_item', rank_group: 1, place_id: 'X', title: 'Ad Co' },
      { type: 'maps_search', rank_group: 1, place_id: 'A', title: 'Other Appliance Repair' },
      { type: 'maps_search', rank_group: 2, place_id: 'B', title: 'Fix It or Free Appliance Repair LLC' },
    ];
    expect(findRank(items, 'B', 'Fix It or Free Appliance Repair')).toBe(2);
    expect(findRank(items, null, 'Fix It or Free Appliance Repair')).toBe(2);
    expect(findRank(items, 'Z', 'Nope Plumbing')).toBeNull();
  });
});

describe('ai visibility', () => {
  it('detects a mention and its list position, and collects competitors', () => {
    const answer = `Here are some options:\n1. **Sarasota Appliance Pros** - solid reviews\n2. **Fix It or Free Appliance Repair** - same-day service\n3. Gulf Coast Appliance - established`;
    const a = analyzeAnswer(answer, 'Fix It or Free Appliance Repair');
    expect(a.mentioned).toBe(true);
    expect(a.position).toBe(2);
    expect(a.competitors).toEqual(['Sarasota Appliance Pros', 'Gulf Coast Appliance']);
    expect(analyzeAnswer('I cannot recommend specific businesses.', 'Fix It or Free Appliance Repair').mentioned).toBe(false);
  });
  it('treats directory advice as a declined answer, not competitors', () => {
    const refusal = `I don't have reliable local data.\n\n**Here's what I'd suggest for finding accurate results:**\n- Google Maps\n- Yelp\n- Angi\n- BBB\n- Nextdoor`;
    const a = analyzeAnswer(refusal, 'Fix It or Free Appliance Repair');
    expect(a.answered).toBe(false);
    expect(a.competitors).toEqual([]);
  });
  it('builds customer-style prompts', () => {
    const p = visibilityPrompts('Appliance repair service', 'Sarasota', 'FL');
    expect(p).toHaveLength(3);
    expect(p[0]).toContain('appliance repair');
    expect(p[0]).toContain('Sarasota, FL');
  });
});


describe('map overlay helpers', () => {
  const grid = buildGrid(27.302749, -82.5225185, 7, 1);
  it('fits a 7x7 1-mile grid on a 400px map at a sensible zoom', () => {
    const z = fitZoom(grid, 400);
    expect(z).toBeGreaterThanOrEqual(10);
    expect(z).toBeLessThanOrEqual(13);
  });
  it('places the centre point at 50%/50% and keeps every point inside the map', () => {
    const z = fitZoom(grid, 400);
    const c = mapPercent(27.302749, -82.5225185, 27.302749, -82.5225185, z, 400);
    expect(c.left).toBeCloseTo(50, 5);
    expect(c.top).toBeCloseTo(50, 5);
    for (const p of grid) {
      const pos = mapPercent(p.lat, p.lng, 27.302749, -82.5225185, z, 400);
      expect(pos.left).toBeGreaterThan(5); expect(pos.left).toBeLessThan(95);
      expect(pos.top).toBeGreaterThan(5); expect(pos.top).toBeLessThan(95);
    }
    // North-west corner is up and left of the centre.
    const nw = mapPercent(grid[0].lat, grid[0].lng, 27.302749, -82.5225185, z, 400);
    expect(nw.left).toBeLessThan(50); expect(nw.top).toBeLessThan(50);
  });
});

describe('analyzeAnswer on search-grounded answers', () => {
  it('reads ChatGPT bold markdown links and Claude numbered bold entries', () => {
    const chatgpt = `If you're seeking graphic design services, here are several local businesses:\n\n**[Graphic Works](https://www.google.com/maps/search/Graphic+Works?utm_source=openai)**\n_Lake Charles, LA_\nA full-service design shop.\n\n**[The Lab Design Group](https://maps.google.com/x)**\n_Lake Charles, LA_\nA creative agency.\n\n**[FASTSIGNS® of Lake Charles, LA](https://maps.google.com/y)**\nSignage.`;
    const a = analyzeAnswer(chatgpt, 'Graphic Works Advertising & Design Shop');
    expect(a.mentioned).toBe(true);
    expect(a.position).toBe(1);
    expect(a.answered).toBe(true);
    expect(a.competitors).toEqual(['The Lab Design Group', 'FASTSIGNS of Lake Charles, LA']);

    const claude = `### 🎨 Top Graphic Design Companies\n\n1. **Graphic Works Advertising & Design Shop**\n   - 📍 318 Pujo St\n2. **Parker Brand Creative Services**\n   - 🌐 parkerbrandcreative.com\n3. **The Lab Design Group, LLC**\n   - 📞 (337) 214-4357`;
    const b = analyzeAnswer(claude, 'Graphic Works Advertising & Design Shop');
    expect(b.position).toBe(1);
    expect(b.competitors).toEqual(['Parker Brand Creative Services', 'The Lab Design Group, LLC']);
  });
  it('does not count directories or advice as competitors', () => {
    const txt = `I can't name specific businesses. Try:\n- LinkedIn\n- Clutch.co\n- Lake Charles/Southwest Louisiana Chamber of Commerce\n- Businesses that have closed\n- Portfolio relevant to your industry`;
    const a = analyzeAnswer(txt, 'Graphic Works');
    expect(a.answered).toBe(false);
    expect(a.competitors).toEqual([]);
  });
});

describe('Google AI Mode cards', () => {
  it('reads "Name 5.0 (87)" business cards into a ranked list', async () => {
    const { analyzeAnswer: analyze } = await import('./ai-visibility');
    const md = `Several top-rated local agencies stand out.\n\n![](https://cdn/x)\nGraphic Works 5.0 (87)  \nGraphic designer\nClosed 318 Pujo St 0.1 mi\n![](https://cdn/y)\nHoneywave Creative 5.0 (135)  \nWebsite designer\nThe Lab Design Group 4.9 (21)  \n`;
    const cards: string[] = [];
    for (const line of md.split('\n')) {
      const m = line.trim().match(/^(?:\*\*)?([A-Za-z0-9][^|*]{1,70}?)(?:\*\*)?\s+([1-5]\.\d)\s*\((\d[\d,]*)\)/);
      if (m && !cards.includes(m[1].trim())) cards.push(m[1].trim());
    }
    expect(cards).toEqual(['Graphic Works', 'Honeywave Creative', 'The Lab Design Group']);
    const a = analyze(cards.map((c, i) => `${i + 1}. ${c}`).join('\n') + '\n\n' + md, 'Graphic Works Advertising & Design Shop');
    expect(a.mentioned).toBe(true);
    expect(a.position).toBe(1);
    expect(a.competitors).toEqual(['Honeywave Creative', 'The Lab Design Group']);
  });
});
