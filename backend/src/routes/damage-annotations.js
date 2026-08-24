const categories = ['dent', 'scratch', 'crack', 'broken', 'plateMissing', 'other'];
const imageSides = ['before', 'after'];

const annotationItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['imageSide', 'category', 'x', 'y', 'width', 'height'],
  properties: {
    imageSide: { type: 'string', enum: imageSides },
    category: { type: 'string', enum: categories },
    x: { type: 'number', minimum: 0, maximum: 1 },
    y: { type: 'number', minimum: 0, maximum: 1 },
    width: { type: 'number', exclusiveMinimum: 0, maximum: 1 },
    height: { type: 'number', exclusiveMinimum: 0, maximum: 1 }
  }
};

const routeSchema = {
  params: {
    type: 'object',
    required: ['caseId'],
    properties: { caseId: { type: 'string', minLength: 1, maxLength: 80 } }
  }
};

function text(value) {
  return String(value ?? '').trim();
}

function formatYolo(annotation) {
  const centerX = annotation.x + annotation.width / 2;
  const centerY = annotation.y + annotation.height / 2;
  return [centerX, centerY, annotation.width, annotation.height]
    .map(value => value.toFixed(6))
    .join(' ');
}

function presentAnnotation(item) {
  return {
    id: item.id,
    caseId: item.caseId,
    plateNumber: item.plateNumber,
    imageSide: item.imageSide,
    category: item.category,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    yoloCoordinates: item.yoloCoordinates,
    createdById: item.createdById,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function validateBounds(annotations) {
  for (const annotation of annotations) {
    if (annotation.x + annotation.width > 1 || annotation.y + annotation.height > 1) {
      return '框選範圍不可超出照片邊界';
    }
  }
  return null;
}

export default async function damageAnnotationRoutes(app, options) {
  const { auth, prisma } = options;

  app.get('/:caseId', {
    preHandler: auth.authorize('damage.view'),
    schema: {
      tags: ['Damage Annotations'],
      ...routeSchema
    }
  }, async request => {
    const items = await prisma.damageAnnotation.findMany({
      where: { caseId: request.params.caseId },
      orderBy: [{ imageSide: 'asc' }, { id: 'asc' }]
    });
    return {
      caseId: request.params.caseId,
      plateNumber: items[0]?.plateNumber ?? null,
      items: items.map(presentAnnotation)
    };
  });

  app.put('/:caseId', {
    preHandler: auth.authorize('damage.review'),
    schema: {
      tags: ['Damage Annotations'],
      ...routeSchema,
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['plateNumber', 'annotations'],
        properties: {
          plateNumber: { type: 'string', minLength: 1, maxLength: 20 },
          annotations: { type: 'array', maxItems: 100, items: annotationItemSchema }
        }
      }
    }
  }, async (request, reply) => {
    const caseId = text(request.params.caseId);
    const plateNumber = text(request.body.plateNumber);
    const annotations = request.body.annotations;
    const boundsError = validateBounds(annotations);
    if (boundsError) return reply.code(400).send({ error: boundsError });

    const items = await prisma.$transaction(async transaction => {
      await transaction.damageAnnotation.deleteMany({ where: { caseId } });
      if (annotations.length) {
        await transaction.damageAnnotation.createMany({
          data: annotations.map(annotation => ({
            caseId,
            plateNumber,
            imageSide: annotation.imageSide,
            category: annotation.category,
            x: annotation.x,
            y: annotation.y,
            width: annotation.width,
            height: annotation.height,
            yoloCoordinates: formatYolo(annotation),
            createdById: request.currentUser.id
          }))
        });
      }
      return transaction.damageAnnotation.findMany({
        where: { caseId },
        orderBy: [{ imageSide: 'asc' }, { id: 'asc' }]
      });
    });

    const actor = request.currentUser?.name ?? '使用者';
    await prisma.auditLog.create({
      data: {
        actorUserId: request.currentUser.id,
        action: 'damage.annotation.save',
        targetType: 'damage_annotation_case',
        targetId: caseId,
        summary: `${actor} 儲存車損標註 ${caseId}（${items.length} 個框選）`,
        ip: request.ip
      }
    });

    return {
      caseId,
      plateNumber,
      items: items.map(presentAnnotation),
      savedAt: new Date().toISOString()
    };
  });
}
