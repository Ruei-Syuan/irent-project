import { idParams } from '../schemas/common.js';
import { withAudit } from '../services/audit.js';

export default async function departmentRoutes(app, options) {
  const { auth, prisma } = options;

  app.get('/', {
    // preHandler: auth.authorize('users.view'),
    schema: { tags: ['Departments'] }
  }, async () => ({
    items: await prisma.department.findMany({
      select: { id: true, name: true, description: true },
      orderBy: { id: 'asc' }
    })
  }));

  app.get('/:id', {
    // preHandler: auth.authorize('users.view'),
    schema: { tags: ['Departments'], params: idParams }
  }, async (request, reply) => {
    const item = await prisma.department.findUnique({
      where: { id: request.params.id },
      select: { id: true, name: true, description: true }
    });
    return item ? { item } : reply.code(404).send({ error: '找不到部門' });
  });

  app.post('/', {
    preHandler: auth.authorize('departments.manage'),
    schema: {
      tags: ['Departments'],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          description: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const name = request.body.name.trim();
    if (!name) return reply.code(400).send({ error: '請輸入部門名稱' });
    const item = await withAudit(prisma, transaction => transaction.department.create({
      data: { name, description: String(request.body.description ?? '').trim() },
      select: { id: true, name: true, description: true }
    }), created => ({
      actorUserId: request.currentUser.id,
      action: 'department.create',
      targetType: 'department',
      targetId: created.id,
      summary: `${request.currentUser.name}新增部門「${created.name}」`,
      ip: request.ip
    }));
    return reply.code(201).send({ item });
  });

  app.patch('/:id', {
    preHandler: auth.authorize('departments.manage'),
    schema: {
      tags: ['Departments'],
      params: idParams,
      body: {
        type: 'object',
        minProperties: 1,
        properties: {
          name: { type: 'string' },
          description: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const current = await prisma.department.findUnique({ where: { id: request.params.id } });
    if (!current) return reply.code(404).send({ error: '找不到部門' });
    const name = String(request.body.name ?? current.name).trim();
    if (!name) return reply.code(400).send({ error: '請輸入部門名稱' });
    const item = await withAudit(prisma, transaction => transaction.department.update({
      where: { id: current.id },
      data: {
        name,
        description: String(request.body.description ?? current.description).trim()
      },
      select: { id: true, name: true, description: true }
    }), updated => ({
      actorUserId: request.currentUser.id,
      action: 'department.update',
      targetType: 'department',
      targetId: updated.id,
      summary: `${request.currentUser.name}更新部門「${updated.name}」`,
      ip: request.ip
    }));
    return { item };
  });

  app.delete('/:id', {
    preHandler: auth.authorize('departments.manage'),
    schema: { tags: ['Departments'], params: idParams }
  }, async (request, reply) => {
    const current = await prisma.department.findUnique({
      where: { id: request.params.id },
      include: { _count: { select: { users: true } } }
    });
    if (!current) return reply.code(404).send({ error: '找不到部門' });
    if (current._count.users > 0) return reply.code(409).send({ error: '部門仍有成員，請先調整帳號部門' });
    await withAudit(prisma, transaction => transaction.department.delete({ where: { id: current.id } }), {
      actorUserId: request.currentUser.id,
      action: 'department.delete',
      targetType: 'department',
      targetId: current.id,
      summary: `${request.currentUser.name}刪除部門「${current.name}」`,
      ip: request.ip
    });
    return reply.code(204).send();
  });
}
