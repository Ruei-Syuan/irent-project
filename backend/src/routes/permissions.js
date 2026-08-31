import { idParams } from '../schemas/common.js';
import { withAudit } from '../services/audit.js';

function values(body, current = {}) {
  return {
    code: String(body?.code ?? current.code ?? '').trim(),
    module: String(body?.module ?? current.module ?? '').trim(),
    moduleLabel: String(body?.moduleLabel ?? current.moduleLabel ?? '').trim(),
    action: String(body?.action ?? current.action ?? '').trim(),
    actionLabel: String(body?.actionLabel ?? current.actionLabel ?? '').trim()
  };
}

function validate(reply, item) {
  if (Object.values(item).some(value => !value)) {
    reply.code(400).send({ error: '權限代碼、模組與動作名稱皆為必填' });
    return false;
  }
  if (!/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(item.code)) {
    reply.code(400).send({ error: '權限代碼格式需為 module.action' });
    return false;
  }
  return true;
}

export default async function permissionRoutes(app, { auth, prisma }) {
  app.get('/', {
    // preHandler: auth.authorize('permissions.view'),
    schema: { tags: ['Permissions'] }
  }, async () => ({
    items: await prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { id: 'asc' }] })
  }));

  app.get('/:id', {
    // preHandler: auth.authorize('permissions.view'),
    schema: { tags: ['Permissions'], params: idParams }
  }, async (request, reply) => {
    const item = await prisma.permission.findUnique({ where: { id: request.params.id } });
    return item ? { item } : reply.code(404).send({ error: '找不到權限' });
  });

  app.post('/', { preHandler: auth.authorize('permissions.manage'), schema: { tags: ['Permissions'] } }, async (request, reply) => {
    const data = values(request.body);
    if (!validate(reply, data)) return;
    const item = await withAudit(prisma, transaction => transaction.permission.create({ data }), created => ({
      actorUserId: request.currentUser.id, action: 'permission.create', targetType: 'permission',
      targetId: created.id, summary: `${request.currentUser.name}新增權限 ${created.code}`, ip: request.ip
    }));
    return reply.code(201).send({ item });
  });

  app.patch('/:id', {
    preHandler: auth.authorize('permissions.manage'), schema: { tags: ['Permissions'], params: idParams }
  }, async (request, reply) => {
    const current = await prisma.permission.findUnique({ where: { id: request.params.id } });
    if (!current) return reply.code(404).send({ error: '找不到權限' });
    const data = values(request.body, current);
    if (!validate(reply, data)) return;
    const item = await withAudit(prisma, transaction => transaction.permission.update({
      where: { id: current.id }, data
    }), updated => ({
      actorUserId: request.currentUser.id, action: 'permission.update', targetType: 'permission',
      targetId: updated.id, summary: `${request.currentUser.name}更新權限 ${updated.code}`, ip: request.ip
    }));
    return { item };
  });

  app.delete('/:id', {
    preHandler: auth.authorize('permissions.manage'), schema: { tags: ['Permissions'], params: idParams }
  }, async (request, reply) => {
    const item = await prisma.permission.findUnique({ where: { id: request.params.id } });
    if (!item) return reply.code(404).send({ error: '找不到權限' });
    await withAudit(prisma, transaction => transaction.permission.delete({ where: { id: item.id } }), {
      actorUserId: request.currentUser.id, action: 'permission.delete', targetType: 'permission',
      targetId: item.id, summary: `${request.currentUser.name}刪除權限 ${item.code}`, ip: request.ip
    });
    return reply.code(204).send();
  });
}
