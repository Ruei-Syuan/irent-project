import { findUserById, toPublicUser, userInclude } from '../repositories/user-repository.js';
import { idParams } from '../schemas/common.js';
import { withAudit } from '../services/audit.js';
import { hashPassword } from '../services/auth.js';

export default async function userRoutes(app, { auth, prisma }) {
  app.get('/', { preHandler: auth.authorize('users.view'), schema: { tags: ['Users'] } }, async () => ({
    items: (await prisma.user.findMany({ include: userInclude, orderBy: { id: 'asc' } })).map(toPublicUser)
  }));

  app.get('/:id', {
    preHandler: auth.authorize('users.view'), schema: { tags: ['Users'], params: idParams }
  }, async (request, reply) => {
    const user = await findUserById(prisma, request.params.id);
    return user ? { item: toPublicUser(user) } : reply.code(404).send({ error: '找不到帳號' });
  });

  app.post('/', { preHandler: auth.authorize('users.create'), schema: { tags: ['Users'] } }, async (request, reply) => {
    const employeeNo = String(request.body?.employeeNo ?? '').trim().toUpperCase();
    const name = String(request.body?.name ?? '').trim();
    const password = String(request.body?.password ?? '');
    const roleId = Number(request.body?.roleId);
    const departmentId = Number(request.body?.departmentId);
    const status = request.body?.status === 'suspended' ? 'suspended' : 'active';
    if (!/^[A-Z]{3}\d{3}$/.test(employeeNo)) return reply.code(400).send({ error: '員工編號格式需為 3 碼英文加 3 碼數字' });
    if (!name) return reply.code(400).send({ error: '請輸入姓名' });
    if (password.length < 8) return reply.code(400).send({ error: '密碼至少需要 8 個字元' });
    if (!await prisma.role.findUnique({ where: { id: roleId } })) return reply.code(400).send({ error: '角色不存在' });
    if (!await prisma.department.findUnique({ where: { id: departmentId } })) return reply.code(400).send({ error: '部門不存在' });

    const user = await withAudit(prisma, transaction => transaction.user.create({
      data: {
        employeeNo, name,
        email: String(request.body?.email ?? '').trim() || null,
        phone: String(request.body?.phone ?? '').trim() || null,
        passwordHash: hashPassword(password),
        roleId, departmentId, status
      },
      include: userInclude
    }), created => ({
      actorUserId: request.currentUser.id, action: 'user.create', targetType: 'user', targetId: created.id,
      summary: `${request.currentUser.name}新增帳號 ${employeeNo}（${name}）`, ip: request.ip
    }));
    return reply.code(201).send({ item: toPublicUser(user) });
  });

  app.patch('/:id', {
    preHandler: auth.authorize('users.edit'), schema: { tags: ['Users'], params: idParams }
  }, async (request, reply) => {
    const current = await prisma.user.findUnique({ where: { id: request.params.id } });
    if (!current) return reply.code(404).send({ error: '找不到帳號' });
    const name = String(request.body?.name ?? current.name).trim();
    const roleId = Number(request.body?.roleId ?? current.roleId);
    const departmentId = Number(request.body?.departmentId ?? current.departmentId);
    const status = request.body?.status ?? current.status;
    if (!name) return reply.code(400).send({ error: '請輸入姓名' });
    if (!['active', 'suspended'].includes(status)) return reply.code(400).send({ error: '帳號狀態錯誤' });
    if (current.id === request.currentUser.id && (roleId !== current.roleId || status !== current.status)) {
      return reply.code(409).send({ error: '不可變更自己的角色或帳號狀態' });
    }
    if (roleId !== current.roleId && !request.currentUser.permissions.includes('permissions.manage')) {
      return reply.code(403).send({ error: '缺少指派角色權限' });
    }
    if (!await prisma.role.findUnique({ where: { id: roleId } })) return reply.code(400).send({ error: '角色不存在' });
    if (!await prisma.department.findUnique({ where: { id: departmentId } })) return reply.code(400).send({ error: '部門不存在' });
    const password = request.body?.password == null ? null : String(request.body.password);
    if (password && password.length < 8) return reply.code(400).send({ error: '密碼至少需要 8 個字元' });

    const user = await withAudit(prisma, transaction => transaction.user.update({
      where: { id: current.id },
      data: {
        name,
        email: String(request.body?.email ?? current.email ?? '').trim() || null,
        phone: String(request.body?.phone ?? current.phone ?? '').trim() || null,
        passwordHash: password ? hashPassword(password) : current.passwordHash,
        roleId, departmentId, status,
        updatedAt: new Date().toISOString()
      },
      include: userInclude
    }), updated => ({
      actorUserId: request.currentUser.id, action: 'user.update', targetType: 'user', targetId: updated.id,
      summary: `${request.currentUser.name}更新帳號 ${current.employeeNo}`, ip: request.ip
    }));
    return { item: toPublicUser(user) };
  });

  app.delete('/:id', {
    preHandler: auth.authorize('users.delete'), schema: { tags: ['Users'], params: idParams }
  }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.params.id } });
    if (!user) return reply.code(404).send({ error: '找不到帳號' });
    if (user.id === request.currentUser.id) return reply.code(409).send({ error: '不可刪除目前登入的帳號' });
    await withAudit(prisma, transaction => transaction.user.delete({ where: { id: user.id } }), {
      actorUserId: request.currentUser.id, action: 'user.delete', targetType: 'user', targetId: user.id,
      summary: `${request.currentUser.name}刪除帳號 ${user.employeeNo}（${user.name}）`, ip: request.ip
    });
    return reply.code(204).send();
  });
}
