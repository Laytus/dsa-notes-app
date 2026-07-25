import { asc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { tags, type Database } from '../db/index.js';
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

export function registerTagRoutes(
  app: FastifyInstance,
  resolveDatabase: ResolveDatabase,
): void {
  app.get('/api/tags', async () => {
    const records = await resolveDatabase()
      .select()
      .from(tags)
      .orderBy(asc(sql`lower(${tags.name})`), asc(tags.id));

    return records.map(serializeNamedResource);
  });

  app.post<{ Body: NameBody }>(
    '/api/tags',
    { schema: { body: nameBodySchema } },
    async (request, reply) => {
      const name = normalizeName(request.body.name);

      if (!name) {
        return reply
          .status(400)
          .send(apiError('INVALID_TAG_NAME', 'Tag name is required.'));
      }

      try {
        const [record] = await resolveDatabase()
          .insert(tags)
          .values({ name })
          .returning();

        if (!record) {
          throw new Error('Tag insert returned no record.');
        }

        const resource = serializeNamedResource(record);
        return reply
          .status(201)
          .header('location', `/api/tags/${resource.id}`)
          .send(resource);
      } catch (error) {
        if (
          isPostgreSqlConstraintError(
            error,
            '23505',
            'tags_name_lower_unique',
          )
        ) {
          return reply
            .status(409)
            .send(
              apiError(
                'TAG_NAME_CONFLICT',
                'A tag with this name already exists.',
              ),
            );
        }

        throw error;
      }
    },
  );

  app.patch<{ Body: NameBody; Params: ItemParams }>(
    '/api/tags/:id',
    { schema: { body: nameBodySchema, params: idParamsSchema } },
    async (request, reply) => {
      let id: bigint;
      try {
        id = parseId(request.params.id);
      } catch {
        return reply
          .status(400)
          .send(apiError('INVALID_ID', 'The tag ID is invalid.'));
      }

      const name = normalizeName(request.body.name);
      if (!name) {
        return reply
          .status(400)
          .send(apiError('INVALID_TAG_NAME', 'Tag name is required.'));
      }

      try {
        const [record] = await resolveDatabase()
          .update(tags)
          .set({ name, updatedAt: new Date() })
          .where(eq(tags.id, id))
          .returning();

        if (!record) {
          return reply
            .status(404)
            .send(apiError('TAG_NOT_FOUND', 'Tag not found.'));
        }

        return serializeNamedResource(record);
      } catch (error) {
        if (
          isPostgreSqlConstraintError(
            error,
            '23505',
            'tags_name_lower_unique',
          )
        ) {
          return reply
            .status(409)
            .send(
              apiError(
                'TAG_NAME_CONFLICT',
                'A tag with this name already exists.',
              ),
            );
        }

        throw error;
      }
    },
  );

  app.delete<{ Params: ItemParams }>(
    '/api/tags/:id',
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      let id: bigint;
      try {
        id = parseId(request.params.id);
      } catch {
        return reply
          .status(400)
          .send(apiError('INVALID_ID', 'The tag ID is invalid.'));
      }

      const [deleted] = await resolveDatabase()
        .delete(tags)
        .where(eq(tags.id, id))
        .returning({ id: tags.id });

      if (!deleted) {
        return reply
          .status(404)
          .send(apiError('TAG_NOT_FOUND', 'Tag not found.'));
      }

      return reply.status(204).send();
    },
  );
}
