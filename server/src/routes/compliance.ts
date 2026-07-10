import { Router } from 'express';
import { generateId } from '../utils/idGenerator';
import { storage } from '../storage';
import { asyncHandler, badRequest, notFound } from '../middleware/errorHandler';
import {
  validateSchema,
  auditLogEntrySchema,
  auditLogQuerySchema,
  erasureRequestSchema,
  solvencyReportQuerySchema,
} from '../utils/validation';
import { clock } from '../utils/clock';
import { audit } from '../services/audit';
import { eraseEntity } from '../services/gdpr';
import { settleDuePayouts } from '../services/lifecycle';

const router = Router();

const round2 = (n: number) => Math.round(n * 100) / 100;

router.post('/audit', asyncHandler(async (req, res) => {
  const auditLogEntry = validateSchema(auditLogEntrySchema, req.body);
  const stored = await storage.createAuditLog(auditLogEntry);
  res.status(201).json(stored);
}));

router.get('/audit', asyncHandler(async (req, res) => {
  const { entity_type, entity_id, action, limit, offset } = validateSchema(auditLogQuerySchema, req.query);

  const entries = (await storage.listAuditLogs())
    .filter(e => (!entity_type || e.entity_type === entity_type)
      && (!entity_id || e.entity_id === entity_id)
      && (!action || e.action === action))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  res.json({ entries: entries.slice(offset, offset + limit), total: entries.length, limit, offset });
}));

router.get('/audit/:action_id', asyncHandler(async (req, res) => {
  const auditLog = await storage.getAuditLog(req.params.action_id);
  if (!auditLog) throw notFound('Audit log entry');
  res.json(auditLog);
}));

router.post('/gdpr/erasure', asyncHandler(async (req, res) => {
  const { entity_type, entity_id, requester_email, reason } = validateSchema(erasureRequestSchema, req.body);

  const erased = await eraseEntity(entity_type, entity_id);
  const requestId = generateId('erasure');

  await audit(req, 'GDPR_ERASURE_COMPLETED', 'GDPR_REQUEST', requestId, {
    subject_entity_type: entity_type,
    subject_entity_id: entity_id,
    requester_email,
    reason,
    erased,
  });

  res.status(201).json({ request_id: requestId, status: 'COMPLETED', erased_records: erased });
}));

router.get('/reports/solvency-ii', asyncHandler(async (req, res) => {
  const now = clock.now();
  const { period, year = now.getUTCFullYear() } = validateSchema(solvencyReportQuerySchema, req.query);
  if (year > now.getUTCFullYear()) throw badRequest('year cannot be in the future', 'year');

  let start: Date;
  let end: Date;
  if (period === 'ANNUAL') {
    start = new Date(Date.UTC(year, 0, 1));
    end = new Date(Date.UTC(year + 1, 0, 1));
  } else {
    const quarter = year === now.getUTCFullYear() ? Math.floor(now.getUTCMonth() / 3) : 3;
    start = new Date(Date.UTC(year, quarter * 3, 1));
    end = new Date(Date.UTC(year, quarter * 3 + 3, 1));
  }
  const asOf = end < now ? end : now;
  const until = (iso?: string | null) => !!iso && new Date(iso) < asOf;

  await settleDuePayouts();

  const premiums = (await storage.listPayments()).filter(p => until(p.completed_at)).reduce((s, p) => s + p.amount, 0);
  const refunds = (await storage.listRefunds()).filter(r => until(r.completed_at)).reduce((s, r) => s + r.amount, 0);
  const paidOut = (await storage.listPayouts())
    .filter(p => p.status === 'COMPLETED' && until(p.completed_at))
    .reduce((s, p) => s + p.amount, 0);
  const assets = premiums - refunds - paidOut;

  const allPayouts = await storage.listPayouts();
  const liabilities = (await storage.listClaims())
    .filter(c => until(c.created_at) && !['DENIED', 'PAID', 'CLOSED'].includes(c.status))
    .reduce((sum, c) => {
      if (c.adjudication && c.adjudication.decision !== 'DENY') {
        const settled = allPayouts
          .filter(p => p.claim_id === c.id && p.status === 'COMPLETED')
          .reduce((s, p) => s + p.amount, 0);
        return sum + Math.max((c.adjudication.payout_amount || 0) - settled, 0);
      }
      return sum + (c.estimated_loss || 0);
    }, 0);

  const report = {
    report_id: generateId('report'),
    period,
    year,
    period_start: start.toISOString().split('T')[0],
    period_end: new Date(end.getTime() - 1).toISOString().split('T')[0],
    data: {
      assets: round2(assets),
      liabilities: round2(liabilities),
      solvency_ratio: liabilities > 0 ? round2(assets / liabilities) : null,
    },
    generated_at: now.toISOString(),
  };

  await audit(req, 'SOLVENCY_REPORT_GENERATED', 'REPORT', report.report_id, {
    period,
    year,
    solvency_ratio: report.data.solvency_ratio,
  });

  res.json(report);
}));

export { router as complianceRouter };
