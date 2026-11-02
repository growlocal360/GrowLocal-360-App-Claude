import { describe, it, expect } from 'vitest';
import { buildGrid, cleanKeyword, defaultKeywords, summarize, findRank, rankTone } from './grid';
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
  it('builds customer-style prompts', () => {
    const p = visibilityPrompts('Appliance repair service', 'Sarasota', 'FL');
    expect(p).toHaveLength(3);
    expect(p[0]).toContain('appliance repair');
    expect(p[0]).toContain('Sarasota, FL');
  });
});
