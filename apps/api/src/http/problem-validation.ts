import { parseId } from './validation.js';

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;
export const STATUSES = [
  'To solve',
  'Attempted',
  'Solved',
  'Needs review',
  'Mastered',
] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];
export type Status = (typeof STATUSES)[number];

interface LinkInput {
  readonly url: string;
  readonly label: string;
}

export interface ProblemInput {
  readonly name?: string;
  readonly categoryId?: bigint;
  readonly difficulty?: Difficulty | null;
  readonly status?: Status;
  readonly tagIds?: readonly bigint[];
  readonly solution?: LinkInput | null;
  readonly source?: LinkInput | null;
  readonly notes?: string;
  readonly timesSolved?: number;
  readonly lastReviewedOn?: string | null;
}

export interface ProblemRequestError {
  readonly code: string;
  readonly message: string;
}

export type ProblemRequestResult =
  | { readonly ok: true; readonly value: ProblemInput }
  | { readonly ok: false; readonly error: ProblemRequestError };

const linkObjectSchema = {
  type: ['object', 'null'],
  additionalProperties: false,
  properties: {
    url: {},
    label: {},
  },
} as const;

const problemProperties = {
  name: {},
  categoryId: {},
  difficulty: {},
  status: {},
  tagIds: {},
  solution: linkObjectSchema,
  source: linkObjectSchema,
  notes: {},
  timesSolved: {},
  lastReviewedOn: {},
} as const;

export const createProblemBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'categoryId'],
  properties: problemProperties,
} as const;

export const updateProblemBodySchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: problemProperties,
} as const;

function failure(code: string, message: string): ProblemRequestResult {
  return { ok: false, error: { code, message } };
}

function parseCanonicalId(
  value: unknown,
  code: string,
  message: string,
): bigint | ProblemRequestError {
  if (typeof value !== 'string') {
    return { code, message };
  }

  try {
    return parseId(value);
  } catch {
    return { code, message };
  }
}

export function parseStrictDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;

  const daysByMonth = [
    31,
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return day <= (daysByMonth[month - 1] ?? 0) ? value : null;
}

export function normalizeLink(
  value: unknown,
  defaultLabel: string,
): LinkInput | null | ProblemRequestError {
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    return {
      code: 'INVALID_URL',
      message: 'Links must be null or contain a valid URL.',
    };
  }

  const link = value as { readonly url?: unknown; readonly label?: unknown };
  if (typeof link.url !== 'string' || !link.url.trim()) {
    return {
      code: 'INVALID_URL',
      message: 'Link URLs must be nonempty absolute HTTP or HTTPS URLs.',
    };
  }

  const url = link.url.trim();
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        code: 'INVALID_URL',
        message: 'Link URLs must use HTTP or HTTPS.',
      };
    }
  } catch {
    return {
      code: 'INVALID_URL',
      message: 'Link URLs must be valid absolute URLs.',
    };
  }

  if (link.label !== undefined && typeof link.label !== 'string') {
    return {
      code: 'INVALID_LINK_LABEL',
      message: 'Link labels must be nonempty strings.',
    };
  }

  const label =
    link.label === undefined ? defaultLabel : (link.label as string).trim();
  if (!label) {
    return {
      code: 'INVALID_LINK_LABEL',
      message: 'Link labels must be nonempty strings.',
    };
  }

  return { url, label };
}

export function parseProblemBody(
  body: Record<string, unknown>,
  mode: 'create' | 'update',
): ProblemRequestResult {
  const result: {
    -readonly [Key in keyof ProblemInput]?: ProblemInput[Key];
  } = {};

  if ('name' in body) {
    if (typeof body['name'] !== 'string' || !body['name'].trim()) {
      return failure('INVALID_PROBLEM_NAME', 'Problem name is required.');
    }
    result.name = body['name'].trim();
  } else if (mode === 'create') {
    return failure('INVALID_PROBLEM_BODY', 'Problem name is required.');
  }

  if ('categoryId' in body) {
    const categoryId = parseCanonicalId(
      body['categoryId'],
      'INVALID_CATEGORY_ID',
      'The category ID is invalid.',
    );
    if (typeof categoryId !== 'bigint') {
      return { ok: false, error: categoryId };
    }
    result.categoryId = categoryId;
  } else if (mode === 'create') {
    return failure('INVALID_PROBLEM_BODY', 'Category is required.');
  }

  if ('difficulty' in body) {
    const difficulty = body['difficulty'];
    if (
      difficulty !== null &&
      (typeof difficulty !== 'string' ||
        !DIFFICULTIES.includes(difficulty as Difficulty))
    ) {
      return failure(
        'INVALID_DIFFICULTY',
        'Difficulty must be Easy, Medium, Hard, or null.',
      );
    }
    result.difficulty = difficulty as Difficulty | null;
  }

  if ('status' in body) {
    const status = body['status'];
    if (
      typeof status !== 'string' ||
      !STATUSES.includes(status as Status)
    ) {
      return failure('INVALID_STATUS', 'Status is invalid.');
    }
    result.status = status as Status;
  }

  if ('tagIds' in body) {
    if (!Array.isArray(body['tagIds'])) {
      return failure('INVALID_TAG_ID', 'Tag IDs must be an array of valid IDs.');
    }

    const parsedTagIds: bigint[] = [];
    const seen = new Set<string>();
    for (const tagIdValue of body['tagIds']) {
      const tagId = parseCanonicalId(
        tagIdValue,
        'INVALID_TAG_ID',
        'A tag ID is invalid.',
      );
      if (typeof tagId !== 'bigint') {
        return { ok: false, error: tagId };
      }
      const key = tagId.toString();
      if (seen.has(key)) {
        return failure(
          'DUPLICATE_TAG_IDS',
          'Duplicate tag IDs are not allowed.',
        );
      }
      seen.add(key);
      parsedTagIds.push(tagId);
    }
    result.tagIds = parsedTagIds;
  }

  for (const [field, defaultLabel] of [
    ['solution', 'View solution'],
    ['source', 'LeetCode'],
  ] as const) {
    if (field in body) {
      const link = normalizeLink(body[field], defaultLabel);
      if (
        link !== null &&
        'code' in link
      ) {
        return { ok: false, error: link };
      }
      result[field] = link;
    }
  }

  if ('notes' in body) {
    if (typeof body['notes'] !== 'string') {
      return failure('INVALID_NOTES', 'Notes must be a string.');
    }
    result.notes = body['notes'];
  }

  if ('timesSolved' in body) {
    const timesSolved = body['timesSolved'];
    if (
      typeof timesSolved !== 'number' ||
      !Number.isInteger(timesSolved) ||
      timesSolved < 0 ||
      timesSolved > 2_147_483_647
    ) {
      return failure(
        'INVALID_TIMES_SOLVED',
        'Times solved must be a nonnegative PostgreSQL integer.',
      );
    }
    result.timesSolved = timesSolved;
  }

  if ('lastReviewedOn' in body) {
    const date = body['lastReviewedOn'];
    if (date !== null) {
      if (typeof date !== 'string' || parseStrictDate(date) === null) {
        return failure(
          'INVALID_LAST_REVIEWED_ON',
          'Last reviewed must be null or a valid YYYY-MM-DD date.',
        );
      }
    }
    result.lastReviewedOn = date as string | null;
  }

  return { ok: true, value: result };
}
