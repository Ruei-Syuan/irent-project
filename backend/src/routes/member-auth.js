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

  app.post('/logout', async (request, reply) => {
    await service.logout(request.cookies.irent_member_session);
    reply.clearCookie('irent_member_session', { httpOnly: true, sameSite: 'strict', path: '/' });
    return reply.code(204).send();
  });
}
