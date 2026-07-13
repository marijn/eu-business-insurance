import {QuoteId} from "../../utils/QuoteId";
import {BusinessDetails, CoverageRequest, PolicyType} from "../../types";
import {LocalDate} from "@js-joda/core";

export type RequestQuoteForPolicy = {
    _named: "Request quote for policy!"
    quote_id: QuoteId,
    business_id: string,
    business_details: BusinessDetails,
    coverage_request: CoverageRequest,
    term: {
        start_date: LocalDate,
        end_date: LocalDate,
    }
    policy_type: PolicyType,
    request_from: {
        actor_id: string,
        originating_user_agent: string | null,
        originating_ip: string | null,
    }
}
