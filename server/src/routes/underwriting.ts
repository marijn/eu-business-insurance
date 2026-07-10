import { Router } from 'express';
import { asyncHandler, badRequest, notFound } from '../middleware/errorHandler';
import { authorize } from '../middleware/auth';
import { storage } from '../storage';
import { generateId } from '../utils/idGenerator';
import {
  validateSchema,
  underwritingRequestSchema,
  underwritingRequirementsRequestSchema,
  quoteUnderwritingUpdateSchema,
  underwritingRulesParamsSchema,
} from '../utils/validation';
import { Quote, QuoteUnderwriting, UnderwritingResponse } from '../types';
import { audit } from '../services/audit';
import { refreshQuote } from '../services/lifecycle';
import {
  assess,
  assertCoverageAllowed,
  assertEuCountry,
  baselineRequirements,
  buildPremium,
  getUnderwritingRules,
  profileFromUnderwritingData,
} from '../services/pricing';

const router = Router();

router.post('/assess', asyncHandler(async (req, res) => {
  const request = validateSchema(underwritingRequestSchema, req.body);
  assertEuCountry(request.country, 'country');

  const data = request.data as Record<string, any>;
  const profile = profileFromUnderwritingData(data, request.country);

  const coverage = data.coverage?.limits
    ? { limits: data.coverage.limits, deductible: data.coverage.deductible || 0, add_ons: data.coverage.add_ons || [] }
    : typeof data.coverage_amount === 'number'
      ? { limits: { per_claim: data.coverage_amount }, deductible: 0, add_ons: [] }
      : undefined;
  if (coverage) assertCoverageAllowed(coverage, 'data.coverage');

  const assessment = assess(request.policy_type, profile, coverage);
  const response: UnderwritingResponse = {
    assessment_id: generateId('assessment'),
    ...assessment,
  };

  await audit(req, 'UNDERWRITING_ASSESSED', 'UNDERWRITING', response.assessment_id!, {
    business_id: request.business_id,
    policy_type: request.policy_type,
    risk_score: response.risk_score,
    final_premium: response.final_premium,
  });

  res.json(response);
}));

router.post('/requirements', asyncHandler(async (req, res) => {
  const { policy_type, country } = validateSchema(underwritingRequirementsRequestSchema, req.body);
  res.json({ requirements: baselineRequirements(policy_type, country) });
}));

router.get('/rules/:country/:policy_type', asyncHandler(async (req, res) => {
  const { country, policy_type } = validateSchema(underwritingRulesParamsSchema, req.params);
  res.json({ rules: getUnderwritingRules(policy_type, country) });
}));

function quoteUnderwriting(quote: Quote): QuoteUnderwriting {
  return {
    quote_id: quote.id,
    status: quote.status,
    premium: quote.premium,
    risk_score: quote.underwriting.risk_score,
    requirements: quote.underwriting.requirements || [],
    exclusions: quote.coverage.exclusions || [],
  };
}

router.get('/:quote_id', asyncHandler(async (req, res) => {
  const quote = await storage.getQuote(req.params.quote_id);
  if (!quote) throw notFound('Quote');
  res.json(quoteUnderwriting(await refreshQuote(quote)));
}));

router.patch('/:quote_id', authorize('underwriting:write'), asyncHandler(async (req, res) => {
  const { quote_id } = req.params;
  const update = validateSchema(quoteUnderwritingUpdateSchema, req.body);

  const existing = await storage.getQuote(quote_id);
  if (!existing) throw notFound('Quote');
  const quote = await refreshQuote(existing);
  if (quote.status !== 'PENDING') {
    throw badRequest(`Quote is ${quote.status} and can no longer be underwritten`);
  }

  const premium = update.net_premium === undefined
    ? quote.premium
    : buildPremium(update.net_premium, (await storage.getRatingProfile(quote_id))!.country, quote.premium.currency);
  const risk_score = update.risk_score ?? quote.underwriting.risk_score;
  const requirements = update.requirements ?? quote.underwriting.requirements;
  const exclusions = update.exclusions ?? quote.coverage.exclusions;

  const updated = (await storage.updateQuote(quote_id, {
    premium,
    coverage: { ...quote.coverage, exclusions },
    underwriting: { risk_score, requirements, exclusions },
  }))!;

  await audit(req, 'UNDERWRITING_ADJUSTED', 'QUOTE', quote_id, {
    reason: update.reason,
    net_premium: { from: quote.premium.net, to: updated.premium.net },
    risk_score: { from: quote.underwriting.risk_score, to: risk_score },
    requirements: { from: quote.underwriting.requirements, to: requirements },
    exclusions: { from: quote.coverage.exclusions, to: exclusions },
  });

  res.json(quoteUnderwriting(updated));
}));

export { router as underwritingRouter };
