import aiAnomalyAlertRoutes from './ai-anomaly-alerts.js';
import auditLogRoutes from './audit-logs.js';
import authRoutes from './auth.js';
import cleaningOrderRoutes from './cleaning-orders.js';
import damageAnnotationRoutes from './damage-annotations.js';
import departmentRoutes from './departments.js';
import dashboardRoutes from './dashboard.js';
import inboxRoutes from './inbox.js';
import permissionRoutes from './permissions.js';
import pointRoutes from './points.js';
import repairOrderRoutes from './repair-orders.js';
import roleRoutes from './roles.js';
import stationRoutes from './stations.js';
import userRoutes from './users.js';
import vehicleRoutes from './vehicles.js';

export default async function apiRoutes(app, options) {
  const routeOptions = { auth: options.auth, prisma: options.prisma };

  await app.register(authRoutes, { ...routeOptions, prefix: '/auth' });
  await app.register(inboxRoutes, { ...routeOptions, prefix: '/inbox' });
  await app.register(roleRoutes, { ...routeOptions, prefix: '/roles' });
  await app.register(permissionRoutes, { ...routeOptions, prefix: '/permissions' });
  await app.register(pointRoutes, { ...routeOptions, prefix: '/points' });
  await app.register(departmentRoutes, { ...routeOptions, prefix: '/departments' });
  await app.register(dashboardRoutes, { ...routeOptions, prefix: '/dashboard' });
  await app.register(userRoutes, { ...routeOptions, prefix: '/users' });
  await app.register(auditLogRoutes, { ...routeOptions, prefix: '/audit-logs' });
  await app.register(stationRoutes, { ...routeOptions, prefix: '/stations' });
  await app.register(vehicleRoutes, { ...routeOptions, prefix: '/vehicles' });
  await app.register(cleaningOrderRoutes, { ...routeOptions, prefix: '/cleaning-orders' });
  await app.register(damageAnnotationRoutes, { ...routeOptions, prefix: '/damage-annotations' });
  await app.register(aiAnomalyAlertRoutes, { ...routeOptions, prefix: '/ai-anomaly-alerts' });
  await app.register(repairOrderRoutes, { ...routeOptions, prefix: '/repair-orders' });

  app.setNotFoundHandler((request, reply) => reply.code(404).send({ error: '找不到 API' }));
}
