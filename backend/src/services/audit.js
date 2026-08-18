export function writeAudit(prisma, data) {
  return prisma.auditLog.create({
    data: {
      actorUserId: data.actorUserId ?? null,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId == null ? null : String(data.targetId),
      summary: data.summary,
      ip: data.ip ?? null
    }
  });
}

export function withAudit(prisma, operation, auditData) {
  return prisma.$transaction(async transaction => {
    const result = await operation(transaction);
    const data = typeof auditData === 'function' ? auditData(result) : auditData;
    await writeAudit(transaction, data);
    return result;
  });
}
