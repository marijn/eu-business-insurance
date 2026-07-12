import {LocalDate} from "@js-joda/core";
import {QuoteId} from "../../utils/QuoteId";
import {PolicyId} from "../../utils/PolicyId";

export type AcceptQuoteForPolicy = {
    _named: "Accept quote for policy!",
    quote_id: QuoteId,
    policy_id: PolicyId,
    effective_date: LocalDate | null,
    notes: string,
    accepted_by: {
        actor_id: string,
        originating_user_agent: string | null,
        originating_ip: string | null,
    }
}
