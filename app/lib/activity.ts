import { prisma } from "@/app/lib/db/prisma";

interface LogActivityParams {
  tenantId: string;
  userId: string;
  userName?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  entityName?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function logActivity(params: LogActivityParams) {
  try {
    await prisma.activityLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        userName: params.userName ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        entityName: params.entityName ?? null,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
      },
    });
  } catch {
    // Activity logging is best-effort — never block the main operation
  }
}
