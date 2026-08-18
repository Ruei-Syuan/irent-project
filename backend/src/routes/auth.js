import { writeAudit } from '../services/audit.js';

export default async function authRoutes(app, options) {
  const { auth, prisma } = options;

  app.post('/login', {
    schema: {
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['employeeNo', 'password'],
        properties: {
          employeeNo: { type: 'string', minLength: 1, maxLength: 32 },
          password: { type: 'string', minLength: 1, maxLength: 256 }
        }
      }
    }
  }, async (request, reply) => {
    const result = await auth.service.login(request.body.employeeNo, request.body.password, {
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });
    if (!result) {
      await writeAudit(prisma, {
        action: 'auth.login_failed',
        targetType: 'session',
        targetId: String(request.body.employeeNo).toUpperCase(),
        summary: `員工編號 ${String(request.body.employeeNo).toUpperCase()} 登入失敗`,
        ip: request.ip
      });
      return reply.code(401).send({ error: '員工編號或密碼錯誤' });
    }

    reply.setCookie('irent_session', result.token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 8 * 60 * 60,
      path: '/'
    });
    await writeAudit(prisma, {
      actorUserId: result.user.id,
      action: 'auth.login',
      targetType: 'session',
      summary: `${result.user.name}登入管理後台`,
      ip: request.ip
    });
    return { item: result.user };
  });

  app.post('/logout', async (request, reply) => {
    const token = request.cookies.irent_session;
    const user = await auth.service.currentUser(token);
    await auth.service.logout(token);
    reply.clearCookie('irent_session', { httpOnly: true, sameSite: 'strict', path: '/' });
    if (user) {
      await writeAudit(prisma, {
        actorUserId: user.id,
        action: 'auth.logout',
        targetType: 'session',
        summary: `${user.name}登出管理後台`,
        ip: request.ip
      });
    }
    return reply.code(204).send();
  });

  app.get('/me', { preHandler: auth.authenticate }, async request => ({
    item: request.currentUser
  }));
}
