import { withAudit } from '../services/audit.js';

const pointTypes = ['earn', 'redeem', 'adjustment'];
const listQuery = {
  type: 'object',
  additionalProperties: false,
  properties: {
    search: { type: 'string', default: '' },
    page: { type: 'integer', minimum: 1, default: 1 },
    pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
  }
};
const memberParams = {
  type: 'object',
  required: ['memberNo'],
  properties: { memberNo: { type: 'string', minLength: 1 } }
};
const pointFields = {
  type: 'object',
  additionalProperties: false,
  required: ['memberNo', 'points', 'type', 'reason'],
  properties: {
    memberNo: { type: 'string', minLength: 1 },
    points: { type: 'integer', not: { const: 0 } },
    type: { type: 'string', enum: pointTypes },
    reason: { type: 'string', minLength: 1, maxLength: 200 }
  }
};

function normalizeMemberNo(value) {
  return String(value).trim().toUpperCase();
}

function presentTransaction(transaction) {
  return {
    id: transaction.id,
    memberNo: transaction.customer?.memberNo,
    fullName: transaction.customer?.fullName,
    points: transaction.points,
    balanceAfter: transaction.balanceAfter,
    type: transaction.type,
    reason: transaction.reason,
    createdAt: transaction.createdAt
  };
}

function presentCustomer(customer) {
  const latest = customer.pointTransactions[0];
  return {
    id: customer.id,
    memberNo: customer.memberNo,
    fullName: customer.fullName,
    phone: customer.phone,
    pointsBalance: latest?.balanceAfter ?? 0,
    updatedAt: latest?.createdAt ?? customer.updatedAt
  };
}

function presentSummary(transactions) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  return {
    pointsBalance: transactions[0]?.balanceAfter ?? 0,
    totalEarned: transactions.reduce((total, item) => total + Math.max(item.points, 0), 0),
    totalRedeemed: transactions.reduce((total, item) => total + Math.max(-item.points, 0), 0),
    monthlyChange: transactions
      .filter(item => String(item.createdAt).slice(0, 7) === currentMonth)
      .reduce((total, item) => total + item.points, 0)
  };
}

export default async function pointRoutes(app, { auth, prisma }) {
  app.get('/', {
    // preHandler: auth.authorize('points.view'),
    schema: { tags: ['Points'], querystring: listQuery }
  }, async request => {
    const search = String(request.query.search ?? '').trim();
    const page = Number(request.query.page ?? 1);
    const pageSize = Number(request.query.pageSize ?? 20);
    const where = search ? {
      OR: [
        { memberNo: { contains: search } },
        { fullName: { contains: search } },
        { phone: { contains: search } }
      ]
    } : undefined;

    const [customers, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where,
        include: {
          pointTransactions: {
            orderBy: [{ id: 'desc' }],
            take: 1
          }
        },
        orderBy: { memberNo: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.customer.count({ where })
    ]);

    return {
      items: customers.map(presentCustomer),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    };
  });

  app.get('/:memberNo/transactions', {
    // preHandler: auth.authorize('points.view'),
    schema: { tags: ['Points'], params: memberParams }
  }, async (request, reply) => {
    const memberNo = normalizeMemberNo(request.params.memberNo);
    const customer = await prisma.customer.findUnique({
      where: { memberNo },
      include: {
        pointTransactions: {
          include: { customer: true },
          orderBy: [{ id: 'desc' }],
          take: 100
        }
      }
    });
    if (!customer) return reply.code(404).send({ error: '找不到會員' });

    return {
      customer: {
        id: customer.id,
        memberNo: customer.memberNo,
        fullName: customer.fullName,
        phone: customer.phone
      },
      summary: presentSummary(customer.pointTransactions),
      items: customer.pointTransactions.map(presentTransaction)
    };
  });

  app.post('/', {
    preHandler: auth.authorize('points.create'),
    schema: { tags: ['Points'], body: pointFields }
  }, async (request, reply) => {
    const memberNo = normalizeMemberNo(request.body.memberNo);
    const customer = await prisma.customer.findUnique({ where: { memberNo } });
    if (!customer) return reply.code(404).send({ error: '找不到會員' });

    try {
      const transaction = await withAudit(prisma, async database => {
        const latest = await database.customerPointTransaction.findFirst({
          where: { customerId: customer.id },
          orderBy: [{ id: 'desc' }]
        });
        const balanceAfter = (latest?.balanceAfter ?? 0) + request.body.points;
        if (balanceAfter < 0) {
          const error = new Error('點數餘額不足');
          error.code = 'POINTS_INSUFFICIENT';
          throw error;
        }

        return database.customerPointTransaction.create({
          data: {
            customerId: customer.id,
            points: request.body.points,
            balanceAfter,
            type: request.body.type,
            reason: request.body.reason.trim()
          },
          include: { customer: true }
        });
      }, created => ({
        actorUserId: request.currentUser.id,
        action: 'point.create',
        targetType: 'customer',
        targetId: customer.id,
        summary: `${request.currentUser.name}調整會員 ${customer.memberNo} 點數 ${created.points}`,
        ip: request.ip
      }));

      return reply.code(201).send({ item: presentTransaction(transaction) });
    } catch (error) {
      if (error.code === 'POINTS_INSUFFICIENT') {
        return reply.code(409).send({ error: error.message });
      }
      throw error;
    }
  });
}
