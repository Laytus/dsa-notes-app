import { describe, expect, it } from 'vitest';
import { requireSafeTestDatabaseUrl } from '../verification/persistence-restart.js';

describe('persistence verification database safety', () => {
  it('accepts only a canonical test-database URL', () => {
    expect(requireSafeTestDatabaseUrl('postgresql://user:pass@localhost:5432/dsa_notes_test')).toBeInstanceOf(URL);
  });

  it.each([
    'postgresql://user:pass@localhost:5432/dsa_notes',
    'postgresql://user:pass@localhost:5432/dsa-notes-test',
  ])('rejects unsafe test database URL %s', (url) => {
    expect(() => requireSafeTestDatabaseUrl(url)).toThrow();
  });
});
