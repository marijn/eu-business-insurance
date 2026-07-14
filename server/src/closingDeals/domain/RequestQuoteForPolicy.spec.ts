import {CommandHandlingScenario} from "../infrastructure/Decider/Testing/CommandHandlingScenario";
import {QuoteForPolicyWasRequested} from "./QuoteForPolicyWasRequested";
import {RequestQuoteForPolicy} from "./RequestQuoteForPolicy";
import {runAssertionOnDecider} from "../infrastructure/Decider/Testing/runAssertionOnDecider";
import {LocalDate} from "@js-joda/core";
import {Decider} from "../infrastructure/Decider/Decider";
import {addDays, Clock, ClockForTesting} from "../../utils/clock";
import {QuoteId} from "../../utils/QuoteId";
import {assess, buildPremium, profileFromBusinessDetails} from "../../services/pricing";

type DeciderState = {
    _named: "Initial state"
}

const makeQuoteDecider = (clock: Clock): Decider<RequestQuoteForPolicy, DeciderState, QuoteForPolicyWasRequested, QuoteId> => {
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
