import { Router } from 'express';
import {GenerateId, generateId} from '../utils/idGenerator';
import { storage } from '../storage';
import { asyncHandler, badRequest, notFound } from '../middleware/errorHandler';
import { validateSchema, quoteRequestSchema, bindQuoteRequestSchema, paginate } from '../utils/validation';
import { Policy, Quote, QuoteList, QuoteRequest } from '../types';
import {clock, addDays, Clock} from '../utils/clock';
import {actorId, audit, auditV2} from '../services/audit';
import { refreshQuote } from '../services/lifecycle';
import { generateAgreement } from '../services/agreements';
import {
  assess,
  assertCoverageAllowed,
  assertEuCountry,
  buildPremium,
  profileFromBusinessDetails,
} from '../services/pricing';
import {isQuoteId, QuoteId} from "../utils/QuoteId";

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

/**
 * Still not a pure function because it relies on the global `storage` to be available.
 */
const makeQuotesRouterV2 = (
  clock: Clock,
  generateId: GenerateId
) => {
  const router = Router();

  const QUOTE_VALIDITY_DAYS = 7;

  router.post('/', asyncHandler(async (req, res) => {
    const quoteRequest: QuoteRequest = validateSchema(quoteRequestSchema, req.body);
    const { business_details, coverage_request, term, policy_type } = quoteRequest;

    assertEuCountry(business_details.country, 'business_details.country');
    assertCoverageAllowed(coverage_request, 'coverage_request');
    if (term.start_date >= term.end_date) {
      throw badRequest('Term end_date must be after start_date', 'term.end_date');
    }
    if (policy_type === 'WORKERS_COMP' && !business_details.employee_count) {
      throw badRequest('employee_count is required for WORKERS_COMP', 'business_details.employee_count');
    }

    const profile = profileFromBusinessDetails(business_details);
    const coverage = {
      limits: { ...coverage_request.limits },
      deductible: coverage_request.deductible,
      add_ons: coverage_request.add_ons || [],
    };
    const assessment = assess(policy_type, profile, coverage);

    const now = clock.now();
    const quote: Quote = {
      id: generateId('quote'),
      status: 'PENDING',
      premium: buildPremium(assessment.final_premium, business_details.country),
      coverage: { ...coverage, exclusions: assessment.exclusions },
      underwriting: {
        risk_score: assessment.risk_score,
        requirements: assessment.requirements,
        exclusions: assessment.exclusions,
      },
      expiry_date: addDays(now, QUOTE_VALIDITY_DAYS).toISOString(),
      created_at: now.toISOString(),
      business_id: quoteRequest.business_id,
      policy_type,
      term: { ...term },
    };

    await storage.createQuote(quote);
    await storage.setRatingProfile(quote.id, profile);

    await audit(
      req,
      'QUOTE_CREATED',
      'QUOTE',
      quote.id,
      {
        business_id: quoteRequest.business_id,
        policy_type,
        premium: quote.premium.gross,
      }
    );

    res.status(201).json(quote);
  }));

  /**
   * @todo Developers call it `Bind a Quote to a Policy` but experts refer to this as `Accept a Quote for a Policy`
   */
  router.post('/:quote_id', asyncHandler(async (req, res) => {
    const policyId = generateId('policy');
    const urlParameters = req.params;
    const maybe_quote_id = urlParameters.quote_id;

    if (!isQuoteId(maybe_quote_id)) {
      // We are being cautious by not halting anything of the old workflow, but we are starting to log the problem
      console.error(`Provided quote ID ("${maybe_quote_id}") did not match expected format`);
    }

    const quote_id = maybe_quote_id as QuoteId;
    const validated_request = validateSchema(bindQuoteRequestSchema, req.body ?? {});
    const effective_date = validated_request.effective_date;
    const notes = validated_request.notes;

    const existing = await storage.getQuote(quote_id);
    if (!existing) throw notFound('Quote');
    const quote = await refreshQuote(existing);
    // TODO: Cover this branch in a test
    if (quote.status !== 'PENDING') {
      throw badRequest(`Quote is ${quote.status} and can no longer be bound`);
    }

    const term = {
      start_date: effective_date || quote.term!.start_date,
      end_date: quote.term!.end_date,
    };
    if (term.start_date < quote.term!.start_date || term.start_date >= term.end_date) {
      throw badRequest(
          `effective_date must be within the quoted term ${quote.term!.start_date}..${quote.term!.end_date}`,
          'effective_date'
      );
    }

    const now = clock.now().toISOString();
    const policy: Policy = {
      id: policyId,
      business_id: quote.business_id!,
      policy_type: quote.policy_type!,
      status: 'PENDING',
      premium: quote.premium,
      coverage: quote.coverage,
      term,
      invoices: [],
      endorsements: [],
      created_at: now,
      updated_at: now,
    };

    await storage.createPolicy(policy);
    const ratingProfile = await storage.getRatingProfile(quote.id);
    await storage.setRatingProfile(policyId, ratingProfile!);
    await storage.updateQuote(quote_id, { status: 'ACCEPTED' });

    await auditV2(
      req?.ip,
      req?.get('user-agent'),
      actorId(req),
      'POLICY_BOUND',
      'POLICY',
      policyId,
      clock.now(),
      {
        quote_id,
        premium: policy.premium.gross,
        notes,
      }
    );

    await generateAgreement(
      req,
      {
        policyId: policyId,
        templateId: `${policy.policy_type}_POLICY_v1`
      }
    );

    const finalPolicy = await storage.getPolicy(policyId);

    res.status(201).json(finalPolicy);
  }));

  return router;
}

export { router as quotesRouter, makeQuotesRouterV2 };
