const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function aggregateFleetSummary(vehicles, rentedVehicleIds) {
  const rentedIds = new Set(rentedVehicleIds);
  const summary = {
    totalVehicles: vehicles.length,
    availableVehicles: 0,
    rentedVehicles: 0,
    cleaningVehicles: 0,
    maintenanceVehicles: 0
  };

  for (const vehicle of vehicles) {
    if (rentedIds.has(vehicle.id)) {
      summary.rentedVehicles += 1;
    } else if (vehicle.status === 'available') {
      summary.availableVehicles += 1;
    } else if (vehicle.status === 'cleaning') {
      summary.cleaningVehicles += 1;
    } else if (vehicle.status === 'maintenance') {
      summary.maintenanceVehicles += 1;
    }
  }

  return summary;
}

export async function getFleetSummary(prisma) {
  const [vehicles, activeRentals] = await Promise.all([
    prisma.vehicle.findMany({ select: { id: true, status: true } }),
    prisma.rental.findMany({
      where: { status: 'active' },
      select: { vehicleId: true }
    })
  ]);

  return aggregateFleetSummary(vehicles, activeRentals.map(rental => rental.vehicleId));
}

function taipeiDateParts(date) {
  const taipeiDate = new Date(date.getTime() + TAIPEI_OFFSET_MS);
  return {
    year: taipeiDate.getUTCFullYear(),
    month: taipeiDate.getUTCMonth(),
    day: taipeiDate.getUTCDate()
  };
}

function dateLabel(timestamp) {
  const date = new Date(timestamp + TAIPEI_OFFSET_MS);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-');
}

function sevenDayRange(now) {
  const { year, month, day } = taipeiDateParts(now);
  const todayStart = Date.UTC(year, month, day) - TAIPEI_OFFSET_MS;
  return {
    rangeStart: new Date(todayStart - 6 * DAY_MS).toISOString(),
    rangeEnd: new Date(todayStart + DAY_MS).toISOString()
  };
}

export function aggregateFleetTrend(rentals, totalVehicles, now = new Date()) {
  const { year, month, day } = taipeiDateParts(now);
  const todayStart = Date.UTC(year, month, day) - TAIPEI_OFFSET_MS;

  return Array.from({ length: 7 }, (_, index) => {
    const dayStart = todayStart - (6 - index) * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    const rentedVehicleIds = new Set();

    for (const rental of rentals) {
      const startedAt = Date.parse(rental.startedAt);
      const endedAt = rental.endedAt ? Date.parse(rental.endedAt) : Number.POSITIVE_INFINITY;
      if (startedAt < dayEnd && endedAt > dayStart) rentedVehicleIds.add(rental.vehicleId);
    }

    return {
      date: dateLabel(dayStart),
      totalVehicles,
      rentedVehicles: rentedVehicleIds.size
    };
  });
}

export async function getFleetTrend(prisma, now = new Date()) {
  const { rangeStart, rangeEnd } = sevenDayRange(now);

  const [totalVehicles, rentals] = await Promise.all([
    prisma.vehicle.count(),
    prisma.rental.findMany({
      where: {
        status: { not: 'cancelled' },
        startedAt: { lt: rangeEnd },
        OR: [{ endedAt: null }, { endedAt: { gt: rangeStart } }]
      },
      select: { vehicleId: true, startedAt: true, endedAt: true }
    })
  ]);

  return aggregateFleetTrend(rentals, totalVehicles, now);
}

export function aggregateRentalsByCity(rentals) {
  const counts = new Map();

  for (const rental of rentals) {
    const city = rental.vehicle.station.city;
    counts.set(city, (counts.get(city) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([city, rentalCount]) => ({ city, rentalCount }))
    .sort((left, right) => right.rentalCount - left.rentalCount
      || left.city.localeCompare(right.city, 'zh-Hant'));
}

export async function getRentalCountByCity(prisma, now = new Date()) {
  const { rangeStart, rangeEnd } = sevenDayRange(now);
  const rentals = await prisma.rental.findMany({
    where: {
      status: { not: 'cancelled' },
      startedAt: { gte: rangeStart, lt: rangeEnd }
    },
    select: {
      vehicle: {
        select: {
          station: { select: { city: true } }
        }
      }
    }
  });

  return aggregateRentalsByCity(rentals);
}
