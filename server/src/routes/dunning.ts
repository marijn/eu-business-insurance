import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../middleware/errorHandler';
import { storage } from '../storage';
import { clock, addDays } from '../utils/clock';
import { audit } from '../services/audit';
import { refreshInvoice } from '../services/lifecycle';

const router = Router();

const MAX_DUNNING_LEVEL = 3;
const REMINDER_INTERVAL_DAYS = 7;

router.post('/:invoice_id', asyncHandler(async (req, res) => {
  const { invoice_id } = req.params;

  const existing = await storage.getInvoice(invoice_id);
  if (!existing) throw notFound('Invoice');
  const invoice = await refreshInvoice(existing);
  if (invoice.status !== 'OVERDUE') {
    throw badRequest(`Dunning only applies to OVERDUE invoices (invoice is ${invoice.status})`);
  }

  const previous = await storage.getDunning(invoice_id);
  if (previous && previous.level >= MAX_DUNNING_LEVEL) {
    throw badRequest('Final notice already sent; the invoice is due for collection');
  }

  const now = clock.now();
  const state = await storage.setDunning(invoice_id, {
    level: (previous?.level || 0) + 1,
    last_sent_at: now.toISOString(),
  });
  const nextReminder = state.level < MAX_DUNNING_LEVEL
    ? addDays(now, REMINDER_INTERVAL_DAYS).toISOString().split('T')[0]
    : null;

  await audit(req, 'DUNNING_TRIGGERED', 'INVOICE', invoice_id, {
    level: state.level,
    next_reminder_date: nextReminder,
  });

  res.json({
    message: state.level < MAX_DUNNING_LEVEL ? 'Payment reminder sent' : 'Final notice sent',
    dunning_level: state.level,
    next_reminder_date: nextReminder,
  });
}));

export { router as dunningRouter };
