import { idParams } from '../schemas/common.js';
import { withAudit } from '../services/audit.js';

const nullableText = { anyOf: [{ type: 'string' }, { type: 'null' }] };
const vehicleFields = {
  licensePlate: { type: 'string', pattern: '^[A-Za-z]{3}-[0-9]{4}$' },
  model: { type: 'string', minLength: 1 },
  color: { type: 'string', minLength: 1 },
  stationId: { type: 'integer', minimum: 1 },
  status: { type: 'string', enum: ['available', 'cleaning', 'maintenance'] },
  cabinCondition: { type: 'string', enum: ['clean', 'average', 'dirty'] },
  healthScore: { type: 'integer', minimum: 0, maximum: 100 },
  todayMileage: { type: 'number', minimum: 0 },
  latestAnomaly: nullableText
};

const vehicleInclude = { station: true };
const historyParams = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'integer', minimum: 1 },
    recordId: { type: 'integer', minimum: 1 }
  }
};
const customerField = {
  type: 'object',
  additionalProperties: false,
  required: ['memberNo', 'fullName', 'phone'],
  properties: {
    memberNo: { type: 'string', pattern: '^[A-Za-z0-9-]+$' },
    fullName: { type: 'string', minLength: 1 },
    phone: { type: 'string', pattern: '^09[0-9]{8}$' }
  }
};
const rentalHistoryFields = {
  customer: customerField,
  startedAt: { type: 'string', minLength: 1 },
  endedAt: { anyOf: [{ type: 'string', minLength: 1 }, { type: 'null' }] },
  status: { type: 'string', enum: ['active', 'completed', 'cancelled'] },
  rentalFee: { type: 'integer', minimum: 0 }
};
const serviceHistoryFields = {
  type: { type: 'string', enum: ['cleaning', 'maintenance'] },
  performedAt: { type: 'string', minLength: 1 },
  cost: { type: 'integer', minimum: 0 },
  note: { type: 'string' }
};

function text(value) {
  return String(value).trim();
}

function validCabinCondition(status, cabinCondition) {
  if (status === 'available') return cabinCondition === 'clean' || cabinCondition === 'average';
  if (status === 'cleaning') return cabinCondition === 'dirty';
  return true;
}

function dateTime(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function customerData(customer) {
  return {
    memberNo: text(customer.memberNo).toUpperCase(),
    fullName: text(customer.fullName),
    phone: text(customer.phone)
  };
}

function presentRental(rental) {
  return {
    id: rental.id,
    vehicleId: rental.vehicleId,
    startedAt: rental.startedAt,
    endedAt: rental.endedAt,
    status: rental.status,
    rentalFee: rental.rentalFee,
    createdAt: rental.createdAt,
    updatedAt: rental.updatedAt,
    customer: rental.customer
      ? {
        memberNo: rental.customer.memberNo,
        fullName: rental.customer.fullName,
        phone: rental.customer.phone
      }
      : null
  };
}

async function vehicleExists(prisma, vehicleId) {
  return Boolean(await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { id: true }
  }));
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

  app.get('/map-summary', {
    preHandler: auth.authorize('fleet.view'),
    schema: { tags: ['Vehicles'] }
  }, async () => {
    const vehicles = await prisma.vehicle.findMany({
      where: {
        station: {
          latitude: { not: null },
          longitude: { not: null }
        }
      },
      select: {
        id: true,
        licensePlate: true,
        healthScore: true,
        status: true,
        updatedAt: true,
        station: { select: { latitude: true, longitude: true } },
        _count: { select: { anomalyAlerts: true } }
      },
      orderBy: { licensePlate: 'asc' }
    });

    return {
      type: 'FeatureCollection',
      features: vehicles.map(vehicle => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [vehicle.station.longitude, vehicle.station.latitude]
        },
        properties: {
          id: vehicle.id,
          plateNumber: vehicle.licensePlate,
          latitude: vehicle.station.latitude,
          longitude: vehicle.station.longitude,
          healthScore: vehicle.healthScore,
          issueCount: vehicle._count.anomalyAlerts,
          status: vehicle.status,
          updatedAt: vehicle.updatedAt
        }
      }))
    };
  });

  app.get('/:id/history', {
    preHandler: auth.authorize('fleet.view'),
    schema: { tags: ['Vehicle history'], params: idParams }
  }, async (request, reply) => {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: request.params.id },
      select: { id: true, licensePlate: true, model: true }
    });
    if (!vehicle) return reply.code(404).send({ error: '找不到車輛' });

    const [rentals, services] = await Promise.all([
      prisma.rental.findMany({
        where: { vehicleId: vehicle.id },
        include: { customer: true },
        orderBy: { startedAt: 'desc' }
      }),
      prisma.vehicleServiceRecord.findMany({
        where: { vehicleId: vehicle.id },
        orderBy: { performedAt: 'desc' }
      })
    ]);

    return {
      vehicle,
      summary: {
        rentalFee: rentals.reduce((sum, rental) => sum + rental.rentalFee, 0),
        cleaningCost: services
          .filter(record => record.type === 'cleaning')
          .reduce((sum, record) => sum + record.cost, 0),
        maintenanceCost: services
          .filter(record => record.type === 'maintenance')
          .reduce((sum, record) => sum + record.cost, 0)
      },
      rentals: rentals.map(presentRental),
      services
    };
  });

  app.post('/:id/history/rentals', {
    preHandler: auth.authorize('fleet.edit'),
    schema: {
      tags: ['Vehicle history'],
      params: idParams,
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['customer', 'startedAt', 'rentalFee'],
        properties: rentalHistoryFields
      }
    }
  }, async (request, reply) => {
    if (!(await vehicleExists(prisma, request.params.id))) {
      return reply.code(404).send({ error: '找不到車輛' });
    }
    const startedAt = dateTime(request.body.startedAt);
    const endedAt = request.body.endedAt == null ? null : dateTime(request.body.endedAt);
    if (!startedAt || (request.body.endedAt != null && !endedAt)) {
      return reply.code(400).send({ error: '租借日期格式錯誤' });
    }
    if (endedAt && endedAt < startedAt) {
      return reply.code(400).send({ error: '還車日期不可早於租借日期' });
    }
    const customer = customerData(request.body.customer);
    if (!customer.fullName) return reply.code(400).send({ error: '租客姓名不可為空白' });

    const item = await withAudit(prisma, async transaction => {
      const renter = await transaction.customer.upsert({
        where: { memberNo: customer.memberNo },
        create: customer,
        update: { ...customer, updatedAt: new Date().toISOString() }
      });
      return transaction.rental.create({
        data: {
          vehicleId: request.params.id,
          customerId: renter.id,
          startedAt,
          endedAt,
          status: request.body.status ?? (endedAt ? 'completed' : 'active'),
          rentalFee: request.body.rentalFee
        },
        include: { customer: true }
      });
    }, created => ({
      actorUserId: request.currentUser.id,
      action: 'fleet.history.create',
      targetType: 'rental',
      targetId: created.id,
      summary: `${request.currentUser.name} 新增車輛租借歷程`,
      ip: request.ip
    }));
    return reply.code(201).send({ item: presentRental(item) });
  });

  app.patch('/:id/history/rentals/:recordId', {
    preHandler: auth.authorize('fleet.edit'),
    schema: {
      tags: ['Vehicle history'],
      params: { ...historyParams, required: ['id', 'recordId'] },
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: rentalHistoryFields
      }
    }
  }, async (request, reply) => {
    const current = await prisma.rental.findFirst({
      where: { id: request.params.recordId, vehicleId: request.params.id },
      include: { customer: true }
    });
    if (!current) return reply.code(404).send({ error: '找不到租借紀錄' });

    const data = { updatedAt: new Date().toISOString() };
    if (Object.hasOwn(request.body, 'startedAt')) {
      data.startedAt = dateTime(request.body.startedAt);
      if (!data.startedAt) return reply.code(400).send({ error: '租借日期格式錯誤' });
    }
    if (Object.hasOwn(request.body, 'endedAt')) {
      data.endedAt = request.body.endedAt == null ? null : dateTime(request.body.endedAt);
      if (request.body.endedAt != null && !data.endedAt) {
        return reply.code(400).send({ error: '還車日期格式錯誤' });
      }
    }
    for (const field of ['status', 'rentalFee']) {
      if (Object.hasOwn(request.body, field)) data[field] = request.body[field];
    }
    const nextStartedAt = data.startedAt ?? current.startedAt;
    const nextEndedAt = Object.hasOwn(data, 'endedAt') ? data.endedAt : current.endedAt;
    if (nextEndedAt && nextEndedAt < nextStartedAt) {
      return reply.code(400).send({ error: '還車日期不可早於租借日期' });
    }

    const item = await withAudit(prisma, async transaction => {
      if (request.body.customer) {
        const customer = customerData(request.body.customer);
        if (!customer.fullName) throw new Error('租客姓名不可為空白');
        const renter = await transaction.customer.upsert({
          where: { memberNo: customer.memberNo },
          create: customer,
          update: { ...customer, updatedAt: new Date().toISOString() }
        });
        data.customerId = renter.id;
      }
      return transaction.rental.update({
        where: { id: current.id },
        data,
        include: { customer: true }
      });
    }, updated => ({
      actorUserId: request.currentUser.id,
      action: 'fleet.history.update',
      targetType: 'rental',
      targetId: updated.id,
      summary: `${request.currentUser.name} 修改車輛租借歷程`,
      ip: request.ip
    }));
    return { item: presentRental(item) };
  });

  app.post('/:id/history/services', {
    preHandler: auth.authorize('fleet.edit'),
    schema: {
      tags: ['Vehicle history'],
      params: idParams,
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'performedAt', 'cost'],
        properties: serviceHistoryFields
      }
    }
  }, async (request, reply) => {
    if (!(await vehicleExists(prisma, request.params.id))) {
      return reply.code(404).send({ error: '找不到車輛' });
    }
    const performedAt = dateTime(request.body.performedAt);
    if (!performedAt) return reply.code(400).send({ error: '保養日期格式錯誤' });
    const item = await withAudit(prisma, transaction => transaction.vehicleServiceRecord.create({
      data: {
        vehicleId: request.params.id,
        type: request.body.type,
        performedAt,
        cost: request.body.cost,
        note: text(request.body.note ?? '')
      }
    }), created => ({
      actorUserId: request.currentUser.id,
      action: 'fleet.history.create',
      targetType: 'vehicle_service_record',
      targetId: created.id,
      summary: `${request.currentUser.name} 新增車輛保養歷程`,
      ip: request.ip
    }));
    return reply.code(201).send({ item });
  });

  app.patch('/:id/history/services/:recordId', {
    preHandler: auth.authorize('fleet.edit'),
    schema: {
      tags: ['Vehicle history'],
      params: { ...historyParams, required: ['id', 'recordId'] },
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: serviceHistoryFields
      }
    }
  }, async (request, reply) => {
    const current = await prisma.vehicleServiceRecord.findFirst({
      where: { id: request.params.recordId, vehicleId: request.params.id }
    });
    if (!current) return reply.code(404).send({ error: '找不到保養紀錄' });
    const data = { updatedAt: new Date().toISOString() };
    if (Object.hasOwn(request.body, 'performedAt')) {
      data.performedAt = dateTime(request.body.performedAt);
      if (!data.performedAt) return reply.code(400).send({ error: '保養日期格式錯誤' });
    }
    for (const field of ['type', 'cost']) {
      if (Object.hasOwn(request.body, field)) data[field] = request.body[field];
    }
    if (Object.hasOwn(request.body, 'note')) data.note = text(request.body.note);

    const item = await withAudit(prisma, transaction => transaction.vehicleServiceRecord.update({
      where: { id: current.id },
      data
    }), updated => ({
      actorUserId: request.currentUser.id,
      action: 'fleet.history.update',
      targetType: 'vehicle_service_record',
      targetId: updated.id,
      summary: `${request.currentUser.name} 修改車輛保養歷程`,
      ip: request.ip
    }));
    return { item };
  });

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
      cabinCondition: request.body.cabinCondition ?? 'clean',
      healthScore: request.body.healthScore ?? 100,
      todayMileage: request.body.todayMileage ?? 0,
      latestAnomaly: request.body.latestAnomaly == null ? null : text(request.body.latestAnomaly)
    };
    if (!data.model || !data.color) {
      return reply.code(400).send({ error: '車型與顏色不可為空白' });
    }
    if (!validCabinCondition(data.status, data.cabinCondition)) {
      return reply.code(400).send({ error: '車內狀況與車輛狀態不相符' });
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
    for (const field of ['stationId', 'status', 'cabinCondition', 'healthScore', 'todayMileage']) {
      if (Object.hasOwn(request.body, field)) data[field] = request.body[field];
    }
    if (Object.hasOwn(request.body, 'latestAnomaly')) {
      data.latestAnomaly = request.body.latestAnomaly == null
        ? null
        : text(request.body.latestAnomaly);
    }
    const nextStatus = data.status ?? current.status;
    const nextCabinCondition = data.cabinCondition ?? current.cabinCondition;
    if (!validCabinCondition(nextStatus, nextCabinCondition)) {
      return reply.code(400).send({ error: '車內狀況與車輛狀態不相符' });
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
