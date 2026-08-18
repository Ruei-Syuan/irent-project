import { createAuthService } from '../services/auth.js';

export function createAuthTools(prisma, passwordVerifier) {
  const service = createAuthService(prisma, passwordVerifier);

  async function authenticate(request, reply) {
    const user = await service.currentUser(request.cookies.irent_session);
    if (!user) return reply.code(401).send({ error: '請先登入' });
    request.currentUser = user;
  }

  function authorize(permissionCode) {
    return async (request, reply) => {
      await authenticate(request, reply);
      if (reply.sent) return;
      if (!request.currentUser.permissions.includes(permissionCode)) {
        return reply.code(403).send({ error: '沒有執行此操作的權限' });
      }
    };
  }

  return { authenticate, authorize, service };
}
