import { randomUUID } from 'node:crypto';

const cleaningConditions = ['dirty', 'average', 'clean'];
const cleaningStatuses = ['unassigned', ...cleaningConditions];
const originalConditions = ['dirty', 'average', 'clean'];
const cleaningProviders = ['external_company', 'irent_staff'];

const cleaningOrderInclude = {
  vehicle: {
    select: {
      licensePlate: true,
      model: true,
      color: true,
      status: true,
      cabinCondition: true,
      station: {
        select: { name: true, city: true, district: true }
      }
    }
  }
};

function presentCleaningOrder(order) {
  const cabinScores = { clean: 100, average: 70, dirty: 40 };
  const exteriorScore = order.vehicle.status === 'maintenance' ? 40 : 100;
  const healthScore = order.vehicle.status === 'maintenance'
    ? Math.min((cabinScores[order.vehicle.cabinCondition] + exteriorScore) / 2, 70)
    : (cabinScores[order.vehicle.cabinCondition] + exteriorScore) / 2;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    vehicleLicensePlate: order.vehicleLicensePlate,
    condition: order.condition,
    dispatchStatus: order.dispatchStatus,
    status: order.dispatchStatus === 'unassigned' ? 'unassigned' : order.condition,
    originalCondition: order.originalCondition,
    cleaningFee: order.cleaningFee,
    cleaningProvider: order.cleaningProvider,
    note: order.note,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    vehicle: { ...order.vehicle, healthScore }
  };
}

export default async function cleaningOrderRoutes(app, options) {
  const { auth, prisma } = options;

  app.get('/', {
    // preHandler: auth.authorize('dispatch.view'),
    schema: {
      tags: ['Cleaning orders'],
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          pageSize: { type: 'integer', minimum: 1, maximum: 50, default: 5 },
          condition: { type: 'string', enum: cleaningConditions },
          status: { type: 'string', enum: cleaningStatuses },
          month: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
          search: { type: 'string', maxLength: 100, default: '' }
        }
      }
    }
  }, async request => {
    const pageSize = Number(request.query.pageSize ?? 5);
    const requestedPage = Number(request.query.page ?? 1);
    const search = String(request.query.search ?? '').trim();
    const where = {};

    const requestedStatus = request.query.status || request.query.condition;
    if (requestedStatus === 'unassigned') where.dispatchStatus = 'unassigned';
    else if (requestedStatus) {
      where.dispatchStatus = 'assigned';
      where.condition = requestedStatus;
    }
    if (request.query.month) {
      const [year, month] = request.query.month.split('-').map(Number);
      where.createdAt = {
        gte: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
        lt: new Date(Date.UTC(year, month, 1)).toISOString()
      };
    }
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { vehicleLicensePlate: { contains: search } },
        { note: { contains: search } }
      ];
    }

    const total = await prisma.cleaningOrder.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, requestedPage), totalPages);
    const items = await prisma.cleaningOrder.findMany({
      where,
      include: cleaningOrderInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize
    });

    return {
      items: items.map(presentCleaningOrder),
      pagination: { page, pageSize, total, totalPages }
    };
  });

  app.get('/summary', {
    // preHandler: auth.authorize('dispatch.view'),
    schema: {
      tags: ['Cleaning orders'],
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: { month: { type: 'string', pattern: '^\\d{4}-\\d{2}$' } }
      }
    }
  }, async request => {
    const now = new Date();
    const [year, month] = request.query.month
      ? request.query.month.split('-').map(Number)
      : [now.getUTCFullYear(), now.getUTCMonth() + 1];
    const monthStart = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const nextMonthStart = new Date(Date.UTC(year, month, 1)).toISOString();
    const where = request.query.month ? { createdAt: { gte: monthStart, lt: nextMonthStart } } : {};
    const statusWhere = condition => ({ ...where, dispatchStatus: 'assigned', condition });
    const [total, unassigned, dirty, average, clean, currentMonthCleaned, currentMonthCleaningCost] = await Promise.all([
      prisma.cleaningOrder.count({ where }),
      prisma.cleaningOrder.count({ where: { ...where, dispatchStatus: 'unassigned' } }),
      prisma.cleaningOrder.count({ where: statusWhere('dirty') }),
      prisma.cleaningOrder.count({ where: statusWhere('average') }),
      prisma.cleaningOrder.count({ where: statusWhere('clean') }),
      prisma.cleaningOrder.count({
        where: { dispatchStatus: 'assigned', condition: 'clean', createdAt: { gte: monthStart, lt: nextMonthStart } }
      }),
      prisma.cleaningOrder.aggregate({
        where: { createdAt: { gte: monthStart, lt: nextMonthStart } },
        _sum: { cleaningFee: true }
      })
    ]);
    return {
      total,
      unassigned,
      dirty,
      average,
      clean,
      currentMonthCleaned,
      currentMonthCleaningCost: currentMonthCleaningCost._sum.cleaningFee || 0
    };
  });

  app.patch('/:id/accept', {
    preHandler: auth.authorize('dispatch.edit'),
    schema: {
      tags: ['Cleaning orders'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer', minimum: 1 } }
      }
    }
  }, async (request, reply) => {
    const id = Number(request.params.id);
    const order = await prisma.cleaningOrder.findUnique({ where: { id } });
    if (!order) return reply.code(404).send({ error: '找不到清潔工單' });
    if (order.dispatchStatus !== 'assigned' || order.condition !== 'dirty') {
      return reply.code(409).send({ error: '只有已派工且待驗收工單可以驗收' });
    }

    const item = await prisma.cleaningOrder.update({
      where: { id },
      data: { condition: 'clean', dispatchStatus: 'assigned', updatedAt: new Date().toISOString() },
      include: cleaningOrderInclude
    });
    return { item: presentCleaningOrder(item) };
  });

  app.post('/bulk-accept', {
    preHandler: auth.authorize('dispatch.edit'),
    schema: {
      tags: ['Cleaning orders'],
      body: {
        type: 'object',
        required: ['ids'],
        additionalProperties: false,
        properties: {
          ids: { type: 'array', minItems: 1, maxItems: 50, uniqueItems: true, items: { type: 'integer', minimum: 1 } }
        }
      }
    }
  }, async request => {
    const result = await prisma.cleaningOrder.updateMany({
      where: { id: { in: request.body.ids }, dispatchStatus: 'assigned', condition: 'dirty' },
      data: { condition: 'clean', dispatchStatus: 'assigned', updatedAt: new Date().toISOString() }
    });
    return { updatedCount: result.count };
  });

  app.post('/', {
    preHandler: auth.authorize('dispatch.create'),
    schema: {
      tags: ['Cleaning orders'],
      body: {
        type: 'object',
        required: ['vehicleLicensePlate', 'condition', 'originalCondition', 'cleaningFee', 'cleaningProvider'],
        additionalProperties: false,
        properties: {
          vehicleLicensePlate: { type: 'string', minLength: 1, maxLength: 20 },
          condition: { type: 'string', enum: cleaningConditions },
          dispatchStatus: { type: 'string', enum: ['unassigned', 'assigned'], default: 'unassigned' },
          originalCondition: { type: 'string', enum: originalConditions },
          cleaningFee: { type: 'integer', minimum: 0 },
          cleaningProvider: { type: 'string', enum: cleaningProviders },
          note: { type: 'string', maxLength: 500, default: '' }
        }
      }
    }
  }, async (request, reply) => {
    const vehicleLicensePlate = request.body.vehicleLicensePlate.trim().toUpperCase();
    if (['clean', 'average'].includes(request.body.condition) && request.body.originalCondition === 'clean') {
      return reply.code(400).send({ error: '已清潔或清潔中的工單原始狀況只能是普通或髒污' });
    }
    if (request.body.originalCondition === 'dirty'
      && (request.body.cleaningProvider !== 'external_company' || request.body.cleaningFee <= 0)) {
      return reply.code(400).send({ error: '原始狀況為髒污時，必須由外部清潔公司處理並填寫清潔費用' });
    }
    const vehicle = await prisma.vehicle.findUnique({
      where: { licensePlate: vehicleLicensePlate },
      select: { id: true }
    });
    if (!vehicle) return reply.code(404).send({ error: '找不到指定車輛' });

    const createdAt = new Date().toISOString();
    const dateCode = createdAt.slice(2, 10).replaceAll('-', '');
    const item = await prisma.cleaningOrder.create({
      data: {
        orderNumber: `CO-${dateCode}-${randomUUID().slice(0, 8).toUpperCase()}`,
        vehicleLicensePlate,
        condition: request.body.condition,
        dispatchStatus: request.body.dispatchStatus ?? 'unassigned',
        originalCondition: request.body.originalCondition,
        cleaningFee: request.body.cleaningFee,
        cleaningProvider: request.body.cleaningProvider,
        note: String(request.body.note ?? '').trim(),
        createdAt,
        updatedAt: createdAt
      },
      include: cleaningOrderInclude
    });

    return reply.code(201).send({ item: presentCleaningOrder(item) });
  });
}
