import {addDays, Clock} from "../../utils/clock";
import {StorageType} from "../../storage";
import {RequestQuoteForPolicy} from "../domain/RequestQuoteForPolicy";
import {
    assertCoverageAllowed,
    assertEuCountry,
    assess,
    buildPremium,
    profileFromBusinessDetails
} from "../../services/pricing";
import {badRequest} from "../../middleware/errorHandler";
import {Quote} from "../../types";
import {auditV2} from "../../services/audit";
import * as Either from "fp-ts/lib/Either";

export const configurePromiseToHandleRequestQuoteForPolicyUsingLegacySystem = (
    clock: Clock,
    storage: StorageType
) => {
    const QUOTE_VALIDITY_DAYS = 7;

    return async (command: RequestQuoteForPolicy) => {
        const quote_id = command.quote_id;
        const businessId = command.business_id;
        const business_details = command.business_details;
        const coverage_request = command.coverage_request;
        const term = {
            start_date: command.term.start_date.toString(),
            end_date: command.term.end_date.toString(),
        };
        const policy_type = command.policy_type;
        const originatingIp = command.request_from.originating_ip ?? undefined;
        const originatingUserAgent = command.request_from.originating_user_agent ?? undefined;
        const originatingActor = command.request_from.actor_id;

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
            limits: {...coverage_request.limits},
            deductible: coverage_request.deductible,
            add_ons: coverage_request.add_ons || [],
        };
        const assessment = assess(policy_type, profile, coverage);

        const now = clock.now();
        const quote: Quote = {
            id: quote_id,
            status: 'PENDING',
            premium: buildPremium(assessment.final_premium, business_details.country),
            coverage: {...coverage, exclusions: assessment.exclusions},
            underwriting: {
                risk_score: assessment.risk_score,
                requirements: assessment.requirements,
                exclusions: assessment.exclusions,
            },
            expiry_date: addDays(now, QUOTE_VALIDITY_DAYS).toISOString(),
            created_at: now.toISOString(),
            business_id: businessId,
            policy_type,
            term: {...term},
        };

        await storage.createQuote(quote);
        await storage.setRatingProfile(quote_id, profile);

        await auditV2(
            originatingIp,
            originatingUserAgent,
            originatingActor,
            'QUOTE_CREATED',
            'QUOTE',
            quote_id,
            clock.now(),
            {
                business_id: businessId,
                policy_type,
                premium: quote.premium.gross,
            }
        );

        return Either.right(undefined);
    }
}
