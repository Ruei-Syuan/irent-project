import { idParams } from '../schemas/common.js';
import { withAudit } from '../services/audit.js';

const nullableText = { anyOf: [{ type: 'string' }, { type: 'null' }] };
const vehicleFields = {
  licensePlate: { type: 'string', pattern: '^[A-Za-z]{3}-[0-9]{4}$' },
  model: { type: 'string', minLength: 1 },
  color: { type: 'string', minLength: 1 },
  stationId: { type: 'integer', minimum: 1 },
  status: { type: 'string', enum: ['available', 'cleaning', 'maintenance'] },
  healthScore: { type: 'integer', minimum: 0, maximum: 100 },
  todayMileage: { type: 'number', minimum: 0 },
  latestAnomaly: nullableText
};

const vehicleInclude = { station: true };

function text(value) {
  return String(value).trim();
}

async function stationExists(prisma, stationId) {
  return Boolean(await prisma.station.findUnique({
    where: { id: stationId },
    select: { id: true }
  }));
}

export default async function vehicleRoutes(app, options) {
  const { auth, prisma } = options;

  app.get('/', {
    preHandler: auth.authorize('fleet.view'),
    schema: { tags: ['Vehicles'] }
  }, async () => ({
    items: await prisma.vehicle.findMany({
      include: vehicleInclude,
      orderBy: { licensePlate: 'asc' }
    })
  }));

  app.get('/:id', {
    preHandler: auth.authorize('fleet.view'),
    schema: { tags: ['Vehicles'], params: idParams }
  }, async (request, reply) => {
    const item = await prisma.vehicle.findUnique({
      where: { id: request.params.id },
      include: vehicleInclude
    });
    return item ? { item } : reply.code(404).send({ error: '找不到車輛' });
  });

  app.post('/', {
    preHandler: auth.authorize('fleet.create'),
    schema: {
      tags: ['Vehicles'],
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['licensePlate', 'model', 'color', 'stationId'],
        properties: vehicleFields
      }
    }
  }, async (request, reply) => {
    if (!(await stationExists(prisma, request.body.stationId))) {
      return reply.code(400).send({ error: '指定的停靠站不存在' });
    }
    const data = {
      licensePlate: text(request.body.licensePlate).toUpperCase(),
      model: text(request.body.model),
      color: text(request.body.color),
      stationId: request.body.stationId,
      status: request.body.status ?? 'available',
      healthScore: request.body.healthScore ?? 100,
      todayMileage: request.body.todayMileage ?? 0,
      latestAnomaly: request.body.latestAnomaly == null ? null : text(request.body.latestAnomaly)
    };
    if (!data.model || !data.color) {
      return reply.code(400).send({ error: '車型與顏色不可為空白' });
    }

    const item = await withAudit(prisma, transaction => transaction.vehicle.create({
      data,
      include: vehicleInclude
    }), created => ({
      actorUserId: request.currentUser.id,
      action: 'fleet.create',
      targetType: 'vehicle',
      targetId: created.id,
      summary: `${request.currentUser.name} 新增車輛「${created.licensePlate}」`,
      ip: request.ip
    }));
    return reply.code(201).send({ item });
  });

  app.patch('/:id', {
    preHandler: auth.authorize('fleet.edit'),
    schema: {
      tags: ['Vehicles'],
      params: idParams,
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: vehicleFields
      }
    }
  }, async (request, reply) => {
    const current = await prisma.vehicle.findUnique({ where: { id: request.params.id } });
    if (!current) return reply.code(404).send({ error: '找不到車輛' });
    if (Object.hasOwn(request.body, 'stationId')
      && !(await stationExists(prisma, request.body.stationId))) {
      return reply.code(400).send({ error: '指定的停靠站不存在' });
    }

    const data = { updatedAt: new Date().toISOString() };
    for (const field of ['licensePlate', 'model', 'color']) {
      if (!Object.hasOwn(request.body, field)) continue;
      data[field] = text(request.body[field]);
      if (!data[field]) return reply.code(400).send({ error: '車輛文字欄位不可為空白' });
    }
    if (data.licensePlate) data.licensePlate = data.licensePlate.toUpperCase();
    for (const field of ['stationId', 'status', 'healthScore', 'todayMileage']) {
      if (Object.hasOwn(request.body, field)) data[field] = request.body[field];
    }
    if (Object.hasOwn(request.body, 'latestAnomaly')) {
      data.latestAnomaly = request.body.latestAnomaly == null
        ? null
        : text(request.body.latestAnomaly);
    }

    const item = await withAudit(prisma, transaction => transaction.vehicle.update({
      where: { id: current.id },
      data,
      include: vehicleInclude
    }), updated => ({
      actorUserId: request.currentUser.id,
      action: 'fleet.update',
      targetType: 'vehicle',
      targetId: updated.id,
      summary: `${request.currentUser.name} 更新車輛「${updated.licensePlate}」`,
      ip: request.ip
    }));
    return { item };
  });

  app.delete('/:id', {
    preHandler: auth.authorize('fleet.delete'),
    schema: { tags: ['Vehicles'], params: idParams }
  }, async (request, reply) => {
    const current = await prisma.vehicle.findUnique({ where: { id: request.params.id } });
    if (!current) return reply.code(404).send({ error: '找不到車輛' });
    await withAudit(prisma, transaction => transaction.vehicle.delete({
      where: { id: current.id }
    }), {
      actorUserId: request.currentUser.id,
      action: 'fleet.delete',
      targetType: 'vehicle',
      targetId: current.id,
      summary: `${request.currentUser.name} 刪除車輛「${current.licensePlate}」`,
      ip: request.ip
    });
    return reply.code(204).send();
  });
}
