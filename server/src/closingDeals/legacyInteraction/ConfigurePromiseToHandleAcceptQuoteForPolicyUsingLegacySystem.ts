import {Clock} from "../../utils/clock";
import {StorageType} from "../../storage";
import {AcceptQuoteForPolicy} from "../domain/AcceptAQuoteForAPolicy";
import {effectiveDateToString} from "../../utils/EffectiveDate";
import * as Option from "fp-ts/lib/Option";
import {badRequest, notFound} from "../../middleware/errorHandler";
import {refreshQuote} from "../../services/lifecycle";
import {Policy} from "../../types";
import {auditV2} from "../../services/audit";
import {generateAgreementV2} from "../../services/agreements";
import * as Either from "fp-ts/lib/Either";
import {generateId} from "../../utils/idGenerator";
import {generateAgreementId} from "../../utils/AgreementId";

export const configurePromiseToHandleAcceptQuoteForPolicyUsingLegacySystem = (
    clock: Clock,
    storage: StorageType
) => {
    return async (command: AcceptQuoteForPolicy) => {
        const quote_id = command.quote_id;
        const effective_date = effectiveDateToString(Option.fromNullable(command.effective_date));
        const policyId = command.policy_id;
        const notes = command.notes;
        const originatingIp = command.accepted_by.originating_ip ?? undefined;
        const originatingUserAgent = command.accepted_by.originating_user_agent ?? undefined;
        const originatingActor = command.accepted_by.actor_id;

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
        await storage.updateQuote(quote_id, {status: 'ACCEPTED'});

        await auditV2(
            originatingIp,
            originatingUserAgent,
            originatingActor,
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

        const agreementId = generateAgreementId();

        await generateAgreementV2(
            agreementId,
            originatingIp,
            originatingUserAgent,
            originatingActor,
            clock,
            {
                policyId: policyId,
                templateId: `${policy.policy_type}_POLICY_v1`
            }
        );

        return Either.right(undefined);
    };
}
