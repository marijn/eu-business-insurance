import {Server} from "http";
import app from "./app";
import {useBackend} from "./storage";
import {MemoryBackend} from "./storage/memory";

describe("Characterization test of quotes endpoint", () => {
    const portNumber = 48129;
    const host: string = `http://127.0.0.1:${portNumber}`;
    let server: Server;

    beforeAll(async () => {
        server = app.listen(portNumber);

        await new Promise((resolve) => server.once('listening', resolve));

        const address = server.address();

        if (address === null || typeof address === 'string') {
            throw new Error(`Expected server to be listening on port ":${portNumber}" but it does not.`);
        }
    });

    afterAll(async () => {
        await new Promise((resolve) => server.close(resolve));
    });

    beforeEach(() => useBackend(new MemoryBackend()));

    test("When we put something in `POST /quotes/:quote_id`, then we get something out", async () => {
        const actualQuoteResponse = await fetch(`${host}/v1/quotes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-KEY': 'test-api-key-1' },
            body: JSON.stringify({
                business_id: 'biz_11111111-1111-1111-1111-111111111111',
                policy_type: 'CYBER',
                coverage_request: {
                    limits: { per_claim: 1_000_000, aggregate: 2_000_000 },
                    deductible: 10_000,
                    add_ons: ['DATA_BREACH_RESPONSE'],
                },
                business_details: {
                    legal_name: 'TechCorp GmbH',
                    country: 'DE',
                    industry: 'TECHNOLOGY',
                    revenue: 5_000_000,
                    employee_count: 50,
                    cyber_risk_factors: { has_mfa: true, has_encryption: true, cloud_provider: 'AWS' },
                },
                term: { start_date: '2026-01-01', end_date: '2026-12-31' },
            }),
        });

        expect(actualQuoteResponse.status).toBe(201);

        const actualQuote = await actualQuoteResponse.json() as { id: string };

        const actualBindResponse = await fetch(`${host}/v1/quotes/${actualQuote.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-KEY': 'test-api-key-1' },
            body: JSON.stringify({
                effective_date: "2026-01-01",
                notes: '',
            }),
        });
        expect(actualBindResponse.status).toBe(201);

        const actual = await actualBindResponse.json();

        const expected = {
            id: expect.stringMatching(/^pol_/),
            business_id: 'biz_11111111-1111-1111-1111-111111111111',
            policy_type: 'CYBER',
            status: 'PENDING',
            premium: {
                gross: 7186.41,
                net: 6039,
                taxes: [
                    { type: 'VAT', rate: 0.19, amount: 1147.41 }
                ],
                currency: 'EUR',
            },
            coverage: {
                limits: { per_claim: 1_000_000, aggregate: 2_000_000 },
                deductible: 10_000,
                add_ons: ['DATA_BREACH_RESPONSE'],
                exclusions: [],
            },
            term: { start_date: '2026-01-01', end_date: '2026-12-31' },
            invoices: [],
            endorsements: [],
            agreement_id: expect.stringMatching(/^agreement_/),
            created_at: expect.any(String),
            updated_at: expect.any(String),
        };
        expect(actual).toMatchObject(expected);
    });

    test("Calling `POST /quotes/:quote_id` for a non-existent quote returns an error", async () => {
        const actualBindResponse = await fetch(`${host}/v1/quotes/quote_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-KEY': 'test-api-key-1' },
            body: JSON.stringify({
                effective_date: "2026-01-01",
                notes: '',
            }),
        });
        expect(actualBindResponse.status).toBe(404);

        const actual = await actualBindResponse.json();

        const expected = {
            code: "NOT_FOUND",
            message: "Quote not found",
        };
        expect(actual).toMatchObject(expected);
    });
});
