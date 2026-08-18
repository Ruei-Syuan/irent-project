const userInclude = {
  department: true,
  role: {
    include: {
      rolePermissions: {
        include: { permission: true }
      }
    }
  }
};

export function toPublicUser(user) {
  return {
    id: user.id,
    employeeNo: user.employeeNo,
    name: user.name,
    email: user.email,
    phone: user.phone,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    role: { id: user.role.id, name: user.role.name },
    department: { id: user.department.id, name: user.department.name },
    permissions: user.role.rolePermissions.map(item => item.permission.code).sort()
  };
}

export function findUserByEmployeeNo(prisma, employeeNo) {
  return prisma.user.findUnique({
    where: { employeeNo },
    include: userInclude
  });
}

export function findUserById(prisma, id) {
  return prisma.user.findUnique({
    where: { id: Number(id) },
    include: userInclude
  });
}

export { userInclude };
