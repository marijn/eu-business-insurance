import {Router} from 'express';
import {storage} from '../storage';
import {asyncHandler, notFound} from '../middleware/errorHandler';
import {paginate} from '../utils/validation';
import {Quote, QuoteList} from '../types';
import {refreshQuote} from '../services/lifecycle';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const { business_id, policy_type, status } = req.query;

  let quotes: Quote[] = [];
  for (const quote of await storage.listQuotes()) quotes.push(await refreshQuote(quote));
  if (business_id) quotes = quotes.filter(q => q.business_id === business_id);
  if (policy_type) quotes = quotes.filter(q => q.policy_type === policy_type);
  if (status) quotes = quotes.filter(q => q.status === status);

  const { page, total, limit, offset } = paginate(quotes, req.query);
  const result: QuoteList = { quotes: page, total, limit, offset };
  res.json(result);
}));

router.get('/:quote_id', asyncHandler(async (req, res) => {
  const quote = await storage.getQuote(req.params.quote_id);
  if (!quote) throw notFound('Quote');
  res.json(await refreshQuote(quote));
}));

export { router as quotesRouter };
