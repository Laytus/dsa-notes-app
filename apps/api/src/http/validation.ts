export interface NameBody {
  readonly name: string;
}

export const nameBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name'],
  properties: {
    name: { type: 'string', pattern: '\\S' },
  },
} as const;

export const idParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: { type: 'string' },
  },
} as const;

export function normalizeName(name: string): string {
  return name.trim();
}

export function parseId(id: string): bigint {
  if (!/^[1-9][0-9]*$/u.test(id)) {
    throw new Error('ID must be a canonical positive decimal integer.');
  }

  const parsed = BigInt(id);
  if (parsed > 9_223_372_036_854_775_807n) {
    throw new Error('ID exceeds the PostgreSQL bigint range.');
  }

  return parsed;
}
