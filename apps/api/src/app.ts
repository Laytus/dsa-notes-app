import Fastify, { type FastifyInstance } from 'fastify';
import { getDatabase, type Database } from './db/index.js';
import { registerErrorHandler } from './http/errors.js';
import { registerCategoryRoutes } from './routes/categories.js';
import { registerProblemRoutes } from './routes/problems.js';
import { registerTagRoutes } from './routes/tags.js';

export function buildApp(
  {
    database,
    logger = false,
  }: {
    readonly database?: Database;
    readonly logger?: boolean;
  } = {},
): FastifyInstance {
  const app = Fastify({
    logger,
    ajv: {
      customOptions: {
        coerceTypes: false,
        removeAdditional: false,
      },
    },
  });
  const resolveDatabase = (): Database => database ?? getDatabase();

  app.get('/api/health', async () => ({ status: 'ok' }));
  registerProblemRoutes(app, resolveDatabase);
  registerCategoryRoutes(app, resolveDatabase);
  registerTagRoutes(app, resolveDatabase);
  registerErrorHandler(app);

  return app;
}
