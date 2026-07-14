import {QuoteId} from "../../utils/QuoteId";
import {AddOn, Exclusion, PolicyType, Premium, UnderwritingRequirement} from "../../types";
import {LocalDate} from "@js-joda/core";

export type QuoteForPolicyWasRequested = {
    _named: "Quote for policy was requested",
    quote_id: QuoteId,
    business_id: string,
    policy_type: PolicyType,
    term: {
        start_date: LocalDate,
        end_date: LocalDate,
    },
    coverage: {
        limits: {
            per_claim: number,
            aggregate?: number,
        };
        deductible: number,
        add_ons: AddOn[],
        exclusions: Exclusion[],
    },
    underwriting: {
        risk_score: number,
        requirements: UnderwritingRequirement[],
        exclusions: Exclusion[],
    },
    premium: Premium,
    expiry_date: string,
    requested_by: {
        actor_id: string,
        originating_user_agent: string | null,
        originating_ip: string | null,
    },
    requested_at: string,
}
