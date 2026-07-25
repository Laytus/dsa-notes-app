import type { FastifyError, FastifyInstance } from 'fastify';

export interface ApiErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

interface PostgreSqlError {
  readonly code?: unknown;
  readonly constraint_name?: unknown;
  readonly constraint?: unknown;
}

export function apiError(code: string, message: string): ApiErrorBody {
  return { error: { code, message } };
}

export function findPostgreSqlError(error: unknown): PostgreSqlError | null {
  const visited = new Set<unknown>();
  let current = error;

  while (
    typeof current === 'object' &&
    current !== null &&
    !visited.has(current)
  ) {
    visited.add(current);
    const candidate = current as PostgreSqlError & { readonly cause?: unknown };

    if (typeof candidate.code === 'string') {
      return candidate;
    }

    current = candidate.cause;
  }

  return null;
}

export function isPostgreSqlConstraintError(
  error: unknown,
  code: string,
  constraint: string,
): boolean {
  const postgresError = findPostgreSqlError(error);
  const constraintName =
    postgresError?.constraint_name ?? postgresError?.constraint;

  return (
    postgresError?.code === code &&
    typeof constraintName === 'string' &&
    constraintName === constraint
  );
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (
      error.validation ||
      error.code === 'FST_ERR_CTP_INVALID_JSON_BODY' ||
      error.statusCode === 400
    ) {
      return reply
        .status(400)
        .send(apiError('VALIDATION_ERROR', 'The request is invalid.'));
    }

    app.log.error({ err: error }, 'Unhandled API error');
    return reply
      .status(500)
      .send(apiError('INTERNAL_ERROR', 'An unexpected error occurred.'));
  });
}
