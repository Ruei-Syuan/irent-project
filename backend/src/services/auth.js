import crypto from 'node:crypto';
import { findUserByEmployeeNo, toPublicUser, userInclude } from '../repositories/user-repository.js';

const SESSION_HOURS = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derivedKey}`;
}

export async function verifyPassword(password, storedHash) {
  const [algorithm, salt, expectedHex] = String(storedHash).split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;
  const actual = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(key));
  });
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createAuthService(prisma, passwordVerifier = verifyPassword) {
  const loginFailures = new Map();

  return {
    async login(employeeNo, password, metadata = {}) {
      const normalizedEmployeeNo = String(employeeNo).trim().toUpperCase();
      const failureKey = `${metadata.ip ?? 'unknown'}:${normalizedEmployeeNo}`;
      const now = Date.now();
      const previous = loginFailures.get(failureKey);
      if (previous && previous.expiresAt > now && previous.count >= MAX_LOGIN_FAILURES) {
        const error = new Error('Too many login attempts');
        error.code = 'AUTH_RATE_LIMIT';
        throw error;
      }
      if (previous?.expiresAt <= now) loginFailures.delete(failureKey);

      const user = await findUserByEmployeeNo(prisma, normalizedEmployeeNo);
      if (!user || user.status !== 'active' || !await passwordVerifier(password, user.passwordHash)) {
        const current = loginFailures.get(failureKey);
        loginFailures.set(failureKey, {
          count: (current?.count ?? 0) + 1,
          expiresAt: current?.expiresAt ?? now + LOGIN_WINDOW_MS
        });
        return null;
      }
      loginFailures.delete(failureKey);

      const token = crypto.randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date().toISOString() }
        }),
        prisma.session.create({
          data: {
            userId: user.id,
            tokenHash: hashSessionToken(token),
            ip: metadata.ip ?? null,
            userAgent: metadata.userAgent ?? null,
            expiresAt
          }
        })
      ]);
      return { token, user: toPublicUser(user) };
    },

    async currentUser(token) {
      if (!token) return null;
      const session = await prisma.session.findFirst({
        where: {
          tokenHash: hashSessionToken(token),
          expiresAt: { gt: new Date().toISOString() },
          user: { status: 'active' }
        },
        include: { user: { include: userInclude } }
      });
      return session ? toPublicUser(session.user) : null;
    },

    async logout(token) {
      if (!token) return;
      await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
    }
  };
}
