import { idParams } from '../schemas/common.js';
import { withAudit } from '../services/audit.js';

const alertFields = {
  vehicleId: { type: 'integer', minimum: 1 },
  anomalyType: { type: 'string', minLength: 1 },
  confidence: { type: 'integer', minimum: 0, maximum: 100 },
  status: { type: 'string', enum: ['pending', 'review', 'resolved'] },
  detectedAt: { type: 'string', minLength: 1 }
};

const alertInclude = {
  vehicle: { include: { station: true } }
};

function text(value) {
  return String(value).trim();
}

async function vehicleExists(prisma, vehicleId) {
  return Boolean(await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { id: true }
  }));
}

export default async function aiAnomalyAlertRoutes(app, options) {
  const { auth, prisma } = options;

  app.get('/', {
    // preHandler: auth.authorize('dashboard.view'),
    schema: { tags: ['AI Anomaly Alerts'] }
  }, async () => ({
    items: await prisma.aiAnomalyAlert.findMany({
      include: alertInclude,
      orderBy: { detectedAt: 'desc' }
    })
  }));

  app.get('/:id', {
    // preHandler: auth.authorize('dashboard.view'),
    schema: { tags: ['AI Anomaly Alerts'], params: idParams }
  }, async (request, reply) => {
    const item = await prisma.aiAnomalyAlert.findUnique({
      where: { id: request.params.id },
      include: alertInclude
    });
    return item ? { item } : reply.code(404).send({ error: '找不到 AI 異常警示' });
  });

  app.post('/', {
    preHandler: auth.authorize('damage.review'),
    schema: {
      tags: ['AI Anomaly Alerts'],
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['vehicleId', 'anomalyType', 'confidence'],
        properties: alertFields
      }
    }
  }, async (request, reply) => {
    if (!(await vehicleExists(prisma, request.body.vehicleId))) {
      return reply.code(400).send({ error: '指定的車輛不存在' });
    }
    const anomalyType = text(request.body.anomalyType);
    if (!anomalyType) return reply.code(400).send({ error: '異常類型不可為空白' });

    const item = await withAudit(prisma, transaction => transaction.aiAnomalyAlert.create({
      data: {
        vehicleId: request.body.vehicleId,
        anomalyType,
        confidence: request.body.confidence,
        status: request.body.status ?? 'pending',
        ...(request.body.detectedAt ? { detectedAt: text(request.body.detectedAt) } : {})
      },
      include: alertInclude
    }), created => ({
      actorUserId: request.currentUser.id,
      action: 'damage.alert.create',
      targetType: 'ai_anomaly_alert',
      targetId: created.id,
      summary: `${request.currentUser.name} 新增 AI 異常警示「${created.anomalyType}」`,
      ip: request.ip
    }));
    return reply.code(201).send({ item });
  });

  app.patch('/:id', {
    preHandler: auth.authorize('damage.review'),
    schema: {
      tags: ['AI Anomaly Alerts'],
      params: idParams,
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: alertFields
      }
    }
  }, async (request, reply) => {
    const current = await prisma.aiAnomalyAlert.findUnique({ where: { id: request.params.id } });
    if (!current) return reply.code(404).send({ error: '找不到 AI 異常警示' });
    if (Object.hasOwn(request.body, 'vehicleId')
      && !(await vehicleExists(prisma, request.body.vehicleId))) {
      return reply.code(400).send({ error: '指定的車輛不存在' });
    }

    const data = { updatedAt: new Date().toISOString() };
    for (const field of ['vehicleId', 'confidence', 'status']) {
      if (Object.hasOwn(request.body, field)) data[field] = request.body[field];
    }
    for (const field of ['anomalyType', 'detectedAt']) {
      if (!Object.hasOwn(request.body, field)) continue;
      data[field] = text(request.body[field]);
      if (!data[field]) return reply.code(400).send({ error: '警示文字欄位不可為空白' });
    }

    const item = await withAudit(prisma, transaction => transaction.aiAnomalyAlert.update({
      where: { id: current.id },
      data,
      include: alertInclude
    }), updated => ({
      actorUserId: request.currentUser.id,
      action: 'damage.alert.update',
      targetType: 'ai_anomaly_alert',
      targetId: updated.id,
      summary: `${request.currentUser.name} 更新 AI 異常警示「${updated.anomalyType}」`,
      ip: request.ip
    }));
    return { item };
  });

  app.delete('/:id', {
    preHandler: auth.authorize('damage.review'),
    schema: { tags: ['AI Anomaly Alerts'], params: idParams }
  }, async (request, reply) => {
    const current = await prisma.aiAnomalyAlert.findUnique({ where: { id: request.params.id } });
    if (!current) return reply.code(404).send({ error: '找不到 AI 異常警示' });
    await withAudit(prisma, transaction => transaction.aiAnomalyAlert.delete({
      where: { id: current.id }
    }), {
      actorUserId: request.currentUser.id,
      action: 'damage.alert.delete',
      targetType: 'ai_anomaly_alert',
      targetId: current.id,
      summary: `${request.currentUser.name} 刪除 AI 異常警示「${current.anomalyType}」`,
      ip: request.ip
    });
    return reply.code(204).send();
  });
}
