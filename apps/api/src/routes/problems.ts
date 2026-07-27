import { eq, inArray } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  categories,
  problemTags,
  problems,
  tags,
  type Database,
} from '../db/index.js';
import {
  apiError,
  isPostgreSqlConstraintError,
} from '../http/errors.js';
import {
  loadProblems,
  type ProblemResource,
} from '../http/problem-serialization.js';
import {
  createProblemBodySchema,
  parseProblemBody,
  updateProblemBodySchema,
  type ProblemInput,
  type ProblemRequestError,
} from '../http/problem-validation.js';
import {
  formatServerCalendarDate,
  type ServerDateSource,
} from '../http/server-date.js';
import { idParamsSchema, parseId } from '../http/validation.js';

interface ItemParams {
  readonly id: string;
}

type ProblemBody = Record<string, unknown>;
type ResolveDatabase = () => Database;

class ProblemRouteError extends Error {
  constructor(
    readonly statusCode: 400 | 404,
    readonly apiError: ProblemRequestError,
  ) {
    super(apiError.message);
  }
}

function sendProblemError(
  reply: FastifyReply,
  statusCode: number,
  error: ProblemRequestError,
) {
  return reply.status(statusCode).send(apiError(error.code, error.message));
}

function parseProblemId(id: string): bigint | null {
  try {
    return parseId(id);
  } catch {
    return null;
  }
}

export function duplicateProblemName(name: string): string {
  return `${name} Copy`;
}

async function verifyReferences(
  database: Pick<Database, 'select'>,
  input: ProblemInput,
): Promise<void> {
  if (input.categoryId !== undefined) {
    const [category] = await database
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, input.categoryId));
    if (!category) {
      throw new ProblemRouteError(400, {
        code: 'CATEGORY_REFERENCE_NOT_FOUND',
        message: 'The selected category does not exist.',
      });
    }
  }

  if (input.tagIds !== undefined && input.tagIds.length > 0) {
    const found = await database
      .select({ id: tags.id })
      .from(tags)
      .where(inArray(tags.id, [...input.tagIds]));
    if (found.length !== input.tagIds.length) {
      throw new ProblemRouteError(400, {
        code: 'TAG_REFERENCE_NOT_FOUND',
        message: 'One or more selected tags do not exist.',
      });
    }
  }
}

async function loadProblemOrThrow(
  database: Pick<Database, 'select'>,
  id: bigint,
): Promise<ProblemResource> {
  const [resource] = await loadProblems(database, [id]);
  if (!resource) {
    throw new ProblemRouteError(404, {
      code: 'PROBLEM_NOT_FOUND',
      message: 'Problem not found.',
    });
  }
  return resource;
}

function mapKnownReferenceError(error: unknown): ProblemRouteError | null {
  if (
    isPostgreSqlConstraintError(
      error,
      '23503',
      'problems_category_id_categories_id_fk',
    )
  ) {
    return new ProblemRouteError(400, {
      code: 'CATEGORY_REFERENCE_NOT_FOUND',
      message: 'The selected category does not exist.',
    });
  }

  if (
    isPostgreSqlConstraintError(
      error,
      '23503',
      'problem_tags_tag_id_tags_id_fk',
    )
  ) {
    return new ProblemRouteError(400, {
      code: 'TAG_REFERENCE_NOT_FOUND',
      message: 'One or more selected tags do not exist.',
    });
  }

  return null;
}

function handleRouteError(error: unknown, reply: FastifyReply) {
  const mapped =
    error instanceof ProblemRouteError ? error : mapKnownReferenceError(error);
  if (!mapped) throw error;
  return sendProblemError(reply, mapped.statusCode, mapped.apiError);
}

export function registerProblemRoutes(
  app: FastifyInstance,
  resolveDatabase: ResolveDatabase,
  currentDate: ServerDateSource,
): void {
  app.get('/api/problems', async () => loadProblems(resolveDatabase()));

  app.get<{ Params: ItemParams }>(
    '/api/problems/:id',
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      const id = parseProblemId(request.params.id);
      if (id === null) {
        return reply
          .status(400)
          .send(apiError('INVALID_ID', 'The problem ID is invalid.'));
      }

      try {
        return await loadProblemOrThrow(resolveDatabase(), id);
      } catch (error) {
        return handleRouteError(error, reply);
      }
    },
  );

  app.post<{ Params: ItemParams }>(
    '/api/problems/:id/duplicate',
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      const id = parseProblemId(request.params.id);
      if (id === null) {
        return reply
          .status(400)
          .send(apiError('INVALID_ID', 'The problem ID is invalid.'));
      }

      try {
        const resource = await resolveDatabase().transaction(async (tx) => {
          const [source] = await tx
            .select()
            .from(problems)
            .where(eq(problems.id, id))
            .for('update');
          if (!source) {
            throw new ProblemRouteError(404, {
              code: 'PROBLEM_NOT_FOUND',
              message: 'Problem not found.',
            });
          }

          const sourceTags = await tx
            .select({ tagId: problemTags.tagId })
            .from(problemTags)
            .where(eq(problemTags.problemId, id));

          const [duplicate] = await tx
            .insert(problems)
            .values({
              name: duplicateProblemName(source.name),
              categoryId: source.categoryId,
              difficulty: source.difficulty,
              status: source.status,
              lastReviewedOn: source.lastReviewedOn,
              timesSolved: source.timesSolved,
              solutionUrl: source.solutionUrl,
              solutionLabel: source.solutionLabel,
              sourceUrl: source.sourceUrl,
              sourceLabel: source.sourceLabel,
              notes: source.notes,
            })
            .returning({ id: problems.id });
          if (!duplicate) {
            throw new Error('Problem duplication returned no record.');
          }

          if (sourceTags.length > 0) {
            await tx.insert(problemTags).values(
              sourceTags.map(({ tagId }) => ({
                problemId: duplicate.id,
                tagId,
              })),
            );
          }

          return loadProblemOrThrow(tx, duplicate.id);
        });

        return reply
          .status(201)
          .header('location', `/api/problems/${resource.id}`)
          .send(resource);
      } catch (error) {
        return handleRouteError(error, reply);
      }
    },
  );

  app.post<{ Body: ProblemBody }>(
    '/api/problems',
    { schema: { body: createProblemBodySchema } },
    async (request, reply) => {
      const parsed = parseProblemBody(request.body, 'create');
      if (!parsed.ok) {
        return sendProblemError(reply, 400, parsed.error);
      }

      const input = parsed.value;
      try {
        const resource = await resolveDatabase().transaction(async (tx) => {
          await verifyReferences(tx, input);
          const [created] = await tx
            .insert(problems)
            .values({
              name: input.name as string,
              categoryId: input.categoryId as bigint,
              difficulty: input.difficulty ?? null,
              status: input.status ?? 'To solve',
              lastReviewedOn: input.lastReviewedOn ?? null,
              timesSolved: input.timesSolved ?? 0,
              solutionUrl: input.solution?.url ?? null,
              solutionLabel: input.solution?.label ?? null,
              sourceUrl: input.source?.url ?? null,
              sourceLabel: input.source?.label ?? null,
              notes: input.notes ?? '',
            })
            .returning({ id: problems.id });
          if (!created) throw new Error('Problem insert returned no record.');

          if (input.tagIds && input.tagIds.length > 0) {
            await tx.insert(problemTags).values(
              input.tagIds.map((tagId) => ({
                problemId: created.id,
                tagId,
              })),
            );
          }

          return loadProblemOrThrow(tx, created.id);
        });

        return reply
          .status(201)
          .header('location', `/api/problems/${resource.id}`)
          .send(resource);
      } catch (error) {
        return handleRouteError(error, reply);
      }
    },
  );

  app.patch<{ Body: ProblemBody; Params: ItemParams }>(
    '/api/problems/:id',
    {
      schema: {
        body: updateProblemBodySchema,
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const id = parseProblemId(request.params.id);
      if (id === null) {
        return reply
          .status(400)
          .send(apiError('INVALID_ID', 'The problem ID is invalid.'));
      }

      const parsed = parseProblemBody(request.body, 'update');
      if (!parsed.ok) {
        return sendProblemError(reply, 400, parsed.error);
      }
      const input = parsed.value;

      try {
        const resource = await resolveDatabase().transaction(async (tx) => {
          const [existing] = await tx
            .select({ id: problems.id, timesSolved: problems.timesSolved })
            .from(problems)
            .where(eq(problems.id, id))
            .for('update');
          if (!existing) {
            throw new ProblemRouteError(404, {
              code: 'PROBLEM_NOT_FOUND',
              message: 'Problem not found.',
            });
          }

          await verifyReferences(tx, input);
          const timesSolvedIncreased =
            input.timesSolved !== undefined &&
            input.timesSolved > existing.timesSolved;
          const reviewDate = timesSolvedIncreased
            ? formatServerCalendarDate(currentDate())
            : undefined;
          await tx
            .update(problems)
            .set({
              ...(input.name !== undefined && { name: input.name }),
              ...(input.categoryId !== undefined && {
                categoryId: input.categoryId,
              }),
              ...('difficulty' in input && {
                difficulty: input.difficulty,
              }),
              ...(input.status !== undefined && { status: input.status }),
              ...(input.timesSolved !== undefined && {
                timesSolved: input.timesSolved,
              }),
              ...(reviewDate !== undefined && {
                lastReviewedOn: reviewDate,
              }),
              ...('solution' in input && {
                solutionUrl: input.solution?.url ?? null,
                solutionLabel: input.solution?.label ?? null,
              }),
              ...('source' in input && {
                sourceUrl: input.source?.url ?? null,
                sourceLabel: input.source?.label ?? null,
              }),
              ...(input.notes !== undefined && { notes: input.notes }),
              updatedAt: new Date(),
            })
            .where(eq(problems.id, id));

          if (input.tagIds !== undefined) {
            await tx
              .delete(problemTags)
              .where(eq(problemTags.problemId, id));
            if (input.tagIds.length > 0) {
              await tx.insert(problemTags).values(
                input.tagIds.map((tagId) => ({ problemId: id, tagId })),
              );
            }
          }

          return loadProblemOrThrow(tx, id);
        });

        return resource;
      } catch (error) {
        return handleRouteError(error, reply);
      }
    },
  );

  app.delete<{ Params: ItemParams }>(
    '/api/problems/:id',
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      const id = parseProblemId(request.params.id);
      if (id === null) {
        return reply
          .status(400)
          .send(apiError('INVALID_ID', 'The problem ID is invalid.'));
      }

      const [deleted] = await resolveDatabase()
        .delete(problems)
        .where(eq(problems.id, id))
        .returning({ id: problems.id });
      if (!deleted) {
        return reply
          .status(404)
          .send(apiError('PROBLEM_NOT_FOUND', 'Problem not found.'));
      }

      return reply.status(204).send();
    },
  );
}
