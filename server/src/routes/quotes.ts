import {Router} from 'express';
import {GenerateId} from '../utils/idGenerator';
import {storage, StorageType} from '../storage';
import {asyncHandler, badRequest, notFound} from '../middleware/errorHandler';
import {bindQuoteRequestSchema, paginate, quoteRequestSchema, validateSchema} from '../utils/validation';
import {Quote, QuoteList, QuoteRequest} from '../types';
import {addDays, Clock} from '../utils/clock';
import {actorId, auditV2} from '../services/audit';
import {refreshQuote} from '../services/lifecycle';
import {
  assertCoverageAllowed,
  assertEuCountry,
  assess,
  buildPremium,
  profileFromBusinessDetails,
} from '../services/pricing';
import {AcceptQuoteForPolicy} from "../closingDeals/domain/AcceptAQuoteForAPolicy";
import {isQuoteId, QuoteId} from "../utils/QuoteId";
import * as Option from "fp-ts/Option";
import {isPolicyId} from "../utils/PolicyId";
import {effectiveDateOf} from "../utils/EffectiveDate";
import {
  configurePromiseToHandleAcceptQuoteForPolicyUsingLegacySystem
} from "../closingDeals/legacyInteration/PromiseToHandleAcceptQuoteForPolicyUsingLegacySystem";

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
  storage: StorageType,
  generateId: GenerateId
) => {
  const router = Router();

  const QUOTE_VALIDITY_DAYS = 7;

  const commandHandler = configurePromiseToHandleAcceptQuoteForPolicyUsingLegacySystem(clock, storage);

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

    await auditV2(
      req?.ip,
      req?.get('user-agent'),
      actorId(req),
      'QUOTE_CREATED',
      'QUOTE',
      quote.id,
      clock.now(),
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

    if (!isPolicyId(policyId)) {
      // The types say this could theoretically happen, but in practice it cannot, because `generateId()` is under our
      // control and honors the expected format.
      // That is why I find throwing an Error an acceptable trade-off, even though that is a breaking change
      throw new Error(`Generated policy ID ("${policyId}") did not match expected format`);
    }

    const quote_id = maybe_quote_id as QuoteId;
    const validated_request = validateSchema(bindQuoteRequestSchema, req.body ?? {});
    const effective_date = validated_request.effective_date;
    const notes = validated_request.notes || "";
    // TODO: We should have a debate about the model that powers the audit log.
    //       In the absence of more domain-oriented actor information, this data is considered to be part of the model.
    //       Over time the company may be better served by moving this entire process out of the main process, by basing
    //       it on message metadata.
    const originatingIp = req?.ip;
    const originatingUserAgent = req?.get('user-agent');
    const originatingActor = actorId(req);

    const command: AcceptQuoteForPolicy = {
      _named: "Accept quote for policy!",
      quote_id: quote_id,
      policy_id: policyId,
      // TODO: Let's research what the default effective_date is when no effective_date is provided and set that here,
      //       rather than somewhere deeper in the stack.
      //       In order to keep progress we ignore it for now, and won't address it immediately, unless it hurts us.
      effective_date: Option.toNullable(effectiveDateOf(effective_date)),
      notes: notes,
      accepted_by: {
        actor_id: originatingActor,
        originating_user_agent: originatingUserAgent ?? null,
        originating_ip: originatingIp ?? null
      }
    };

    // Things get worse before they get better, it returns Promise<Either<never, void>>
    // Right now inspecting doesn't bring any value.
    // Over time this should be migrated to TaskEither<AnyAcceptQuoteError, void> to model all error states.
    await commandHandler(command);

    const finalPolicy = await storage.getPolicy(policyId);

    res.status(201).json(finalPolicy);
  }));

  return router;
}

export { router as quotesRouter, makeQuotesRouterV2 };
