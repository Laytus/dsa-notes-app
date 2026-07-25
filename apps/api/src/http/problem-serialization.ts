import { asc, eq, inArray, sql } from 'drizzle-orm';
import {
  categories,
  problemTags,
  problems,
  tags,
  type Database,
} from '../db/index.js';
import type { Difficulty, Status } from './problem-validation.js';

type QueryDatabase = Pick<Database, 'select'>;

interface ProblemRow {
  readonly id: bigint;
  readonly name: string;
  readonly categoryId: bigint;
  readonly categoryName: string;
  readonly difficulty: Difficulty | null;
  readonly status: Status;
  readonly lastReviewedOn: string | null;
  readonly timesSolved: number;
  readonly solutionUrl: string | null;
  readonly solutionLabel: string | null;
  readonly sourceUrl: string | null;
  readonly sourceLabel: string | null;
  readonly notes: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface TagRow {
  readonly problemId: bigint;
  readonly id: bigint;
  readonly name: string;
}

export interface ProblemResource {
  readonly id: string;
  readonly name: string;
  readonly category: { readonly id: string; readonly name: string };
  readonly difficulty: Difficulty | null;
  readonly status: Status;
  readonly tags: readonly { readonly id: string; readonly name: string }[];
  readonly solution: {
    readonly url: string;
    readonly label: string;
  } | null;
  readonly source: {
    readonly url: string;
    readonly label: string;
  } | null;
  readonly notes: string;
  readonly timesSolved: number;
  readonly lastReviewedOn: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function serializeLink(
  url: string | null,
  label: string | null,
): { readonly url: string; readonly label: string } | null {
  return url !== null && label !== null ? { url, label } : null;
}

export function serializeProblem(
  row: ProblemRow,
  problemTagsRows: readonly TagRow[],
): ProblemResource {
  return {
    id: row.id.toString(),
    name: row.name,
    category: {
      id: row.categoryId.toString(),
      name: row.categoryName,
    },
    difficulty: row.difficulty,
    status: row.status,
    tags: problemTagsRows.map((tag) => ({
      id: tag.id.toString(),
      name: tag.name,
    })),
    solution: serializeLink(row.solutionUrl, row.solutionLabel),
    source: serializeLink(row.sourceUrl, row.sourceLabel),
    notes: row.notes,
    timesSolved: row.timesSolved,
    lastReviewedOn: row.lastReviewedOn,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function loadProblems(
  database: QueryDatabase,
  ids?: readonly bigint[],
): Promise<ProblemResource[]> {
  if (ids?.length === 0) return [];

  const baseQuery = database
    .select({
      id: problems.id,
      name: problems.name,
      categoryId: categories.id,
      categoryName: categories.name,
      difficulty: problems.difficulty,
      status: problems.status,
      lastReviewedOn: problems.lastReviewedOn,
      timesSolved: problems.timesSolved,
      solutionUrl: problems.solutionUrl,
      solutionLabel: problems.solutionLabel,
      sourceUrl: problems.sourceUrl,
      sourceLabel: problems.sourceLabel,
      notes: problems.notes,
      createdAt: problems.createdAt,
      updatedAt: problems.updatedAt,
    })
    .from(problems)
    .innerJoin(categories, eq(problems.categoryId, categories.id));

  const problemRows =
    ids === undefined
      ? await baseQuery.orderBy(
          asc(sql`lower(${problems.name})`),
          asc(problems.id),
        )
      : await baseQuery
          .where(inArray(problems.id, [...ids]))
          .orderBy(asc(sql`lower(${problems.name})`), asc(problems.id));

  if (problemRows.length === 0) return [];

  const loadedIds = problemRows.map(({ id }) => id);
  const tagRows = await database
    .select({
      problemId: problemTags.problemId,
      id: tags.id,
      name: tags.name,
    })
    .from(problemTags)
    .innerJoin(tags, eq(problemTags.tagId, tags.id))
    .where(inArray(problemTags.problemId, loadedIds))
    .orderBy(
      asc(problemTags.problemId),
      asc(sql`lower(${tags.name})`),
      asc(tags.id),
    );

  const tagsByProblem = new Map<string, TagRow[]>();
  for (const tag of tagRows) {
    const key = tag.problemId.toString();
    const grouped = tagsByProblem.get(key);
    if (grouped) grouped.push(tag);
    else tagsByProblem.set(key, [tag]);
  }

  return problemRows.map((row) =>
    serializeProblem(row, tagsByProblem.get(row.id.toString()) ?? []),
  );
}
