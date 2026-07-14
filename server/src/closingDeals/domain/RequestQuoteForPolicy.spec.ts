import {CommandHandlingScenario} from "../infrastructure/Decider/Testing/CommandHandlingScenario";
import {QuoteForPolicyWasRequested} from "./QuoteForPolicyWasRequested";
import {RequestQuoteForPolicy} from "./RequestQuoteForPolicy";
import {runAssertionOnDecider} from "../infrastructure/Decider/Testing/runAssertionOnDecider";
import {LocalDate} from "@js-joda/core";
import {ClockForTesting} from "../../utils/clock";
import {makeQuoteDecider} from "./QuoteDecider";

describe("Request quote for a policy", () => {
    test("Happy path :-)", async () => {
        const clock = ClockForTesting(new Date("2026-10-28T14:47:23.000Z"));
        const scenario = new CommandHandlingScenario<QuoteForPolicyWasRequested, RequestQuoteForPolicy>();

        return scenario
            .when({
                "_named": "Request quote for policy!",
                "quote_id": "quote_11111111111111111111111111111111",
                "business_id": "biz_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "business_details": {
                    "legal_name": "TechCorp GmbH",
                    "country": "DE",
                    "industry": "TECHNOLOGY",
                    "revenue": 2_230_000,
                    "employee_count": 42,
                    "cyber_risk_factors": {
                        "has_mfa": true,
                        "has_encryption": true,
                        "cloud_provider": "GCP"
                    }
                },
                "coverage_request": {
                    "limits": {
                        "per_claim": 1_000_000,
                        "aggregate": 2_000_000
                    },
                    "deductible": 10_000,
                    "add_ons": [
                        "DATA_BREACH_RESPONSE"
                    ]
                },
                "term": {
                    "start_date": LocalDate.parse("2026-09-15"),
                    "end_date": LocalDate.parse("2027-09-15"),
                },
                "policy_type": "DNO",
                "request_from": {
                    "actor_id": "user_00700070007000700070007000700070",
                    "originating_user_agent": null,
                    "originating_ip": null,
                }
            })
            .then({
                "_named": "Quote for policy was requested",
                "quote_id": "quote_11111111111111111111111111111111",
                "business_id": "biz_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "policy_type": "DNO",
                "term": {
                    "start_date": LocalDate.parse("2026-09-15"),
                    "end_date": LocalDate.parse("2027-09-15"),
                },
                "coverage": {
                    "limits": {
                        "per_claim": 1_000_000,
                        "aggregate": 2_000_000
                    },
                    "deductible": 10_000,
                    "add_ons": [
                        "DATA_BREACH_RESPONSE"
                    ],
                    "exclusions": [
                    ]
                },
                "underwriting": {
                    "risk_score": 0.4,
                    "requirements": [
                        "FINANCIAL_STATEMENTS",
                        "ANNUAL_AUDIT",
                    ],
                    "exclusions": [],
                },
                "premium": {
                    "gross": 2_609.49,
                    "net": 2_192.85,
                    "taxes": [
                        {
                            "amount": 416.64,
                            "rate": 0.19,
                            "type": "VAT",
                        }
                    ],
                    "currency": "EUR"
                },
                "expiry_date": "2026-11-04T14:47:23.000Z",
                "requested_by": {
                    "actor_id": "user_00700070007000700070007000700070",
                    "originating_user_agent": null,
                    "originating_ip": null,
                },
                "requested_at": "2026-10-28T14:47:23.000Z",
            })
            .assertScenario(runAssertionOnDecider(makeQuoteDecider(clock)));
    });
});
