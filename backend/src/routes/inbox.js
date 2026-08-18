import { idParams } from '../schemas/common.js';

const kinds = new Set(['notification', 'message']);
const tones = new Set(['danger', 'warning', 'info', 'success']);

function inboxValues(body, current = {}) {
  return {
    kind: String(body?.kind ?? current.kind ?? '').trim(),
    title: String(body?.title ?? current.title ?? '').trim(),
    body: String(body?.body ?? current.body ?? '').trim(),
    href: String(body?.href ?? current.href ?? '').trim(),
    tone: String(body?.tone ?? current.tone ?? 'info').trim(),
    sender: String(body?.sender ?? current.sender ?? '').trim() || null,
    isRead: body?.isRead === undefined ? Boolean(current.isRead) : Boolean(body.isRead)
  };
}

function validate(reply, item) {
  if (!kinds.has(item.kind)) {
    reply.code(400).send({ error: '通知類型錯誤' });
    return false;
  }
  if (!item.title || !item.body) {
    reply.code(400).send({ error: '標題與內容為必填' });
    return false;
  }
  if (!tones.has(item.tone)) {
    reply.code(400).send({ error: '通知色彩類型錯誤' });
    return false;
  }
  return true;
}

export default async function inboxRoutes(app, { auth, prisma }) {
  app.addHook('preHandler', auth.authenticate);

  app.get('/', { schema: { tags: ['Inbox'] } }, async request => {
    const items = await prisma.inboxItem.findMany({
      where: { userId: request.currentUser.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50
    });
    return {
      items,
      unread: {
        notifications: items.filter(item => item.kind === 'notification' && !item.isRead).length,
        messages: items.filter(item => item.kind === 'message' && !item.isRead).length
      }
    };
  });

  app.post('/', { schema: { tags: ['Inbox'] } }, async (request, reply) => {
    const data = inboxValues(request.body);
    if (!validate(reply, data)) return;
    const item = await prisma.inboxItem.create({ data: { ...data, userId: request.currentUser.id } });
    return reply.code(201).send({ item });
  });

  app.post('/read-all', { schema: { tags: ['Inbox'] } }, async (request, reply) => {
    const kind = String(request.body?.kind ?? '');
    if (!kinds.has(kind)) return reply.code(400).send({ error: '通知類型錯誤' });
    const result = await prisma.inboxItem.updateMany({
      where: { userId: request.currentUser.id, kind, isRead: false },
      data: { isRead: true }
    });
    return { updated: result.count };
  });

  app.get('/:id', { schema: { tags: ['Inbox'], params: idParams } }, async (request, reply) => {
    const item = await prisma.inboxItem.findFirst({ where: { id: request.params.id, userId: request.currentUser.id } });
    return item ? { item } : reply.code(404).send({ error: '找不到通知或訊息' });
  });

  app.patch('/:id/read', { schema: { tags: ['Inbox'], params: idParams } }, async (request, reply) => {
    const current = await prisma.inboxItem.findFirst({ where: { id: request.params.id, userId: request.currentUser.id } });
    if (!current) return reply.code(404).send({ error: '找不到通知或訊息' });
    const item = await prisma.inboxItem.update({ where: { id: current.id }, data: { isRead: true } });
    return { item };
  });

  app.patch('/:id', { schema: { tags: ['Inbox'], params: idParams } }, async (request, reply) => {
    const current = await prisma.inboxItem.findFirst({ where: { id: request.params.id, userId: request.currentUser.id } });
    if (!current) return reply.code(404).send({ error: '找不到通知或訊息' });
    const data = inboxValues(request.body, current);
    if (!validate(reply, data)) return;
    const item = await prisma.inboxItem.update({ where: { id: current.id }, data });
    return { item };
  });

  app.delete('/:id', { schema: { tags: ['Inbox'], params: idParams } }, async (request, reply) => {
    const current = await prisma.inboxItem.findFirst({ where: { id: request.params.id, userId: request.currentUser.id } });
    if (!current) return reply.code(404).send({ error: '找不到通知或訊息' });
    await prisma.inboxItem.delete({ where: { id: current.id } });
    return reply.code(204).send();
  });
}
