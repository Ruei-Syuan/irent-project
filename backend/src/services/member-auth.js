import crypto from 'node:crypto';
import { verifyPassword, hashPassword } from './auth.js';

const SESSION_HOURS = 8;
const SESSION_CACHE_MS = 5 * 1000;

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function publicMember(customer) {
  return {
    memberNo: customer.memberNo,
    fullName: customer.fullName,
    phone: customer.phone
  };
}

function normalizedIdentifier(value) {
  return String(value ?? '').trim();
}

export function createMemberAuthService(prisma, passwordVerifier = verifyPassword) {
  const sessionCache = new Map();

  async function findMember(identifier) {
    const value = normalizedIdentifier(identifier);
    return prisma.customer.findFirst({
      where: {
        OR: [
          { memberNo: value.toUpperCase() },
          { phone: value }
        ]
      }
    });
  }

  return {
    async register({ memberNo, fullName, phone, password }) {
      const customer = await prisma.customer.create({
        data: {
          memberNo: String(memberNo).trim().toUpperCase(),
          fullName: String(fullName).trim(),
          phone: String(phone).trim(),
          passwordHash: hashPassword(password)
        }
      });
      return publicMember(customer);
    },

    async login(identifier, password, metadata = {}) {
      const customer = await findMember(identifier);
      if (!customer?.passwordHash || !await passwordVerifier(password, customer.passwordHash)) return null;

      const token = crypto.randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
      await prisma.customerSession.create({
        data: {
          customerId: customer.id,
          tokenHash: hashSessionToken(token),
          ip: metadata.ip ?? null,
          userAgent: metadata.userAgent ?? null,
          expiresAt
        }
      });

      const member = publicMember(customer);
      sessionCache.set(hashSessionToken(token), { member, expiresAt: Date.now() + SESSION_CACHE_MS });
      return { token, member };
    },

    async currentMember(token) {
      if (!token) return null;
      const tokenHash = hashSessionToken(token);
      const cached = sessionCache.get(tokenHash);
      if (cached?.expiresAt > Date.now()) return cached.member;
      if (cached) sessionCache.delete(tokenHash);

      const session = await prisma.customerSession.findFirst({
        where: {
          tokenHash,
          expiresAt: { gt: new Date().toISOString() }
        },
        include: { customer: true }
      });
      if (!session) return null;

      const member = publicMember(session.customer);
      sessionCache.set(tokenHash, { member, expiresAt: Date.now() + SESSION_CACHE_MS });
      return member;
    },

    async logout(token) {
      if (!token) return;
      const tokenHash = hashSessionToken(token);
      sessionCache.delete(tokenHash);
      await prisma.customerSession.deleteMany({ where: { tokenHash } });
    }
  };
}
