import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import { createAuthTools } from './plugins/auth.js';
import { createPrisma } from './plugins/prisma.js';
import apiRoutes from './routes/index.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pagePermissions = {
  'dashboard.html': 'dashboard.view',
  'fleet.html': 'fleet.view',
  'damage-review.html': 'damage.view',
  'dispatch.html': 'dispatch.view',
  'work-orders.html': 'work_orders.view',
  'reports.html': 'reports.view',
  'permissions.html': 'permissions.view'
};

export async function buildApp(options = {}) {
  const app = Fastify({ logger: options.logger ?? true });
  const prisma = options.prisma ?? createPrisma();
  const ownsPrisma = !options.prisma;
  const auth = createAuthTools(prisma, options.passwordVerifier);

  app.decorate('prisma', prisma);
  app.decorateRequest('currentUser', null);

  await app.register(cookie);
  await app.register(swagger, {
    openapi: {
      info: { title: 'iRent Management API', version: '1.0.0' },
      servers: [{ url: '/api/v1' }]
    }
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'same-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  });

  app.setErrorHandler((error, request, reply) => {
    if (error.code === 'AUTH_RATE_LIMIT') {
      return reply.code(429).send({ error: '登入失敗次數過多，請稍後再試' });
    }
    if (error.code === 'P2002') {
      return reply.code(409).send({ error: '資料重複，請檢查唯一欄位' });
    }
    if (error.code === 'P2003') {
      return reply.code(409).send({ error: '資料仍被其他紀錄使用' });
    }
    if (error.validation) return reply.code(400).send({ error: '請求資料格式錯誤' });
    request.log.error(error);
    return reply.code(500).send({ error: '伺服器發生錯誤' });
  });

  await app.register(fastifyStatic, {
    root: path.join(projectRoot, 'css'),
    prefix: '/css/'
  });
  await app.register(fastifyStatic, {
    root: path.join(projectRoot, 'js'),
    prefix: '/js/',
    decorateReply: false
  });
  app.get('/login.html', async (request, reply) => {
    const user = await auth.service.currentUser(request.cookies.irent_session);
    if (user) return reply.redirect('/dashboard.html');
    return reply.sendFile('login.html', projectRoot);
  });
  app.get('/', async (request, reply) => reply.redirect('/dashboard.html'));

  for (const [filename, permission] of Object.entries(pagePermissions)) {
    app.get(`/${filename}`, async (request, reply) => {
      const user = await auth.service.currentUser(request.cookies.irent_session);
      if (!user) return reply.redirect('/login.html');
      if (!user.permissions.includes(permission)) {
        return reply.code(403).sendFile('forbidden.html', projectRoot);
      }
      return reply.sendFile(filename, projectRoot);
    });
  }

  await app.register(apiRoutes, { prefix: '/api/v1', auth, prisma });
  await app.register(apiRoutes, { prefix: '/api', auth, prisma });

  if (ownsPrisma) {
    app.addHook('onClose', async () => prisma.$disconnect());
  }
  return app;
}
