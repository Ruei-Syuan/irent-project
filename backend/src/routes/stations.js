import { idParams } from '../schemas/common.js';
import { withAudit } from '../services/audit.js';

const stationFields = {
  code: { type: 'string', minLength: 1 },
  name: { type: 'string', minLength: 1 },
  city: { type: 'string', minLength: 1 },
  district: { type: 'string', minLength: 1 },
  address: { type: 'string', minLength: 1 },
  latitude: { anyOf: [{ type: 'number', minimum: -90, maximum: 90 }, { type: 'null' }] },
  longitude: { anyOf: [{ type: 'number', minimum: -180, maximum: 180 }, { type: 'null' }] },
  stationType: { type: 'string', enum: ['station', 'parking'] },
  status: { type: 'string', enum: ['active', 'inactive'] }
};

const stationInclude = {
  _count: { select: { vehicles: true } }
};

function presentStation(station) {
  const { _count, ...item } = station;
  return { ...item, vehicleCount: _count?.vehicles ?? 0 };
}

function text(value) {
  return String(value).trim();
}

export default async function stationRoutes(app, options) {
  const { auth, prisma } = options;

  app.get('/', {
    // preHandler: auth.authorize('fleet.view'),
    schema: { tags: ['Stations'] }
  }, async () => ({
    items: (await prisma.station.findMany({
      include: stationInclude,
      orderBy: [{ city: 'asc' }, { district: 'asc' }, { name: 'asc' }]
    })).map(presentStation)
  }));

  app.get('/:id', {
    // preHandler: auth.authorize('fleet.view'),
    schema: { tags: ['Stations'], params: idParams }
  }, async (request, reply) => {
    const station = await prisma.station.findUnique({
      where: { id: request.params.id },
      include: stationInclude
    });
    return station
      ? { item: presentStation(station) }
      : reply.code(404).send({ error: '找不到停靠站' });
  });

  app.post('/', {
    preHandler: auth.authorize('fleet.create'),
    schema: {
      tags: ['Stations'],
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'name', 'city', 'district', 'address'],
        properties: stationFields
      }
    }
  }, async (request, reply) => {
    const data = {
      code: text(request.body.code).toUpperCase(),
      name: text(request.body.name),
      city: text(request.body.city),
      district: text(request.body.district),
      address: text(request.body.address),
      latitude: request.body.latitude ?? null,
      longitude: request.body.longitude ?? null,
      stationType: request.body.stationType ?? 'station',
      status: request.body.status ?? 'active'
    };
    if ([data.code, data.name, data.city, data.district, data.address].some(value => !value)) {
      return reply.code(400).send({ error: '停靠站必填欄位不可為空白' });
    }

    const station = await withAudit(prisma, transaction => transaction.station.create({
      data,
      include: stationInclude
    }), created => ({
      actorUserId: request.currentUser.id,
      action: 'station.create',
      targetType: 'station',
      targetId: created.id,
      summary: `${request.currentUser.name} 新增停靠站「${created.name}」`,
      ip: request.ip
    }));
    return reply.code(201).send({ item: presentStation(station) });
  });

  app.patch('/:id', {
    preHandler: auth.authorize('fleet.edit'),
    schema: {
      tags: ['Stations'],
      params: idParams,
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: stationFields
      }
    }
  }, async (request, reply) => {
    const current = await prisma.station.findUnique({ where: { id: request.params.id } });
    if (!current) return reply.code(404).send({ error: '找不到停靠站' });

    const data = { updatedAt: new Date().toISOString() };
    for (const field of ['code', 'name', 'city', 'district', 'address']) {
      if (!Object.hasOwn(request.body, field)) continue;
      data[field] = text(request.body[field]);
      if (!data[field]) return reply.code(400).send({ error: '停靠站文字欄位不可為空白' });
    }
    if (data.code) data.code = data.code.toUpperCase();
    for (const field of ['latitude', 'longitude', 'stationType', 'status']) {
      if (Object.hasOwn(request.body, field)) data[field] = request.body[field];
    }

    const station = await withAudit(prisma, transaction => transaction.station.update({
      where: { id: current.id },
      data,
      include: stationInclude
    }), updated => ({
      actorUserId: request.currentUser.id,
      action: 'station.update',
      targetType: 'station',
      targetId: updated.id,
      summary: `${request.currentUser.name} 更新停靠站「${updated.name}」`,
      ip: request.ip
    }));
    return { item: presentStation(station) };
  });

  app.delete('/:id', {
    preHandler: auth.authorize('fleet.delete'),
    schema: { tags: ['Stations'], params: idParams }
  }, async (request, reply) => {
    const current = await prisma.station.findUnique({
      where: { id: request.params.id },
      include: stationInclude
    });
    if (!current) return reply.code(404).send({ error: '找不到停靠站' });
    if (current._count.vehicles > 0) {
      return reply.code(409).send({ error: '停靠站仍有關聯車輛，無法刪除' });
    }
    await withAudit(prisma, transaction => transaction.station.delete({
      where: { id: current.id }
    }), {
      actorUserId: request.currentUser.id,
      action: 'station.delete',
      targetType: 'station',
      targetId: current.id,
      summary: `${request.currentUser.name} 刪除停靠站「${current.name}」`,
      ip: request.ip
    });
    return reply.code(204).send();
  });
}
