const repairOrderStatuses = ['待派工', '待驗收', '維修中', '維修完畢'];

const repairOrderInclude = {
  vehicle: { select: { licensePlate: true, model: true } },
  assignedManager: { select: { id: true, name: true } }
};

function completedTimestamp() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function presentRepairOrder(order) {
  return {
    id: order.id,
    repairCenter: order.repairCenter,
    orderNumber: order.orderNumber,
    vehicleLicensePlate: order.vehicleLicensePlate,
    vehicleModel: order.vehicle?.model ?? '',
    maintenanceItem: order.maintenanceItem,
    status: order.status,
    assignedManager: order.assignedManager,
    estimatedCost: order.estimatedCost,
    actualCost: order.actualCost,
    createdAt: order.createdAt,
    completedAt: order.completedAt
  };
}

export default async function repairOrderRoutes(app, options) {
  const { auth, prisma } = options;

  app.get('/', {
    preHandler: auth.authorize('work_orders.view'),
    schema: {
      tags: ['Repair orders'],
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          pageSize: { type: 'integer', minimum: 1, maximum: 50, default: 5 },
          search: { type: 'string', maxLength: 100, default: '' },
          status: { type: 'string', enum: repairOrderStatuses },
          month: { type: 'string', pattern: '^\\d{4}-\\d{2}$' }
        }
      }
    }
  }, async request => {
    const pageSize = Number(request.query.pageSize ?? 5);
    const requestedPage = Number(request.query.page ?? 1);
    const search = String(request.query.search ?? '').trim();
    const where = {};
    const and = [];

    if (request.query.status) where.status = request.query.status;
    if (request.query.month) {
      const [year, month] = request.query.month.split('-').map(Number);
      const formatDate = date => date.toISOString().slice(0, 19).replace('T', ' ');
      const start = formatDate(new Date(Date.UTC(year, month - 1, 1)));
      const end = formatDate(new Date(Date.UTC(year, month, 1)));
      and.push({ OR: [
        { completedAt: { gte: start, lt: end } },
        { status: { in: ['待派工', '待驗收', '維修中'] }, createdAt: { gte: start, lt: end } }
      ] });
    }
    if (search) {
      and.push({ OR: [
        { orderNumber: { contains: search } },
        { repairCenter: { contains: search } },
        { vehicleLicensePlate: { contains: search } },
        { maintenanceItem: { contains: search } },
        { assignedManager: { is: { name: { contains: search } } } }
      ] });
    }
    if (and.length) where.AND = and;

    const total = await prisma.repairOrder.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, requestedPage), totalPages);
    const items = await prisma.repairOrder.findMany({
      where,
      include: repairOrderInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize
    });

    return {
      items: items.map(presentRepairOrder),
      pagination: { page, pageSize, total, totalPages }
    };
  });

  app.patch('/:id/accept', {
    preHandler: auth.authorize('work_orders.edit'),
    schema: {
      tags: ['Repair orders'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer', minimum: 1 } }
      }
    }
  }, async (request, reply) => {
    const id = Number(request.params.id);
    const order = await prisma.repairOrder.findUnique({ where: { id } });
    if (!order) return reply.code(404).send({ error: '找不到維修工單' });
    if (order.status !== '待驗收') return reply.code(409).send({ error: '只有待驗收工單可以驗收' });

    const updated = await prisma.repairOrder.update({
      where: { id },
      data: { status: '維修完畢', completedAt: completedTimestamp() },
      include: repairOrderInclude
    });
    return { item: presentRepairOrder(updated) };
  });

  app.post('/bulk-accept', {
    preHandler: auth.authorize('work_orders.edit'),
    schema: {
      tags: ['Repair orders'],
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
    const result = await prisma.repairOrder.updateMany({
      where: { id: { in: request.body.ids }, status: '待驗收' },
      data: { status: '維修完畢', completedAt: completedTimestamp() }
    });
    return { updatedCount: result.count };
  });
}
