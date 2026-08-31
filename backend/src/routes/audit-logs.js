import { idParams } from '../schemas/common.js';

const includeActor = {
  actor: { select: { id: true, name: true, employeeNo: true } }
};

export default async function auditLogRoutes(app, { auth, prisma }) {
  app.get('/', {
    // preHandler: auth.authorize('audit.view'),
    schema: { tags: ['Audit Logs'] }
  }, async () => ({
    items: await prisma.auditLog.findMany({
      include: includeActor,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200
    })
  }));

  app.get('/:id', {
    // preHandler: auth.authorize('audit.view'),
    schema: { tags: ['Audit Logs'], params: idParams }
  }, async (request, reply) => {
    const item = await prisma.auditLog.findUnique({ where: { id: request.params.id }, include: includeActor });
    return item ? { item } : reply.code(404).send({ error: '找不到稽核紀錄' });
  });
}
