import { createMemberAuthService } from '../services/member-auth.js';

const memberNoPattern = '^[A-Za-z0-9-]+$';
const phonePattern = '^09[0-9]{8}$';
const passwordField = { type: 'string', minLength: 8, maxLength: 256 };

function memberPayload(member) {
  return { item: member };
}

function setMemberCookie(reply, token) {
  reply.setCookie('irent_member_session', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60,
    path: '/'
  });
}

// 一般會員認證 API：供前端一般會員登入、取得會員資料與登出使用。
// POST /api/v1/member-auth/register：建立一般會員，欄位為 memberNo、fullName、phone、password。
// POST /api/v1/member-auth/login：identifier 可填會員編號或手機號碼，另帶 password。
// GET  /api/v1/member-auth/me：使用登入後的 irent_member_session Cookie 取得目前會員。
// POST /api/v1/member-auth/logout：清除一般會員登入 Cookie。
const rentalRequestField = {
  type: 'object',
  additionalProperties: false,
  required: ['vehicleId', 'startedAt', 'endedAt', 'rentalFee'],
  properties: {
    vehicleId: { type: 'integer', minimum: 1 },
    startedAt: { type: 'string', minLength: 1 },
    endedAt: { type: 'string', minLength: 1 },
    rentalFee: { type: 'integer', minimum: 0 }
  }
};

function validDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function memberRentalPayload(rental) {
  const item = {
    id: rental.id,
    vehicleId: rental.vehicleId,
    startedAt: rental.startedAt,
    endedAt: rental.endedAt,
    status: rental.status,
    rentalFee: rental.rentalFee
  };
  if (rental.customer) {
    item.customer = {
      memberNo: rental.customer.memberNo,
      fullName: rental.customer.fullName,
      phone: rental.customer.phone
    };
  }
  if (rental.vehicle) {
    item.vehicle = {
      id: rental.vehicle.id,
      model: rental.vehicle.model,
      licensePlate: rental.vehicle.licensePlate,
      station: rental.vehicle.station ? { name: rental.vehicle.station.name } : null
    };
  }
  return item;
}

export default async function memberAuthRoutes(app, { prisma }) {
  const service = createMemberAuthService(prisma);

  app.post('/register', {
    schema: {
      tags: ['Member auth'],
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['memberNo', 'fullName', 'phone', 'password'],
        properties: {
          memberNo: { type: 'string', pattern: memberNoPattern, minLength: 3, maxLength: 32 },
          fullName: { type: 'string', minLength: 1, maxLength: 80 },
          phone: { type: 'string', pattern: phonePattern },
          password: passwordField
        }
      }
    }
  }, async (request, reply) => {
    const memberNo = request.body.memberNo.trim().toUpperCase();
    const phone = request.body.phone.trim();
    const existing = await prisma.customer.findFirst({
      where: { OR: [{ memberNo }, { phone }] },
      select: { id: true }
    });
    if (existing) return reply.code(409).send({ error: '會員編號或手機號碼已註冊' });

    const member = await service.register({ ...request.body, memberNo, phone });
    const login = await service.login(memberNo, request.body.password, {
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });
    setMemberCookie(reply, login.token);
    return reply.code(201).send(memberPayload(member));
  });

  app.post('/login', {
    schema: {
      tags: ['Member auth'],
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['identifier', 'password'],
        properties: {
          identifier: { type: 'string', minLength: 3, maxLength: 80 },
          password: passwordField
        }
      }
    }
  }, async (request, reply) => {
    const result = await service.login(request.body.identifier, request.body.password, {
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });
    if (!result) return reply.code(401).send({ error: '會員編號／手機號碼或密碼錯誤' });

    setMemberCookie(reply, result.token);
    return memberPayload(result.member);
  });

  app.get('/me', async (request, reply) => {
    const member = await service.currentMember(request.cookies.irent_member_session);
    if (!member) return reply.code(401).send({ error: '請先登入會員' });
    return memberPayload(member);
  });

  app.post('/rentals', {
    schema: { tags: ['Member rentals'], body: rentalRequestField }
  }, async (request, reply) => {
    const member = await service.currentMember(request.cookies.irent_member_session);
    if (!member) return reply.code(401).send({ error: '\u8acb\u5148\u767b\u5165\u6703\u54e1' });

    const startedAt = validDateTime(request.body.startedAt);
    const endedAt = validDateTime(request.body.endedAt);
    if (!startedAt || !endedAt || endedAt <= startedAt) {
      return reply.code(400).send({ error: '\u79df\u501f\u6642\u9593\u7121\u6548' });
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: request.body.vehicleId }, select: { id: true, status: true } });
    if (!vehicle) return reply.code(404).send({ error: '\u627e\u4e0d\u5230\u8eca\u8f1b' });
    if (vehicle.status !== 'available') return reply.code(409).send({ error: '\u8eca\u8f1b\u76ee\u524d\u7121\u6cd5\u79df\u501f' });

    const activeRental = await prisma.rental.findFirst({
      where: { vehicleId: vehicle.id, status: { in: ['pending_pickup', 'active'] } },
      select: { id: true }
    });
    if (activeRental) return reply.code(409).send({ error: '\u8eca\u8f1b\u5df2\u6709\u672a\u5b8c\u6210\u8a02\u55ae' });

    const customer = await prisma.customer.findUnique({
      where: { memberNo: member.memberNo },
      select: { id: true }
    });
    if (!customer) return reply.code(401).send({ error: '\u8acb\u5148\u767b\u5165\u6703\u54e1' });

    const item = await prisma.rental.create({
      data: {
        vehicleId: vehicle.id,
        customerId: customer.id,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        status: 'pending_pickup',
        rentalFee: request.body.rentalFee
      },
      include: { customer: true }
    });

    return reply.code(201).send({ item: memberRentalPayload(item) });
  });

  app.get('/rentals', async (request, reply) => {
    const member = await service.currentMember(request.cookies.irent_member_session);
    if (!member) return reply.code(401).send({ error: '\u8acb\u5148\u767b\u5165\u6703\u54e1' });

    const customer = await prisma.customer.findUnique({ where: { memberNo: member.memberNo }, select: { id: true } });
    if (!customer) return reply.code(401).send({ error: '\u8acb\u5148\u767b\u5165\u6703\u54e1' });

    const items = await prisma.rental.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      include: { vehicle: { include: { station: true } } }
    });
    return { items: items.map(memberRentalPayload) };
  });

  app.patch('/rentals/:rentalId/status', {
    schema: {
      tags: ['Member rentals'],
      params: { type: 'object', required: ['rentalId'], properties: { rentalId: { type: 'integer', minimum: 1 } } },
      body: { type: 'object', additionalProperties: false, required: ['status'], properties: { status: { type: 'string', enum: ['active', 'completed'] } } }
    }
  }, async (request, reply) => {
    const member = await service.currentMember(request.cookies.irent_member_session);
    if (!member) return reply.code(401).send({ error: '\u8acb\u5148\u767b\u5165\u6703\u54e1' });

    const customer = await prisma.customer.findUnique({ where: { memberNo: member.memberNo }, select: { id: true } });
    if (!customer) return reply.code(401).send({ error: '\u8acb\u5148\u767b\u5165\u6703\u54e1' });

    const rental = await prisma.rental.findFirst({
      where: { id: request.params.rentalId, customerId: customer.id },
      select: { id: true, status: true }
    });
    if (!rental) return reply.code(404).send({ error: '\u627e\u4e0d\u5230\u8a02\u55ae' });

    const expectedStatus = request.body.status === 'active' ? 'pending_pickup' : 'active';
    if (rental.status !== expectedStatus) return reply.code(409).send({ error: '\u8a02\u55ae\u72c0\u614b\u7121\u6cd5\u66f4\u65b0' });

    const item = await prisma.rental.update({
      where: { id: rental.id },
      data: { status: request.body.status },
      include: { vehicle: { include: { station: true } } }
    });
    return { item: memberRentalPayload(item) };
  });
  app.post('/logout', async (request, reply) => {
    await service.logout(request.cookies.irent_member_session);
    reply.clearCookie('irent_member_session', { httpOnly: true, sameSite: 'strict', path: '/' });
    return reply.code(204).send();
  });
}
