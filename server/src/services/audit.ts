import { Request } from 'express';
import { storage } from '../storage';
import { AuditAction, AuditEntityType, AuditLogEntry } from '../types';
import { clock } from '../utils/clock';

export function actorId(req?: Request): string {
  return req?.user?.userId || 'system';
}

export async function audit(
  req: Request | undefined,
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string,
  metadata?: Record<string, unknown>
): Promise<AuditLogEntry> {
  return await storage.createAuditLog({
    action,
    entity_type: entityType,
    entity_id: entityId,
    user_id: actorId(req),
    timestamp: clock.now().toISOString(),
    metadata,
    ip_address: req?.ip,
    user_agent: req?.get('user-agent'),
  });
}
