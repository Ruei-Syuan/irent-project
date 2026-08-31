import { idParams } from '../schemas/common.js';
import { withAudit, writeAudit } from '../services/audit.js';

const roleInclude = {
  _count: { select: { users: true } },
  rolePermissions: { include: { permission: true } }
};

function mapRole(role) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    userCount: role._count.users,
    permissions: role.rolePermissions
      .map(item => item.permission)
      .sort((a, b) => a.module.localeCompare(b.module) || a.id - b.id)
  };
}

export default async function roleRoutes(app, { auth, prisma }) {
  app.get('/', {
    // preHandler: auth.authorize('permissions.view'),
    schema: { tags: ['Roles'] }
  }, async () => ({
    items: (await prisma.role.findMany({ include: roleInclude, orderBy: [{ isSystem: 'desc' }, { id: 'asc' }] })).map(mapRole)
  }));

  app.get('/:id', {
    // preHandler: auth.authorize('permissions.view'),
    schema: { tags: ['Roles'], params: idParams }
  }, async (request, reply) => {
    const role = await prisma.role.findUnique({ where: { id: request.params.id }, include: roleInclude });
    return role ? { item: mapRole(role) } : reply.code(404).send({ error: '找不到角色' });
  });

  app.post('/', { preHandler: auth.authorize('permissions.manage'), schema: { tags: ['Roles'] } }, async (request, reply) => {
    const name = String(request.body?.name ?? '').trim();
    if (!name) return reply.code(400).send({ error: '請輸入角色名稱' });
    const role = await withAudit(prisma, transaction => transaction.role.create({
      data: { name, description: String(request.body?.description ?? '').trim() },
      include: roleInclude
    }), created => ({
      actorUserId: request.currentUser.id,
      action: 'role.create', targetType: 'role', targetId: created.id,
      summary: `${request.currentUser.name}新增角色「${created.name}」`, ip: request.ip
    }));
    return reply.code(201).send({ item: mapRole(role) });
  });

  app.patch('/:id', {
    preHandler: auth.authorize('permissions.manage'),
    schema: { tags: ['Roles'], params: idParams }
  }, async (request, reply) => {
    const current = await prisma.role.findUnique({ where: { id: request.params.id } });
    if (!current) return reply.code(404).send({ error: '找不到角色' });
    const name = String(request.body?.name ?? current.name).trim();
    if (!name) return reply.code(400).send({ error: '請輸入角色名稱' });
    if (current.isSystem && name !== current.name) {
      return reply.code(409).send({ error: '系統角色不可更名' });
    }
    const role = await withAudit(prisma, transaction => transaction.role.update({
      where: { id: current.id },
      data: {
        name,
        description: String(request.body?.description ?? current.description).trim(),
        updatedAt: new Date().toISOString()
      },
      include: roleInclude
    }), updated => ({
      actorUserId: request.currentUser.id,
      action: 'role.update', targetType: 'role', targetId: updated.id,
      summary: `${request.currentUser.name}更新角色「${updated.name}」`, ip: request.ip
    }));
    return { item: mapRole(role) };
  });

  app.put('/:id/permissions', {
    preHandler: auth.authorize('permissions.manage'),
    schema: {
      tags: ['Roles'],
      params: idParams,
      body: {
        type: 'object',
        required: ['permissionIds'],
        additionalProperties: false,
        properties: {
          permissionIds: {
            type: 'array',
            uniqueItems: true,
            items: { type: 'integer', minimum: 1 }
          }
        }
      }
    }
  }, async (request, reply) => {
    const role = await prisma.role.findUnique({ where: { id: request.params.id } });
    if (!role) return reply.code(404).send({ error: '找不到角色' });
    if (role.isSystem) return reply.code(409).send({ error: '系統角色權限不可變更' });
    const permissionIds = [...new Set((request.body?.permissionIds ?? []).map(Number))];
    if (permissionIds.some(id => !Number.isInteger(id) || id <= 0)) {
      return reply.code(400).send({ error: '權限資料格式錯誤' });
    }
    const validCount = await prisma.permission.count({ where: { id: { in: permissionIds } } });
    if (validCount !== permissionIds.length) return reply.code(400).send({ error: '包含不存在的權限' });
    await prisma.$transaction(async transaction => {
      await transaction.rolePermission.deleteMany({ where: { roleId: role.id } });
      if (permissionIds.length) {
        await transaction.rolePermission.createMany({
          data: permissionIds.map(permissionId => ({ roleId: role.id, permissionId }))
        });
      }
      await transaction.role.update({ where: { id: role.id }, data: { updatedAt: new Date().toISOString() } });
      await writeAudit(transaction, {
        actorUserId: request.currentUser.id,
        action: 'role.permission.update', targetType: 'role', targetId: role.id,
        summary: `${request.currentUser.name}更新「${role.name}」權限矩陣`, ip: request.ip
      });
    });
    const updated = await prisma.role.findUnique({ where: { id: role.id }, include: roleInclude });
    return { item: mapRole(updated) };
  });

  app.delete('/:id', {
    preHandler: auth.authorize('permissions.manage'),
    schema: { tags: ['Roles'], params: idParams }
  }, async (request, reply) => {
    const role = await prisma.role.findUnique({ where: { id: request.params.id }, include: roleInclude });
    if (!role) return reply.code(404).send({ error: '找不到角色' });
    if (role.isSystem) return reply.code(409).send({ error: '系統角色不可刪除' });
    if (role._count.users > 0) return reply.code(409).send({ error: '角色仍有帳號使用，請先調整帳號角色' });
    await withAudit(prisma, transaction => transaction.role.delete({ where: { id: role.id } }), {
      actorUserId: request.currentUser.id,
      action: 'role.delete', targetType: 'role', targetId: role.id,
      summary: `${request.currentUser.name}刪除角色「${role.name}」`, ip: request.ip
    });
    return reply.code(204).send();
  });
}
