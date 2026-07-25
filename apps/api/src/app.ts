import Fastify, { type FastifyInstance } from 'fastify';

export function buildApp(
  { logger = false }: { readonly logger?: boolean } = {},
): FastifyInstance {
  const app = Fastify({ logger });

  app.get('/api/health', async () => ({ status: 'ok' }));

  return app;
}
