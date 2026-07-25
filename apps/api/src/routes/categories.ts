import { asc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { categories, type Database } from '../db/index.js';
import {
  apiError,
  isPostgreSqlConstraintError,
} from '../http/errors.js';
import { serializeNamedResource } from '../http/serialization.js';
import {
  idParamsSchema,
  nameBodySchema,
  normalizeName,
  parseId,
  type NameBody,
} from '../http/validation.js';

interface ItemParams {
  readonly id: string;
}

type ResolveDatabase = () => Database;

export function registerCategoryRoutes(
  app: FastifyInstance,
  resolveDatabase: ResolveDatabase,
): void {
  app.get('/api/categories', async () => {
    const records = await resolveDatabase()
      .select()
      .from(categories)
      .orderBy(asc(sql`lower(${categories.name})`), asc(categories.id));

    return records.map(serializeNamedResource);
  });

  app.post<{ Body: NameBody }>(
    '/api/categories',
    { schema: { body: nameBodySchema } },
    async (request, reply) => {
      const name = normalizeName(request.body.name);

      if (!name) {
        return reply
          .status(400)
          .send(apiError('INVALID_CATEGORY_NAME', 'Category name is required.'));
      }

      try {
        const [record] = await resolveDatabase()
          .insert(categories)
          .values({ name })
          .returning();

        if (!record) {
          throw new Error('Category insert returned no record.');
        }

        const resource = serializeNamedResource(record);
        return reply
          .status(201)
          .header('location', `/api/categories/${resource.id}`)
          .send(resource);
      } catch (error) {
        if (
          isPostgreSqlConstraintError(
            error,
            '23505',
            'categories_name_lower_unique',
          )
        ) {
          return reply
            .status(409)
            .send(
              apiError(
                'CATEGORY_NAME_CONFLICT',
                'A category with this name already exists.',
              ),
            );
        }

        throw error;
      }
    },
  );

  app.patch<{ Body: NameBody; Params: ItemParams }>(
    '/api/categories/:id',
    { schema: { body: nameBodySchema, params: idParamsSchema } },
    async (request, reply) => {
      let id: bigint;
      try {
        id = parseId(request.params.id);
      } catch {
        return reply
          .status(400)
          .send(apiError('INVALID_ID', 'The category ID is invalid.'));
      }

      const name = normalizeName(request.body.name);
      if (!name) {
        return reply
          .status(400)
          .send(apiError('INVALID_CATEGORY_NAME', 'Category name is required.'));
      }

      try {
        const [record] = await resolveDatabase()
          .update(categories)
          .set({ name, updatedAt: new Date() })
          .where(eq(categories.id, id))
          .returning();

        if (!record) {
          return reply
            .status(404)
            .send(apiError('CATEGORY_NOT_FOUND', 'Category not found.'));
        }

        return serializeNamedResource(record);
      } catch (error) {
        if (
          isPostgreSqlConstraintError(
            error,
            '23505',
            'categories_name_lower_unique',
          )
        ) {
          return reply
            .status(409)
            .send(
              apiError(
                'CATEGORY_NAME_CONFLICT',
                'A category with this name already exists.',
              ),
            );
        }

        throw error;
      }
    },
  );

  app.delete<{ Params: ItemParams }>(
    '/api/categories/:id',
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      let id: bigint;
      try {
        id = parseId(request.params.id);
      } catch {
        return reply
          .status(400)
          .send(apiError('INVALID_ID', 'The category ID is invalid.'));
      }

      try {
        const [deleted] = await resolveDatabase()
          .delete(categories)
          .where(eq(categories.id, id))
          .returning({ id: categories.id });

        if (!deleted) {
          return reply
            .status(404)
            .send(apiError('CATEGORY_NOT_FOUND', 'Category not found.'));
        }

        return reply.status(204).send();
      } catch (error) {
        if (
          isPostgreSqlConstraintError(
            error,
            '23001',
            'problems_category_id_categories_id_fk',
          ) ||
          isPostgreSqlConstraintError(
            error,
            '23503',
            'problems_category_id_categories_id_fk',
          )
        ) {
          return reply
            .status(409)
            .send(
              apiError(
                'CATEGORY_IN_USE',
                'The category cannot be deleted while problems reference it.',
              ),
            );
        }

        throw error;
      }
    },
  );
}
