import { describe, expect, it } from 'vitest';
import { runPerformanceVerification } from './1000-problems.verification';

describe('1,000-problem local performance verification', () => {
  it('records representative operation timings without imposing machine-sensitive timing gates', () => {
    const measurements = runPerformanceVerification();

    for (const measurement of measurements) {
      console.info(
        `${measurement.operation}: ${measurement.medianMs.toFixed(3)} ms (${measurement.resultCount} rows)`,
      );
    }

    expect(measurements).toHaveLength(13);
    expect(measurements.every(({ medianMs }) => Number.isFinite(medianMs))).toBe(true);
  });
});
