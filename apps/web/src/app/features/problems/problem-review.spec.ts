import { formatLocalDate } from './problem-review';

describe('formatLocalDate', () => {
  it('formats and pads local calendar components as YYYY-MM-DD', () => {
    expect(
      formatLocalDate({
        getFullYear: () => 2026,
        getMonth: () => 0,
        getDate: () => 5,
      }),
    ).toBe('2026-01-05');
  });

  it('uses local getters when the local and UTC calendar dates differ', () => {
    const dateAcrossUtcBoundary = {
      getFullYear: () => 2025,
      getMonth: () => 11,
      getDate: () => 31,
      toISOString: () => '2026-01-01T02:30:00.000Z',
    };

    expect(formatLocalDate(dateAcrossUtcBoundary)).toBe('2025-12-31');
    expect(dateAcrossUtcBoundary.toISOString().slice(0, 10)).toBe('2026-01-01');
  });
});
