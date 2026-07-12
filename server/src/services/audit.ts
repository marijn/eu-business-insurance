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
  return auditV2(
      req?.ip,
      req?.get('user-agent'),
      actorId(req),
      action,
      entityType,
      entityId,
      clock.now(),
      metadata
  );
}

export async function auditV2(
  originatingIp: string | undefined,
  originatingUserAgent: string | undefined,
  originatingActor: string,
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string,
  operationOccurredAt: Date,
  metadata?: Record<string, unknown>
): Promise<AuditLogEntry> {
  return await storage.createAuditLog({
    action,
    entity_type: entityType,
    entity_id: entityId,
    user_id: originatingActor,
    timestamp: operationOccurredAt.toISOString(),
    metadata,
    ip_address: originatingIp,
    user_agent: originatingUserAgent,
  });
}
