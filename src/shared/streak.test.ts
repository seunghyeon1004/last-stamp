import { describe, expect, it } from 'vitest';
import { liveStreak, nextStreak } from './streak';

describe('streaks', () => {
  it('starts at 1, grows on consecutive days, resets after a gap', () => {
    expect(nextStreak({ streak: 0, last: null }, '2026-12-01')).toBe(1);
    expect(nextStreak({ streak: 1, last: '2026-12-01' }, '2026-12-02')).toBe(2);
    expect(nextStreak({ streak: 2, last: '2026-12-02' }, '2026-12-02')).toBe(2);
    expect(nextStreak({ streak: 5, last: '2026-12-02' }, '2026-12-04')).toBe(1);
    expect(nextStreak({ streak: 9, last: '2026-12-31' }, '2027-01-01')).toBe(10);
  });
  it('shows a broken streak as 0 but keeps yesterday alive', () => {
    expect(liveStreak({ streak: 4, last: '2026-12-02' }, '2026-12-03')).toBe(4);
    expect(liveStreak({ streak: 4, last: '2026-12-03' }, '2026-12-03')).toBe(4);
    expect(liveStreak({ streak: 4, last: '2026-12-01' }, '2026-12-03')).toBe(0);
    expect(liveStreak({ streak: 0, last: null }, '2026-12-03')).toBe(0);
  });
});
