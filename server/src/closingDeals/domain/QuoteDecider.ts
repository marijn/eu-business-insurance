import {addDays, Clock} from "../../utils/clock";
import {Decider} from "../infrastructure/Decider/Decider";
import {RequestQuoteForPolicy} from "./RequestQuoteForPolicy";
import {QuoteForPolicyWasRequested} from "./QuoteForPolicyWasRequested";
import {QuoteId} from "../../utils/QuoteId";
import {assess, buildPremium, profileFromBusinessDetails} from "../../services/pricing";

type DeciderState = {
    _named: "Initial state"
}

export const makeQuoteDecider = (clock: Clock): Decider<RequestQuoteForPolicy, DeciderState, QuoteForPolicyWasRequested, QuoteId> => {
    return {
        decide: async (command: RequestQuoteForPolicy, _: DeciderState): Promise<QuoteForPolicyWasRequested[]> => {
            switch (command._named) {
                case "Request quote for policy!": {
                    const now = clock.now();
                    const profile = profileFromBusinessDetails(command.business_details);
                    const coverage = {
                        limits: command.coverage_request.limits,
                        deductible: command.coverage_request.deductible,
                        add_ons: command.coverage_request.add_ons ?? [],
                    };
                    const assessment = assess(command.policy_type, profile, coverage);
                    const premium = buildPremium(assessment.final_premium, command.business_details.country);

                    const quoteForPolicyWasRequested: QuoteForPolicyWasRequested = {
                        _named: "Quote for policy was requested",
                        quote_id: command.quote_id,
                        business_id: command.business_id,
                        policy_type: command.policy_type,
                        term: command.term,
                        coverage: {
                            limits: coverage.limits,
                            deductible: coverage.deductible,
                            add_ons: coverage.add_ons,
                            exclusions: assessment.exclusions,
                        },
                        underwriting: {
                            risk_score: assessment.risk_score,
                            requirements: assessment.requirements,
                            exclusions: assessment.exclusions,
                        },
                        premium: premium,
                        expiry_date: addDays(now, 7).toISOString(),
                        requested_by: command.request_from,
                        requested_at: now.toISOString()
                    };

                    return [
                        quoteForPolicyWasRequested,
                    ];
                }
            }
        },
        evolve: (state: DeciderState, event: QuoteForPolicyWasRequested): DeciderState => {
            throw new Error("TODO: Implement me!");
        },
        identify: (command: RequestQuoteForPolicy): QuoteId => {
            throw new Error("TODO: Implement me!");
        },
        initialState: (): DeciderState => {
            return {
                _named: "Initial state",
            };
        }
    }
}
