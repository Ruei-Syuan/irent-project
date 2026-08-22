import { getFleetSummary, getFleetTrend, getRentalCountByCity } from '../services/dashboard-trend.js';

export default async function dashboardRoutes(app, options) {
  const { auth, prisma } = options;

  app.get('/fleet-summary', {
    preHandler: auth.authorize('dashboard.view'),
    schema: {
      tags: ['Dashboard'],
      response: {
        200: {
          type: 'object',
          required: [
            'totalVehicles',
            'availableVehicles',
            'rentedVehicles',
            'cleaningVehicles',
            'maintenanceVehicles'
          ],
          properties: {
            totalVehicles: { type: 'integer', minimum: 0 },
            availableVehicles: { type: 'integer', minimum: 0 },
            rentedVehicles: { type: 'integer', minimum: 0 },
            cleaningVehicles: { type: 'integer', minimum: 0 },
            maintenanceVehicles: { type: 'integer', minimum: 0 }
          }
        }
      }
    }
  }, async () => getFleetSummary(prisma));

  app.get('/fleet-trend', {
    preHandler: auth.authorize('dashboard.view'),
    schema: {
      tags: ['Dashboard'],
      response: {
        200: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              minItems: 7,
              maxItems: 7,
              items: {
                type: 'object',
                required: ['date', 'totalVehicles', 'rentedVehicles'],
                properties: {
                  date: { type: 'string', format: 'date' },
                  totalVehicles: { type: 'integer', minimum: 0 },
                  rentedVehicles: { type: 'integer', minimum: 0 }
                }
              }
            }
          }
        }
      }
    }
  }, async () => ({ items: await getFleetTrend(prisma) }));

  app.get('/rental-count-by-city', {
    preHandler: auth.authorize('dashboard.view'),
    schema: {
      tags: ['Dashboard'],
      response: {
        200: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: ['city', 'rentalCount'],
                properties: {
                  city: { type: 'string', minLength: 1 },
                  rentalCount: { type: 'integer', minimum: 0 }
                }
              }
            }
          }
        }
      }
    }
  }, async () => ({ items: await getRentalCountByCity(prisma) }));
}
